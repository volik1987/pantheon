/* Пантеон: Хроники богов — движок (без DOM: работает и в браузере, и в node для тестов). */
'use strict';
(function (root) {
const D = root.PD || require('./data.js');
const E = {};
let R = Math.random;
E.seed = s => { // детерминированный генератор для тестов
  let x = s >>> 0 || 1;
  R = () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
};
const rnd = (a, b) => a + R() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wpick = (arr, wf) => { let s = 0; const ws = arr.map(x => { const w = Math.max(0, wf(x)); s += w; return w; }); let r = R() * s; for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0 && ws[i] > 0) return arr[i]; } return arr[arr.length - 1]; };
E.rnd = rnd; E.ri = ri; E.pick = pick; E.clamp = clamp;

/* game hours per real second */
E.SPEEDS = {
  tz: { n: 'Канон: 1 сутки = 8 дней героя', s: 'канон', hps: 192 / 86400, off: 1 },
  hour: { n: '1 час = 8 дней героя', s: '×24', hps: 192 / 3600, off: 1 },
  min: { n: '1 минута = 1 день героя', s: '×180', hps: 24 / 60, off: 0 },
  fast: { n: '10 секунд = 1 день героя', s: '×1080', hps: 2.4, off: 0 }
};
const YEAR = 365, DAY = 24;

/* ---------- форматирование ---------- */
const CASES = { // мама/отец по падежам
  mom: { n: 'мама', g: 'мамы', d: 'маме', a: 'маму', i: 'мамой' },
  dad: { n: 'отец', g: 'отца', d: 'отцу', a: 'отца', i: 'отцом' },
  omom: { n: 'приёмная мать', g: 'приёмной матери', d: 'приёмной матери', a: 'приёмную мать', i: 'приёмной матерью' },
  odad: { n: 'опекун', g: 'опекуна', d: 'опекуну', a: 'опекуна', i: 'опекуном' }
};
E.fmt = function (t, h, S, x) {
  if (!t) return '';
  const f = h && h.g === 'f';
  t = t.replace(/\{([^{}|]*)\|([^{}]*)\}/g, (m, a, b) => f ? b : a);
  const w = h ? D.WORLDS[h.world] : null;
  const orphan = h && h.fam && h.fam.att === 'orphan';
  return t.replace(/%(\w+)%/g, (m, k) => {
    if (x && x[k] != null) return x[k];
    if (k === 'god') return S ? S.god.name : 'бог';
    if (k === 'deity') return S && S.god.g === 'f' ? 'богиня' : 'бог';
    if (!h) return '';
    if (k === 'name') return h.name;
    const mm = k.match(/^(mom|dad)(?:_(\w))?$/);
    if (mm) { const c = CASES[(orphan ? 'o' : '') + mm[1]]; const s = c[mm[2] || 'n']; return mm[2] ? s : s[0].toUpperCase() === s[0] ? s : s; }
    if (k === 'world') return w.n;
    if (k === 'place') return pick(w.place);
    if (k === 'beast') return pick(w.beast);
    if (k === 'food') return w.food;
    if (k === 'race') return D.RACES[h.race].n[f ? 1 : 0].toLowerCase();
    if (k === 'friend') return pick(D.FRIENDS);
    if (k === 'dest') return D.DEST[h.dest].n.toLowerCase();
    return m;
  }).replace(/(^|[.!?»]\s+)([а-яё])/g, (m, a, b) => a + b.toUpperCase());
};

/* ---------- время ---------- */
E.days = S => S.T / DAY;
E.dateStr = function (S) {
  const T = S.T + (S.acc || 0), d = Math.floor(T / DAY), y = Math.floor(d / YEAR) + 1, doy = d % YEAR;
  const se = Math.floor(doy / (YEAR / 4)), dd = Math.floor(doy - se * YEAR / 4) + 1;
  const hr = Math.floor(T % DAY);
  return { y, season: D.SEASONS[(se + 1) % 4], day: dd, hour: hr, s: `${dd}-й день, ${D.SEASONS[(se + 1) % 4].toLowerCase()}, ${y}-й год` };
};
E.season = S => (Math.floor((Math.floor(S.T / DAY) % YEAR) / (YEAR / 4)) + 1) % 4;

