/* Пантеон: Хроники богов — интерфейс «рабочий стол с вкладками». */
'use strict';
const D = window.PD, E = window.PE;
const QS = new URLSearchParams(location.search);
const SAVE = 'pantheon-v1' + (QS.get('slot') ? '-' + QS.get('slot') : '');
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TABS = [['hero', 'ГЕРОЙ'], ['omens', 'ЗНАМЕНИЯ'], ['pantheon', 'ПАНТЕОН'], ['world', 'МИР']];
const MAX_HEROES = 5;

let S = null, TAB = 'hero', SEL = null, BR = 'help', TGT = null, LASTRES = null, lastTick = 0, sig = '', unread = 0, WTAB = 'chron';
const UI = { creating: null };

/* ---------- сохранение ---------- */
function save() { if (!S) return; S.real = Date.now(); try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) { } }
function loadSave() { try { const j = localStorage.getItem(SAVE); return j ? E.load(j) : null; } catch (e) { return null; } }
setInterval(save, 5000);
addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

/* ---------- утилиты ---------- */
const sph = () => D.SPHERES[S.god.sph];
const godTitle = () => sph().titles[S.god.g === 'f' ? 1 : 0];
const hero = id => S.heroes.find(h => h.id === id);
const alive = () => S.heroes.filter(h => h.alive);
const raceName = h => D.RACES[h.race].n[h.g === 'f' ? 1 : 0];
const realDur = hours => {
  const sec = hours / E.SPEEDS[S.speed].hps;
  if (sec < 60) return Math.max(1, Math.round(sec)) + ' с';
  if (sec < 3600) return Math.round(sec / 60) + ' мин';
  if (sec < 86400) return (sec / 3600).toFixed(sec < 36000 ? 1 : 0).replace('.', ',') + ' ч';
  return (sec / 86400).toFixed(1).replace('.', ',') + ' сут';
};
const tStr = T => { const d = Math.floor(T / 24); return `д${d % 365 + 1} ${String(T % 24).padStart(2, '0')}:00`; };
function toast(txt, cls, fn) {
  const el = document.createElement('div'); el.className = 'toast ' + (cls || ''); el.textContent = txt;
  el.onclick = () => { el.remove(); fn && fn(); };
  $('#toasts').appendChild(el);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  setTimeout(() => el.remove(), cls === 'death' ? 12000 : 7000);
}
let actx = null;
function chime(kind) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'death' ? [330, 247, 196] : kind === 'event' ? [660, 880] : [880, 1320];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime + i * 0.14; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.start(t); o.stop(t + 0.55);
    });
  } catch (e) { }
}

/* ---------- запуск ---------- */
function boot() {
  NET.cb = { me: () => ({ god: godPub(), heroes: S ? S.heroes.filter(h => h.alive).map(h => E.summary(h, S)) : [] }), onMsg: netMsg, onState: () => { if (TAB === 'pantheon' || TAB === 'omens') render(true); renderTabs(); }, onError: e => toast(e, 'ev') };
  S = loadSave();
  if (!S) { titleScreen(); return; }
  catchUp();
  startGame();
}
function godPub() { return S ? { id: S.god.id, name: S.god.name, g: S.god.g, sph: S.god.sph } : null; }
function catchUp() {
  const sp = E.SPEEDS[S.speed];
  const secs = Math.max(0, (Date.now() - (S.real || Date.now())) / 1000);
  if (!sp.off || S.paused || secs < 5) return;
  const hours = Math.min(secs * sp.hps, 24 * 365);
  const T0 = S.T;
  const notes = E.advance(S, hours, false);
  const evs = notes.filter(n => n.k === 'event').length, deaths = notes.filter(n => n.k === 'death'), ok = notes.filter(n => n.k === 'res' && n.ok).length, bad = notes.filter(n => n.k === 'res' && !n.ok).length;
  if (S.T - T0 < 1) return;
  const days = Math.round((S.T - T0) / 24);
  modal(`<h3>Пока ты дремал${S.god.g === 'f' ? 'а' : ''} на облаке…</h3>
    <p class="muted">Прошло ${days ? days + ' дн.' : (S.T - T0) + ' ч'} жизни смертных. Без твоего присмотра случилось событий: ${evs}. Справились — ${ok}, пострадали — ${bad}.</p>
    ${deaths.map(d => `<p style="color:var(--red)">${esc(d.txt)}</p>`).join('')}
    ${notes.filter(n => n.k === 'world').slice(-3).map(n => `<p class="muted">${esc(n.txt)}</p>`).join('')}
    <div class="row" style="justify-content:flex-end"><button class="b gold" onclick="closeModal()">Вернуться к делам</button></div>`);
}
function startGame() {
  $('#screen').innerHTML = ''; $('#app').hidden = false;
  document.documentElement.style.setProperty('--sph', sph().col);
  if (!SEL || !hero(SEL)) SEL = (alive()[0] || S.heroes[0] || {}).id || null;
  if (!S.heroes.length) { heroScreen(); return; }
  lastTick = performance.now();
  render(true);
  const j = QS.get('join');
  if (j && !NET.role) { TAB = 'pantheon'; NET.join(j); }
}
setInterval(tick, 250);
function tick() {
  const now = performance.now(), dt = Math.min(5, (now - lastTick) / 1000); lastTick = now;
  if (!S || $('#app').hidden) return;
  if (!S.paused) {
    const notes = E.advance(S, dt * E.SPEEDS[S.speed].hps, true);
    if (notes.length) handleNotes(notes);
  }
  render();
}
function handleNotes(notes) {
  let sound = null;
  for (const n of notes) {
    const h = n.hid && hero(n.hid);
    if (n.k === 'event') { toast('⚠ ' + n.txt, 'ev', () => { SEL = n.hid; setTab('hero'); }); sound = sound || 'event'; }
    else if (n.k === 'death') { toast(n.txt, 'death', () => { SEL = n.hid; setTab('hero'); }); sound = 'death'; save(); }
    else if (n.k === 'world') toast(n.txt, 'world');
    else if (n.k === 'ms') toast('★ ' + n.txt);
    else if (n.k === 'res' && h && (h.id === SEL || notes.length < 3)) toast((n.ok ? '✔ ' : '✘ ') + n.txt, n.ok ? '' : 'ev');
  }
  if (sound) chime(sound);
  if (notes.some(n => n.k === 'event') && document.hidden) document.title = '(!) Пантеон';
}
addEventListener('focus', () => { document.title = 'Пантеон: Хроники богов'; });

