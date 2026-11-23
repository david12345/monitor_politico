#!/usr/bin/env python3
"""Valida relatórios diários do Monitor Político.

Uso: python3 scripts/validar.py data/relatorios/<partido>/2026-11-22.json [...]
Sai com 1 se algum relatório falhar. Só biblioteca padrão.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

CATEGORIAS = {"parlamento", "campanha", "declaracao", "justica", "interno", "media", "outro"}
TIPOS = {"factual", "promessa", "opiniao"}
VEREDICTOS = [
    "verdadeiro",
    "maioritariamente_verdadeiro",
    "enganador",
    "maioritariamente_falso",
    "falso",
    "nao_verificavel",
]
CONFIANCAS = {"alta", "media", "baixa"}
SENTIDOS = {"apoia", "contraria", "contexto"}
RE_TEMA = re.compile(r"^[a-z_]+$")
RE_VER_TAMBEM = re.compile(r"^\d{4}-\d{2}-\d{2}#f\d+$")
# Teto absoluto; as instruções do agente pedem menos (7 e 10 por partido).
MAX_ACONTECIMENTOS = 10
MAX_AFIRMACOES = 15
PARTIDOS_JSON = Path(__file__).resolve().parent.parent / "data" / "partidos.json"


def partidos_validos() -> set[str]:
    return {p["id"] for p in json.loads(PARTIDOS_JSON.read_text(encoding="utf-8"))}


class Erros(list):
    def add(self, caminho: str, msg: str) -> None:
        self.append(f"{caminho}: {msg}")


def _texto(v, e: Erros, caminho: str) -> None:
    if not isinstance(v, str) or not v.strip():
        e.add(caminho, "texto obrigatório e não vazio")


def _data(v, e: Erros, caminho: str, nulo: bool = False) -> date | None:
    if v is None and nulo:
        return None
    try:
        return date.fromisoformat(v)
    except (TypeError, ValueError):
        e.add(caminho, f"data ISO inválida: {v!r}")
        return None


def _url(v, e: Erros, caminho: str) -> None:
    if not isinstance(v, str) or not re.match(r"^https?://[^\s/]+\.[^\s]+$", v):
        e.add(caminho, f"URL inválido: {v!r}")


def _fonte(f, e: Erros, caminho: str, campos_texto: tuple[str, ...]) -> None:
    if not isinstance(f, dict):
        e.add(caminho, "tem de ser objeto")
        return
    for c in campos_texto:
        _texto(f.get(c), e, f"{caminho}.{c}")
    _url(f.get("url"), e, f"{caminho}.url")


def validar(rel: dict, nome: str = "") -> Erros:
    e = Erros()
    if not isinstance(rel, dict):
        e.add("raiz", "tem de ser objeto")
        return e

    partido = rel.get("partido")
    if partido not in partidos_validos():
        e.add("partido", f"desconhecido: {partido!r} (ver data/partidos.json)")
    elif nome and Path(nome).parent.name != partido:
        e.add("partido", f"'{partido}' mas o ficheiro está na pasta '{Path(nome).parent.name}'")

    dia = _data(rel.get("data"), e, "data")
    if dia and nome and Path(nome).stem != dia.isoformat():
        e.add("data", f"não coincide com o nome do ficheiro ({Path(nome).name})")
    try:
        g = datetime.fromisoformat(rel.get("gerado_em", ""))
        if g.tzinfo is None:
            e.add("gerado_em", "falta o fuso horário")
    except (TypeError, ValueError):
        e.add("gerado_em", "data/hora ISO inválida")

    janela = rel.get("janela")
    if not isinstance(janela, dict):
        e.add("janela", "obrigatória")
    else:
        de = _data(janela.get("de"), e, "janela.de")
        ate = _data(janela.get("ate"), e, "janela.ate")
        if de and ate and de > ate:
            e.add("janela", "'de' posterior a 'ate'")

    _texto(rel.get("resumo"), e, "resumo")

    # Acontecimentos
    acs = rel.get("acontecimentos")
    if not isinstance(acs, list):
        e.add("acontecimentos", "tem de ser lista")
        acs = []
    if len(acs) > MAX_ACONTECIMENTOS:
        e.add("acontecimentos", f"mais de {MAX_ACONTECIMENTOS}")
    ids = set()
    for i, a in enumerate(acs):
        c = f"acontecimentos[{i}]"
        if not isinstance(a, dict):
            e.add(c, "tem de ser objeto")
            continue
        if not re.match(r"^a\d+$", str(a.get("id"))):
            e.add(f"{c}.id", "formato aN")
        if a.get("id") in ids:
            e.add(f"{c}.id", "repetido")
        ids.add(a.get("id"))
        _texto(a.get("titulo"), e, f"{c}.titulo")
        _texto(a.get("resumo"), e, f"{c}.resumo")
        _data(a.get("data"), e, f"{c}.data")
        if a.get("categoria") not in CATEGORIAS:
            e.add(f"{c}.categoria", f"valor inválido: {a.get('categoria')!r}")
        if not isinstance(a.get("relevancia"), int) or not 1 <= a["relevancia"] <= 5:
            e.add(f"{c}.relevancia", "inteiro de 1 a 5")
        fontes = a.get("fontes")
        if not isinstance(fontes, list) or not fontes:
            e.add(f"{c}.fontes", "pelo menos uma fonte")
        else:
            for j, f in enumerate(fontes):
                _fonte(f, e, f"{c}.fontes[{j}]", ("titulo", "meio"))
                if isinstance(f, dict):
                    _data(f.get("data_publicacao"), e, f"{c}.fontes[{j}].data_publicacao", nulo=True)

    # Afirmações
    afs = rel.get("afirmacoes")
    if not isinstance(afs, list):
        e.add("afirmacoes", "tem de ser lista")
        afs = []
    if len(afs) > MAX_AFIRMACOES:
        e.add("afirmacoes", f"mais de {MAX_AFIRMACOES}")
    ids = set()
    contagem = {v: 0 for v in VEREDICTOS}
    contagem["sem_veredicto"] = 0
    for i, f in enumerate(afs):
        c = f"afirmacoes[{i}]"
        if not isinstance(f, dict):
            e.add(c, "tem de ser objeto")
            continue
        if not re.match(r"^f\d+$", str(f.get("id"))):
            e.add(f"{c}.id", "formato fN")
        if f.get("id") in ids:
            e.add(f"{c}.id", "repetido")
        ids.add(f.get("id"))
        for campo in ("texto", "autor", "contexto", "explicacao"):
            _texto(f.get(campo), e, f"{c}.{campo}")
        if f.get("cargo") is not None:
            _texto(f.get("cargo"), e, f"{c}.cargo")
        if not isinstance(f.get("literal"), bool):
            e.add(f"{c}.literal", "booleano obrigatório")
        _data(f.get("data"), e, f"{c}.data")
        _fonte(f.get("origem"), e, f"{c}.origem", ("meio",))
        if isinstance(f.get("origem"), dict):
            _data(f["origem"].get("data_publicacao"), e, f"{c}.origem.data_publicacao", nulo=True)
        tipo = f.get("tipo")
        if tipo not in TIPOS:
            e.add(f"{c}.tipo", f"valor inválido: {tipo!r}")
        if not isinstance(f.get("tema"), str) or not RE_TEMA.match(f["tema"]):
            e.add(f"{c}.tema", "minúsculas sem acentos")
        vt = f.get("ver_tambem")
        if vt is not None and not (isinstance(vt, str) and RE_VER_TAMBEM.match(vt)):
            e.add(f"{c}.ver_tambem", "formato AAAA-MM-DD#fN ou null")

        ver = f.get("veredicto")
        evid = f.get("evidencias")
        if not isinstance(evid, list):
            e.add(f"{c}.evidencias", "tem de ser lista")
            evid = []
        for j, ev in enumerate(evid):
            _fonte(ev, e, f"{c}.evidencias[{j}]", ("titulo", "entidade"))
            if isinstance(ev, dict):
                _data(ev.get("data"), e, f"{c}.evidencias[{j}].data", nulo=True)
                if ev.get("sentido") not in SENTIDOS:
                    e.add(f"{c}.evidencias[{j}].sentido", f"valor inválido: {ev.get('sentido')!r}")

        if tipo == "factual":
            if ver not in VEREDICTOS:
                e.add(f"{c}.veredicto", f"afirmação factual exige veredicto válido: {ver!r}")
            else:
                contagem[ver] += 1
                if ver != "nao_verificavel" and len(evid) < 2:
                    e.add(f"{c}.evidencias", "veredicto exige pelo menos 2 evidências")
            if f.get("confianca") not in CONFIANCAS:
                e.add(f"{c}.confianca", "alta, media ou baixa")
        elif tipo in TIPOS:
            if ver is not None:
                e.add(f"{c}.veredicto", f"'{tipo}' não leva veredicto (null)")
            if f.get("confianca") is not None:
                e.add(f"{c}.confianca", f"'{tipo}' não leva confiança (null)")
            contagem["sem_veredicto"] += 1

    # Cobertura
    cob = rel.get("cobertura")
    if not isinstance(cob, dict):
        e.add("cobertura", "obrigatória")
    else:
        for k in ("fontes_consultadas", "limitacoes"):
            v = cob.get(k)
            if not isinstance(v, list) or not all(isinstance(x, str) and x.strip() for x in v):
                e.add(f"cobertura.{k}", "lista de textos")
        if isinstance(cob.get("fontes_consultadas"), list) and not cob["fontes_consultadas"]:
            e.add("cobertura.fontes_consultadas", "não pode estar vazia")

    # Estatísticas têm de bater com as listas
    est = rel.get("estatisticas")
    if not isinstance(est, dict):
        e.add("estatisticas", "obrigatórias")
    else:
        if est.get("n_acontecimentos") != len(acs):
            e.add("estatisticas.n_acontecimentos", f"{est.get('n_acontecimentos')} ≠ {len(acs)}")
        if est.get("n_afirmacoes") != len(afs):
            e.add("estatisticas.n_afirmacoes", f"{est.get('n_afirmacoes')} ≠ {len(afs)}")
        if est.get("por_veredicto") != contagem:
            e.add("estatisticas.por_veredicto", f"{est.get('por_veredicto')} ≠ {contagem}")
    return e


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    falhou = False
    for nome in argv:
        try:
            rel = json.loads(Path(nome).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"✗ {nome}: não se lê como JSON ({exc})")
            falhou = True
            continue
        erros = validar(rel, nome)
        if erros:
            falhou = True
            print(f"✗ {nome}: {len(erros)} erro(s)")
            for x in erros:
                print(f"   - {x}")
        else:
            print(f"✓ {nome}")
    return 1 if falhou else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
