// Monitor Chega — dashboard. Só lê data/indice.json e data/relatorios/*.json.
// Todo o texto vem de fontes externas: é inserido como texto, nunca como HTML.

const VEREDICTOS = [
  ['verdadeiro', 'Verdadeiro'],
  ['maioritariamente_verdadeiro', 'Maioritariamente verdadeiro'],
  ['enganador', 'Enganador'],
  ['maioritariamente_falso', 'Maioritariamente falso'],
  ['falso', 'Falso'],
  ['nao_verificavel', 'Não verificável'],
];
const ROTULO_VEREDICTO = Object.fromEntries(VEREDICTOS);
const ROTULO_TIPO = { factual: 'Factual', promessa: 'Promessa', opiniao: 'Opinião' };
const ROTULO_CATEGORIA = {
  parlamento: 'Parlamento', campanha: 'Campanha', declaracao: 'Declaração',
  justica: 'Justiça', interno: 'Vida interna', media: 'Comunicação social', outro: 'Outro',
};
const ROTULO_SENTIDO = { apoia: 'Apoia', contraria: 'Contraria', contexto: 'Contexto' };
const ROTULO_CONFIANCA = { alta: 'alta', media: 'média', baixa: 'baixa' };
const ND = 'Dado não disponível';

const main = document.getElementById('conteudo');
const dica = document.getElementById('dica');
let indice = null;
const cache = new Map();

// ---------- utilitários ----------
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.setAttribute('style', v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const urlSegura = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);
function ligacao(url, texto) {
  const u = urlSegura(url);
  return u ? h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, texto) : h('span', {}, texto);
}
const fmtData = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => {
  if (!iso) return ND;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? ND : d.toLocaleDateString('pt-PT', opts);
};
const txt = (v) => (v == null || v === '' ? ND : v);
const amostra = (v) =>
  h('span', { class: `amostra${v === 'nao_verificavel' ? ' tracejado' : ''}`, style: `--cor: var(--v-${v})`, 'aria-hidden': 'true' });
const selo = (v) => h('span', { class: 'selo' }, amostra(v), ROTULO_VEREDICTO[v] ?? v);