/* ---------- рендер ---------- */
function setTab(t) { TAB = t; if (t === 'pantheon') unread = 0; LASTRES = t === 'omens' ? LASTRES : null; render(true); scrollTo({ top: 0 }); }
function render(force) {
  if (!S) return;
  renderTop();
  const s = [TAB, SEL, BR, TGT && TGT.id, WTAB, S.T, Math.floor(S.god.faith), S.paused, S.speed, S.heroes.map(h => h.feed.length + ':' + (h.ev ? h.ev.mod : '-') + ':' + h.alive).join(','), S.chat.length, NET.status, Object.keys(NET.gods).length].join('|');
  if (!force && s === sig) return;
  sig = s;
  renderTabs();
  const v = $('#view');
  const keepFocus = document.activeElement && document.activeElement.id === 'chatText';
  if (TAB === 'hero') v.innerHTML = viewHero();
  else if (TAB === 'omens') v.innerHTML = viewOmens();
  else if (TAB === 'pantheon') { if (!keepFocus || !$('#chatLog')) v.innerHTML = viewPantheon(); else { $('#chatLog').outerHTML = chatLog(); $('#colon').outerHTML = colonnade(); } scrollChat(); }
  else v.innerHTML = viewWorld();
}
function renderTop() {
  const d = E.dateStr(S), sp = E.SPEEDS[S.speed];
  $('#top').innerHTML = `
    <div class="godname"><div class="ico">${sph().ico}</div><div><b>${esc(S.god.name)}</b><small>${S.god.g === 'f' ? 'Богиня' : 'Бог'} сферы «${sph().n}» · ${godTitle()}</small></div></div>
    <div class="hstat">
      <span class="pill faith" title="Очки веры: тратятся на знамения. Прирост в день: ${E.income(S).toFixed(1)}">✦ ${Math.floor(S.god.faith)} веры</span>
      <span class="pill" title="Время мира">📅 <span class="long">${d.s}, </span><span class="short">${d.day} ${d.season.toLowerCase().slice(0, 3)}. ${d.y} г., </span>${String(d.hour).padStart(2, '0')}:00</span>
      <span class="pill btn ${S.paused ? 'paused' : ''}" onclick="togglePause()" title="Скорость: ${sp.n}">${S.paused ? '⏸ пауза' : '▶ ' + sp.s}</span>
    </div>`;
}
function renderTabs() {
  const evN = alive().filter(h => h.ev).length;
  $('#tabs').innerHTML = TABS.map(([id, n]) => `<button class="${TAB === id ? 'on' : ''}" onclick="setTab('${id}')">[ ${n} ]${id === 'hero' && evN ? `<span class="badge">${evN}</span>` : ''}${id === 'pantheon' && unread && TAB !== 'pantheon' ? `<span class="badge">${unread}</span>` : ''}</button>`).join('');
}
function togglePause() { S.paused = !S.paused; lastTick = performance.now(); save(); render(true); }

