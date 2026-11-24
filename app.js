// Monitor Político — dashboard. Só lê data/partidos.json, data/indice.json e data/relatorios/<partido>/*.json.
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
let partidos = [];
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

const nomePartido = (p) => partidos.find((x) => x.id === p)?.curto ?? p;
const diasDe = (p) => indice.partidos?.[p] ?? [];

// Cabeçalho comum das vistas de um partido: nome + Relatórios / Histórico.
function cabecalhoPartido(p, ativo) {
  const info = partidos.find((x) => x.id === p);
  return h('div', { class: 'cab-partido' },
    h('p', { class: 'partido-nome' }, info.curto, info.nome !== info.curto && h('span', { class: 'meta' }, ` · ${info.nome}`)),
    h('nav', { class: 'subnav', 'aria-label': `Secções de ${info.curto}` },
      h('a', { href: `#/${p}`, 'aria-current': ativo === 'dia' ? 'page' : null }, 'Relatórios'),
      h('a', { href: `#/${p}/historico`, 'aria-current': ativo === 'historico' ? 'page' : null }, 'Histórico')));
}

// ---------- vista: hoje (os três partidos) ----------
async function vistaHoje() {
  marcarNav('hoje');
  const ultimas = partidos.map((p) => diasDe(p.id)[0]?.data).filter(Boolean).sort();
  if (!ultimas.length) {
    mostrar(h('h1', {}, 'Ainda não há relatórios'),
      h('p', { class: 'vazio' }, 'O primeiro relatório diário aparece aqui depois da primeira execução.'));
    return;
  }
  const dia = ultimas[ultimas.length - 1];
  const cartoes = partidos.map((p) => {
    const e = diasDe(p.id).find((d) => d.data === dia);
    const cab = h('h2', {}, h('a', { href: `#/${p.id}` }, p.curto), p.nome !== p.curto && h('span', { class: 'meta' }, ` · ${p.nome}`));
    if (!e) {
      const ult = diasDe(p.id)[0];
      return h('li', { class: 'cartao partido' }, cab,
        h('p', { class: 'vazio' }, `${ND}: sem relatório para este dia.`),
        ult && h('p', {}, h('a', { href: `#/${p.id}/dia/${ult.data}` }, `Ver o último (${fmtData(ult.data, { day: 'numeric', month: 'short' })})`)));
    }
    return h('li', { class: 'cartao partido' }, cab,
      h('p', {}, e.resumo),
      h('p', { class: 'meta' }, `${e.n_acontecimentos} acontecimento${e.n_acontecimentos === 1 ? '' : 's'} · ${e.n_afirmacoes} afirmaç${e.n_afirmacoes === 1 ? 'ão' : 'ões'}`),
      h('ul', { class: 'contagem contagem-compacta', 'aria-label': `Afirmações de ${p.curto} por veredicto` },
        VEREDICTOS.map(([v, rot]) => h('li', {}, amostra(v), h('strong', {}, e.por_veredicto[v] ?? 0), rot)),
        h('li', {}, amostra('sem_veredicto'), h('strong', {}, e.por_veredicto.sem_veredicto ?? 0), 'Promessas e opiniões')),
      h('p', {}, h('a', { class: 'botao', href: `#/${p.id}/dia/${dia}` }, 'Ver o relatório completo')));
  });
  mostrar(
    h('h1', {}, fmtData(dia)),
    h('p', { class: 'nota' }, 'As contagens dependem do que cada partido disse e do que foi noticiado nesse dia; não comparam a veracidade dos partidos. Os três são verificados com o mesmo critério. ',
      h('a', { href: '#/metodologia' }, 'Como é feito')),
    h('ol', { class: 'lista partidos' }, cartoes));
}

