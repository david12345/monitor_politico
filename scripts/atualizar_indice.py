#!/usr/bin/env python3
"""Reconstrói data/indice.json a partir de data/relatorios/<partido>/*.json.

Só inclui relatórios que passam a validação; os outros são reportados e
deixados de fora, para o dashboard nunca mostrar um relatório inválido.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validar import partidos_validos, validar  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
RELATORIOS = RAIZ / "data" / "relatorios"
INDICE = RAIZ / "data" / "indice.json"


def construir(pasta: Path = RELATORIOS) -> tuple[dict, list[str]]:
    partidos = {p: [] for p in sorted(partidos_validos())}
    rejeitados = []
    for p in sorted(pasta.glob("*/????-??-??.json")):
        nome = f"{p.parent.name}/{p.name}"
        try:
            rel = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            rejeitados.append(nome)
            continue
        if p.parent.name not in partidos or validar(rel, str(p)):
            rejeitados.append(nome)
            continue
        partidos[rel["partido"]].append({
            "data": rel["data"],
            "ficheiro": f"data/relatorios/{nome}",
            "resumo": rel["resumo"],
            "n_acontecimentos": rel["estatisticas"]["n_acontecimentos"],
            "n_afirmacoes": rel["estatisticas"]["n_afirmacoes"],
            "por_veredicto": rel["estatisticas"]["por_veredicto"],
        })
    for dias in partidos.values():
        dias.sort(key=lambda d: d["data"], reverse=True)
    return {
        "atualizado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "partidos": partidos,
    }, rejeitados


def main() -> int:
    indice, rejeitados = construir()
    INDICE.write_text(json.dumps(indice, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("indice.json: " + ", ".join(f"{k} {len(v)} dia(s)" for k, v in indice["partidos"].items()))
    for r in rejeitados:
        print(f"  ✗ excluído (inválido): {r}")
    return 1 if rejeitados else 0


if __name__ == "__main__":
    sys.exit(main())