/* ---------- герой: базовые величины ---------- */
E.age = (h, S) => ((h.alive ? S.T + (S.acc || 0) : h.deathT) - h.birthT) / DAY / YEAR;
E.mat = (h, S) => { const a = E.age(h, S); return a < 18 ? a : 18 + (a - 18) / D.RACES[h.race].life; };
E.band = m => m < 3 ? 0 : m < 7 ? 1 : m < 13 ? 2 : m < 18 ? 3 : m < 36 ? 4 : m < 60 ? 5 : 6;
E.group = m => m < 3 ? 'baby' : m < 13 ? 'child' : m < 18 ? 'youth' : m < 60 ? 'adult' : 'elder';
E.ageStr = function (h, S) {
  const a = E.age(h, S), y = Math.floor(a), mo = Math.floor((a - y) * 12), d = Math.floor(((a - y) * YEAR) % 30.4);
  const pl = (n, f1, f2, f5) => { const m10 = n % 10, m100 = n % 100; return n + ' ' + (m10 === 1 && m100 !== 11 ? f1 : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? f2 : f5); };
  if (y === 0 && mo === 0) return pl(d, 'день', 'дня', 'дней');
  if (y === 0) return pl(mo, 'месяц', 'месяца', 'месяцев');
  if (y < 3 && mo) return pl(y, 'год', 'года', 'лет') + ' ' + pl(mo, 'мес.', 'мес.', 'мес.');
  return pl(y, 'год', 'года', 'лет');
};
E.who = function (h, S) {
  const m = E.mat(h, S), f = h.g === 'f';
  if (m < 1) return f ? 'малышка' : 'младенец';
  if (m < 3) return f ? 'кроха' : 'карапуз';
  if (m < 13) return f ? 'девочка' : 'мальчик';
  if (m < 18) return f ? 'девушка' : 'юноша';
  if (m < 60) return f ? 'женщина' : 'мужчина';
  return f ? 'старушка' : 'старик';
};
E.stat = function (h, k, S) {
  let v = h.st[k];
  for (const b of h.buffs) if (b.k === k && (!S || b.until > S.T)) v += b.v;
  return clamp(v, 0, 14);
};
E.maxHP = function (h, S) {
  const m = E.mat(h, S);
  let base = m < 18 ? 4 + 26 * Math.pow(m / 18, 1.2) : 30;
  if (m > 60) base *= Math.max(0.5, 1 - (m - 60) / 50);
  const k = 1 + (h.st.str - 5) * 0.05 + (h.st.will - 5) * 0.03 + (h.mhp || 0);
  return Math.max(3, Math.round(base * k + Math.log2(h.lvl) * 2.2 * Math.min(1, 0.15 + m / 18)));
};
E.hasMark = (h, id) => h.marks.some(x => x.id === id);
E.MARKS = {
  poison: { n: 'Отравление', bad: 1, days: 3 }, sick: { n: 'Болезнь', bad: 1, days: 4 }, regen: { n: 'Регенерация', days: 3 },
  scar: { n: 'Шрам', bad: 1, perm: 1 }, coin: { n: 'Счастливая монета', perm: 1 }, blessforest: { n: 'Благословение леса', perm: 1 },
  amulet: { n: 'Древний амулет', perm: 1 }, dark: { n: 'Метка тьмы', bad: 1, perm: 1 }
};
function addMark(h, S, id) {
  const m = E.MARKS[id]; if (!m) return;
  const ex = h.marks.find(x => x.id === id);
  if (ex) { if (!m.perm) ex.until = S.T + m.days * DAY; return; }
  h.marks.push({ id, until: m.perm ? 0 : S.T + m.days * DAY });
}