/* ---------- вкладка ГЕРОЙ ---------- */
function heroChips(onSel) {
  return `<div class="heroes">${S.heroes.map(h => `<button class="hchip ${h.id === SEL ? 'on' : ''} ${h.alive ? '' : 'dead'}" onclick="${onSel || 'selHero'}('${h.id}')">
      <span class="av">${h.alive ? D.RACES[h.race].ico : '✝'}</span><span>${esc(h.name)}<small>${h.alive ? E.ageStr(h, S) + ' · ур. ' + h.lvl : 'покоится'}</small></span>${h.ev && h.alive ? '<i class="dot"></i>' : ''}</button>`).join('')}
    ${alive().length < MAX_HEROES ? `<button class="hchip" onclick="heroScreen()"><span class="av">＋</span><span>Новый герой<small>${alive().length}/${MAX_HEROES}</small></span></button>` : ''}</div>`;
}
function selHero(id) { SEL = id; render(true); }
function viewHero() {
  const h = hero(SEL);
  if (!h) return heroChips() + `<div class="card"><p class="muted">Героев пока нет.</p></div>`;
  const m = E.mat(h, S), mh = E.maxHP(h, S), fam = h.fam, att = D.ATTITUDE[fam.att];
  const statsHtml = D.STATS.map(([k, n]) => {
    const v = E.stat(h, k, S), base = h.st[k];
    return `<div class="stat"><div class="t"><span>${n}</span><b class="${v > base ? 'up' : v < base ? 'down' : ''}">${v}${v !== base ? ` <small class="dim">(${base})</small>` : ''}</b></div>
      <div class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : i < h.pot[k] ? 'pot' : ''}"></i>`).join('')}</div></div>`;
  }).join('');
  const tags = [
    ...h.marks.map(x => { const mk = E.MARKS[x.id]; return `<span class="tag ${mk.bad ? 'bad' : 'good'}">${mk.n}${x.until ? ' · ' + Math.ceil((x.until - S.T) / 24) + ' дн.' : ''}</span>`; }),
    ...h.buffs.filter(b => b.until > S.T).map(b => `<span class="tag ${b.v > 0 ? 'good' : 'bad'}">${b.n}: ${D.STAT[b.k]} ${b.v > 0 ? '+' : ''}${b.v} · ${Math.ceil((b.until - S.T) / 24)} дн.</span>`),
    h.shield ? '<span class="tag good">Защита свыше</span>' : '',
    h.pre && h.pre.until > S.T ? `<span class="tag ${h.pre.v > 0 ? 'good' : 'bad'}">Предзнаменование ${h.pre.v > 0 ? '+' : ''}${h.pre.v}</span>` : ''
  ].join('');
  const card = `<div class="card">
    <div class="portrait"><div class="big">${D.RACES[h.race].ico}<i>${D.DEST[h.dest].ico}</i></div>
      <div><h2>${esc(h.name)}</h2><div class="muted">${E.who(h, S)}, ${E.ageStr(h, S)}${h.alive ? '' : ' (навеки)'}</div><div class="muted">Уровень <b style="color:var(--gold)">${h.lvl}</b></div></div></div>
    <div class="hpline"><span>HP</span><span>${Math.max(0, Math.round(h.hp))} / ${mh}</span></div>
    <div class="bar hp"><i style="width:${Math.max(0, h.hp / mh * 100)}%;background-position:${100 - h.hp / mh * 100}% 0"></i></div>
    <dl class="kv" style="margin-top:12px">
      <dt>Пол</dt><dd>${h.g === 'f' ? 'женский' : 'мужской'}</dd>
      <dt>Раса</dt><dd>${D.RACES[h.race].ico} ${raceName(h)}</dd>
      <dt>Мир</dt><dd>${D.WORLDS[h.world].ico} ${D.WORLDS[h.world].n}</dd>
      <dt>Положение</dt><dd title="${esc(D.STATUS[h.status].d)}">${D.STATUS[h.status].n}${h.followers >= 1 ? ` · последователей: ${Math.floor(h.followers)}` : ''}</dd>
      <dt>Предназначение</dt><dd title="${esc(D.DEST[h.dest].d)}">${D.DEST[h.dest].ico} ${D.DEST[h.dest].n}</dd>
      <dt>Семья</dt><dd>${D.WEALTH[fam.wealth]}${fam.att === 'orphan' ? ', сирота' : `: мать ${esc(fam.mom)}, отец ${esc(fam.dad)}`}${fam.sib ? `, братьев и сестёр: ${fam.sib}` : ''}</dd>
      <dt>Родители</dt><dd title="${esc(att.d)}">${att.n}</dd>
    </dl>
    <div class="hpline"><span>Вера в тебя</span><span>${Math.round(h.faith)}</span></div><div class="bar fa"><i style="width:${h.faith}%"></i></div>
    <div class="hpline"><span>Страх перед небом</span><span>${Math.round(h.fear)}</span></div><div class="bar fe"><i style="width:${h.fear}%"></i></div>
    <div class="stats">${statsHtml}</div>
    <div class="tags">${tags || '<span class="dim" style="font-size:13px">Меток нет: ни благословений, ни проклятий.</span>'}</div>
    <p class="dim" style="font-size:12px;margin:10px 0 0">Яркие деления — нынешнее значение, тусклые — врождённый потенциал. Очки веры бога: ✦ ${Math.floor(S.god.faith)}.</p>
  </div>`;
  let evBox = '';
  if (h.alive && h.ev) {
    const ch = E.chance(h, S), left = Math.max(0, h.ev.until - S.T - (S.acc || 0));
    evBox = `<div class="event"><div class="lbl">ТЕКУЩЕЕ СОБЫТИЕ</div><p>${esc(h.ev.txt)}</p>
      <div class="row"><span class="chance">Шанс справиться: <b>${Math.round(ch * 100)}%</b>${h.ev.mod ? ` (твоё вмешательство: ${h.ev.mod > 0 ? '+' : ''}${h.ev.mod})` : ''} · решится через ${Math.ceil(left)} ч (≈ ${realDur(left)})</span>
      <span class="sp"></span><button class="b gold" onclick="goOmen('${h.id}')">Послать знамение →</button></div></div>`;
  } else if (h.alive) {
    evBox = `<div class="card" style="margin-bottom:12px"><span class="dim">Текущее событие:</span> <span class="muted">жизнь идёт своим чередом.</span> <button class="b sm" style="float:right" onclick="goOmen('${h.id}')">Знамения</button></div>`;
  } else {
    evBox = `<div class="event"><div class="lbl">ПОКОИТСЯ С МИРОМ</div><p>${esc(h.cause || '')}</p>
      <div class="row"><span class="chance">Душа ждёт, когда ты её отпустишь. Это освободит место для нового героя.</span><span class="sp"></span><button class="b" onclick="releaseHero('${h.id}')">Отпустить душу в Зал предков</button></div></div>`;
  }
  const ep = Math.floor((S.T - h.birthT) / 24 / 8), nextReset = (ep + 1) * 8 * 24 + h.birthT - S.T;
  const feed = [...h.feed].reverse().map(f => `<li><span class="tm">${tStr(f.T)}</span><span class="k-${f.k}">${esc(f.txt)}</span></li>`).join('');
  const hist = `<div class="card"><div class="row"><h3 style="margin:0">История героя</h3><span class="sp"></span>
      <span class="dim" style="font-size:13px">${h.alive ? `восьмидневка №${ep + 1} · обнулится через ${Math.ceil(nextReset / 24)} дн. (≈ ${realDur(nextReset)})` : ''}</span></div>
      ${E.mat(h, S) < 3 && h.alive ? '<p class="dim" style="font-size:13px;margin:6px 0 0">Мысли появятся с 3 лет. Пока — только поступки.</p>' : ''}
      <ul class="feed">${feed || '<li><span></span><span class="dim">Новая восьмидневка только началась…</span></li>'}</ul></div>
    <div class="card"><details><summary class="muted" style="cursor:pointer">Летопись героя (${h.chron.length})</summary>
      <ul class="feed chron">${[...h.chron].reverse().map(c => `<li><span><span class="tm">${E.dateStr({ T: c.T }).s}</span><br>${esc(c.txt)}</span></li>`).join('')}</ul></details></div>`;
  return heroChips() + `<div class="grid2"><div>${card}</div><div>${evBox}${hist}</div></div>`;
}
function goOmen(id) { TGT = { id, own: 1 }; SEL = id; LASTRES = null; setTab('omens'); }
function releaseHero(id) {
  const h = hero(id); if (!h) return;
  S.heroes = S.heroes.filter(x => x !== h);
  S.dead.push({ id: h.id, name: h.name, g: h.g, race: h.race, world: h.world, dest: h.dest, lvl: h.lvl, age: E.ageStr(h, S), cause: h.cause, chron: h.chron.slice(-30), T: h.deathT });
  SEL = (alive()[0] || S.heroes[0] || {}).id || null;
  save();
  if (!S.heroes.length) heroScreen(); else render(true);
}

/* ---------- вкладка ЗНАМЕНИЯ ---------- */
function targets() {
  const own = alive().map(h => ({ id: h.id, own: 1, name: h.name, ico: D.RACES[h.race].ico, sub: E.ageStr(h, S), ev: h.ev ? h.ev.txt : null }));
  const foreign = [];
  if (NET.status === 'on') for (const g of NET.others()) for (const h of g.heroes || []) if (h.alive) foreign.push({ id: h.id, god: g.god, name: h.name, ico: D.RACES[h.race].ico, sub: `${h.age} · ${D.SPHERES[g.god.sph].ico} ${g.god.name}`, ev: h.ev });
  return own.concat(foreign);
}
function viewOmens() {
  const ts = targets();
  if (!TGT || !ts.find(t => t.id === TGT.id)) TGT = ts.find(t => t.id === SEL) || ts[0] || null;
  if (!TGT) return `<div class="card"><p class="muted">Некому слать знамения: живых героев нет.</p><button class="b gold" onclick="heroScreen()">Создать героя</button></div>`;
  const t = ts.find(x => x.id === TGT.id), foreign = !t.own;
  const h = t.own ? hero(t.id) : null;
  const s = sph();
  const brBtns = D.BR_IDS.map(b => `<button data-br="${b}" class="${BR === b ? 'on' : ''}" onclick="BR='${b}';LASTRES=null;render(true)">${D.BR[b].ico} ${D.BR[b].n.toUpperCase()}</button>`).join('');
  const acts = s[BR].map(a => {
    const cost = E.omenCost(a, foreign);
    return `<div class="act"><h4>${a.n}<span>✦ ${cost}</span></h4><div class="fx">${E.fxText(a.fx)}</div>
      <button class="b ${BR === 'harm' ? 'red' : ''}" ${S.god.faith < cost ? 'disabled' : ''} onclick="castOmen('${BR}','${a.id}')">${S.god.faith < cost ? 'Не хватает веры' : 'Ниспослать'}</button></div>`;
  }).join('');
  let ctx = '';
  if (h) {
    const ch = E.chance(h, S);
    ctx = h.ev ? `<div class="event" style="margin:0"><div class="lbl">СОБЫТИЕ У ГЕРОЯ · шанс ${Math.round(ch * 100)}% · ещё ${Math.ceil(h.ev.until - S.T)} ч (≈ ${realDur(h.ev.until - S.T)})</div><p style="margin-bottom:0">${esc(h.ev.txt)}</p>
      ${D.EVENTS[h.ev.i].fit ? `<div class="chance" style="margin-top:6px">Особенно уместны сферы: ${D.EVENTS[h.ev.i].fit.map(i => D.SPHERES[i].ico + ' ' + D.SPHERES[i].n).join(', ')}${D.EVENTS[h.ev.i].fit.includes(S.god.sph) ? ' — <b>твоя помощь здесь сильнее (+1)</b>' : ''}</div>` : ''}</div>`
      : `<p class="muted" style="margin:0">Сейчас у ${esc(h.name)} спокойно. Помощь или вред «к исходу события» сохранятся как предзнаменование на 2 дня и повлияют на ближайшее событие.</p>`;
    ctx += `<div class="row" style="margin-top:8px;font-size:14px" class="muted"><span>HP ${Math.round(h.hp)}/${E.maxHP(h, S)}</span><span class="dim">·</span><span>вера ${Math.round(h.faith)}</span><span class="dim">·</span><span>страх ${Math.round(h.fear)}</span><span class="dim">·</span><span>Восприятие ${E.stat(h, 'per', S)} — заметит ли знак?</span></div>`;
  } else {
    ctx = `<p class="muted" style="margin:0">Герой бога ${esc(t.god.name)}. Знамение обойдётся в полтора раза дороже, а вера героя достанется не тебе.</p>${t.ev ? `<div class="event" style="margin:8px 0 0"><div class="lbl">СОБЫТИЕ</div><p style="margin:0">${esc(t.ev)}</p></div>` : ''}`;
  }
  return `<div class="card"><h3>Кому знамение?</h3><div class="tgt">${ts.map(x => `<button class="hchip ${x.id === TGT.id ? 'on' : ''}" onclick="TGT={id:'${x.id}'};LASTRES=null;render(true)"><span class="av">${x.ico}</span><span>${esc(x.name)}<small>${esc(x.sub)}</small></span>${x.ev ? '<i class="dot"></i>' : ''}</button>`).join('')}</div>
      <div style="margin-top:12px">${ctx}</div></div>
    <div class="card"><div class="row"><h3 style="margin:0">${s.ico} Знамения сферы «${s.n}»</h3><span class="sp"></span><span class="pill faith">✦ ${Math.floor(S.god.faith)}</span></div>
      <div class="branches">${brBtns}</div>
      <div class="acts">${acts}</div>
      ${LASTRES ? `<div class="result">${LASTRES}</div>` : ''}
      <p class="dim" style="font-size:13px;margin:12px 0 0">Маленькие герои проще относятся к богам: обиды быстро забывают, а за помощь любят вдвое. Чем выше Восприятие, тем вернее герой заметит знак — и тем сильнее изменится его вера.</p></div>`;
}
function castOmen(br, aid) {
  const t = targets().find(x => x.id === TGT.id); if (!t) return;
  const act = E.findAct(S.god.sph, br, aid);
  if (t.own) {
    const r = E.omen(S, t.id, S.god.sph, br, aid);
    if (!r.ok) { toast(r.err, 'ev'); return; }
    LASTRES = `<b>«${esc(act.n)}»</b> — ${esc(r.vis)}${r.avoided ? ' <b>Беда обойдена.</b>' : ''}<br><span class="muted">${r.notice ? 'Герой заметил знак: ' : ''}${esc(r.react)}</span>`;
    chime('omen'); save();
  } else {
    const cost = E.omenCost(act, true);
    if (S.god.faith < cost) { toast('Не хватает веры', 'ev'); return; }
    const sent = NET.send({ t: 'omen', to: t.god.id, hid: t.id, sph: S.god.sph, br, aid, from: { id: S.god.id, name: S.god.name, g: S.god.g } });
    if (!sent) { toast('Нет связи с пантеоном', 'ev'); return; }
    S.god.faith -= cost; S.god.omens++;
    LASTRES = `<b>«${esc(act.n)}»</b> отправлено герою ${esc(t.name)}. Ждём, что ответит мир…`;
    chime('omen'); save();
  }
  render(true);
}

/* ---------- вкладка ПАНТЕОН ---------- */
function pillar(g, me, n) {
  const s = D.SPHERES[g.sph];
  return `<div class="pillar ${me ? 'me' : ''}" style="--sph:${s.col}"><pre> ▁▁▁▁▁▁
 ]|${s.ico}|[
 ]|  |[
 ]|  |[
▔▔▔▔▔▔▔▔</pre><b>${esc(g.name)}</b><small>${s.n}${n != null ? ' · героев ' + n : ''}</small></div>`;
}
function colonnade() {
  const list = NET.status === 'on' ? Object.values(NET.gods) : [];
  const mine = list.find(x => x.god.id === S.god.id);
  const others = list.filter(x => x.god.id !== S.god.id);
  return `<div class="colonnade" id="colon">${pillar(godPub(), 1, alive().length)}${others.map(x => pillar(x.god, 0, (x.heroes || []).length)).join('')}${!mine && NET.status !== 'on' ? '<div class="pillar dim" style="align-self:center">…пока ты<br>один на Олимпе</div>' : ''}</div>`;
}
function chatLog() {
  const W = 26;
  const line = (n) => '─'.repeat(Math.max(2, n));
  const items = S.chat.slice(-150).map(m => {
    if (m.t === 'sys') return `<div class="msg sys">⟦ ${esc(m.txt)} ⟧</div>`;
    const me = m.from.id === S.god.id, s = D.SPHERES[m.from.sph] || D.SPHERES[0];
    const nm = `${s.ico} ${m.from.name}`, tm = new Date(m.ts).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    const hd = me ? `${line(W - nm.length)}[ ${nm} ]─╖` : `╓─[ ${nm} ]${line(W - nm.length)}`;
    const ft = me ? `${tm} ${line(W - 2)}╜` : `╙${line(W - 2)} ${tm}`;
    return `<div class="msg ${me ? 'me' : ''}" style="--c:${me ? 'var(--gold)' : s.col}"><div class="hd">${esc(hd)}</div><div class="bd">${esc(m.txt)}</div><div class="ft">${esc(ft)}</div></div>`;
  }).join('');
  return `<div class="chat" id="chatLog">${items || '<div class="msg sys">⟦ Здесь будут речи богов ⟧</div>'}</div>`;
}
function scrollChat() { const c = $('#chatLog'); if (c) c.scrollTop = c.scrollHeight; }
function viewPantheon() {
  let ctl;
  if (NET.status === 'on') {
    ctl = `<div class="row"><span class="muted">Пантеон</span><span class="code">${NET.code}</span><span class="sp"></span>
      <button class="b sm" onclick="copyInvite()">Скопировать приглашение</button><button class="b sm red" onclick="NET.leave()">Покинуть</button></div>`;
  } else if (NET.status === 'connecting') {
    ctl = `<div class="row"><span class="muted">Связываемся с небесами… ${NET.code ? `<span class="code">${NET.code}</span>` : ''}</span><span class="sp"></span><button class="b sm" onclick="NET.leave()">Отмена</button></div>`;
  } else {
    ctl = `<p class="muted" style="margin-top:0">Пантеон — это чат между настоящими богами-игроками. Каждый ведёт своих героев, а здесь вы спорите, договариваетесь и посылаете знамения чужим подопечным. Других богов игра не выдумывает — только живые игроки.</p>
      ${NET.err ? `<p style="color:var(--red)">${esc(NET.err)}</p>` : ''}
      <div class="row"><button class="b gold" onclick="NET.host()">Основать пантеон</button><span class="dim">или</span>
      <input type="text" id="joinCode" placeholder="КОД" maxlength="5" style="width:110px;text-transform:uppercase;font-family:var(--mono);letter-spacing:.2em">
      <button class="b" onclick="const c=$('#joinCode').value.trim();if(c.length===5)NET.join(c);else toast('Код — 5 символов','ev')">Войти</button></div>`;
  }
  const others = NET.status === 'on' ? NET.others() : [];
  const foreign = others.map(g => `<div class="card"><div class="row"><b style="color:${D.SPHERES[g.god.sph].col}">${D.SPHERES[g.god.sph].ico} ${esc(g.god.name)}</b><span class="dim">${g.god.g === 'f' ? 'богиня' : 'бог'} сферы «${D.SPHERES[g.god.sph].n}»</span></div>
    ${(g.heroes || []).length ? (g.heroes || []).map(h => `<div class="row" style="margin-top:8px;font-size:14px"><span>${D.RACES[h.race].ico} <b>${esc(h.name)}</b>, ${esc(h.who)}, ${esc(h.age)} · ур. ${h.lvl} · HP ${h.hp}/${h.mhp} · ${D.WORLDS[h.world].ico} ${D.WORLDS[h.world].n}</span><span class="sp"></span>
      <button class="b sm" onclick="TGT={id:'${h.id}'};setTab('omens')">Знамение</button></div>${h.ev ? `<div class="chance" style="margin:2px 0 0 26px">⚠ ${esc(h.ev)}</div>` : ''}`).join('') : '<p class="dim">Героев пока нет.</p>'}</div>`).join('');
  return `<div class="card">${ctl}</div>
    <div class="card">${colonnade()}${chatLog()}
      <div class="chatin"><input type="text" id="chatText" maxlength="400" placeholder="${NET.status === 'on' ? 'Слово богам…' : 'Войдите в пантеон, чтобы говорить'}" ${NET.status === 'on' ? '' : 'disabled'} onkeydown="if(event.key==='Enter')sendChat()"><button class="b gold" onclick="sendChat()" ${NET.status === 'on' ? '' : 'disabled'}>Изречь</button></div></div>
    ${foreign ? `<h3 style="margin-top:16px">Герои других богов</h3>${foreign}` : ''}`;
}
function sendChat() {
  const i = $('#chatText'); const txt = i.value.trim(); if (!txt) return;
  NET.send({ t: 'chat', from: godPub(), txt, ts: Date.now() });
  i.value = ''; i.focus();
}
function copyInvite() {
  const u = location.origin + location.pathname + '?join=' + NET.code + (QS.has('local') ? '&local=1' : '');
  (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('Приглашение скопировано: ' + u)).catch(() => prompt('Ссылка-приглашение:', u));
}
function netMsg(m) {
  if (m.t === 'chat' || m.t === 'sys') {
    S.chat.push(m); if (S.chat.length > 300) S.chat.splice(0, S.chat.length - 300);
    if (TAB !== 'pantheon' && !m.local) { unread++; if (m.t === 'chat') toast(`${m.from.name}: ${m.txt}`, '', () => setTab('pantheon')); }
    render(true);
  } else if (m.t === 'omen') {
    const r = E.omen(S, m.hid, m.sph, m.br, m.aid, { from: m.from, free: true });
    const h = hero(m.hid);
    const act = E.findAct(m.sph, m.br, m.aid);
    if (r.ok && h) {
      toast(`${m.from.name} ниспослал${m.from.g === 'f' ? 'а' : ''} знамение «${act.n}» твоему герою ${h.name}`, m.br === 'harm' ? 'ev' : 'world', () => { SEL = h.id; setTab('hero'); });
      NET.send({ t: 'omenres', to: m.from.id, txt: `${h.name}: ${r.vis} ${r.react}` });
    } else NET.send({ t: 'omenres', to: m.from.id, txt: `Знамение не дошло: ${r.err || 'герой недоступен'}` });
    save(); render(true);
  } else if (m.t === 'omenres') {
    toast('Ответ мира: ' + m.txt, 'world');
    if (TAB === 'omens') { LASTRES = esc(m.txt); render(true); }
  }
}

/* ---------- вкладка МИР ---------- */
function viewWorld() {
  const d = E.dateStr(S);
  const ws = [...new Set(alive().map(h => h.world))];
  const worlds = ws.map(w => {
    const W = D.WORLDS[w], st = S.worlds[w] || { ev: 'calm', until: 0 }, we = D.WORLD_EVENTS[st.ev];
    const hs = alive().filter(h => h.world === w);
    return `<div class="card world"><h3>${W.ico} ${W.n}</h3><p class="muted" style="margin:0">${W.d}</p>
      <div class="wev"><b>${we.ico} ${we.n}</b> — ${we.d}<br><span class="dim">ещё ~${Math.max(1, Math.ceil((st.until - S.T) / 24))} дн. · опасность ×${we.k}</span></div>
      <p style="margin:8px 0 0;font-size:14px">Твои герои: ${hs.map(h => `${D.RACES[h.race].ico} ${esc(h.name)}${D.RACES[h.race].home.includes(w) ? '' : ' <span class="dim">(чужак)</span>'}`).join(', ')}</p></div>`;
  }).join('');
  const fol = S.heroes.reduce((s, h) => s + (h.alive ? h.followers : 0), 0);
  const tabs = [['chron', 'Летопись'], ['ancestors', 'Зал предков'], ['settings', 'Время и настройки']];
  let sub = '';
  if (WTAB === 'chron') sub = `<ul class="feed chron">${[...S.chron].reverse().slice(0, 120).map(c => `<li><span><span class="tm">${E.dateStr({ T: c.T }).s}</span><br><span class="${c.k === 'death' ? 'k-death' : c.k === 'world' ? 'k-world' : ''}">${c.hn ? '<b>' + esc(c.hn) + ':</b> ' : ''}${esc(c.txt)}</span></span></li>`).join('') || '<li class="dim">Летопись пуста.</li>'}</ul>`;
  else if (WTAB === 'ancestors') sub = S.dead.length ? S.dead.map(x => `<div class="card"><b>✝ ${esc(x.name)}</b> <span class="dim">— ${D.RACES[x.race].n[x.g === 'f' ? 1 : 0]}, ${D.DEST[x.dest].n.toLowerCase()}, ${x.age}, ур. ${x.lvl}</span><p class="muted" style="margin:6px 0 0">${esc(x.cause || '')}</p>
      <details><summary class="dim" style="cursor:pointer;font-size:13px">Последние страницы летописи</summary><ul class="feed chron">${x.chron.slice().reverse().map(c => `<li>${esc(c.txt)}</li>`).join('')}</ul></details></div>`).join('') : '<p class="dim">Зал пуст. Пусть так будет подольше.</p>';
  else sub = `<h3>Течение времени</h3><div class="speeds">${Object.entries(E.SPEEDS).map(([k, v]) => `<label><input type="radio" name="spd" ${S.speed === k ? 'checked' : ''} onchange="setSpeed('${k}')"> <span><b>${v.n}</b><br><span class="dim" style="font-size:13px">${v.off ? 'Время идёт, даже когда игра закрыта.' : 'Когда игра закрыта, время стоит.'}</span></span></label>`).join('')}</div>
      <label class="row" style="margin-top:12px"><input type="checkbox" ${S.pauseOnEvent ? 'checked' : ''} onchange="S.pauseOnEvent=this.checked;save()"> Ставить паузу, когда у героя случается событие (на быстрых скоростях)</label>
      <h3 style="margin-top:20px">Сохранение</h3><div class="row"><button class="b" onclick="exportSave()">Скачать сохранение</button><label class="b">Загрузить<input type="file" accept=".json" hidden onchange="importSave(this.files[0])"></label>
      <span class="sp"></span><button class="b red" onclick="resetGame()">Начать заново</button></div>`;
  return `<div class="card"><div class="row"><div><div class="dim" style="font-size:13px">Сейчас в мирах</div><div class="big-n">${d.season}, ${d.day}-й день</div><div class="muted">${d.y}-й год от твоего восшествия · ${String(d.hour).padStart(2, '0')}:00</div></div><span class="sp"></span>
      <div class="statsbox" style="flex:1;max-width:620px"><div><small>Очки веры</small><b>✦ ${Math.floor(S.god.faith)}</b></div><div><small>Прирост в день</small><b>+${E.income(S).toFixed(1)}</b></div><div><small>Последователи</small><b>${Math.floor(fol)}</b></div><div><small>Знамений послано</small><b>${S.god.omens}</b></div></div></div></div>
    <div class="worlds" style="margin-top:12px">${worlds || '<div class="card dim">Нет живых героев — миры скрыты во мгле.</div>'}</div>
    <div class="card" style="margin-top:12px"><div class="branches" style="grid-template-columns:repeat(3,1fr);margin-top:0">${tabs.map(([k, n]) => `<button class="${WTAB === k ? 'on' : ''}" onclick="WTAB='${k}';render(true)">${n}</button>`).join('')}</div>${sub}</div>`;
}
function setSpeed(k) { S.speed = k; lastTick = performance.now(); save(); render(true); }
function exportSave() {
  save();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
  a.download = `pantheon-${S.god.name}.json`; a.click();
}
function importSave(f) {
  if (!f) return;
  f.text().then(t => { S = E.load(t); save(); location.reload(); }).catch(() => toast('Не удалось прочитать файл', 'ev'));
}
function resetGame() {
  modal(`<h3>Низвергнуть себя с Олимпа?</h3><p class="muted">Все герои, летопись и вера исчезнут безвозвратно. Можно сначала скачать сохранение во вкладке «Мир».</p>
    <div class="row" style="justify-content:flex-end"><button class="b" onclick="closeModal()">Остаться</button><button class="b red" onclick="localStorage.removeItem(SAVE);location.href=location.pathname">Начать заново</button></div>`);
}
function modal(html) { $('#modal').innerHTML = `<div class="card">${html}</div>`; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }

/* ---------- экраны создания ---------- */
function titleScreen() {
  $('#app').hidden = true;
  $('#screen').innerHTML = `<div class="title">
    <pre>      .        ✦         .
   ___________________________
   ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[
   ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[
  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔</pre>
    <h1>ПАНТЕОН</h1><div class="sub">Хроники богов</div>
    <p>Ты — бог или богиня. Создай героя, смотри, как он растёт с первого дня жизни, и вмешивайся знамениями своей сферы: помогай, вреди, пугай, подбадривай. Решения принимает он сам.</p>
    <button class="b gold" style="font-size:18px;padding:12px 28px" onclick="godScreen()">Стать богом</button>
    ${QS.get('join') ? `<p class="dim" style="margin-top:16px">Тебя позвали в пантеон <b class="code" style="font-size:16px">${esc(QS.get('join'))}</b> — сначала создай своё божество.</p>` : ''}
  </div>`;
}
function godScreen() {
  const c = UI.god = UI.god || { g: 'm', sph: 0, name: E.pick(E.GOD_NAMES.m), speed: 'tz' };
  $('#screen').innerHTML = `<h2>Восшествие</h2><p class="muted">Кто ты среди богов?</p>
    <div class="form">
      <label class="f"><span>Имя божества</span><div class="row"><input type="text" id="gName" value="${esc(c.name)}" maxlength="24" style="flex:1" oninput="UI.god.name=this.value"><button class="b" onclick="UI.god.name=E.pick(E.GOD_NAMES[UI.god.g]);godScreen()">🎲</button></div></label>
      <div class="f"><span class="dim" style="font-size:13px">Облик</span><br><div class="seg"><button class="${c.g === 'm' ? 'on' : ''}" onclick="UI.god.g='m';godScreen()">Бог</button><button class="${c.g === 'f' ? 'on' : ''}" onclick="UI.god.g='f';godScreen()">Богиня</button></div></div>
      <div><span class="dim" style="font-size:13px">Сфера влияния — определяет, какие знамения тебе доступны</span>
      <div class="choices sph" style="margin-top:6px">${D.SPHERES.map((s, i) => `<button class="choice ${c.sph === i ? 'on' : ''}" onclick="UI.god.sph=${i};godScreen()" style="--sph:${s.col}"><span class="ic">${s.ico}</span><b>${s.n}</b><small>${s.d}</small>
        <small style="color:var(--tx2);margin-top:4px">${D.BR_IDS.map(b => s[b].map(a => a.n).join(', ')).join(' · ')}</small></button>`).join('')}</div></div>
      <div><span class="dim" style="font-size:13px">Течение времени (можно поменять потом во вкладке «Мир»)</span>
      <div class="speeds" style="margin-top:6px">${Object.entries(E.SPEEDS).map(([k, v]) => `<label><input type="radio" name="gspd" ${c.speed === k ? 'checked' : ''} onchange="UI.god.speed='${k}'"> <span><b>${v.n}</b>${k === 'tz' ? ' <span class="dim">— неспешная игра на месяцы: заглядывай раз в день</span>' : k === 'min' ? ' <span class="dim">— чтобы сразу увидеть жизнь в движении</span>' : ''}</span></label>`).join('')}</div></div>
      <div class="row"><span class="sp"></span><button class="b gold" style="font-size:17px;padding:10px 24px" onclick="createGod()">Вознестись →</button></div>
    </div>`;
}
function createGod() {
  const c = UI.god; const name = (c.name || '').trim();
  if (!name) { toast('У бога должно быть имя', 'ev'); return; }
  S = E.newState({ name, g: c.g, sph: c.sph });
  S.speed = c.speed;
  document.documentElement.style.setProperty('--sph', sph().col);
  save();
  heroScreen();
}
function heroScreen() {
  $('#app').hidden = true;
  if (alive().length >= MAX_HEROES) { toast('Не больше пяти живых героев', 'ev'); startGame(); return; }
  const c = UI.creating = UI.creating || { g: Math.random() < 0.5 ? 'm' : 'f', race: 'human', world: 'human', dest: null, name: '' };
  if (!c.name) c.name = E.randName(c.race, c.g);
  const native = D.RACES[c.race].home.includes(c.world);
  $('#screen').innerHTML = `<h2>Новая жизнь</h2><p class="muted">Ты выбираешь, где и кем родится герой. Дальше он решает сам.</p>
    <div class="form">
      <label class="f"><span>Имя</span><div class="row"><input type="text" value="${esc(c.name)}" maxlength="24" style="flex:1" oninput="UI.creating.name=this.value"><button class="b" onclick="UI.creating.name=E.randName(UI.creating.race,UI.creating.g);heroScreen()">🎲</button></div></label>
      <div><div class="seg"><button class="${c.g === 'm' ? 'on' : ''}" onclick="UI.creating.g='m';UI.creating.name='';heroScreen()">Мальчик</button><button class="${c.g === 'f' ? 'on' : ''}" onclick="UI.creating.g='f';UI.creating.name='';heroScreen()">Девочка</button></div></div>
      <div><span class="dim" style="font-size:13px">Раса</span><div class="choices" style="margin-top:6px">${D.RACE_IDS.map(r => { const R = D.RACES[r]; return `<button class="choice ${c.race === r ? 'on' : ''}" onclick="UI.creating.race='${r}';UI.creating.name='';heroScreen()"><span class="ic">${R.ico}</span><b>${R.n[c.g === 'f' ? 1 : 0]}</b><small>${Object.entries(R.mod).map(([k, v]) => D.STAT[k] + (v > 0 ? ' +' : ' ') + v).join(', ') || 'без перекосов'}${R.life !== 1 ? ` · живёт ×${R.life}` : ''}</small></button>`; }).join('')}</div></div>
      <div><span class="dim" style="font-size:13px">Мир рождения</span><div class="choices" style="margin-top:6px">${D.WORLD_IDS.map(w => { const W = D.WORLDS[w]; const home = D.RACES[c.race].home.includes(w); return `<button class="choice ${c.world === w ? 'on' : ''}" onclick="UI.creating.world='${w}';heroScreen()"><span class="ic">${W.ico}</span><b>${W.n}</b><small>${home ? 'родной мир расы' : 'чужак: изгой, жрец или лже-божество'}</small></button>`; }).join('')}</div>
        ${native ? '' : `<p class="muted" style="font-size:14px">⚠ ${D.RACES[c.race].n[c.g === 'f' ? 1 : 0]} в мире «${D.WORLDS[c.world].n}» — чужак. Судьба решит: станет изгоем, лже-божеством, которому поклоняются, или жрецом, несущим твоё имя. За продвижение твоей веры ты получаешь очки веры.</p>`}</div>
      <div><span class="dim" style="font-size:13px">Предназначение</span><div class="choices" style="margin-top:6px">
        <button class="choice ${!c.dest ? 'on' : ''}" onclick="UI.creating.dest=null;heroScreen()"><span class="ic">🎲</span><b>Судьба решит</b><small>Случайное предназначение</small></button>
        ${D.DEST_IDS.map(d => { const X = D.DEST[d]; return `<button class="choice ${c.dest === d ? 'on' : ''}" onclick="UI.creating.dest='${d}';heroScreen()"><span class="ic">${X.ico}</span><b>${X.n}</b><small>${X.d}</small></button>`; }).join('')}</div></div>
      <p class="dim" style="font-size:13px">Семья, отношение родителей и врождённые характеристики выпадут при рождении — их не выбирают даже боги.</p>
      <div class="row">${S.heroes.length ? '<button class="b" onclick="UI.creating=null;startGame()">← Назад</button>' : ''}<span class="sp"></span><button class="b gold" style="font-size:17px;padding:10px 24px" onclick="birthHero()">Даровать жизнь ✦</button></div>
    </div>`;
  scrollTo({ top: 0 });
}
function birthHero() {
  const c = UI.creating; const name = (c.name || '').trim() || E.randName(c.race, c.g);
  const h = E.addHero(S, E.newHero(S, { name, g: c.g, race: c.race, world: c.world, dest: c.dest || undefined }));
  UI.creating = null; SEL = h.id; TAB = 'hero';
  save(); startGame();
  toast(`Родил${h.g === 'f' ? 'ась' : 'ся'} ${h.name}. Смотри за ${h.g === 'f' ? 'ней' : 'ним'} внимательно.`);
}

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });

boot();
