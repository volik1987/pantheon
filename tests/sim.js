// Симуляция жизни: node tests/sim.js [героев] [лет] [режим: none|help|harm|random] [seed]
const D = require('../data.js'), E = require('../engine.js');
const N = +process.argv[2] || 200, YEARS = +process.argv[3] || 90, MODE = process.argv[4] || 'none';
E.seed(+process.argv[5] || 7);
const deaths = [], lv = [], fol = [], faith = [];
let checks = 0, bad = 0, evs = 0, ok = 0, omens = 0;
const badRe = /%\w+%|\{[^}]*\|[^}]*\}|undefined|NaN/;
for (let n = 0; n < N; n++) {
  const S = E.newState({ name: 'Тест', sph: n % 8, g: n % 2 ? 'f' : 'm' });
  const h = E.addHero(S, E.newHero(S, {}));
  for (let d = 0; d < YEARS * 365 && h.alive; d++) {
    for (let i = 0; i < 24; i++) {
      const notes = E.advance(S, 1, false);
      for (const x of notes) { if (x.k === 'event') evs++; if (x.k === 'res' && x.ok) ok++; }
      if (MODE !== 'none' && h.ev && h.ev.start === S.T) {
        const acts = E.omenList(S.god.sph).filter(b => MODE === 'random' || b.br === MODE).flatMap(b => b.acts.map(a => [b.br, a]));
        const [br, a] = acts[Math.floor(Math.random() * acts.length)];
        const r = E.omen(S, h.id, S.god.sph, br, a.id);
        if (r.ok) omens++;
      }
    }
    for (const f of h.feed) { checks++; if (badRe.test(f.txt)) { bad++; if (bad < 15) console.log('BAD:', f.txt); } }
  }
  if (!h.alive) deaths.push(E.age(h, S)); lv.push(h.lvl); fol.push(h.followers); faith.push(S.god.faith);
}
const avg = a => a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '-';
const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))].toFixed(1) : '-'; };
console.log(`mode=${MODE} heroes=${N} years=${YEARS}`);
console.log(`умерло ${deaths.length}/${N}; возраст смерти: медиана ${q(deaths, .5)}, 10% ${q(deaths, .1)}; до 12 лет: ${deaths.filter(a => a < 12).length}, до 18: ${deaths.filter(a => a < 18).length}`);
console.log(`уровень ср ${avg(lv)}; событий ${evs}, успехов ${ok} (${(ok / evs * 100).toFixed(0)}%); знамений ${omens}; вера бога ср ${avg(faith)}; последователи ср ${avg(fol)}`);
console.log(`строк ленты проверено ${checks}, битых ${bad}`);