async function obterJSON(caminho) {
  if (cache.has(caminho)) return cache.get(caminho);
  const r = await fetch(caminho, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status}`);
  const j = await r.json();
  cache.set(caminho, j);
  return j;
}

function marcarNav(nome) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === nome) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function mostrar(...nos) {
  main.replaceChildren(...nos);
}

// ---------- vista: um dia ----------
async function vistaDia(dataPedida) {
  marcarNav(dataPedida ? '' : 'dia');
  const dias = indice.dias;
  if (!dias.length) {
    mostrar(h('h1', {}, 'Ainda não há relatórios'),
      h('p', { class: 'vazio' }, 'O primeiro relatório diário aparece aqui depois da primeira execução.'));
    return;
  }
  const pos = dataPedida ? dias.findIndex((d) => d.data === dataPedida) : 0;
  if (pos < 0) {
    mostrar(h('h1', {}, fmtData(dataPedida)), h('p', { class: 'vazio' }, `${ND}: não há relatório para este dia.`),
      h('p', {}, h('a', { href: '#/' }, 'Ver o relatório mais recente')));
    return;
  }
  const entrada = dias[pos];
  let rel;
  try {
    rel = await obterJSON(entrada.ficheiro);
  } catch (e) {
    mostrar(h('p', { class: 'estado' }, `Não foi possível carregar o relatório (${e.message}).`));
    return;
  }

  // navegação entre dias (índice está do mais recente para o mais antigo)
  const anterior = dias[pos + 1];
  const seguinte = dias[pos - 1];
  const sel = h('select', { 'aria-label': 'Escolher dia', onchange: (e) => { location.hash = `#/dia/${e.target.value}`; } },
    dias.map((d) => h('option', { value: d.data, selected: d.data === entrada.data }, fmtData(d.data))));
  const nav = h('div', { class: 'dias' },
    h('button', { type: 'button', 'aria-label': 'Dia anterior', disabled: !anterior,
      onclick: () => { location.hash = `#/dia/${anterior.data}`; } }, '‹'),
    sel,
    h('button', { type: 'button', 'aria-label': 'Dia seguinte', disabled: !seguinte,
      onclick: () => { location.hash = `#/dia/${seguinte.data}`; } }, '›'));

  const est = rel.estatisticas;
  const contagem = h('ul', { class: 'contagem', 'aria-label': 'Afirmações por veredicto' },
    VEREDICTOS.map(([v, rot]) => h('li', {}, amostra(v), h('strong', {}, est.por_veredicto[v] ?? 0), rot)),
    h('li', {}, amostra('sem_veredicto'), h('strong', {}, est.por_veredicto.sem_veredicto ?? 0), 'Promessas e opiniões'));

  const resumo = h('section', { class: 'cartao resumo-dia', 'aria-labelledby': 't-resumo' },
    h('h1', { id: 't-resumo' }, fmtData(rel.data)),
    h('p', {}, rel.resumo),
    h('p', { class: 'meta' },
      `${est.n_acontecimentos} acontecimento${est.n_acontecimentos === 1 ? '' : 's'} · ${est.n_afirmacoes} afirmaç${est.n_afirmacoes === 1 ? 'ão' : 'ões'} · período de ${fmtData(rel.janela.de, { day: 'numeric', month: 'short' })} a ${fmtData(rel.janela.ate, { day: 'numeric', month: 'short' })} · gerado em ${new Date(rel.gerado_em).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}`),
    contagem);

  // acontecimentos
  const acs = [...rel.acontecimentos].sort((a, b) => b.relevancia - a.relevancia);
  const secAcs = h('section', { 'aria-labelledby': 't-acs' },
    h('h2', { id: 't-acs' }, 'Principais acontecimentos'),
    acs.length
      ? h('ol', { class: 'lista' }, acs.map((a) => h('li', { class: 'cartao acontecimento' },
        h('div', { class: 'etiquetas' },
          h('span', { class: 'etiqueta' }, ROTULO_CATEGORIA[a.categoria] ?? a.categoria),
          h('span', { class: 'etiqueta' }, `Relevância ${a.relevancia}/5`),
          h('span', { class: 'etiqueta' }, fmtData(a.data, { day: 'numeric', month: 'short' }))),
        h('h3', {}, a.titulo),
        h('p', {}, a.resumo),
        h('ul', { class: 'fontes', 'aria-label': 'Fontes' }, a.fontes.map((f) => h('li', {},
          ligacao(f.url, f.titulo), ` — ${f.meio}`, f.data_publicacao ? `, ${fmtData(f.data_publicacao, { day: 'numeric', month: 'short' })}` : '')))))
      : h('p', { class: 'vazio' }, 'Sem acontecimentos relevantes neste período.'));

  // afirmações + filtros
  const lista = h('ol', { class: 'lista' });
  const temas = [...new Set(rel.afirmacoes.map((f) => f.tema))].sort();
  const estado = { q: '', veredicto: '', tipo: '', tema: '' };
  const aplicar = () => {
    const q = estado.q.trim().toLowerCase();
    const vis = rel.afirmacoes.filter((f) =>
      (!estado.veredicto || (estado.veredicto === 'sem' ? f.veredicto == null : f.veredicto === estado.veredicto)) &&
      (!estado.tipo || f.tipo === estado.tipo) &&
      (!estado.tema || f.tema === estado.tema) &&
      (!q || `${f.texto} ${f.autor} ${f.explicacao} ${f.contexto}`.toLowerCase().includes(q)));
    lista.replaceChildren(...vis.map(cartaoAfirmacao));
    contador.textContent = `${vis.length} de ${rel.afirmacoes.length} afirmações`;
  };
  const contador = h('p', { class: 'meta', 'aria-live': 'polite' });
  const filtros = h('div', { class: 'filtros' },
    h('label', {}, 'Pesquisar', h('input', { type: 'search', placeholder: 'texto, autor…', oninput: (e) => { estado.q = e.target.value; aplicar(); } })),
    h('label', {}, 'Veredicto', h('select', { onchange: (e) => { estado.veredicto = e.target.value; aplicar(); } },
      h('option', { value: '' }, 'Todos'), VEREDICTOS.map(([v, r]) => h('option', { value: v }, r)), h('option', { value: 'sem' }, 'Sem veredicto'))),
    h('label', {}, 'Tipo', h('select', { onchange: (e) => { estado.tipo = e.target.value; aplicar(); } },
      h('option', { value: '' }, 'Todos'), Object.entries(ROTULO_TIPO).map(([v, r]) => h('option', { value: v }, r)))),
    h('label', {}, 'Tema', h('select', { onchange: (e) => { estado.tema = e.target.value; aplicar(); } },
      h('option', { value: '' }, 'Todos'), temas.map((t) => h('option', { value: t }, t.replace(/_/g, ' '))))));
  const secAfs = h('section', { 'aria-labelledby': 't-afs' },
    h('h2', { id: 't-afs' }, 'Afirmações e verificação'),
    rel.afirmacoes.length ? [filtros, contador, lista] : h('p', { class: 'vazio' }, 'Sem afirmações registadas neste período.'));
  if (rel.afirmacoes.length) aplicar();

  const cob = rel.cobertura;
  const secCob = h('section', { 'aria-labelledby': 't-cob' },
    h('h2', { id: 't-cob' }, 'Cobertura deste relatório'),
    h('div', { class: 'cartao' },
      h('p', {}, h('strong', {}, 'Fontes consultadas: '), cob.fontes_consultadas.join(', ')),
      h('p', {}, h('strong', {}, 'Limitações: ')),
      cob.limitacoes.length ? h('ul', {}, cob.limitacoes.map((l) => h('li', {}, l))) : h('p', { class: 'vazio' }, 'Nenhuma registada.')));

  mostrar(nav, resumo, secAcs, secAfs, secCob);
}

