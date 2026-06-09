// ── NAVIGATION ──────────────────────────────────────────────────────────────
const modules = document.querySelectorAll('.module');
const navItems = document.querySelectorAll('.nav-item');
let currentModule = 0;
const visited = new Set([0]);

function showModule(idx) {
  modules.forEach(m => m.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));
  modules[idx].classList.add('active');
  navItems[idx].classList.add('active');
  currentModule = idx;
  visited.add(idx);
  navItems[idx].classList.remove('done');
  updateProgress();
  window.scrollTo(0,0);
  document.getElementById('main').scrollTo(0,0);
}

navItems.forEach((item, i) => item.addEventListener('click', () => showModule(i)));

function updateProgress() {
  const pct = Math.round((visited.size / modules.length) * 100);
  document.getElementById('progress-fill').style.width = pct + '%';
  document.querySelector('#progress-bar-wrap span').textContent = `${pct}% completado`;
}

// ── TOOLTIPS ─────────────────────────────────────────────────────────────────
const tooltipDefs = {
  'AS': 'Autonomous System: colección de redes bajo una misma política administrativa de routing.',
  'ASN': 'Autonomous System Number: identificador único de un AS. Privado: 64512–65534.',
  'BGP Speaker': 'Router que ejecuta el protocolo BGP y puede establecer sesiones con otros speakers.',
  'eBGP': 'External BGP: sesión BGP entre routers de ASes distintos.',
  'iBGP': 'Internal BGP: sesión BGP entre routers dentro del mismo AS.',
  'AS-PATH': 'Lista de ASes que una ruta ha atravesado. Más corto = más preferido.',
  'LOCAL-PREF': 'Métrica interna que controla por dónde sale el tráfico del AS. Mayor = preferido.',
  'MED': 'Multi-Exit Discriminator: sugiere al vecino por cuál enlace entrar. Menor = preferido.',
  'NEXT-HOP': 'IP del router frontera que conoce cómo llegar al prefijo destino.',
  'COMMUNITY': 'Etiqueta de 32 bits para aplicar políticas de routing en grupo.',
  'ORIGIN': 'Indica cómo el prefijo llegó a BGP: IGP (i) > EGP (e) > Incomplete (?)',
  'Prepend': 'Técnica de añadir el propio ASN múltiples veces al AS-PATH para degradar la ruta.',
  'Route Reflector': 'Router iBGP que distribuye rutas a sus clients sin necesidad de full-mesh.',
  'Hold Timer': 'Tiempo máximo sin mensajes BGP antes de declarar la sesión caída. Default: 90s.',
  'Loc-RIB': 'Local Routing Information Base: tabla de las mejores rutas seleccionadas localmente.',
};

const tip = document.getElementById('tooltip');
document.querySelectorAll('.tooltip-term').forEach(el => {
  const key = el.dataset.tip || el.textContent.trim();
  el.addEventListener('mouseenter', e => {
    tip.textContent = tooltipDefs[key] || '';
    tip.style.display = 'block';
    moveTip(e);
  });
  el.addEventListener('mousemove', moveTip);
  el.addEventListener('mouseleave', () => tip.style.display = 'none');
});
function moveTip(e) {
  tip.style.left = (e.pageX + 14) + 'px';
  tip.style.top = (e.pageY - 8) + 'px';
}

