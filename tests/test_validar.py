import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "scripts"))

from validar import validar  # noqa: E402
import atualizar_indice  # noqa: E402

FIXTURE = RAIZ / "tests" / "fixtures" / "chega" / "2026-01-02.json"
NOME = "data/relatorios/chega/2026-01-02.json"


def base():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


class TestValidar(unittest.TestCase):
    def assertFalha(self, rel, trecho, nome=NOME):
        erros = validar(rel, nome)
        self.assertTrue(any(trecho in e for e in erros), f"esperava '{trecho}' em {erros}")

    def test_valido(self):
        self.assertEqual(validar(base(), NOME), [])

    def test_nome_ficheiro(self):
        self.assertTrue(validar(base(), "data/relatorios/chega/2026-01-03.json"))

    def test_partido_desconhecido(self):
        r = base()
        r["partido"] = "outro"
        self.assertFalha(r, "desconhecido")

    def test_partido_sem_campo(self):
        r = base()
        del r["partido"]
        self.assertFalha(r, "partido")

    def test_partido_diferente_da_pasta(self):
        self.assertFalha(base(), "pasta 'psd'", "data/relatorios/psd/2026-01-02.json")

    def test_demasiadas_afirmacoes(self):
        r = base()
        extra = [dict(r["afirmacoes"][1], id=f"f{i}") for i in range(3, 18)]
        r["afirmacoes"] += extra
        self.assertFalha(r, "mais de 15")

    def test_veredicto_invalido(self):
        r = base()
        r["afirmacoes"][0]["veredicto"] = "meia_verdade"
        self.assertFalha(r, "veredicto")

    def test_factual_sem_veredicto(self):
        r = base()
        r["afirmacoes"][0]["veredicto"] = None
        self.assertFalha(r, "exige veredicto")

    def test_poucas_evidencias(self):
        r = base()
        r["afirmacoes"][0]["evidencias"].pop()
        self.assertFalha(r, "2 evidências")

    def test_nao_verificavel_dispensa_evidencias(self):
        r = base()
        f = r["afirmacoes"][0]
        f["veredicto"] = "nao_verificavel"
        f["evidencias"] = []
        r["estatisticas"]["por_veredicto"]["falso"] = 0
        r["estatisticas"]["por_veredicto"]["nao_verificavel"] = 1
        self.assertEqual(validar(r, NOME), [])

    def test_promessa_com_veredicto(self):
        r = base()
        r["afirmacoes"][1]["veredicto"] = "falso"
        self.assertFalha(r, "não leva veredicto")

    def test_acontecimento_sem_fonte(self):
        r = base()
        r["acontecimentos"][0]["fontes"] = []
        self.assertFalha(r, "pelo menos uma fonte")

    def test_url_invalido(self):
        r = base()
        r["afirmacoes"][0]["origem"]["url"] = "pesquisa google"
        self.assertFalha(r, "URL inválido")

    def test_contagens_erradas(self):
        r = base()
        r["estatisticas"]["n_afirmacoes"] = 5
        self.assertFalha(r, "n_afirmacoes")
        r = base()
        r["estatisticas"]["por_veredicto"]["falso"] = 0
        self.assertFalha(r, "por_veredicto")

    def test_ids_repetidos(self):
        r = base()
        r["afirmacoes"][1]["id"] = "f1"
        self.assertFalha(r, "repetido")

    def test_texto_vazio(self):
        r = base()
        r["resumo"] = "   "
        self.assertFalha(r, "resumo")

    def test_fuso_obrigatorio(self):
        r = base()
        r["gerado_em"] = "2026-01-02T06:50:00"
        self.assertFalha(r, "fuso")


class TestIndice(unittest.TestCase):
    def test_por_partido_exclui_invalidos_e_ordena(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "chega").mkdir()
            (p / "ps").mkdir()
            (p / "chega" / "2026-01-02.json").write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")
            r = base()
            r["data"] = "2026-01-03"
            (p / "chega" / "2026-01-03.json").write_text(json.dumps(r), encoding="utf-8")
            ps = base()
            ps["partido"] = "ps"
            (p / "ps" / "2026-01-02.json").write_text(json.dumps(ps), encoding="utf-8")
            mau = copy.deepcopy(ps)
            mau["data"] = "2026-01-04"
            mau["resumo"] = ""
            (p / "ps" / "2026-01-04.json").write_text(json.dumps(mau), encoding="utf-8")
            indice, rejeitados = atualizar_indice.construir(p)
            self.assertEqual([x["data"] for x in indice["partidos"]["chega"]], ["2026-01-03", "2026-01-02"])
            self.assertEqual([x["data"] for x in indice["partidos"]["ps"]], ["2026-01-02"])
            self.assertEqual(indice["partidos"]["psd"], [])
            self.assertEqual(indice["partidos"]["ps"][0]["ficheiro"], "data/relatorios/ps/2026-01-02.json")
            self.assertEqual(rejeitados, ["ps/2026-01-04.json"])


if __name__ == "__main__":
    unittest.main()