function cartaoAfirmacao(f) {
  const cor = f.veredicto ? `var(--v-${f.veredicto})` : 'var(--v-sem_veredicto)';
  const ev = f.evidencias ?? [];
  return h('li', { class: 'cartao afirmacao', style: `--cor: ${cor}` },
    h('div', { class: 'etiquetas' },
      f.veredicto ? selo(f.veredicto) : h('span', { class: 'selo' }, amostra('sem_veredicto'), `${ROTULO_TIPO[f.tipo]} — sem veredicto`),
      f.veredicto && h('span', { class: 'etiqueta' }, `Confiança ${ROTULO_CONFIANCA[f.confianca] ?? ND}`),
      h('span', { class: 'etiqueta' }, f.tema.replace(/_/g, ' '))),
    h('blockquote', { class: f.literal ? '' : 'parafrase' }, f.literal ? `«${f.texto}»` : f.texto),
    h('p', { class: 'meta' },
      `${f.autor}${f.cargo ? `, ${f.cargo}` : ''} · ${fmtData(f.data, { day: 'numeric', month: 'short' })} · `,
      ligacao(f.origem.url, f.origem.meio), f.literal ? '' : ' · paráfrase'),
    h('p', { class: 'meta' }, f.contexto),
    h('p', { class: 'explicacao' }, f.explicacao),
    f.ver_tambem && h('p', { class: 'meta' }, 'Já verificada antes: ',
      h('a', { href: `#/dia/${f.ver_tambem.split('#')[0]}` }, fmtData(f.ver_tambem.split('#')[0]))),
    ev.length > 0 && h('details', {},
      h('summary', {}, `Evidências (${ev.length})`),
      h('ul', { class: 'evidencias' }, ev.map((e) => h('li', {},
        h('span', { class: 'sentido' }, ROTULO_SENTIDO[e.sentido] ?? e.sentido), ' · ',
        ligacao(e.url, e.titulo), ` — ${e.entidade}`, e.data ? `, ${fmtData(e.data, { day: 'numeric', month: 'short', year: 'numeric' })}` : '')))));
}

