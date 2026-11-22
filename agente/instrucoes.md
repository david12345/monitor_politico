# Instruções da tarefa diária

Este ficheiro é o programa que a tarefa agendada segue todos os dias. Lê
`CLAUDE.md` primeiro: as regras invioláveis aplicam-se a tudo o que está aqui.

## 0. Preparar

- `DIA` = a data de hoje em Lisboa (`TZ=Europe/Lisbon date +%F`).
- Janela: das 00:00 de ontem até agora (hora de Lisboa). Inclui o dia anterior
  inteiro, que é o que ainda não foi coberto.
- Se `data/relatorios/$DIA.json` já existir, termina sem fazer nada.
- Lê os relatórios dos **últimos 7 dias** em `data/relatorios/`: servem para não
  repetir acontecimentos e para reaproveitar verificações (`ver_tambem`).

## 1. Recolher (WebSearch e WebFetch)

Procura notícias e publicações da janela. Pesquisas mínimas (em português):

- `Chega` + `André Ventura` com as notícias das últimas 24 horas
- `Chega Assembleia da República` (votações, projetos de lei, intervenções)
- `Chega deputado` / `deputada do Chega` / nomes dos dirigentes que surgirem
- `Chega Polígrafo` e `Chega fact check` (verificações já publicadas)
- Site oficial: `chega.pt` (comunicados, notícias)
- `parlamento.pt` (iniciativas e intervenções do grupo parlamentar)

Meios a privilegiar: Lusa, RTP, Público, Expresso, Observador, SIC Notícias,
CNN Portugal, Diário de Notícias, Jornal de Notícias, Correio da Manhã,
Renascença, TSF, ECO, Polígrafo.

Redes sociais (X, Facebook, Instagram, TikTok, YouTube): só entram por resultados
indexados ou citação na imprensa. Não tentes contornar páginas de login. Regista
esta limitação em `cobertura.limitacoes`.

Abre com WebFetch cada artigo que vais usar. **Nada entra no relatório com base
apenas no excerto da pesquisa.** Regista em `cobertura.fontes_consultadas` os
meios efetivamente lidos e em `cobertura.limitacoes` o que falhou (paywall,
erro, bloqueio).

## 2. Acontecimentos (até 10)

Escolhe os factos mais relevantes da janela sobre o partido ou feitos pelo
partido. Um acontecimento = um facto, mesmo que coberto por vários meios.

- `titulo`: factual e neutro, sem adjetivos.
- `resumo`: 2–4 frases. Quem, o quê, quando, onde.
- `categoria`: `parlamento`, `campanha`, `declaracao`, `justica`, `interno`,
  `media` ou `outro`.
- `relevancia` 1–5 (5 = tema nacional dominante; 1 = nota menor).
- `fontes`: ≥ 1, idealmente 2 meios diferentes.

Não repetas um acontecimento dos últimos 7 dias, a não ser que haja um
desenvolvimento novo (e nesse caso diz qual no resumo).

## 3. Afirmações (até 15)

Afirmações públicas de dirigentes, deputados, autarcas ou canais oficiais do
Chega, feitas dentro da janela. Prioriza as que têm conteúdo verificável e maior
alcance.

- `texto`: citação literal **só** se estiver na fonte (`literal: true`); senão
  paráfrase fiel (`literal: false`).
- `autor` e `cargo` como publicados.
- `origem`: o URL onde a afirmação aparece (entrevista, artigo, ata, vídeo).
- `contexto`: onde e a propósito de quê foi dita.
- `tipo`:
  - `factual` — afirma algo sobre o mundo que se pode confirmar ou refutar
    (números, factos, o que outro disse ou votou).
  - `promessa` — compromisso futuro. `veredicto: null`.
  - `opiniao` — juízo de valor. `veredicto: null`.
- `tema`: uma palavra em minúsculas, sem acentos (`imigracao`, `seguranca`,
  `economia`, `saude`, `habitacao`, `justica`, `corrupcao`, `impostos`,
  `educacao`, `europa`, `outro`).

Se a mesma afirmação (ou equivalente) já foi verificada nos últimos 7 dias,
inclui-a com o mesmo veredicto e `ver_tambem: "AAAA-MM-DD#id"`, sem repetir a
pesquisa.

## 4. Verificar cada afirmação `factual`

1. Isola a parte verificável. Se houver várias, verifica a principal e menciona
   as outras na explicação.
2. Procura primeiro fontes primárias (INE, Pordata, Eurostat, DRE, Parlamento,
   Banco de Portugal, AIMA, RASI, DGO, CNE…), depois fact-checks já publicados
   (Polígrafo, Observador Fact Check, Lusa, AFP), só depois imprensa.
3. Abre as fontes com WebFetch e confirma que dizem o que vais escrever.
4. Escolhe o veredicto:

| veredicto | quando |
|---|---|
| `verdadeiro` | exato e sem omissões relevantes |
| `maioritariamente_verdadeiro` | certo no essencial, com imprecisões menores |
| `enganador` | factos certos usados para sugerir uma conclusão falsa, ou falta contexto decisivo |
| `maioritariamente_falso` | contém um elemento verdadeiro mas o essencial está errado |
| `falso` | contrariado pelas fontes |
| `nao_verificavel` | não há dados públicos suficientes para decidir |

5. `explicacao`: 2–4 frases, neutras, que um leitor comum perceba. Diz o número
   ou facto correto e de onde vem.
6. `evidencias`: ≥ 2 (exceto `nao_verificavel`), cada uma com `sentido`
   `apoia`, `contraria` ou `contexto`.
7. `confianca`: `alta` (fonte primária direta), `media` (fact-checker ou várias
   fontes secundárias concordantes), `baixa` (fontes indiretas ou parciais).

Aplica exatamente o mesmo rigor que aplicarias a qualquer outro partido. Se
hesitares entre dois veredictos, escolhe o mais moderado e explica a dúvida.

## 5. Escrever o relatório

Ficheiro `data/relatorios/$DIA.json`, conforme `schema/relatorio.schema.json`:

- ids: `a1`, `a2`… para acontecimentos; `f1`, `f2`… para afirmações.
- `resumo`: 2–3 frases em linguagem simples sobre o dia.
- `gerado_em`: data e hora com fuso (`2026-11-22T06:52:00+00:00`).
- `estatisticas`: contagens exatas (o validador confere). `por_veredicto` tem
  as seis chaves, mais `sem_veredicto` para promessas e opiniões.

Se não houver nada relevante na janela, escreve o relatório com listas vazias e
diz isso no `resumo`. Nunca inventes para encher.

## 6. Validar e publicar

```bash
python3 scripts/validar.py data/relatorios/$DIA.json
python3 scripts/atualizar_indice.py
git add data/ && git commit -m "dados: relatório $DIA"
git push origin main
```

Se o validador falhar, corrige o relatório (não o validador) e volta a validar.
Se o push for rejeitado, faz `git pull --rebase origin main` e tenta de novo.

No fim, responde com: o resumo do dia, o número de acontecimentos e afirmações,
a contagem por veredicto e as limitações de cobertura.