// ── FSM ───────────────────────────────────────────────────────────────────────
const fsmData = {
  Idle: {
    color: '#8b949e',
    desc: 'Estado inicial del BGP speaker. No acepta conexiones todavía.',
    detail: 'En este estado, BGP no tiene recursos inicializados. Espera un evento de inicio manual (ME01) o automático (OE03). Al ocurrir, inicializa recursos, arranca el Connect Retry Timer e inicia una conexión TCP al peer.',
    next: 'Connect',
    event: 'ME01 / OE03 (inicio)'
  },
  Connect: {
    color: '#d29922',
    desc: 'Esperando que se establezca la conexión TCP al peer.',
    detail: 'El speaker espera que el TCP handshake complete. Si tiene éxito (ME16), envía un mensaje OPEN y avanza. Si falla o el Connect Retry Timer expira (ME09), pasa a Active. Si recibe una conexión entrante válida, también avanza.',
    next: 'OpenSent',
    event: 'ME16 (TCP establecido)'
  },
  Active: {
    color: '#f85149',
    desc: 'TCP falló. Intentando reconectar activamente.',
    detail: 'Estado de reintento. El speaker intenta establecer TCP nuevamente. Si persiste aquí mucho tiempo, indica problema de configuración (IP incorrecta, ACL, etc.). Al lograr TCP (ME16 / ME17), avanza a OpenSent.',
    next: 'OpenSent',
    event: 'ME16/ME17 (nuevo TCP)'
  },
  OpenSent: {
    color: '#58a6ff',
    desc: 'TCP establecido. Mensaje OPEN enviado. Esperando OPEN del peer.',
    detail: 'El speaker envió su OPEN message con: versión BGP (4), su ASN, Hold Time propuesto y BGP Identifier. Ahora espera el OPEN del otro lado (ME19). Si hay error en el OPEN recibido (ME22), envía NOTIFICATION y vuelve a Idle.',
    next: 'OpenConfirm',
    event: 'ME19 (OPEN válido recibido)'
  },
  OpenConfirm: {
    color: '#bc8cff',
    desc: 'OPEN recibido y válido. KEEPALIVE enviado. Esperando KEEPALIVE del peer.',
    detail: 'Los parámetros del OPEN fueron aceptados. El speaker envió KEEPALIVE como confirmación. Espera el KEEPALIVE del peer (ME26). Si el Hold Timer expira (ME10) antes de recibirlo, envía NOTIFICATION y vuelve a Idle.',
    next: 'Established',
    event: 'ME26 (KEEPALIVE recibido)'
  },
  Established: {
    color: '#3fb950',
    desc: '¡Sesión BGP operativa! Se intercambian UPDATE y KEEPALIVE.',
    detail: 'La sesión está completamente funcional. El speaker puede enviar y recibir UPDATE messages con rutas. Los KEEPALIVE se intercambian periódicamente (cada ~30s). Si el Hold Timer expira (ME10) o se recibe NOTIFICATION (ME25), la sesión cae a Idle.',
    next: null,
    event: null
  }
};

let fsmActive = 'Idle';
function renderFSM() {
  const states = ['Idle','Connect','Active','OpenSent','OpenConfirm','Established'];
  const wrap = document.getElementById('fsm-states');
  wrap.innerHTML = '';
  states.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'fsm-state' + (s === fsmActive ? (s==='Established'?' established':' active') : '');
    el.textContent = s;
    el.style.borderColor = s === fsmActive ? fsmData[s].color : '';
    el.style.color = s === fsmActive ? fsmData[s].color : '';
    el.addEventListener('click', () => { fsmActive = s; renderFSM(); });
    wrap.appendChild(el);
    if (i < states.length - 1) {
      const arr = document.createElement('div');
      arr.className = 'fsm-arrow'; arr.textContent = '→';
      wrap.appendChild(arr);
    }
  });
  const d = fsmData[fsmActive];
  document.getElementById('fsm-detail').innerHTML =
    `<strong style="color:${d.color}">${fsmActive}</strong>${d.detail}
    ${d.next ? `<div style="margin-top:10px;font-size:12px;color:#8b949e">▶ Siguiente: <span style="color:${fsmData[d.next].color}">${d.next}</span> — evento: <code style="background:#21262d;padding:2px 6px;border-radius:4px;font-family:monospace;color:#39d353">${d.event}</code></div>` : '<div style="margin-top:10px;font-size:12px;color:#3fb950">✓ Sesión completamente operativa. Fin del establecimiento.</div>'}`;
}
if(document.getElementById('fsm-states')) renderFSM();

document.getElementById('fsm-next')?.addEventListener('click', () => {
  const order = ['Idle','Connect','OpenSent','OpenConfirm','Established'];
  const i = order.indexOf(fsmActive);
  if (i < order.length - 1) { fsmActive = order[i+1]; renderFSM(); }
});
document.getElementById('fsm-reset')?.addEventListener('click', () => { fsmActive = 'Idle'; renderFSM(); });

// ── PATH ATTRIBUTES ───────────────────────────────────────────────────────────
document.querySelectorAll('.attr-card').forEach(card => {
  card.addEventListener('click', () => {
    const wasOpen = card.classList.contains('open');
    document.querySelectorAll('.attr-card').forEach(c => c.classList.remove('open'));
    if (!wasOpen) card.classList.add('open');
  });
});