// ---------- vista: histórico ----------
function vistaHistorico() {
  marcarNav('historico');
  const dias = [...indice.dias].slice(0, 30).reverse(); // cronológico
  if (!dias.length) {
    mostrar(h('h1', {}, 'Histórico'), h('p', { class: 'vazio' }, 'Ainda não há relatórios.'));
    return;
  }
  const chaves = [...VEREDICTOS.map(([v]) => v)];
  const totais = Object.fromEntries(chaves.map((k) => [k, dias.reduce((s, d) => s + (d.por_veredicto[k] ?? 0), 0)]));
  const nVerif = Object.values(totais).reduce((a, b) => a + b, 0);
  const nFalsas = totais.falso + totais.maioritariamente_falso;

  const grafico = graficoEmpilhado(dias, chaves);
  const legenda = h('ul', { class: 'legenda', 'aria-label': 'Legenda' },
    VEREDICTOS.map(([v, r]) => h('li', {}, amostra(v), r)));
  const tabela = h('details', {},
    h('summary', {}, 'Ver em tabela'),
    h('div', { class: 'tabela-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Dia'), h('th', { scope: 'col' }, 'Acont.'),
        VEREDICTOS.map(([, r]) => h('th', { scope: 'col' }, r)), h('th', { scope: 'col' }, 'Sem veredicto'))),
      h('tbody', {}, [...dias].reverse().map((d) => h('tr', {},
        h('th', { scope: 'row' }, h('a', { href: `#/dia/${d.data}` }, fmtData(d.data, { day: 'numeric', month: 'short' }))),
        h('td', {}, d.n_acontecimentos),
        chaves.map((k) => h('td', {}, d.por_veredicto[k] ?? 0)),
        h('td', {}, d.por_veredicto.sem_veredicto ?? 0)))))));

  mostrar(
    h('h1', {}, 'Histórico'),
    h('section', { class: 'cartao resumo-dia' },
      h('p', {}, nVerif
        ? `Nos últimos ${dias.length} relatórios foram verificadas ${nVerif} afirmações factuais; ${nFalsas} (${Math.round((100 * nFalsas) / nVerif)}%) foram classificadas como falsas ou maioritariamente falsas.`
        : `Nos últimos ${dias.length} relatórios não houve afirmações factuais verificadas.`),
      h('p', { class: 'meta' }, 'A contagem depende de quais afirmações tiveram cobertura em cada dia; não é uma amostra estatística de tudo o que foi dito.')),
    h('section', { 'aria-labelledby': 't-graf' },
      h('h2', { id: 't-graf' }, 'Afirmações verificadas por dia, por veredicto'),
      h('div', { class: 'cartao' }, grafico, legenda, tabela)));
}

