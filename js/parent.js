// =====================================================================
// parent.js — Voortgang voor ouders en leerkrachten
// ---------------------------------------------------------------------
// Een scherm voor volwassenen (achter een eenvoudige rekenvraag die een
// kind van 9 nog niet uit het hoofd weet) met:
//  - een overzicht: vluchten, sommen, % goed, gemiddelde tijd, beheerst
//  - per tafel (1 t/m 12) een rij met de 10 sommen in kleur:
//      grijs = nog niet geoefend · rood = hapert (laatste keer fout)
//      oranje = goed maar traag · lichtgroen = goed · donkergroen = beheerst
//    Tik op een som voor de details.
//  - de lastigste sommen op een rij
//  - sterren per wereld en de uitslag tegen Karel
//  - "Kopieer overzicht": alles als tekst, om te mailen of te bewaren
//
// Alle gegevens komen uit wat de game al bijhoudt (localStorage op dit
// apparaat). Er gaat niets het internet op.
// =====================================================================

import { CONFIG } from './config.js';

const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const LEVELS = {
  new:      { label: 'Nog niet geoefend', color: '#e3e8ef', text: '#8a96a8' },
  struggle: { label: 'Hapert',            color: '#ff8a80', text: '#7a1f1a' },
  slow:     { label: 'Goed, maar traag',  color: '#ffc46b', text: '#6b4100' },
  good:     { label: 'Goed',              color: '#a8e6a1', text: '#1f5e26' },
  mastered: { label: 'Beheerst',          color: '#3fb85a', text: '#ffffff' }
};

function formatTime(seconds) {
  return `${seconds.toFixed(1).replace('.', ',')} s`;
}