// AS-PATH Prepend slider
const prependSlider = document.getElementById('prepend-slider');
const prependDemo = document.getElementById('prepend-demo');
if (prependSlider) {
  prependSlider.addEventListener('input', () => {
    const n = parseInt(prependSlider.value);
    const path = Array(n).fill('65001').join(' ');
    prependDemo.innerHTML = `
      <div class="prepend-row"><span class="as-box">AS-PATH: [${path}, 65000]</span><span class="label">← ${n === 1 ? 'Normal (Sitio Matriz — preferido)' : `Prepend ×${n-1} (ruta degradada — backup)`}</span></div>
      <div style="margin-top:6px;font-size:12px;color:#8b949e">Longitud del AS-PATH: ${n+1} saltos. ${n > 1 ? '⚠ El ISP prefiere el camino más corto → este sitio es backup.' : '✓ Ruta preferida por AS-PATH más corto.'}</div>`;
  });
  prependSlider.dispatchEvent(new Event('input'));
}

// LOCAL-PREF slider
const lpSlider = document.getElementById('lp-slider');
const lpDemo = document.getElementById('lp-demo');
if (lpSlider) {
  lpSlider.addEventListener('input', () => {
    const v = parseInt(lpSlider.value);
    const winner = v >= 100 ? 'ISP Principal' : 'ISP Backup';
    lpDemo.innerHTML = `<div style="font-size:13px">ISP Principal LOCAL-PREF: <strong style="color:#3fb950">${v}</strong> | ISP Backup: <strong style="color:#8b949e">100</strong><br><span style="color:#8b949e;font-size:12px;margin-top:4px;display:block">Tráfico de salida → <strong style="color:${v>=100?'#3fb950':'#f85149'}">${winner}</strong> ${v===100?'(empate → siguiente criterio)':''}</span></div>`;
  });
  lpSlider.dispatchEvent(new Event('input'));
}

// ── BGP DECISION PROCESS ──────────────────────────────────────────────────────
const decisionSteps = [
  { label: 'Import Policy & Filtering', desc: 'Descartar prefijos de espacios inválidos (IPs privadas, ASNs privados en eBGP).' },
  { label: 'LOCAL-PREF más alto', desc: 'Mayor LOCAL-PREF gana. Controla la salida del AS.' },
  { label: 'Ruta originada localmente', desc: 'Preferir ruta generada en este mismo speaker.' },
  { label: 'AS-PATH más corto', desc: 'Menor cantidad de ASes en el path gana. El prepend afecta aquí.' },
  { label: 'ORIGIN más bajo', desc: 'IGP (i) > EGP (e) > Incomplete (?). Indica confiabilidad.' },
  { label: 'MED más bajo', desc: 'Menor MED gana. Solo aplica si ambas rutas vienen del mismo AS vecino.' },
  { label: 'eBGP > iBGP', desc: 'Rutas aprendidas vía eBGP se prefieren sobre iBGP.' },
  { label: 'IGP metric al NEXT-HOP menor', desc: 'Hot potato routing: minimizar el recorrido interno.' },
  { label: 'BGP Identifier del peer eBGP más bajo', desc: 'Desempate por IP del peer eBGP.' },
  { label: 'BGP Identifier del peer iBGP más bajo', desc: 'Desempate final por IP del peer iBGP.' }
];

let decisionRoute = { lp: 200, prepend: 1, origin: 'IGP' };
let decisionRoute2 = { lp: 100, prepend: 2, origin: 'IGP' };

function renderDecision() {
  const container = document.getElementById('decision-steps');
  if (!container) return;
  let winner = null; let winStep = -1;

  // Determine winner step
  if (decisionRoute.lp !== decisionRoute2.lp) { winner = decisionRoute.lp > decisionRoute2.lp ? 1 : 2; winStep = 1; }
  else if (decisionRoute.prepend !== decisionRoute2.prepend) { winner = decisionRoute.prepend < decisionRoute2.prepend ? 1 : 2; winStep = 3; }

  container.innerHTML = decisionSteps.map((s,i) => {
    const isWin = winStep === i;
    const isActive = !winner && i < 3;
    return `<div class="step ${isWin?'winner':''} ${isActive&&!winner?'active-step':''}">
      <div class="step-num">${i+1}</div>
      <div class="step-text"><strong>${s.label}</strong><p>${s.desc}</p>
      ${isWin?`<p style="color:#3fb950;margin-top:4px">→ Gana Ruta ${winner} aquí. Decisión finalizada.</p>`:''}
      </div></div>`;
  }).join('');
}

