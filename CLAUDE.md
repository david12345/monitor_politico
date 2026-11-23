# Monitor Político — contexto do projeto

Relatório diário sobre três partidos — **Chega, PSD e PS** (`data/partidos.json`):
principais acontecimentos, principais afirmações e verificação de veracidade
(fact-check) de cada afirmação factual. No PSD contam também os membros do
Governo filiados no partido.
Site estático, sem servidor: o dashboard (`index.html`) só lê JSON.

Quem gera os dados é uma **tarefa agendada do Claude** que, todos os dias às
06:47 (Lisboa), segue `agente/instrucoes.md` e faz commit de
`data/relatorios/<partido>/AAAA-MM-DD.json` (um por partido) no `main`.

## Regras invioláveis

1. **Não inventar.** Cada acontecimento e afirmação tem o URL de onde foi tirado,
   consultado nesse dia. Citação literal só se o texto estiver na fonte; caso
   contrário `literal: false` e escreve-se como paráfrase.
2. **Imparcialidade.** O mesmo padrão de prova que se aplicaria a qualquer partido.
   Descrever, não adjetivar. Incluir o contexto que favorece e o que desfavorece.
3. **Só afirmações `factual` levam veredicto.** `promessa` e `opiniao` registam-se
   com `veredicto: null`.
4. **Veredicto exige ≥ 2 evidências** (exceto `nao_verificavel`), explicação e
   `confianca`.
5. **Hierarquia de evidência:** fontes primárias (INE, Pordata, Eurostat, DRE,
   Parlamento, Banco de Portugal, CNE, AIMA, RASI, DGO, Tribunal Constitucional)
   > fact-checkers (Polígrafo, Observador Fact Check, Lusa, AFP)
   > imprensa. Wikipédia e resumos de motor de busca **não são evidência**.
6. **Sem dados pessoais** de cidadãos privados. Só figuras públicas.
7. **`null` = dado não disponível** e o dashboard mostra-o assim. Nunca `""`.
8. **Na dúvida, não publicar** a afirmação ou usar `nao_verificavel`.
9. **Mesmo critério para os três partidos** (limites, escala, fontes, esforço), e
   nada no dashboard que compare a veracidade dos partidos: as contagens
   dependem do que foi dito e coberto em cada dia.

## Comandos

```bash
python3 scripts/validar.py data/relatorios/*/*.json   # bloqueante; sai com 1 se falhar
python3 scripts/atualizar_indice.py                 # reconstrói data/indice.json
python3 -m unittest discover tests
python3 -m http.server 8000                         # dashboard em http://localhost:8000
```

Só biblioteca padrão de Python; o dashboard não tem build nem dependências.

## Estrutura

```
agente/instrucoes.md        o "programa" da tarefa diária — afinar aqui
agente/partidos/<p>.md      o que muda por partido (quem conta, pesquisas)
data/partidos.json          partidos válidos (id, nome, âmbito)
schema/relatorio.schema.json esquema do relatório (referência)
data/relatorios/<partido>/  um JSON por partido e por dia
data/indice.json            GERADO por atualizar_indice.py
scripts/                    validar.py, atualizar_indice.py, texto.py (HTML → texto)
index.html app.js estilo.css dashboard
```

## Convenções

- Português europeu em tudo. Chaves e enums em `snake_case` sem acentos.
- Datas ISO (`AAAA-MM-DD`; `gerado_em` com hora e fuso).
- Commits de dados: `dados: relatórios AAAA-MM-DD`.
- Dashboard: telemóvel (360 px) e portátil (1280 px), sem scroll horizontal,
  alvos ≥ 44 px, veredicto sempre com texto e não só cor.
