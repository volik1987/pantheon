// Проверка шаблонов: все строки справочника в мужском и женском роде, ищем битые формы
const D = require('../data.js'), E = require('../engine.js');
const S = E.newState({ name: 'Икс', g: 'f' });
const strs = []; (function walk(o) { if (typeof o === 'string') strs.push(o); else if (o && typeof o === 'object') for (const k in o) walk(o[k]); })(D);
let n = 0;
for (const g of ['m', 'f']) {
  const h = { g, name: 'Мила', world: 'human', race: 'human', fam: { att: 'love' }, dest: 'bard' };
  for (const t of strs) {
    const f = E.fmt(t, h, S);
    const bad = /%\w+%|\{|\}/.test(f) || (g === 'f' && /(шёл|ёс|ёг|ёк|ел)л?а\b|шёлла|\b[а-яё]+лся\b/i.test(f.replace(/Мила|Икс/g, '')) && !/внук|Внук|ушёл в слезах|кошка|Кошка|ветер|Монетка|Ягода|Ветка|Болезнь|Тварь|Дух|Зверь|Посланник|Купец|Учитель|Обидчик|вельможа|дерево|мир|Ребёнок|Воин|Свиток|Малыш|Кусочек|Щенок|жар|сосед|Сосед|страх|Страх|он сам/.test(f));
    if (bad) { n++; console.log(g, '|', f.slice(0, 150)); }
  }
}
console.log('строк', strs.length, 'подозрительных', n);