/* ---------- создание ---------- */
E.uid = () => Math.random().toString(36).slice(2, 10);
E.GOD_NAMES = { m: ['Хронос', 'Велес', 'Аркан', 'Солнцеслав', 'Тенебр', 'Зарог', 'Эфирий', 'Громовит', 'Ксерон', 'Ладимир'], f: ['Мойра', 'Лада', 'Селена', 'Ночена', 'Веста', 'Зоряна', 'Эйра', 'Флора', 'Ирида', 'Морана'] };
E.newState = function (god) {
  return { v: 1, god: Object.assign({ id: E.uid(), name: 'Безымянный', g: 'm', sph: 0, faith: 15, omens: 0, born: Date.now() }, god),
    speed: 'tz', T: 0, acc: 0, real: Date.now(), paused: false, pauseOnEvent: true, heroes: [], dead: [], worlds: {}, chron: [], chat: [], day: 0, room: null };
};
E.randName = (race, g) => pick(D.NAMES[D.RACES[race].cult][g]);
E.newHero = function (S, o) {
  o = o || {};
  const g = o.g || (R() < 0.5 ? 'm' : 'f');
  const race = o.race || pick(D.RACE_IDS);
  const world = o.world || (R() < 0.6 ? pick(D.RACES[race].home) : pick(D.WORLD_IDS));
  const dest = o.dest || pick(D.DEST_IDS);
  const native = D.RACES[race].home.includes(world);
  let status = 'native';
  if (!native) {
    const holy = ['angel', 'demon', 'drake'].includes(race);
    status = wpick(['outcast', 'falsegod', 'priest', 'native'], s => ({ outcast: holy ? 3 : 5, falsegod: holy ? 4 : 1.5, priest: holy ? 3 : 2, native: holy ? 0 : 1.5 })[s]);
  }
  const att = o.att || wpick(Object.keys(D.ATTITUDE), a => ({ love: 4, strict: 3, cold: 2, cruel: status === 'outcast' ? 2 : 1, orphan: status === 'native' ? 1 : 2.5, proud: dest === 'ruler' || dest === 'chosen' ? 2.5 : 1 })[a]);
  const cult = D.RACES[race].cult;
  const fam = { att, wealth: o.wealth != null ? o.wealth : wpick([0, 1, 2, 3, 4], i => [1, 3, 4, 2, dest === 'ruler' ? 1.5 : 0.5][i]),
    mom: pick(D.NAMES[cult].f), dad: pick(D.NAMES[cult].m), sib: ri(0, 4) };
  const pot = {}, st = {};
  for (const [k] of D.STATS) {
    let v = ri(2, 7) + (D.RACES[race].mod[k] || 0) + (D.ATTITUDE[att].mod[k] || 0);
    const di = D.DEST[dest].st.indexOf(k); if (di === 0) v += 2; else if (di > 0) v += 1;
    if (k === 'temp') v = ri(1, 8) + (D.RACES[race].mod[k] || 0) + (D.ATTITUDE[att].mod[k] || 0);
    pot[k] = clamp(v, 1, 10);
    st[k] = Math.max(1, Math.round(pot[k] * 0.25));
  }
  if (o.pot) Object.assign(pot, o.pot);
  const h = { id: E.uid(), name: o.name || E.randName(race, g), g, race, world, dest, status, fam, pot, st,
    birthT: S.T, lvl: 1, hp: 4, mhp: 0, alive: true, faith: clamp(10 + D.ATTITUDE[att].faith + (status !== 'native' && status !== 'outcast' ? 10 : 0), 0, 100), fear: 0,
    followers: 0, marks: [], buffs: [], ev: null, pre: null, shield: 0, feed: [], feedEp: 0, ms: {}, chron: [], lastEv: [], lastEvT: S.T, yr: 0, omens: 0, owner: S.god.id };
  h.hp = E.maxHP(h, S);
  return h;
};
E.addHero = function (S, h) {
  S.heroes.push(h);
  if (!S.worlds[h.world]) S.worlds[h.world] = newWorldEv(S, h.world, true);
  const t = E.fmt(`Родил{ся|ась} %name% — ${D.RACES[h.race].n[h.g === 'f' ? 1 : 0].toLowerCase()} в мире «%world%». Семья ${D.WEALTH[h.fam.wealth]}, родители ${D.ATTITUDE[h.fam.att].n}.`, h, S);
  feed(h, S, t, 'ms'); chron(S, h, t);
  if (h.status !== 'native') { const s2 = E.fmt(statusBirth[h.status], h, S); feed(h, S, s2, 'ms'); chron(S, h, s2); }
  return h;
};
const statusBirth = {
  outcast: 'Местные косо смотрят на младенца-чужака. Шепчутся, что он принесёт беду.',
  falsegod: 'Местные увидели в младенце знак небес. К дому уже несут дары.',
  priest: 'Повитуха сказала: «Этого ребёнка коснулся бог». С тех пор у колыбели всегда горит свеча.'
};
function feed(h, S, txt, k) {
  h.feed.push({ T: S.T, txt, k });
  if (h.feed.length > 160) h.feed.splice(0, h.feed.length - 160);
}
function chron(S, h, txt, k) {
  const e = { T: S.T, txt, hid: h ? h.id : null, hn: h ? h.name : null, k: k || '' };
  if (h) { h.chron.push(e); if (h.chron.length > 300) h.chron.shift(); }
  S.chron.push(e); if (S.chron.length > 400) S.chron.shift();
}
E.feed = feed; E.chron = chron;
E.die = (h, S, cause) => { const n = []; die(h, S, n, cause); return n; };