// ---------- vista: um dia de um partido ----------
async function vistaDia(p, dataPedida) {
  marcarNav(p);
  const dias = diasDe(p);
  if (!dias.length) {
    mostrar(cabecalhoPartido(p, 'dia'), h('h1', {}, 'Ainda não há relatórios'),
      h('p', { class: 'vazio' }, `${ND}: o primeiro relatório de ${nomePartido(p)} aparece aqui depois da próxima execução diária.`));
    return;
  }
  const pos = dataPedida ? dias.findIndex((d) => d.data === dataPedida) : 0;
  if (pos < 0) {
    mostrar(cabecalhoPartido(p, 'dia'), h('h1', {}, fmtData(dataPedida)), h('p', { class: 'vazio' }, `${ND}: não há relatório de ${nomePartido(p)} para este dia.`),
      h('p', {}, h('a', { href: `#/${p}` }, 'Ver o relatório mais recente')));
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
  const ir = (d) => { location.hash = `#/${p}/dia/${d}`; };
  const sel = h('select', { 'aria-label': 'Escolher dia', onchange: (e) => ir(e.target.value) },
    dias.map((d) => h('option', { value: d.data, selected: d.data === entrada.data }, fmtData(d.data))));
  const nav = h('div', { class: 'dias' },
    h('button', { type: 'button', 'aria-label': 'Dia anterior', disabled: !anterior,
      onclick: () => ir(anterior.data) }, '‹'),
    sel,
    h('button', { type: 'button', 'aria-label': 'Dia seguinte', disabled: !seguinte,
      onclick: () => ir(seguinte.data) }, '›'));

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
          ligacao(f.url, f.titulo), ` — ${f.meio}`, f.data_publicacao ? `, ${fmtData(f.data_publicacao, { day: 'numeric', month: 'short' })}` : ''))))))
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
    lista.replaceChildren(...vis.map((f) => cartaoAfirmacao(f, p)));
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

  mostrar(cabecalhoPartido(p, 'dia'), nav, resumo, secAcs, secAfs, secCob);
}

function cartaoAfirmacao(f, p) {
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
      h('a', { href: `#/${p}/dia/${f.ver_tambem.split('#')[0]}` }, fmtData(f.ver_tambem.split('#')[0]))),
    ev.length > 0 && h('details', {},
      h('summary', {}, `Evidências (${ev.length})`),
      h('ul', { class: 'evidencias' }, ev.map((e) => h('li', {},
        h('span', { class: 'sentido' }, ROTULO_SENTIDO[e.sentido] ?? e.sentido), ' · ',
        ligacao(e.url, e.titulo), ` — ${e.entidade}`, e.data ? `, ${fmtData(e.data, { day: 'numeric', month: 'short', year: 'numeric' })}` : '')))));
}

