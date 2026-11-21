// =====================================================================
// parent.js — Voortgang voor ouders en leerkrachten
// ---------------------------------------------------------------------
// Een scherm voor volwassenen (achter een eenvoudige rekenvraag die een
// kind van 9 nog niet uit het hoofd weet) met:
//  - een overzicht: vluchten, sommen, % goed, gemiddelde tijd, beheerst
//  - "weet het" = goed + net mis (net naast de goede ring gevlogen: het
//    kind wist het antwoord, alleen het mikken ging mis)
//  - per tafel (1 t/m 12) een rij met de 10 sommen in kleur:
//      grijs = nog niet geoefend · rood = hapert (laatste keer fout)
//      oranje = goed maar traag · lichtgroen = goed · donkergroen = beheerst
//    Tik op een som voor de details.
//  - de lastigste sommen op een rij
//  - sterren per wereld en de uitslag tegen Karel
//  - "Kopieer overzicht": alles als tekst, om te mailen of te bewaren
//  - Stap 5: alle spelers op deze tablet (klasoverzicht), en spelers
//    exporteren/importeren als bestand (bijv. naar een andere tablet)
//    of verwijderen
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
  let nearMiss = 0;
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
      nearMiss += stats.nearMiss || 0;
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
    nearMiss,
    knowPercent: percent(correct + nearMiss, seen),
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
    `${stats.correct}× goed`
  ];
  if (stats.nearMiss) parts.push(`${stats.nearMiss}× net mis (wist het wel)`);
  parts.push(`${stats.wrong}× fout`);
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

    // Stap 5: spelers exporteren / importeren
    document.getElementById('exportAllBtn').addEventListener('click', () => {
      const ids = this.deps.listPlayers().map((player) => player.id);
      this.share(this.deps.exportPlayers(ids), 'alle-spelers');
    });
    document.getElementById('importFile').addEventListener('change', (event) => this.importFile(event));
  }

  // -------------------------------------------------------------------
  // Spelers op deze tablet (klasoverzicht)
  // -------------------------------------------------------------------
  renderPlayers() {
    const d = this.deps;
    const box = document.getElementById('parentPlayers');
    box.innerHTML = '';
    const table = document.createElement('table');
    const head = document.createElement('tr');
    for (const title of ['Speler', 'Vluchten', 'Sommen', 'Weet het', 'Net mis', 'Beheerst', 'Badges', 'Hapert vooral', '']) {
      const th = document.createElement('th');
      th.textContent = title;
      head.appendChild(th);
    }
    table.appendChild(head);

    const current = d.currentPlayerId();
    for (const player of d.listPlayers()) {
      const data = d.readPlayerData(player.id);
      const facts = (data.progress && data.progress.facts) || {};
      const info = overview(facts);
      const hard = hardestFacts(facts, 1)[0];
      const row = document.createElement('tr');
      if (player.id === current) row.className = 'current';
      const cells = [
        `${player.name || '(nog geen naam)'}${player.id === current ? ' ← speelt nu' : ''}`,
        String((data.progress && data.progress.flights) || 0),
        String(info.answered),
        info.answered ? `${info.knowPercent}%` : '–',
        String(info.nearMiss),
        `${info.mastered}/${info.totalFacts}`,
        String(data.badges ? Object.keys(data.badges).length : 0),
        hard ? `${hard.times} × ${hard.table}` : '–'
      ];
      for (const text of cells) {
        const td = document.createElement('td');
        td.textContent = text;
        row.appendChild(td);
      }

      const actions = document.createElement('td');
      const exportButton = document.createElement('button');
      exportButton.type = 'button';
      exportButton.className = 'row-btn';
      exportButton.textContent = '⬇️ Exporteer';
      exportButton.addEventListener('click', () => this.share(d.exportPlayers([player.id]), player.name || 'speler'));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'row-btn danger';
      deleteButton.textContent = '🗑 Verwijder';
      let armed = false;
      deleteButton.addEventListener('click', () => {
        // Twee keer tikken: eerst "Zeker weten?"
        if (!armed) {
          armed = true;
          deleteButton.textContent = 'Zeker weten?';
          deleteButton.classList.add('confirm');
          setTimeout(() => {
            armed = false;
            deleteButton.textContent = '🗑 Verwijder';
            deleteButton.classList.remove('confirm');
          }, 4000);
          return;
        }
        d.deletePlayer(player.id);   // de huidige speler verwijderen laadt de game opnieuw
        this.render();
      });
      actions.appendChild(exportButton);
      actions.appendChild(deleteButton);
      row.appendChild(actions);
      table.appendChild(row);
    }
    box.appendChild(table);
  }

  /** Exportbestand delen (iPad/Android: deelmenu) of downloaden. */
  async share(payload, label) {
    const message = document.getElementById('parentPlayersMessage');
    const date = new Date().toISOString().slice(0, 10);
    const safeLabel = String(label).replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    const filename = `rekenvogels-${safeLabel}-${date}.json`;
    const json = JSON.stringify(payload, null, 1);
    const file = new File([json], filename, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Rekenvogels-spelers' });
        message.textContent = `✓ ${filename} gedeeld. Bewaar het bijv. in Bestanden of stuur het door.`;
        return;
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;   // delen geannuleerd
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    message.textContent = `✓ ${filename} gedownload.`;
  }

  /** Spelers uit een bestand toevoegen. */
  importFile(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    const message = document.getElementById('parentPlayersMessage');
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const added = this.deps.importPlayers(JSON.parse(String(reader.result)));
        message.textContent = added === 1
          ? '✓ 1 speler toegevoegd. Kies hem via "👥 Andere speler" op de kaart.'
          : `✓ ${added} spelers toegevoegd. Kies ze via "👥 Andere speler" op de kaart.`;
        this.renderPlayers();
      } catch (error) {
        message.textContent = `Importeren lukte niet: ${error.message || 'onbekend bestand.'}`;
      }
      input.value = '';
    };
    reader.readAsText(file);
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
      [`${info.knowPercent}%`, info.nearMiss ? `weet het (${info.correctPercent}% goed + ${info.nearMiss}× net mis)` : 'weet het (goed)'],
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

    this.renderPlayers();
  }

  /** Alles als platte tekst (voor mail of een leerlingdossier). */
  summaryText() {
    const d = this.deps;
    const facts = d.getFacts();
    const info = overview(facts);
    const lines = [
      `Rekenvogels — voortgang van ${d.getName()} (${new Date().toLocaleDateString('nl-NL')})`,
      '',
      `Vluchten: ${d.getFlights()} · Sommen beantwoord: ${info.answered} · Goed: ${info.correctPercent}% · Weet het (goed + net mis): ${info.knowPercent}%`,
      `Net mis (net naast de goede ring, maar wist het wel): ${info.nearMiss}×`,
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