function graficoEmpilhado(dias, chaves) {
  const L = 640, A = 260, m = { t: 12, r: 8, b: 26, l: 28 };
  const w = L - m.l - m.r, hh = A - m.t - m.b;
  const totalDia = (d) => chaves.reduce((s, k) => s + (d.por_veredicto[k] ?? 0), 0);
  const max = Math.max(1, ...dias.map(totalDia));
  const passo = max <= 5 ? 1 : max <= 10 ? 2 : 5;
  const topo = Math.ceil(max / passo) * passo;
  const y = (v) => m.t + hh - (v / topo) * hh;
  const banda = w / dias.length;
  const larg = Math.max(4, Math.min(28, banda * 0.7));

  const s = svg('svg', { viewBox: `0 0 ${L} ${A}`, class: 'grafico', role: 'img',
    'aria-label': 'Gráfico de barras empilhadas com o número de afirmações por veredicto em cada dia. A mesma informação está na tabela abaixo.' });
  const defs = svg('defs');
  const pad = svg('pattern', { id: 'trac', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pad.append(svg('rect', { width: 5, height: 5, fill: 'var(--v-nao_verificavel)' }), svg('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: 'var(--tinta-3)', 'stroke-width': 1.5 }));
  defs.append(pad);
  s.append(defs);

  for (let v = 0; v <= topo; v += passo) {
    s.append(svg('line', { x1: m.l, x2: L - m.r, y1: y(v), y2: y(v), class: v === 0 ? 'eixo' : 'grelha' }));
    const t = svg('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' });
    t.textContent = v;
    s.append(t);
  }
  const cada = Math.ceil(dias.length / 8);
  dias.forEach((d, i) => {
    const cx = m.l + banda * i + banda / 2;
    let acum = 0;
    const seg = chaves.filter((k) => (d.por_veredicto[k] ?? 0) > 0);
    seg.forEach((k, j) => {
      const n = d.por_veredicto[k];
      const y0 = y(acum), y1 = y(acum + n);
      acum += n;
      const ultimo = j === seg.length - 1;
      const alt = Math.max(0, y0 - y1 - (ultimo ? 0 : 2)); // 2px de separação entre segmentos
      const r = svg('rect', { x: cx - larg / 2, y: y1, width: larg, height: alt,
        fill: k === 'nao_verificavel' ? 'url(#trac)' : `var(--v-${k})`, rx: ultimo ? 3 : 0 });
      s.append(r);
    });
    if (i % cada === 0 || i === dias.length - 1) {
      const t = svg('text', { x: cx, y: A - 8, 'text-anchor': 'middle' });
      t.textContent = fmtData(d.data, { day: 'numeric', month: 'numeric' });
      s.append(t);
    }
    // alvo de toque/hover maior do que a barra
    const alvo = svg('rect', { x: m.l + banda * i, y: m.t, width: banda, height: hh, class: 'alvo', tabindex: 0,
      'aria-label': `${fmtData(d.data)}: ${totalDia(d)} afirmações verificadas` });
    const ver = (ev) => mostrarDica(ev, d, alvo);
    alvo.addEventListener('pointerenter', ver);
    alvo.addEventListener('pointermove', ver);
    alvo.addEventListener('pointerleave', esconderDica);
    alvo.addEventListener('focus', ver);
    alvo.addEventListener('blur', esconderDica);
    // rato: clique abre o dia; toque: 1.º toque mostra a dica, 2.º abre o dia
    alvo.addEventListener('click', (ev) => {
      if (ev.pointerType === 'mouse' || alvo.classList.contains('ativo')) location.hash = `#/dia/${d.data}`;
      else ver(ev);
    });
    alvo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') location.hash = `#/dia/${d.data}`; });
    s.append(alvo);
  });
  return s;
}

function mostrarDica(ev, d, alvo) {
  document.querySelectorAll('.alvo.ativo').forEach((a) => a.classList.remove('ativo'));
  alvo.classList.add('ativo');
  dica.replaceChildren(
    h('strong', {}, fmtData(d.data)),
    h('ul', {}, VEREDICTOS.filter(([v]) => d.por_veredicto[v]).map(([v, r]) =>
      h('li', {}, h('span', { class: 'selo' }, amostra(v), r), h('strong', {}, d.por_veredicto[v])))),
    h('div', { class: 'meta' }, 'Toque duas vezes ou Enter para abrir o dia'));
  if (!VEREDICTOS.some(([v]) => d.por_veredicto[v])) dica.querySelector('ul').replaceWith(h('div', {}, 'Sem afirmações verificadas'));
  dica.hidden = false;
  const caixa = alvo.getBoundingClientRect();
  const x = ev.clientX ?? caixa.left + caixa.width / 2;
  const yy = ev.clientY ?? caixa.top + 20;
  const lw = dica.offsetWidth, lh = dica.offsetHeight;
  dica.style.left = `${Math.min(window.innerWidth - lw - 8, Math.max(8, x + 12))}px`;
  dica.style.top = `${Math.max(8, Math.min(window.innerHeight - lh - 8, yy - lh - 12))}px`;
}
function esconderDica() {
  dica.hidden = true;
  document.querySelectorAll('.alvo.ativo').forEach((a) => a.classList.remove('ativo'));
}

// ---------- vista: metodologia ----------
function vistaMetodologia() {
  marcarNav('metodologia');
  const def = {
    verdadeiro: 'Exato e sem omissões relevantes.',
    maioritariamente_verdadeiro: 'Certo no essencial, com imprecisões menores.',
    enganador: 'Factos certos usados para sugerir uma conclusão falsa, ou falta contexto decisivo.',
    maioritariamente_falso: 'Contém um elemento verdadeiro, mas o essencial está errado.',
    falso: 'Contrariado pelas fontes.',
    nao_verificavel: 'Não há dados públicos suficientes para decidir.',
  };
  mostrar(h('div', { class: 'metodo' },
    h('h1', {}, 'Como é feito'),
    h('p', {}, 'Todos os dias de manhã, um agente automático (Claude) pesquisa notícias, comunicados do partido, a atividade parlamentar e verificações já publicadas sobre o Chega no dia anterior. Escolhe até 10 acontecimentos e até 15 afirmações de dirigentes e deputados, e verifica as afirmações factuais contra fontes públicas. Cada item tem ligação para a fonte de onde foi tirado.'),
    h('h2', {}, 'Tipos de afirmação'),
    h('ul', {},
      h('li', {}, h('strong', {}, 'Factual: '), 'diz algo sobre o mundo que se pode confirmar ou refutar. É a única que recebe veredicto.'),
      h('li', {}, h('strong', {}, 'Promessa: '), 'compromisso para o futuro. Regista-se, sem veredicto.'),
      h('li', {}, h('strong', {}, 'Opinião: '), 'juízo de valor. Regista-se, sem veredicto.')),
    h('h2', {}, 'Escala de veredictos'),
    h('div', { class: 'tabela-wrap' }, h('table', {}, h('tbody', {},
      VEREDICTOS.map(([v]) => h('tr', {}, h('th', { scope: 'row' }, selo(v)), h('td', {}, def[v])))))),
    h('p', {}, 'Cada veredicto tem pelo menos duas evidências (exceto "não verificável") e um grau de confiança: alta quando assenta numa fonte primária, média com fact-checkers ou várias fontes concordantes, baixa com fontes indiretas.'),
    h('h2', {}, 'Que fontes contam'),
    h('ol', {},
      h('li', {}, 'Fontes primárias: INE, Pordata, Eurostat, Diário da República, Parlamento, Banco de Portugal, AIMA, RASI, DGO, CNE, tribunais.'),
      h('li', {}, 'Verificações já publicadas: Polígrafo, Observador Fact Check, Lusa, AFP.'),
      h('li', {}, 'Imprensa.')),
    h('p', {}, 'Wikipédia e resumos de motores de busca não contam como evidência.'),
    h('h2', {}, 'Limitações'),
    h('ul', {},
      h('li', {}, 'X, Facebook, Instagram e TikTok exigem sessão iniciada: as publicações nessas redes só entram quando estão indexadas ou são citadas pela imprensa.'),
      h('li', {}, 'Artigos com paywall podem ficar de fora; cada relatório lista o que não conseguiu consultar.'),
      h('li', {}, 'A verificação é automática. Pode errar: confirme sempre nas fontes ligadas antes de citar.'),
      h('li', {}, 'O mesmo padrão de prova aplicar-se-ia a qualquer partido. O número de afirmações falsas num dia depende do que foi dito e coberto nesse dia, não é uma medida da veracidade geral do partido.'))));
}

// ---------- encaminhamento ----------
async function encaminhar() {
  esconderDica();
  const rota = location.hash.replace(/^#\/?/, '');
  try {
    if (!indice) indice = await obterJSON('data/indice.json');
  } catch (e) {
    mostrar(h('p', { class: 'estado' }, `Não foi possível carregar o índice (${e.message}).`));
    return;
  }
  if (rota === 'historico') vistaHistorico();
  else if (rota === 'metodologia') vistaMetodologia();
  else if (rota.startsWith('dia/')) await vistaDia(rota.slice(4));
  else await vistaDia(null);
  if (rota) main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', encaminhar);
document.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('.alvo')) esconderDica(); });
encaminhar();
