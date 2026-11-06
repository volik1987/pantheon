/* Пантеон — связь между богами (PeerJS, звезда через создателя пантеона).
   ?local=1 — вместо WebRTC BroadcastChannel (для тестов в одном браузере). */
'use strict';
(function (root) {
const QS = new URLSearchParams(location.search);
const LOCAL = QS.has('local');
const PREFIX = 'pantheon-v1-';
const PEER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';
const PEER_OPTS = { debug: 1, config: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }] } };
const ERR = { 'peer-unavailable': 'Пантеон с таким кодом не найден', 'unavailable-id': 'Такой код уже занят — попробуйте ещё раз', 'network': 'Нет связи с сервером', 'server-error': 'Сервер связи недоступен', 'no-peerjs': 'Не загрузилась сетевая библиотека — нужен интернет', 'browser-incompatible': 'Браузер не поддерживает WebRTC' };

function loadPeer() {
  if (LOCAL || typeof Peer !== 'undefined') return Promise.resolve();
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = PEER_URL; s.onload = ok; s.onerror = () => no('no-peerjs'); document.head.appendChild(s); });
}
function wrapPeer(pc) {
  const c = { open: false, dead: false, send(o) { if (c.open) try { pc.send(o); } catch (e) { } }, close() { try { pc.close(); } catch (e) { } } };
  const shut = () => { if (c.dead) return; c.dead = true; c.open = false; c.onclose && c.onclose(); };
  pc.on('open', () => { c.open = true; c.onopen && c.onopen(); });
  pc.on('data', d => c.ondata && c.ondata(d));
  pc.on('close', shut); pc.on('error', shut);
  return c;
}
function localConn(bc, to, from) {
  const c = {
    open: false, dead: false,
    send(o) { if (c.open) try { bc.postMessage({ to, from, ty: 'd', d: JSON.parse(JSON.stringify(o)) }); } catch (e) { } },
    close() { try { bc.postMessage({ to, from, ty: 'x' }); } catch (e) { } c._shut(); },
    _open() { c.open = true; c.onopen && c.onopen(); },
    _recv(m) { if (m.ty === 'd') c.ondata && c.ondata(m.d); else if (m.ty === 'x') c._shut(); },
    _shut() { if (c.dead) return; c.dead = true; c.open = false; c.onclose && c.onclose(); }
  };
  return c;
}
function makeHost(code, h) {
  if (LOCAL) {
    const bc = new BroadcastChannel('pantheon-' + code), conns = {};
    bc.onmessage = e => {
      const m = e.data; if (m.to !== 'host') return;
      if (m.ty === 'c') {
        if (conns[m.from]) return;
        const c = localConn(bc, m.from, 'host'); conns[m.from] = c; h.conn(c);
        bc.postMessage({ to: m.from, from: 'host', ty: 'ok' }); setTimeout(() => c._open(), 0);
      } else if (conns[m.from]) conns[m.from]._recv(m);
    };
    setTimeout(() => h.ready(code), 30);
    return { destroy() { for (const k in conns) conns[k].close(); bc.close(); } };
  }
  const peer = new Peer(PREFIX + code, PEER_OPTS);
  peer.on('open', () => h.ready(code));
  peer.on('connection', pc => h.conn(wrapPeer(pc)));
  peer.on('error', e => h.error(e.type));
  peer.on('disconnected', () => { if (!peer.destroyed) try { peer.reconnect(); } catch (e) { } });
  return { destroy() { peer.destroy(); } };
}
function makeJoin(code, h) {
  if (LOCAL) {
    const bc = new BroadcastChannel('pantheon-' + code), id = 'p' + Math.random().toString(36).slice(2, 8);
    const c = localConn(bc, 'host', id); let ok = false;
    bc.onmessage = e => { const m = e.data; if (m.to !== id) return; if (m.ty === 'ok') { ok = true; c._open(); } else c._recv(m); };
    h.conn(c);
    let tries = 0;
    const knock = () => { if (ok) return; if (++tries > 8) { h.error('peer-unavailable'); return; } bc.postMessage({ to: 'host', from: id, ty: 'c' }); setTimeout(knock, 400); };
    knock();
    return { destroy() { c.close(); bc.close(); } };
  }
  const peer = new Peer(PEER_OPTS);
  peer.on('open', () => h.conn(wrapPeer(peer.connect(PREFIX + code, { serialization: 'json', reliable: true }))));
  peer.on('error', e => h.error(e.type));
  return { destroy() { peer.destroy(); } };
}

/* ---------- логика пантеона ----------
   cb: me() → {god, heroes}; onMsg(m); onState(); onError(text) */