/* ---------- мир ---------- */
function newWorldEv(S, wid, first) {
  const ids = Object.keys(D.WORLD_EVENTS);
  const id = first ? 'calm' : wpick(ids, k => D.WORLD_EVENTS[k].w * (k === (S.worlds[wid] || {}).ev ? 0.3 : 1));
  return { ev: id, until: S.T + ri(id === 'calm' ? 30 : 12, id === 'calm' ? 80 : 40) * DAY };
}
E.worldEv = (S, wid) => D.WORLD_EVENTS[(S.worlds[wid] || { ev: 'calm' }).ev];

/* ---------- события героя ---------- */
const RATE = [0.12, 0.14, 0.16, 0.18, 0.16, 0.15, 0.14]; // событий в день по возрастной группе
function eventPool(h, S) {
  const m = E.mat(h, S), wev = (S.worlds[h.world] || {}).ev;
  const out = [];
  D.EVENTS.forEach((e, i) => {
    if (m < e.a[0] || m >= e.a[1]) return;
    if (e.w && !e.w.includes(h.world)) return;
    if (e.we && e.we !== wev) return;
    if (e.ds && e.ds !== h.dest) return;
    if (e.out && h.status === 'native') return;
    if (e.holy && !(h.status === 'falsegod' || h.status === 'priest')) return;
    if (h.lastEv.includes(i)) return;
    let w = 1;
    if (e.ds) w = 1.6; if (e.we) w = 3; if (e.out) w = h.status === 'outcast' ? 1.6 : 0.6; if (e.holy) w = 1.3;
    if (e.w) w *= 1.3;
    if (wev === 'plague' && /хвор|лихорад|Мор|болезн/i.test(e.t)) w *= 3;
    out.push([i, w]);
  });
  return out;
}
E.startEvent = function (h, S, forceIdx) {
  let i = forceIdx;
  if (i == null) { const pool = eventPool(h, S); if (!pool.length) return null; i = wpick(pool, p => p[1])[0]; }
  const e = D.EVENTS[i];
  const pre = h.pre && h.pre.until > S.T ? h.pre.v : 0;
  h.pre = null;
  h.ev = { i, start: S.T, until: S.T + e.h, mod: pre, help: 0, harm: 0, txt: E.fmt(e.t, h, S) };
  h.lastEv.push(i); if (h.lastEv.length > 4) h.lastEv.shift();
  h.lastEvT = S.T;
  feed(h, S, '⚠ ' + h.ev.txt, 'ev');
  return h.ev;
};
E.evInfo = h => h.ev ? D.EVENTS[h.ev.i] : null;
/* шанс успеха текущего события (для подсказки богу) */
E.chance = function (h, S) {
  if (!h.ev) return null;
  const e = D.EVENTS[h.ev.i];
  const base = evScoreBase(h, S, e);
  let n = 0; for (let r = 1; r <= 10; r++) if (base + r >= evDiff(h, S, e)) n++;
  return n / 10;
};
function evDiff(h, S, e) { return e.d + (E.worldEv(S, h.world).k - 1) * 3; }
function evScoreBase(h, S, e) {
  const sv = e.rev ? 11 - E.stat(h, 'temp', S) : E.stat(h, e.st, S);
  let s = sv + (E.stat(h, 'luck', S) - 5) * 0.3 + h.ev.mod + Math.min(3, Math.log10(h.lvl) * 1.2);
  if (e.soc && !e.rev) s -= Math.max(0, E.stat(h, 'temp', S) - 5) * 0.4;
  if (E.hasMark(h, 'sick')) s -= 1;
  if (E.hasMark(h, 'coin') && e.st === 'luck') s += 1;
  return s;
}
function resolveEvent(h, S, notes) {
  const e = D.EVENTS[h.ev.i], ev = h.ev;
  const roll = ri(1, 10), score = evScoreBase(h, S, e) + roll, d = evDiff(h, S, e);
  h.ev = null;
  const ok = score >= d;
  if (ok) {
    h.lvl++;
    let gain = '';
    const k = e.rev ? null : e.st;
    if (k && h.st[k] < 10 && R() < (h.st[k] < h.pot[k] ? 0.06 : h.st[k] < h.pot[k] + 2 ? 0.015 : 0)) { h.st[k]++; gain = ` (${D.STAT[k]} +1)`; }
    else if (e.rev && R() < 0.08 && h.st.temp > 1) { h.st.temp--; gain = ' (Вспыльчивость −1)'; }
    const t = E.fmt(e.ok, h, S);
    feed(h, S, '✔ ' + t + gain, 'ok');
    if (/монет/.test(e.ok)) addMark(h, S, 'coin');
    if (/амулет/.test(e.ok)) addMark(h, S, 'amulet');
    if (/благословение леса/.test(e.ok)) addMark(h, S, 'blessforest');
    if (e.holy) h.followers += ri(3, 12);
    if (ev.help > 0 && R() < 0.6) { h.faith = clamp(h.faith + 2, 0, 100); }
    if (e.dg >= 3 || e.ds || e.dg === 0 && R() < 0.4) chron(S, h, `${ev.txt} — ${t}`);
    notes.push({ k: 'res', hid: h.id, ok: true, txt: `${h.name}: ${t}` });
  } else {
    const t = E.fmt(e.no, h, S);
    let dmgT = '';
    if (e.dg > 0) {
      const crit = score < d - 6;
      let dmg = E.maxHP(h, S) * e.dg * rnd(0.045, 0.09) * (crit ? 1.5 : 1);
      if (h.shield) { h.shield = 0; dmg *= 0.25; dmgT = ' Невидимая сила смягчила удар.'; }
      dmg = Math.max(1, Math.round(dmg));
      if (E.mat(h, S) < 12 && h.hp - dmg <= 0 && R() < 0.75) dmg = Math.max(0, h.hp - 1);
      h.hp -= dmg; dmgT = ` (−${dmg} HP)` + dmgT;
      if (crit && e.dg >= 3 && R() < 0.5) addMark(h, S, 'scar');
      if (/лихорад|хвор|Мор|болезн/i.test(e.t + e.no)) addMark(h, S, 'sick');
      if (/метку/.test(e.no)) addMark(h, S, 'dark');
    }
    if (e.holy && h.followers > 0) h.followers = Math.max(0, h.followers - ri(1, 5));
    feed(h, S, '✘ ' + t + dmgT, 'no');
    if (e.dg >= 3) chron(S, h, `${ev.txt} — ${t}`);
    notes.push({ k: 'res', hid: h.id, ok: false, txt: `${h.name}: ${t}` });
    if (h.hp <= 0) die(h, S, notes, t);
  }
}
function die(h, S, notes, cause) {
  h.alive = false; h.deathT = S.T; h.hp = 0; h.ev = null;
  const t = E.fmt(`✝ %name% погиб{|ла} в возрасте ${E.ageStr(h, S)}. ${cause || ''}`, h, S);
  h.cause = cause; feed(h, S, t, 'death'); chron(S, h, t, 'death');
  notes.push({ k: 'death', hid: h.id, txt: t });
}