document.getElementById('sim-lp')?.addEventListener('input', e => {
  decisionRoute.lp = parseInt(e.target.value);
  document.getElementById('lp-val').textContent = e.target.value;
  renderDecision();
});
document.getElementById('sim-prepend')?.addEventListener('input', e => {
  decisionRoute.prepend = parseInt(e.target.value);
  document.getElementById('pp-val').textContent = e.target.value;
  renderDecision();
});
renderDecision();

// ── ROUTE FLAP DAMPENING ──────────────────────────────────────────────────────
function initFlapChart() {
  const canvas = document.getElementById('flap-chart');
  if (!canvas || !window.Chart) return;
  const H = 7.5, Pinc = 1000, suppress = 2000, reuse = 750;
  const flaps = [2, 4, 6, 8, 10]; // flap times in minutes
  const tmax = 35;
  const labels = [], data1 = [];
  let t = 0, P = 0, lastFlap = -1;
  while (t <= tmax) {
    if (flaps.includes(parseFloat(t.toFixed(1)))) {
      if (lastFlap >= 0) P = P * Math.pow(2, -(t - lastFlap) / H);
      else P = 0;
      P += Pinc; lastFlap = t;
    } else if (lastFlap >= 0) {
      P = Pinc * Math.pow(2, -(t - lastFlap) / H) + (P - Pinc * Math.pow(2, -(t - lastFlap) / H));
      // simplified decay
    }
    if (lastFlap >= 0) P = Math.max(0, Pinc * Math.pow(2, -(t - flaps[flaps.filter(f=>f<=t).length-1])/H) * Math.pow(2, flaps.filter(f=>f<=t).length));
    labels.push(t.toFixed(1)); data1.push(Math.round(P));
    t = parseFloat((t + 0.5).toFixed(1));
  }
  // Simplified: just show a representative curve
  const times = Array.from({length:71}, (_,i) => (i*0.5).toFixed(1));
  const penalty = times.map(t => {
    t = parseFloat(t);
    const flapCount = flaps.filter(f => f <= t).length;
    if (flapCount === 0) return 0;
    const lastF = flaps.filter(f => f <= t).slice(-1)[0];
    let P = 0;
    flaps.filter(f=>f<=t).forEach((f,i) => { P += Pinc * Math.pow(2, -(t-f)/H); });
    return Math.round(P);
  });
  new Chart(canvas, {
    type:'line',
    data:{ labels:times,
      datasets:[
        { label:'Penalidad', data:penalty, borderColor:'#58a6ff', fill:true, backgroundColor:'rgba(88,166,255,0.08)', tension:0.3, pointRadius:0 },
        { label:'Suppress limit (2000)', data:times.map(()=>suppress), borderColor:'#f85149', borderDash:[5,5], pointRadius:0, fill:false },
        { label:'Reuse limit (750)', data:times.map(()=>reuse), borderColor:'#3fb950', borderDash:[5,5], pointRadius:0, fill:false }
      ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'#8b949e', font:{size:11} } } },
      scales:{
        x:{ grid:{color:'#21262d'}, ticks:{color:'#8b949e', maxTicksLimit:12}, title:{display:true, text:'Tiempo (min)', color:'#8b949e'} },
        y:{ grid:{color:'#21262d'}, ticks:{color:'#8b949e'}, min:0, max:3000 }
      }
    }
  });
}