// ---------- vista: histórico ----------
function vistaHistorico(p) {
  marcarNav(p);
  const dias = [...diasDe(p)].slice(0, 30).reverse(); // cronológico
  if (!dias.length) {
    mostrar(cabecalhoPartido(p, 'historico'), h('h1', {}, 'Histórico'), h('p', { class: 'vazio' }, `${ND}: ainda não há relatórios de ${nomePartido(p)}.`));
    return;
  }
  const chaves = [...VEREDICTOS.map(([v]) => v)];
  const totais = Object.fromEntries(chaves.map((k) => [k, dias.reduce((s, d) => s + (d.por_veredicto[k] ?? 0), 0)]));
  const nVerif = Object.values(totais).reduce((a, b) => a + b, 0);
  const nFalsas = totais.falso + totais.maioritariamente_falso;

  const grafico = graficoEmpilhado(dias, chaves, p);
  const legenda = h('ul', { class: 'legenda', 'aria-label': 'Legenda' },
    VEREDICTOS.map(([v, r]) => h('li', {}, amostra(v), r)));
  const tabela = h('details', {},
    h('summary', {}, 'Ver em tabela'),
    h('div', { class: 'tabela-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Dia'), h('th', { scope: 'col' }, 'Acont.'),
        VEREDICTOS.map(([, r]) => h('th', { scope: 'col' }, r)), h('th', { scope: 'col' }, 'Sem veredicto'))),
      h('tbody', {}, [...dias].reverse().map((d) => h('tr', {},
        h('th', { scope: 'row' }, h('a', { href: `#/${p}/dia/${d.data}` }, fmtData(d.data, { day: 'numeric', month: 'short' }))),
        h('td', {}, d.n_acontecimentos),
        chaves.map((k) => h('td', {}, d.por_veredicto[k] ?? 0)),
        h('td', {}, d.por_veredicto.sem_veredicto ?? 0)))))));

  mostrar(
    cabecalhoPartido(p, 'historico'),
    h('h1', {}, `Histórico — ${nomePartido(p)}`),
    h('section', { class: 'cartao resumo-dia' },
      h('p', {}, nVerif
        ? `Nos últimos ${dias.length} relatórios de ${nomePartido(p)} foram verificadas ${nVerif} afirmações factuais; ${nFalsas} (${Math.round((100 * nFalsas) / nVerif)}%) foram classificadas como falsas ou maioritariamente falsas.`
        : `Nos últimos ${dias.length} relatórios não houve afirmações factuais verificadas.`),
      h('p', { class: 'meta' }, 'A contagem depende de quais afirmações tiveram cobertura em cada dia; não é uma amostra estatística de tudo o que foi dito.')),
    h('section', { 'aria-labelledby': 't-graf' },
      h('h2', { id: 't-graf' }, 'Afirmações verificadas por dia, por veredicto'),
      h('div', { class: 'cartao' }, grafico, legenda, tabela)));
}

function graficoEmpilhado(dias, chaves, p) {
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
      if (ev.pointerType === 'mouse' || alvo.classList.contains('ativo')) location.hash = `#/${p}/dia/${d.data}`;
      else ver(ev);
    });
    alvo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') location.hash = `#/${p}/dia/${d.data}`; });
    s.append(alvo);
  });
  return s;
}

