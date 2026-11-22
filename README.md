# Monitor Chega

Relatório diário sobre o partido Chega: os principais acontecimentos, as principais
afirmações de dirigentes e deputados e a **verificação de factos** de cada afirmação
factual, com ligação a todas as fontes.

- **Dashboard:** site estático (`index.html`), sem servidor nem dependências, publicado
  em GitHub Pages. Abre no relatório mais recente; tem histórico e metodologia.
- **Recolha:** uma tarefa agendada do Claude corre todos os dias às 06:47 (Lisboa),
  segue [`agente/instrucoes.md`](agente/instrucoes.md), escreve
  `data/relatorios/AAAA-MM-DD.json`, valida-o e faz commit no `main`.

## Ver localmente

```bash
python3 -m http.server 8000
```

Abrir <http://localhost:8000>.

## Afinar

O comportamento da recolha está todo em `agente/instrucoes.md` (fontes, número de
itens, escala de veredictos). Muda-se por commit; a próxima execução já usa a versão nova.

## Verificar

```bash
python3 -m unittest discover tests
python3 scripts/validar.py data/relatorios/*.json
python3 scripts/atualizar_indice.py
```

O workflow `validar.yml` corre o mesmo em cada envio.

## Limitações

- X, Facebook, Instagram e TikTok exigem sessão: só entram quando indexados ou
  citados pela imprensa.
- Artigos com paywall podem ficar de fora; cada relatório lista o que falhou.
- A verificação é automática e pode errar. Cada veredicto liga às evidências para
  se poder confirmar.