// ── PLAYGROUND ────────────────────────────────────────────────────────────────
const scenarios = {
  basic: {
    nodes: [
      { id:'cliente', label:'Cliente', asn:'AS 65001', x:80, y:155, prefixes:['192.0.2.0/24'], lp:100 },
      { id:'claro', label:'ISP-Ejemplo', asn:'AS 65000', x:380, y:155, prefixes:[], lp:100 }
    ],
    links: [{ from:'cliente', to:'claro', type:'eBGP', prepend:1 }],
    desc:'Topología básica: cliente con un solo enlace al ISP. El prefijo 192.0.2.0/24 se anuncia hacia AS 65000.'
  },
  backup: {
    nodes: [
      { id:'matriz', label:'Sitio Matriz', asn:'AS 65001', x:60, y:80, prefixes:['192.0.2.0/24'], lp:200 },
      { id:'alterno', label:'Sitio Alterno', asn:'AS 65001', x:60, y:240, prefixes:['203.0.113.0/24'], lp:100 },
      { id:'claro', label:'ISP-Ejemplo', asn:'AS 65000', x:380, y:160, prefixes:[], lp:100 }
    ],
    links: [
      { from:'matriz', to:'claro', type:'eBGP', prepend:1, primary:true },
      { from:'alterno', to:'claro', type:'eBGP', prepend:2, primary:false }
    ],
    desc:'Solución Karina: dos servicios independientes. Sitio Matriz = principal (prepend ×1). Sitio Alterno = backup (prepend ×2). Bloques /24 distintos por sitio.'
  },
  rr: {
    nodes: [
      { id:'rr', label:'Route Reflector', asn:'RR', x:280, y:155, prefixes:[], lp:100 },
      { id:'r1', label:'Router 1', asn:'iBGP', x:80, y:60, prefixes:['10.1.0.0/24'], lp:100 },
      { id:'r2', label:'Router 2', asn:'iBGP', x:80, y:250, prefixes:['10.2.0.0/24'], lp:100 },
      { id:'r3', label:'Router 3', asn:'iBGP', x:480, y:155, prefixes:['10.3.0.0/24'], lp:100 }
    ],
    links: [
      { from:'r1', to:'rr', type:'iBGP', prepend:1 },
      { from:'r2', to:'rr', type:'iBGP', prepend:1 },
      { from:'r3', to:'rr', type:'iBGP', prepend:1 }
    ],
    desc:'Route Reflector: 3 routers iBGP hablan solo con el RR. Sin RR necesitarían full-mesh (3 sesiones). Con RR: 3 sesiones. Para N routers: N vs N×(N-1)/2.'
  }
};

let pgScenario = 'backup';
let pgNodeDown = null;

function renderPlayground(scenario) {
  const s = scenarios[scenario];
  const canvas = document.getElementById('pg-canvas');
  const svg = document.getElementById('pg-svg');
  if (!canvas) return;

  // Clear
  canvas.querySelectorAll('.pg-node').forEach(n => n.remove());
  svg.innerHTML = '';

  // Draw links
  s.links.forEach(link => {
    const from = s.nodes.find(n => n.id === link.from);
    const to = s.nodes.find(n => n.id === link.to);
    if (!from || !to) return;
    const x1 = from.x + 50, y1 = from.y + 35;
    const x2 = to.x + 50, y2 = to.y + 35;
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',x1); line.setAttribute('y1',y1);
    line.setAttribute('x2',x2); line.setAttribute('y2',y2);
    line.setAttribute('stroke', pgNodeDown === from.id || pgNodeDown === to.id ? '#f85149' : (link.primary === false ? '#d29922' : '#58a6ff'));
    line.setAttribute('stroke-width', link.primary === false ? '2' : '2.5');
    line.setAttribute('stroke-dasharray', link.primary === false ? '6,4' : '');
    line.setAttribute('opacity', pgNodeDown === from.id || pgNodeDown === to.id ? '0.3' : '1');
    svg.appendChild(line);

    // Label on link
    const mx = (x1+x2)/2, my = (y1+y2)/2 - 10;
    const text = document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x',mx); text.setAttribute('y',my);
    text.setAttribute('fill','#8b949e'); text.setAttribute('font-size','10');
    text.setAttribute('text-anchor','middle');
    const prepStr = link.prepend > 1 ? ` prepend×${link.prepend-1}` : '';
    text.textContent = `${link.type}${prepStr}`;
    svg.appendChild(text);
  });

  // Draw nodes
  s.nodes.forEach(node => {
    const el = document.createElement('div');
    el.className = 'pg-node' + (pgNodeDown === node.id ? ' style="opacity:.3"' : '');
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    if (pgNodeDown === node.id) el.style.opacity = '0.3';
    el.innerHTML = `<span style="font-size:11px;font-weight:700">${node.label}</span><span class="asn">${node.asn}</span>${node.prefixes.length ? `<span style="font-size:9px;color:#39d353;margin-top:2px">${node.prefixes[0]}</span>` : ''}`;
    el.addEventListener('click', () => {
      if (!node.id.includes('claro') && !node.id.includes('rr')) {
        pgNodeDown = pgNodeDown === node.id ? null : node.id;
        renderPlayground(pgScenario);
        updatePgLog(node);
      }
    });
    canvas.appendChild(el);
  });

  document.getElementById('pg-desc').textContent = s.desc;
}

