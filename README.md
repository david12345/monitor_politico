# Monitor Político

Relatório diário sobre o **Chega, o PSD e o PS**: os principais acontecimentos, as
principais afirmações de dirigentes, deputados e (no PSD) membros do Governo, e a
**verificação de factos** de cada afirmação factual, com ligação a todas as fontes.
Os três partidos são tratados com o mesmo critério.

- **Dashboard:** site estático (`index.html`), sem servidor nem dependências, publicado
  em GitHub Pages: <https://david12345.github.io/monitor_politico/>. Abre na vista
  "Hoje" com os três partidos; cada partido tem relatórios, filtros e histórico.
- **Recolha:** uma tarefa agendada do Claude corre todos os dias às 06:47 (Lisboa),
  segue [`agente/instrucoes.md`](agente/instrucoes.md), escreve
  `data/relatorios/<partido>/AAAA-MM-DD.json` para cada partido, valida e faz
  commit no `main`.

## Ver localmente

```bash
python3 -m http.server 8000
```

Abrir <http://localhost:8000>.

## Afinar

O comportamento da recolha está em `agente/instrucoes.md` (regras comuns, número
de itens, escala de veredictos) e em `agente/partidos/` (o que muda por partido).
Para acrescentar um partido: uma entrada em `data/partidos.json`, um ficheiro em
`agente/partidos/` e um link no cabeçalho de `index.html`. Muda-se por commit; a próxima execução já usa a versão nova.

## Verificar

```bash
python3 -m unittest discover tests
python3 scripts/validar.py data/relatorios/*/*.json
python3 scripts/atualizar_indice.py
```

O workflow `validar.yml` corre o mesmo em cada envio.

## Limitações

- X, Facebook, Instagram e TikTok exigem sessão: só entram quando indexados ou
  citados pela imprensa.
- Artigos com paywall podem ficar de fora; cada relatório lista o que falhou.
- A verificação é automática e pode errar. Cada veredicto liga às evidências para
  se poder confirmar.