/* ---------- лента ---------- */
function feedTick(h, S) {
  const m = E.mat(h, S), b = E.band(m);
  if (m >= 3 && R() < 0.42) {
    const th = D.THOUGHTS['b' + b];
    let mood = 'n';
    const r = R();
    if (h.faith >= 55 && r < 0.45) mood = 'f'; else if (h.fear >= 40 && r < 0.4) mood = 'x'; else if (h.faith < 12 && r < 0.3) mood = 'z';
    feed(h, S, '💭 ' + E.fmt(pick(th[mood]), h, S), 'think');
  } else {
    feed(h, S, E.fmt(pick(D.FEED['b' + b]), h, S), 'act');
  }
}

/* ---------- такт ---------- */
function hourTick(S, notes, live) {
  S.T += 1;
  const dayN = Math.floor(S.T / DAY), newDay = dayN !== S.day;
  if (newDay) { S.day = dayN; dayTick(S, notes); }
  const hour = S.T % DAY;
  for (const h of S.heroes) {
    if (!h.alive) continue;
    // здоровье
    const mh = E.maxHP(h, S);
    let reg = mh * 0.012 * (E.hasMark(h, 'regen') ? 3 : 1);
    if (E.hasMark(h, 'sick')) reg = -mh * 0.004;
    if (E.hasMark(h, 'poison')) reg = -mh * 0.006;
    h.hp = clamp(h.hp + reg, E.hasMark(h, 'sick') || E.hasMark(h, 'poison') ? 1 : -99, mh);
    // события
    if (h.ev) { if (S.T >= h.ev.until) resolveEvent(h, S, notes); }
    else if (S.T - h.lastEvT > 12) {
      const m = E.mat(h, S), we = E.worldEv(S, h.world);
      if (R() < RATE[E.band(m)] / DAY * we.k * (h.dest === 'chosen' ? 1.2 : 1)) {
        const ev = E.startEvent(h, S);
        if (ev) notes.push({ k: 'event', hid: h.id, txt: `${h.name}: ${ev.txt}` });
      }
    }
    if (!h.alive) continue;
    if (hour >= 7 && hour <= 22 && R() < 0.2) feedTick(h, S);
    // день рождения / вехи
    const a = E.age(h, S), m = E.mat(h, S);
    for (const ms of D.MILESTONES) if (!h.ms[ms.id] && m >= ms.a) milestone(h, S, ms, notes);
    if (Math.floor(a) > h.yr) { h.yr = Math.floor(a); birthday(h, S, notes); }
  }
}
function milestone(h, S, ms, notes) {
  h.ms[ms.id] = 1; h.lvl++;
  const t = E.fmt(ms.t, h, S);
  feed(h, S, '★ ' + t, 'ms'); chron(S, h, t);
  if (ms.id === 'path' && (h.dest === 'priest' || h.faith >= 70) && h.status !== 'priest') {
    h.status = 'priest';
    const t2 = E.fmt('%name% посвятил{|а} себя служению. Теперь {он|она} — жрец %god%.', h, S, { god: S.god.name });
    feed(h, S, '★ ' + t2, 'ms'); chron(S, h, t2); notes.push({ k: 'ms', hid: h.id, txt: t2 });
  }
}
function birthday(h, S, notes) {
  const m = E.mat(h, S);
  for (const [k] of D.STATS) {
    if (m < 18) { if (h.st[k] < h.pot[k] && R() < 0.42) h.st[k]++; }
    else if (m < 50) { if (h.st[k] < h.pot[k] && R() < 0.15) h.st[k]++; }
    else if (m > 62 && (k === 'str' || k === 'agi') && h.st[k] > 1 && R() < 0.25) h.st[k]--;
    else if (m > 55 && (k === 'int' || k === 'emp' || k === 'will') && h.st[k] < 10 && R() < 0.1) h.st[k]++;
  }
  if (m >= 60) {
    const p = Math.pow((m - 60) / 40, 2) * 0.5;
    if (R() < p) die(h, S, notes, E.fmt(pick(D.DEATH_OLD), h, S));
  }
}
function dayTick(S, notes) {
  // мир
  for (const w in S.worlds) {
    if (S.T >= S.worlds[w].until) {
      const prev = S.worlds[w].ev;
      S.worlds[w] = newWorldEv(S, w);
      if (S.worlds[w].ev === prev) continue;
      const we = D.WORLD_EVENTS[S.worlds[w].ev];
      const t = `${D.WORLDS[w].ico} ${D.WORLDS[w].n}: ${we.ico} ${we.n}. ${we.d}`;
      chron(S, null, t, 'world'); notes.push({ k: 'world', txt: t });
      for (const h of S.heroes) if (h.alive && h.world === w) feed(h, S, '🌍 ' + we.n + '. ' + we.d, 'world');
    }
  }
  // вера
  let inc = 0.5;
  for (const h of S.heroes) {
    if (!h.alive) continue;
    const we = E.worldEv(S, h.world);
    let x = h.faith * 0.025 + h.fear * 0.015;
    if ((h.status === 'priest' || h.status === 'falsegod') && h.faith >= 30) x += Math.sqrt(h.followers) * 0.15;
    inc += x * (we.faith || 1);
    // последователи
    const m = E.mat(h, S);
    if ((h.status === 'priest' || h.status === 'falsegod') && m >= 10)
      h.followers += Math.max(0, E.stat(h, 'cha', S) + Math.log10(h.lvl) * 2 - 4) * rnd(0, 0.04);
    if (we.faith) h.faith = clamp(h.faith + 0.15, 0, 100);
    h.fear = Math.max(0, h.fear - 0.25);
    if (h.faith > 20) h.faith -= 0.03;
    // эффекты
    h.buffs = h.buffs.filter(b => b.until > S.T);
    h.marks = h.marks.filter(x => !x.until || x.until > S.T);
    // история обнуляется каждые 8 дней героя
    const ep = Math.floor((S.T - h.birthT) / DAY / 8);
    if (ep !== h.feedEp) { h.feedEp = ep; h.feed = []; }
  }
  S.god.faith = Math.min(999, S.god.faith + inc);
  S.god.inc = inc;
}
E.income = function (S) {
  let inc = 0.5;
  for (const h of S.heroes) if (h.alive) {
    let x = h.faith * 0.025 + h.fear * 0.015;
    if ((h.status === 'priest' || h.status === 'falsegod') && h.faith >= 30) x += Math.sqrt(h.followers) * 0.15;
    inc += x * (E.worldEv(S, h.world).faith || 1);
  }
  return inc;
};