function percent(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Hoe staat deze som ervoor? (zie LEVELS) */
export function classifyFact(stats) {
  if (!stats || !stats.seen) return 'new';
  // Oudere opslag heeft nog geen lastCorrect: afleiden uit het doosje
  const lastCorrect = stats.lastCorrect !== undefined
    ? stats.lastCorrect
    : (stats.box > 0 || stats.wrong === 0);
  if (!lastCorrect) return 'struggle';
  if (stats.avgTime !== null && stats.avgTime > CONFIG.math.repeatSlowerThan) return 'slow';
  if (stats.box >= 2 || (stats.lastFast && stats.avgTime !== null && stats.avgTime <= CONFIG.math.masteredTime)) {
    return 'mastered';
  }
  return 'good';
}

function factKey(table, times) {
  return `${table}x${times}`;
}

/** Samenvatting van één tafel. */
export function tableSummary(facts, table) {
  const counts = { new: 0, struggle: 0, slow: 0, good: 0, mastered: 0 };
  let timeSum = 0;
  let timeCount = 0;
  let seen = 0;
  for (const times of CONFIG.math.multipliers) {
    const stats = facts[factKey(table, times)];
    counts[classifyFact(stats)] += 1;
    if (stats && stats.seen) {
      seen += stats.seen;
      if (stats.avgTime !== null) {
        timeSum += stats.avgTime;
        timeCount += 1;
      }
    }
  }
  return {
    table,
    counts,
    seen,
    averageTime: timeCount ? timeSum / timeCount : null,
    total: CONFIG.math.multipliers.length
  };
}

/** De sommen die het meest haperen (meeste fouten, langste tijd). */
export function hardestFacts(facts, limit = 8) {
  const list = [];
  for (const table of TABLES) {
    for (const times of CONFIG.math.multipliers) {
      const stats = facts[factKey(table, times)];
      if (!stats || !stats.seen) continue;
      const level = classifyFact(stats);
      if (level !== 'struggle' && level !== 'slow') continue;
      const score = stats.wrong * 3 + (level === 'struggle' ? 4 : 0) + (stats.avgTime || 0);
      list.push({ table, times, stats, level, score });
    }
  }
  return list.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Totaaloverzicht over alle sommen. */
export function overview(facts) {
  let seen = 0;
  let correct = 0;
  let timeSum = 0;
  let timeWeight = 0;
  let mastered = 0;
  let practiced = 0;
  for (const table of TABLES) {
    for (const times of CONFIG.math.multipliers) {
      const stats = facts[factKey(table, times)];
      if (!stats || !stats.seen) continue;
      practiced += 1;
      seen += stats.seen;
      correct += stats.correct;
      if (stats.avgTime !== null && stats.correct) {
        timeSum += stats.avgTime * stats.correct;
        timeWeight += stats.correct;
      }
      if (classifyFact(stats) === 'mastered') mastered += 1;
    }
  }
  return {
    answered: seen,
    correctPercent: percent(correct, seen),
    averageTime: timeWeight ? timeSum / timeWeight : null,
    mastered,
    practiced,
    totalFacts: TABLES.length * CONFIG.math.multipliers.length
  };
}

/** Eén som in woorden, voor het detailregeltje. */
export function factDetail(table, times, stats) {
  const sum = `${times} × ${table} = ${table * times}`;
  if (!stats || !stats.seen) return `${sum} — nog niet geoefend.`;
  const parts = [
    `${stats.seen}× gezien`,
    `${stats.correct}× goed`,
    `${stats.wrong}× fout`
  ];
  if (stats.avgTime !== null) parts.push(`gemiddeld ${formatTime(stats.avgTime)}`);
  return `${sum} — ${parts.join(', ')}. Oordeel: ${LEVELS[classifyFact(stats)].label.toLowerCase()}.`;
}

// =====================================================================
// Het scherm
// =====================================================================

export class ParentScreen {
  /**
   * @param {object} deps  { getFacts, getName, getFlights, getFeathers,
   *                         getBadgeCount, totalBadges, worlds, bestResult,
   *                         isWorldUnlocked, getRace, onClose, audio }
   */
  constructor(deps) {
    this.deps = deps;
    this.gate = document.getElementById('parentGate');
    this.gateQuestion = document.getElementById('gateQuestion');
    this.gateInput = document.getElementById('gateInput');
    this.gateError = document.getElementById('gateError');
    this.overlay = document.getElementById('parentOverlay');
    this.answer = 0;

    document.getElementById('gateCancel').addEventListener('click', () => this.closeGate(true));
    document.getElementById('gateOk').addEventListener('click', () => this.checkGate());
    this.gateInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.checkGate();
      }
    });
    document.getElementById('parentClose').addEventListener('click', () => this.close());
    document.getElementById('parentCopy').addEventListener('click', () => this.copy());
  }

  /** Vraag voor volwassenen (bewust buiten de tafels van 1 t/m 12). */
  openGate() {
    const a = 13 + Math.floor(Math.random() * 7);
    const b = 13 + Math.floor(Math.random() * 7);
    this.answer = a * b;
    this.gateQuestion.textContent = `${a} × ${b} = ?`;
    this.gateInput.value = '';
    this.gateError.textContent = '';
    this.gate.classList.remove('hidden');
    setTimeout(() => this.gateInput.focus(), 50);
  }

  closeGate(backToMap) {
    this.gateInput.blur();
    this.gate.classList.add('hidden');
    window.scrollTo(0, 0);
    if (backToMap) this.deps.onClose();
  }

  checkGate() {
    if (Number(this.gateInput.value.trim()) === this.answer) {
      this.closeGate(false);
      this.open();
    } else {
      this.gateError.textContent = 'Dat klopt niet. Deze vraag is voor volwassenen 🙂';
      this.gateInput.value = '';
    }
  }

  open() {
    this.render();
    this.overlay.classList.remove('hidden');
  }

  close() {
    this.overlay.classList.add('hidden');
    this.deps.onClose();
  }

  render() {
    const d = this.deps;
    const facts = d.getFacts();
    const info = overview(facts);

    document.getElementById('parentTitle').textContent = `Voortgang van ${d.getName()}`;

    // ---------- Tegels ----------
    const tiles = [
      [String(d.getFlights()), 'vluchten'],
      [String(info.answered), 'sommen beantwoord'],
      [`${info.correctPercent}%`, 'goed'],
      [info.averageTime === null ? '–' : formatTime(info.averageTime), 'gem. tijd (goed)'],
      [`${info.mastered}/${info.totalFacts}`, 'sommen beheerst'],
      [`${d.getBadgeCount()}/${d.totalBadges}`, 'badges']
    ];
    const tileBox = document.getElementById('parentTiles');
    tileBox.innerHTML = '';
    for (const [value, label] of tiles) {
      const tile = document.createElement('div');
      tile.className = 'parent-tile';
      const strong = document.createElement('strong');
      strong.textContent = value;
      const small = document.createElement('small');
      small.textContent = label;
      tile.appendChild(strong);
      tile.appendChild(small);
      tileBox.appendChild(tile);
    }

    // ---------- Legenda ----------
    const legend = document.getElementById('parentLegend');
    legend.innerHTML = '';
    for (const level of Object.values(LEVELS)) {
      const item = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.style.background = level.color;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(level.label));
      legend.appendChild(item);
    }

    // ---------- Per tafel ----------
    const detail = document.getElementById('parentDetail');
    detail.textContent = 'Tik op een som voor de details.';
    const grid = document.getElementById('parentTables');
    grid.innerHTML = '';
    for (const table of TABLES) {
      const row = document.createElement('div');
      row.className = 'parent-row';
      const label = document.createElement('span');
      label.className = 'parent-row-label';
      label.textContent = `Tafel van ${table}`;
      row.appendChild(label);

      for (const times of CONFIG.math.multipliers) {
        const stats = facts[factKey(table, times)];
        const level = LEVELS[classifyFact(stats)];
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'parent-cell';
        cell.style.background = level.color;
        cell.style.color = level.text;
        cell.textContent = `${times}×${table}`;
        cell.addEventListener('click', () => {
          detail.textContent = factDetail(table, times, stats);
          for (const other of grid.querySelectorAll('.parent-cell.active')) other.classList.remove('active');
          cell.classList.add('active');
        });
        row.appendChild(cell);
      }

      const summary = tableSummary(facts, table);
      const sumLabel = document.createElement('span');
      sumLabel.className = 'parent-row-summary';
      sumLabel.textContent = summary.seen
        ? `${summary.counts.mastered}/${summary.total} beheerst${summary.averageTime === null ? '' : ` · ${formatTime(summary.averageTime)}`}`
        : 'nog niet geoefend';
      row.appendChild(sumLabel);
      grid.appendChild(row);
    }

    // ---------- Lastigste sommen ----------
    const hard = hardestFacts(facts);
    const hardBox = document.getElementById('parentHard');
    hardBox.innerHTML = '';
    if (hard.length === 0) {
      const p = document.createElement('p');
      p.className = 'parent-empty';
      p.textContent = info.answered
        ? 'Er zijn op dit moment geen sommen die haperen. 🎉'
        : 'Nog geen gegevens: eerst een paar vluchten spelen.';
      hardBox.appendChild(p);
    } else {
      for (const item of hard) {
        const chip = document.createElement('span');
        chip.className = 'parent-chip';
        chip.style.background = LEVELS[item.level].color;
        chip.style.color = LEVELS[item.level].text;
        const time = item.stats.avgTime === null ? '' : `, ${formatTime(item.stats.avgTime)}`;
        chip.textContent = `${item.times} × ${item.table} = ${item.table * item.times} (${item.stats.wrong}× fout${time})`;
        hardBox.appendChild(chip);
      }
    }

    // ---------- Werelden ----------
    const worldBox = document.getElementById('parentWorlds');
    worldBox.innerHTML = '';
    for (const world of d.worlds) {
      const line = document.createElement('div');
      line.className = 'parent-world';
      const best = d.bestResult(world.id);
      let text;
      if (!d.isWorldUnlocked(world.id)) text = 'nog op slot';
      else if (!best) text = 'open, nog niet gespeeld';
      else text = `beste vlucht ${best.correct}/${best.asked} goed · ${'★'.repeat(best.stars)}${'☆'.repeat(3 - best.stars)}`;
      line.textContent = `${world.icon} ${world.name}: ${text}`;
      worldBox.appendChild(line);
    }
    const race = d.getRace();
    if (race) {
      const line = document.createElement('div');
      line.className = 'parent-world';
      line.textContent = `🧢 Tegen Karel: ${race.wins}× gewonnen (waarvan ${race.streetWins}× op een straatlengte)`;
      worldBox.appendChild(line);
    }
  }

  /** Alles als platte tekst (voor mail of een leerlingdossier). */
  summaryText() {
    const d = this.deps;
    const facts = d.getFacts();
    const info = overview(facts);
    const lines = [
      `Rekenvogels — voortgang van ${d.getName()} (${new Date().toLocaleDateString('nl-NL')})`,
      '',
      `Vluchten: ${d.getFlights()} · Sommen beantwoord: ${info.answered} · Goed: ${info.correctPercent}%`,
      `Gemiddelde tijd (goede antwoorden): ${info.averageTime === null ? '–' : formatTime(info.averageTime)}`,
      `Beheerst (goed én snel): ${info.mastered} van de ${info.totalFacts} sommen`,
      '',
      'Per tafel:'
    ];
    for (const table of TABLES) {
      const s = tableSummary(facts, table);
      if (!s.seen) {
        lines.push(`  Tafel van ${table}: nog niet geoefend`);
        continue;
      }
      const c = s.counts;
      lines.push(`  Tafel van ${table}: ${c.mastered} beheerst, ${c.good} goed, ${c.slow} traag, ${c.struggle} hapert, ${c.new} nog niet geoefend${s.averageTime === null ? '' : ` (gem. ${formatTime(s.averageTime)})`}`);
    }
    const hard = hardestFacts(facts);
    lines.push('', 'Sommen die nog haperen:');
    if (hard.length === 0) lines.push('  geen');
    for (const item of hard) {
      lines.push(`  ${item.times} × ${item.table} = ${item.table * item.times} — ${item.stats.wrong}× fout${item.stats.avgTime === null ? '' : `, gem. ${formatTime(item.stats.avgTime)}`}`);
    }
    return lines.join('\n');
  }

  async copy() {
    const text = this.summaryText();
    const button = document.getElementById('parentCopy');
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = '✓ Gekopieerd';
    } catch (error) {
      // Geen klembord (bijv. niet via https): toon de tekst om zelf te kopiëren
      const box = document.getElementById('parentText');
      box.value = text;
      box.classList.remove('hidden');
      box.focus();
      box.select();
      button.textContent = 'Selecteer en kopieer de tekst hieronder';
    }
    setTimeout(() => { button.textContent = '📋 Kopieer overzicht'; }, 3000);
  }
}