const N = {
  role: null, code: null, link: null, conns: [], hostConn: null, gods: {}, status: 'off', err: '', cb: null, timer: null,
  ERR,
  newCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; },
  async host(code) {
    N.leave(true);
    N.role = 'host'; N.code = code || N.newCode(); N.status = 'connecting'; N.cb.onState();
    try { await loadPeer(); } catch (e) { return N.fail('no-peerjs'); }
    N.link = makeHost(N.code, {
      ready: () => { N.status = 'on'; N.selfUpdate(); N.cb.onState(); N.sys(`Пантеон ${N.code} открыт. Позовите других богов — дайте им код.`); },
      conn: c => {
        c.onopen = () => { };
        c.ondata = m => N.hostRecv(c, m);
        c.onclose = () => { N.conns = N.conns.filter(x => x !== c); if (c.godId && N.gods[c.godId]) { const g = N.gods[c.godId].god; delete N.gods[c.godId]; N.broadcast({ t: 'sys', txt: `${g.name} покинул${g.g === 'f' ? 'а' : ''} пантеон.` }); N.roster(); } };
        N.conns.push(c);
      },
      error: t => N.fail(t)
    });
    N.startTimer();
  },
  async join(code) {
    N.leave(true);
    N.role = 'client'; N.code = code.toUpperCase().trim(); N.status = 'connecting'; N.cb.onState();
    try { await loadPeer(); } catch (e) { return N.fail('no-peerjs'); }
    N.link = makeJoin(N.code, {
      conn: c => {
        N.hostConn = c;
        c.onopen = () => { N.status = 'on'; N.cb.onState(); N.sendHi(); };
        c.ondata = m => N.clientRecv(m);
        c.onclose = () => { if (N.role === 'client') { N.status = 'off'; N.err = 'Связь с пантеоном потеряна'; N.gods = {}; N.cb.onState(); N.sys('Связь с пантеоном потеряна.'); } };
      },
      error: t => N.fail(t)
    });
    N.startTimer();
  },
  fail(t) { N.err = ERR[t] || ('Ошибка связи: ' + t); N.status = 'off'; const r = N.role; N.leave(true); N.cb.onError && N.cb.onError(N.err, r); N.cb.onState(); },
  leave(silent) {
    if (N.link) try { N.link.destroy(); } catch (e) { }
    N.link = null; N.conns = []; N.hostConn = null; N.gods = {}; N.role = null;
    if (!silent) { N.status = 'off'; N.code = null; N.err = ''; }
    clearInterval(N.timer); N.timer = null;
    N.cb && N.cb.onState();
  },
  startTimer() { clearInterval(N.timer); N.timer = setInterval(() => { if (N.status !== 'on') return; if (N.role === 'host') N.selfUpdate(); else N.sendHi(); }, 15000); },
  me() { return N.cb.me(); },
  sendHi() { const m = N.me(); N.hostConn && N.hostConn.send({ t: 'hi', god: m.god, heroes: m.heroes }); },
  selfUpdate() { const m = N.me(); N.gods[m.god.id] = { god: m.god, heroes: m.heroes, me: 1 }; N.roster(); },
  roster() { const list = Object.values(N.gods).map(x => ({ god: x.god, heroes: x.heroes })); N.broadcast({ t: 'roster', list }, null, true); N.cb.onState(); },
  broadcast(m, except, noLocal) { for (const c of N.conns) if (c !== except) c.send(m); if (!noLocal) N.cb.onMsg(m); },
  sendTo(godId, m) { // только для хоста
    if (godId === N.me().god.id) { N.cb.onMsg(m); return true; }
    const c = N.conns.find(x => x.godId === godId); if (c) { c.send(m); return true; } return false;
  },
  hostRecv(c, m) {
    if (!m || !m.t) return;
    if (m.t === 'hi') {
      const first = !c.godId;
      c.godId = m.god.id; N.gods[m.god.id] = { god: m.god, heroes: m.heroes || [] };
      if (first) N.broadcast({ t: 'sys', txt: `${m.god.name} вош${m.god.g === 'f' ? 'ла' : 'ёл'} в пантеон.` });
      N.roster();
    } else if (m.t === 'chat') N.broadcast(m, null);
    else if (m.t === 'omen' || m.t === 'omenres') N.sendTo(m.to, m);
  },
  clientRecv(m) {
    if (!m || !m.t) return;
    if (m.t === 'roster') { N.gods = {}; for (const x of m.list) N.gods[x.god.id] = x; N.cb.onState(); return; }
    N.cb.onMsg(m);
  },
  send(m) { // от себя
    if (N.status !== 'on') return false;
    if (N.role === 'host') {
      if (m.t === 'chat') N.broadcast(m);
      else if (m.to) return N.sendTo(m.to, m);
    } else N.hostConn && N.hostConn.send(m);
    return true;
  },
  sys(txt) { N.cb.onMsg({ t: 'sys', txt, local: 1 }); },
  others() { const my = N.me().god.id; return Object.values(N.gods).filter(x => x.god.id !== my); }
};
root.NET = N;
})(this);