/* advance: hours — сколько игровых часов прошло; live=false — догоняем (бог «спал») */
E.advance = function (S, hours, live) {
  const notes = [];
  S.acc = (S.acc || 0) + hours;
  while (S.acc >= 1) {
    S.acc -= 1;
    const n0 = notes.length;
    hourTick(S, notes, live);
    if (live && S.pauseOnEvent && !E.SPEEDS[S.speed].off && notes.slice(n0).some(n => n.k === 'event' || n.k === 'death')) { S.paused = true; S.acc = 0; break; }
  }
  return notes;
};

/* ---------- знамения ---------- */
E.omenList = sph => D.BR_IDS.map(br => ({ br, acts: D.SPHERES[sph][br] }));
E.findAct = (sph, br, id) => (D.SPHERES[sph][br] || []).find(a => a.id === id);
E.fxText = function (fx) {
  const o = [];
  if (fx.ev) o.push((fx.ev > 0 ? '+' : '') + fx.ev + ' к исходу события');
  if (fx.pre) o.push('+' + fx.pre + ' к следующему событию');
  if (fx.hp) o.push((fx.hp > 0 ? '+' : '−') + Math.round(Math.abs(fx.hp) * 100) + '% HP');
  for (const b of [fx.buff, fx.buff2]) if (b) o.push(`${D.STAT[b[0]]} ${b[1] > 0 ? '+' : ''}${b[1]} на ${b[2]} дн.`);
  if (fx.grow) o.push(`рост: +1 к ${fx.grow} хар.`);
  if (fx.grow1) o.push(`шанс: ${D.STAT[fx.grow1]} +1`);
  if (fx.mhp) o.push('+' + Math.round(fx.mhp * 100) + '% к макс. HP навсегда');
  if (fx.avoid) o.push(`${Math.round(fx.avoid * 100)}% увести от беды`);
  if (fx.shield) o.push('смягчит следующий удар');
  if (fx.cure) o.push('снимает болезни и проклятия');
  if (fx.mark) o.push('метка: ' + E.MARKS[fx.mark].n);
  if (fx.fa) o.push((fx.fa > 0 ? 'вера +' : 'вера ') + fx.fa);
  if (fx.fe) o.push('страх +' + fx.fe);
  return o.join(' · ');
};
E.omenCost = (act, foreign) => Math.ceil(act.c * (foreign ? 1.5 : 1));
/* o: {from: {name, g}} — знамение чужого бога; free — не списывать веру (её списал отправитель) */
E.omen = function (S, hid, sph, br, aid, o) {
  o = o || {};
  const h = S.heroes.find(x => x.id === hid);
  if (!h || !h.alive) return { ok: false, err: 'Герой недоступен' };
  const act = E.findAct(sph, br, aid);
  if (!act) return { ok: false, err: 'Нет такого знамения' };
  const cost = E.omenCost(act, !!o.from);
  if (!o.free) { if (S.god.faith < cost) return { ok: false, err: 'Не хватает веры' }; S.god.faith -= cost; S.god.omens++; }
  const fx = act.fx, m = E.mat(h, S), kid = m < 13;
  const godName = o.from ? o.from.name : S.god.name;
  const we = E.worldEv(S, h.world);
  const notice = R() < clamp(0.45 + E.stat(h, 'per', S) * 0.05 + (m < 7 ? 0.3 : 0) + (we.notice ? 0.3 : 0), 0.2, 0.97);
  const mh = E.maxHP(h, S);
  const lines = [];
  // эффекты
  if (fx.ev) {
    let v = fx.ev;
    if (h.ev) {
      const e = D.EVENTS[h.ev.i];
      if (v > 0 && e.fit && e.fit.includes(sph)) v += 1;
      h.ev.mod = clamp(h.ev.mod + v, -8, 8);
      if (v > 0) h.ev.help++; else h.ev.harm++;
    } else {
      h.pre = { v: clamp(((h.pre && h.pre.until > S.T) ? h.pre.v : 0) + v, -6, 6), until: S.T + 48 };
    }
  }
  if (fx.pre) h.pre = { v: clamp(((h.pre && h.pre.until > S.T) ? h.pre.v : 0) + fx.pre, -6, 6), until: S.T + 72 };
  if (fx.hp) h.hp = clamp(h.hp + mh * fx.hp, 1, mh);
  for (const b of [fx.buff, fx.buff2]) if (b) h.buffs.push({ k: b[0], v: b[1], until: S.T + b[2] * DAY, n: act.n });
  if (fx.grow) { const ks = D.STATS.map(s => s[0]).filter(k => k !== 'temp' && h.st[k] < 10); for (let i = 0; i < fx.grow && ks.length; i++) { const k = ks.splice(ri(0, ks.length - 1), 1)[0]; h.st[k]++; lines.push(`${D.STAT[k]} +1`); } }
  if (fx.grow1 && R() < 0.4 && h.st[fx.grow1] < 10) { h.st[fx.grow1]++; lines.push(`${D.STAT[fx.grow1]} +1`); }
  if (fx.mhp) h.mhp = Math.min(1, (h.mhp || 0) + fx.mhp);
  if (fx.mark) addMark(h, S, fx.mark);
  if (fx.cure) { h.marks = h.marks.filter(x => !(E.MARKS[x.id] && E.MARKS[x.id].bad && !E.MARKS[x.id].perm) && x.id !== 'dark'); h.buffs = h.buffs.filter(b => b.v > 0); }
  if (fx.shield) h.shield = 1;
  let avoided = false;
  if (fx.avoid && h.ev && R() < fx.avoid * (notice ? 1 : 0.5)) {
    avoided = true;
    const e = D.EVENTS[h.ev.i];
    h.ev = null;
    lines.push(E.fmt('Почуяв недоброе, %name% обош{ёл|ла} беду стороной', h, S));
    if (e.dg === 0) lines.push(E.fmt('Правда, и удачу упустил{|а} тоже', h, S));
  }
  // вера/страх
  if (notice) {
    let fa = fx.fa || 0, fe = fx.fe || 0;
    if (kid) { fa = fa > 0 ? fa * 1.5 : fa * 0.5; fe *= 0.6; }
    if (o.from) { fa *= 0.5; } // чужой бог — вера уходит не тебе, но герой всё равно впечатлён
    h.faith = clamp(h.faith + fa, 0, 100); h.fear = clamp(h.fear + fe, 0, 100);
  }
  h.omens = (h.omens || 0) + 1;
  // текст
  const vis = E.fmt(act.v, h, S);
  const react = notice ? E.fmt(pick(D.REACT[E.group(m)][br]), h, S, { god: godName }) : E.fmt(pick(D.UNNOTICED), h, S);
  const pref = o.from ? `✧ Знамение от ${o.from.name}: ` : '✧ ';
  feed(h, S, pref + `«${act.n}». ` + vis + (lines.length ? ' ' + lines.join('. ') + '.' : ''), 'omen');
  feed(h, S, (notice ? '↳ ' : '↳ ') + react, 'react');
  if (o.from) chron(S, h, `${o.from.name} послал${o.from.g === 'f' ? 'а' : ''} знамение «${act.n}» герою ${h.name}.`, 'foreign');
  return { ok: true, cost, notice, avoided, vis, react, act };
};

/* ---------- сводка героя для пантеона ---------- */
E.summary = (h, S) => ({ id: h.id, name: h.name, g: h.g, race: h.race, world: h.world, dest: h.dest, status: h.status, age: E.ageStr(h, S),
  who: E.who(h, S), lvl: h.lvl, hp: Math.round(h.hp), mhp: E.maxHP(h, S), alive: h.alive, ev: h.ev ? h.ev.txt : null, faith: Math.round(h.faith) });

/* ---------- сохранение ---------- */
E.load = function (json) {
  const S = JSON.parse(json);
  if (!S || !S.god) throw new Error('bad save');
  for (const h of S.heroes) if (h.alive) h.hp = Math.min(h.hp, E.maxHP(h, S));
  return S;
};

if (typeof module !== 'undefined') module.exports = E; else root.PE = E;
})(this);