function mostrarDica(ev, d, alvo) {
  const temVeredictos = VEREDICTOS.some(([v]) => d.por_veredicto[v]);
  abrirDica(ev, alvo,
    h('strong', {}, fmtData(d.data)),
    temVeredictos
      ? h('ul', {}, VEREDICTOS.filter(([v]) => d.por_veredicto[v]).map(([v, r]) =>
        h('li', {}, h('span', { class: 'selo' }, amostra(v), r), h('strong', {}, d.por_veredicto[v]))))
      : h('div', {}, 'Sem afirmações verificadas'),
    h('div', { class: 'meta' }, 'Toque duas vezes ou Enter para abrir o dia'));
}
// Mostra a dica junto do elemento `alvo` (rato, toque ou teclado).
function abrirDica(ev, alvo, ...conteudo) {
  document.querySelectorAll('.alvo.ativo').forEach((a) => a.classList.remove('ativo'));
  alvo.classList.add('ativo');
  dica.replaceChildren(...conteudo);
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

// ---------- vista: comparar partidos ----------
const PERIODOS = [['7', '7 dias', 7], ['30', '30 dias', 30], ['tudo', 'Tudo', null]];
const AMOSTRA_PEQUENA = 10;
const pct = (n, t) => (t ? Math.round((100 * n) / t) : 0);

function vistaComparar(periodoPedido) {
  marcarNav('comparar');
  const periodo = PERIODOS.find(([id]) => id === periodoPedido) ?? PERIODOS[1];
  const todas = partidos.flatMap((p) => diasDe(p.id).map((d) => d.data)).sort();
  const cabeca = [
    h('h1', {}, 'Comparar partidos'),
    h('div', { class: 'cartao aviso' },
      h('p', {}, h('strong', {}, 'Como ler: '), 'as afirmações verificadas não são uma amostra aleatória. Dependem do que cada partido disse, do que foi noticiado e do que é verificável com dados públicos. O PSD inclui membros do Governo, que falam mais vezes e sobre mais números. Uma diferença entre partidos não mede, por si, quem é mais honesto.'),
      h('p', {}, h('a', { href: '#/metodologia' }, 'Como é feita a verificação'))),
  ];
  if (!todas.length) {
    mostrar(...cabeca, h('p', { class: 'vazio' }, `${ND}: ainda não há relatórios.`));
    return;
  }
  const fim = todas[todas.length - 1];
  let inicio = todas[0];
  if (periodo[2]) {
    const d = new Date(`${fim}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (periodo[2] - 1));
    inicio = d.toISOString().slice(0, 10);
  }
  const chaves = VEREDICTOS.map(([v]) => v);
  const linhas = partidos.map((p) => {
    const dias = diasDe(p.id).filter((d) => d.data >= inicio && d.data <= fim);
    const cont = Object.fromEntries(chaves.map((k) => [k, dias.reduce((s, d) => s + (d.por_veredicto[k] ?? 0), 0)]));
    const n = chaves.reduce((s, k) => s + cont[k], 0);
    return { p, dias: dias.length, cont, n };
  });

  const botoes = h('div', { class: 'periodos', role: 'group', 'aria-label': 'Período' },
    PERIODOS.map(([id, rot]) => h('button', { type: 'button', 'aria-pressed': id === periodo[0] ? 'true' : 'false',
      onclick: () => { location.hash = `#/comparar/${id}`; } }, rot)));

  const legenda = h('ul', { class: 'legenda', 'aria-label': 'Legenda' }, VEREDICTOS.map(([v, r]) => h('li', {}, amostra(v), r)));

  const barras = h('ol', { class: 'comparacao' }, linhas.map(({ p, dias, cont, n }) => {
    const titulo = h('h2', {}, p.curto);
    if (!n) {
      return h('li', {}, titulo, h('p', { class: 'vazio' }, `${ND}: sem afirmações factuais verificadas neste período (${dias} relatório${dias === 1 ? '' : 's'}).`));
    }
    const pequena = n < AMOSTRA_PEQUENA;
    const barra = h('div', { class: `barra100${pequena ? ' pequena' : ''}`, role: 'img',
      'aria-label': `${p.curto}: ` + VEREDICTOS.filter(([v]) => cont[v]).map(([v, r]) => `${r} ${pct(cont[v], n)}%`).join(', ') },
    VEREDICTOS.filter(([v]) => cont[v]).map(([v, r]) => {
      const seg = h('span', { class: `seg alvo${v === 'nao_verificavel' ? ' tracejado' : ''}`, tabindex: 0,
        style: `flex-grow: ${cont[v]}; background-color: var(--v-${v})`, 'aria-label': `${r}: ${cont[v]} (${pct(cont[v], n)}%)` });
      const ver = (ev) => abrirDica(ev, seg, h('strong', {}, p.curto), h('div', {}, h('span', { class: 'selo' }, amostra(v), r)),
        h('div', {}, `${cont[v]} de ${n} afirmações factuais (${pct(cont[v], n)}%)`));
      seg.addEventListener('pointerenter', ver);
      seg.addEventListener('pointermove', ver);
      seg.addEventListener('pointerleave', esconderDica);
      seg.addEventListener('click', ver);
      seg.addEventListener('focus', ver);
      seg.addEventListener('blur', esconderDica);
      return seg;
    }));
    const verdade = cont.verdadeiro + cont.maioritariamente_verdadeiro;
    const falso = cont.falso + cont.maioritariamente_falso;
    return h('li', {}, titulo, barra,
      h('p', { class: 'meta' }, `n = ${n} afirmaç${n === 1 ? 'ão factual' : 'ões factuais'} em ${dias} relatório${dias === 1 ? '' : 's'}`),
      h('p', {}, `${pct(verdade, n)}% verdadeiras ou maioritariamente verdadeiras · ${pct(cont.enganador, n)}% enganadoras · ${pct(falso, n)}% falsas ou maioritariamente falsas · ${pct(cont.nao_verificavel, n)}% não verificáveis`),
      pequena && h('p', { class: 'etiqueta-aviso' }, `Amostra pequena (menos de ${AMOSTRA_PEQUENA}) — não tirar conclusões.`));
  }));

  const tabela = h('details', {},
    h('summary', {}, 'Ver em tabela'),
    h('div', { class: 'tabela-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Partido'), h('th', { scope: 'col' }, 'n'),
        VEREDICTOS.map(([, r]) => h('th', { scope: 'col' }, r)))),
      h('tbody', {}, linhas.map(({ p, cont, n }) => h('tr', {},
        h('th', { scope: 'row' }, p.curto), h('td', {}, n),
        chaves.map((k) => h('td', {}, n ? `${cont[k]} (${pct(cont[k], n)}%)` : '—'))))))));

  mostrar(...cabeca,
    h('section', { 'aria-labelledby': 't-comp' },
      h('h2', { id: 't-comp' }, 'Veredictos das afirmações factuais, por partido'),
      h('p', { class: 'meta' }, `De ${fmtData(inicio)} a ${fmtData(fim)}. Promessas e opiniões não entram nesta conta.`),
      botoes,
      h('div', { class: 'cartao' }, legenda, barras, tabela)));
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
    h('p', {}, 'Todos os dias de manhã, um agente automático (Claude) pesquisa notícias, comunicados dos partidos, a atividade parlamentar e verificações já publicadas sobre o Chega, o PSD e o PS no dia anterior. Para cada partido escolhe até 7 acontecimentos e até 10 afirmações, e verifica as afirmações factuais contra fontes públicas. Cada item tem ligação para a fonte de onde foi tirado.'),
    h('h2', {}, 'Mesmo critério para os três'),
    h('p', {}, 'Os três partidos são tratados da mesma forma: os mesmos limites, a mesma escala de veredictos, as mesmas fontes e o mesmo esforço de pesquisa. As afirmações são escolhidas pela relevância e pelo conteúdo verificável, nunca para equilibrar ou desequilibrar resultados entre partidos.'),
    h('h2', {}, 'Quem conta em cada partido'),
    h('ul', {}, partidos.map((x) => h('li', {}, h('strong', {}, `${x.curto}: `), x.ambito))),
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
    h('h2', {}, 'Como ler a comparação'),
    h('p', {}, 'A página Comparar mostra, para cada partido, a percentagem das afirmações factuais verificadas em cada veredicto, num período à escolha. Não é uma medida da honestidade dos partidos: as afirmações não são escolhidas ao acaso, dependem do que cada partido disse e do que foi noticiado, e só entram as que têm conteúdo verificável. Mostramos sempre o número de afirmações (n) e marcamos como amostra pequena qualquer partido com menos de 10 no período. Os partidos aparecem sempre pela mesma ordem, nunca ordenados pelo resultado.'),
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
    if (!indice) [indice, partidos] = await Promise.all([obterJSON('data/indice.json'), obterJSON('data/partidos.json')]);
  } catch (e) {
    mostrar(h('p', { class: 'estado' }, `Não foi possível carregar o índice (${e.message}).`));
    return;
  }
  // Ligações antigas (só Chega): #/dia/AAAA-MM-DD e #/historico
  if (rota.startsWith('dia/') || rota === 'historico') {
    location.replace(`#/chega/${rota}`);
    return;
  }
  const [p, sec, dia] = rota.split('/');
  const ids = partidos.map((x) => x.id);
  if (rota === 'metodologia') vistaMetodologia();
  else if (p === 'comparar') vistaComparar(sec);
  else if (ids.includes(p) && sec === 'historico') vistaHistorico(p);
  else if (ids.includes(p) && sec === 'dia' && dia) await vistaDia(p, dia);
  else if (ids.includes(p)) await vistaDia(p, null);
  else await vistaHoje();
  if (rota) main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', encaminhar);
document.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('.alvo')) esconderDica(); });
encaminhar();
