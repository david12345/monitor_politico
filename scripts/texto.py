#!/usr/bin/env python3
"""Extrai o texto legível de uma página HTML descarregada.

Uso: python3 -I scripts/texto.py pagina.html [max_caracteres]
Imprime as datas de publicação encontradas (JSON-LD) e os parágrafos com mais
de 60 caracteres. Só biblioteca padrão.
"""
import re
import sys
from html.parser import HTMLParser

IGNORAR = {"script", "style", "nav", "footer", "header", "aside", "noscript", "svg", "form"}


class Extrator(HTMLParser):
    def __init__(self):
        super().__init__()
        self.partes, self.dentro = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in IGNORAR:
            self.dentro += 1
        if tag in ("p", "h1", "h2", "h3", "li", "br", "blockquote"):
            self.partes.append("\n")

    def handle_endtag(self, tag):
        if tag in IGNORAR and self.dentro:
            self.dentro -= 1

    def handle_data(self, data):
        if not self.dentro:
            self.partes.append(data)


def main():
    raw = open(sys.argv[1], encoding="utf-8", errors="replace").read()
    limite = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
    print("DATAS:", re.findall(r'"date(?:Published|Modified)"\s*:\s*"([^"]+)"', raw)[:2])
    e = Extrator()
    e.feed(raw)
    texto = re.sub(r"[ \t]+", " ", "".join(e.partes))
    linhas = [l.strip() for l in texto.split("\n") if len(l.strip()) > 60]
    print("\n".join(linhas)[:limite])


if __name__ == "__main__":
    main()