function updatePgLog(node) {
  const log = document.getElementById('pg-log');
  if (!log) return;
  if (pgNodeDown) {
    log.innerHTML = `<span style="color:#f85149">⚠ ${node.label} caído.</span> Las sesiones BGP hacia este nodo se interrumpen. Los anuncios de sus prefijos se retiran. El peer detecta la caída cuando el Hold Timer (90s) expira sin KEEPALIVE. <span style="color:#d29922">BGP converge hacia la ruta alternativa si existe.</span>`;
  } else {
    log.innerHTML = `<span style="color:#3fb950">✓ ${node.label} recuperado.</span> La sesión BGP se restablece (FSM: Idle → Connect → Established). Se re-anuncian todos los prefijos con full route exchange.`;
  }
}

document.querySelectorAll('.pg-scenario-btn')?.forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pg-scenario-btn').forEach(b => b.classList.remove('btn-primary'));
    document.querySelectorAll('.pg-scenario-btn').forEach(b => b.classList.add('btn-secondary'));
    btn.classList.add('btn-primary'); btn.classList.remove('btn-secondary');
    pgScenario = btn.dataset.scenario;
    pgNodeDown = null;
    document.getElementById('pg-log').textContent = 'Haz click en un nodo para simular una falla.';
    renderPlayground(pgScenario);
  });
});

// ── QUIZ ──────────────────────────────────────────────────────────────────────
const quizzes = {
  0: { q:'¿Qué protocolo usa BGP para transporte confiable de mensajes?', opts:['UDP 53','TCP 179','TCP 443','ICMP'], correct:1, exp:'BGP usa TCP puerto 179. La sesión TCP actúa como "virtual link" entre ASes. Si cae el TCP, BGP debe dejar de usar las rutas aprendidas de ese peer.' },
  1: { q:'Si el AS-PATH de una ruta es [65001, 65001, 65000] y otra es [65001, 65000], ¿cuál prefiere BGP?', opts:['La primera (path más largo)','La segunda (path más corto)','Ambas igual','Depende del Hold Timer'], correct:1, exp:'BGP prefiere el AS-PATH más corto (paso 4 del algoritmo de decisión). Menos saltos = ruta más preferida. El prepend [65001, 65001] hace la ruta menos atractiva deliberadamente.' },
  2: { q:'¿Por qué un iBGP speaker no puede re-anunciar rutas aprendidas de otro iBGP speaker?', opts:['Por limitación de memoria','Para evitar loops ya que el ASN no se añade al AS-PATH en iBGP','Porque iBGP solo usa UDP','Por el Hold Timer'], correct:1, exp:'En iBGP el AS number no se añade al AS-PATH (es el mismo AS). Sin ese mecanismo anti-loop, las rutas podrían circular indefinidamente entre iBGP speakers. Por eso existe la Regla 2.' },
  3: { q:'¿Qué atributo controla por cuál enlace SALE el tráfico de un AS?', opts:['MED','AS-PATH','LOCAL-PREF','NEXT-HOP'], correct:2, exp:'LOCAL-PREF es un atributo interno (no sale del AS) que indica la preferencia de salida. Mayor LOCAL-PREF = enlace preferido para salir. MED en cambio influye en cómo ENTRA el tráfico desde el AS vecino.' },
  4: { q:'¿Cuántas sesiones iBGP se necesitan en full-mesh con 5 routers?', opts:['5','10','15','20'], correct:1, exp:'Full-mesh requiere N×(N-1)/2 sesiones. Con 5 routers: 5×4/2 = 10 sesiones. Por eso Route Reflectors son esenciales en redes grandes.' }
};

let quizAnswered = {};
document.querySelectorAll('.quiz-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    const qid = parseInt(opt.closest('.quiz-wrap').dataset.qid);
    if (quizAnswered[qid]) return;
    quizAnswered[qid] = true;
    const chosen = parseInt(opt.dataset.idx);
    const q = quizzes[qid];
    opt.closest('.quiz-wrap').querySelectorAll('.quiz-opt').forEach((o,i) => {
      if (i === q.correct) o.classList.add('correct');
      else if (i === chosen && chosen !== q.correct) o.classList.add('wrong');
    });
    opt.closest('.quiz-wrap').querySelector('#quiz-feedback').innerHTML =
      `<span style="color:${chosen===q.correct?'#3fb950':'#f85149'}">${chosen===q.correct?'✓ Correcto!':'✗ Incorrecto.'}</span> ${q.exp}`;
  });
});

// ── INIT ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  renderFSM();
  renderDecision();
  renderPlayground('backup');
  if(window.Chart) initFlapChart();
  updateProgress();
  // Mark nav items for locked modules
  document.querySelectorAll('.nav-item[data-locked]').forEach(item => {
    item.style.opacity = '0.5';
  });
});
