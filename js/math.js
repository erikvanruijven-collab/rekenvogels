// =====================================================================
// math.js — De rekenkern van Rekenvogels
// ---------------------------------------------------------------------
//  - Kiest keersommen uit de tafels van de huidige wereld
//  - Maakt slimme afleiders uit aangrenzende tafels (7×8 -> 56, 48, 63…)
//  - Spaced repetition: foute of trage sommen komen na 3 à 4 andere
//    sommen terug in dezelfde vlucht
//  - Houdt per som bij hoe vaak hij goed/fout/snel ging (localStorage),
//    zodat lastige sommen vaker langskomen. Dit vormt later de basis
//    voor badges zoals "Tafelridder".
//
// Deze module weet niets van tekenen, geluid of vliegen.
// =====================================================================

import { CONFIG } from './config.js';
import { playerKey } from './storage.js';

const MAX_BOX = 5; // Leitner-doosjes: 0 = nieuw/lastig, 5 = geautomatiseerd

function factKey(a, b) {
  return `${a}x${b}`;
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Slimme afleiders: antwoorden uit de buurtafels, zodat gokken op
 * "het getal dat er ongeveer goed uitziet" niet werkt.
 * @param {number} table  de tafel (bijv. 7)
 * @param {number} times  de vermenigvuldiger (bijv. 8)
 * @returns {number[]} twee foute antwoorden
 */
export function makeDistractors(table, times) {
  const answer = table * times;
  const near = [
    (table - 1) * times,       // vorige tafel      (6×8 = 48)
    (table + 1) * times,       // volgende tafel    (8×8 = 64)
    table * (times - 1),       // één keer minder   (7×7 = 49)
    table * (times + 1),       // één keer meer     (7×9 = 63)
    (table - 1) * (times + 1), // schuin ernaast    (6×9 = 54)
    (table + 1) * (times - 1)  // schuin ernaast    (8×7 = 56 -> valt af als gelijk)
  ];

  const unique = [];
  for (const value of shuffle(near)) {
    if (value > 0 && value !== answer && !unique.includes(value)) {
      unique.push(value);
    }
  }

  // Bij kleine sommen (1×1, 1×2…) zijn er soms te weinig buren
  let step = 1;
  while (unique.length < 2) {
    for (const value of [answer + step, answer - step]) {
      if (value > 0 && value !== answer && !unique.includes(value) && unique.length < 2) {
        unique.push(value);
      }
    }
    step += 1;
  }

  // Voorkeur voor afleiders die dicht bij het antwoord liggen
  unique.sort((x, y) => Math.abs(x - answer) - Math.abs(y - answer));
  const closest = unique.slice(0, Math.min(4, unique.length));
  return shuffle(closest).slice(0, 2);
}

/** Bijv. "7 × 8" (vermenigvuldiger × tafel, zoals in de rest van de game). */
export function sumLabel(times, table) {
  return `${times} × ${table}`;
}

/**
 * Afleiders voor OMGEKEERDE sommen (De Nachtvlucht): bovenin staat de
 * uitkomst, in de ringen staan sommen. De foute sommen liggen dicht bij
 * het goede antwoord (7×8=56 -> 6×9=54, 7×7=49...), maar hebben NOOIT
 * dezelfde uitkomst: 3×8 en 4×6 zijn allebei 24, dus die komen nooit
 * samen in één kolom. Ook de omgedraaide som (8×7) valt daardoor af.
 * @returns {Array<[number, number]>} twee paren [vermenigvuldiger, tafel]
 */
export function makeReverseDistractors(table, times) {
  const answer = table * times;
  const candidates = [
    [times, table - 1], [times, table + 1],
    [times - 1, table], [times + 1, table],
    [times - 1, table + 1], [times + 1, table - 1],
    [times - 1, table - 1], [times + 1, table + 1],
    [times + 2, table - 1], [times - 2, table + 1]
  ];

  const seenProducts = new Set([answer]);
  const valid = [];
  for (const [a, b] of shuffle(candidates)) {
    if (a < 1 || b < 1 || a > 12 || b > 12) continue;
    const product = a * b;
    if (seenProducts.has(product)) continue;   // nooit dezelfde uitkomst als het antwoord of als elkaar
    seenProducts.add(product);
    valid.push([a, b]);
  }

  valid.sort((x, y) => Math.abs(x[0] * x[1] - answer) - Math.abs(y[0] * y[1] - answer));
  const closest = valid.slice(0, Math.min(4, valid.length));

  // Vangnet voor de kleinste sommen (1×1, 1×2...)
  let extra = 2;
  while (closest.length < 2) {
    const candidate = [times + extra, table];
    if (!seenProducts.has(candidate[0] * candidate[1])) {
      seenProducts.add(candidate[0] * candidate[1]);
      closest.push(candidate);
    }
    extra += 1;
  }
  return shuffle(closest).slice(0, 2);
}

export class MathEngine {
  constructor() {
    this.progress = this.loadProgress();
    this.tables = [1];
    this.round = null;
    this.repeatQueue = [];
    this.recentKeys = [];
  }

  // -------------------------------------------------------------------
  // Opslag
  // -------------------------------------------------------------------
  loadProgress() {
    const empty = { feathers: 0, flights: 0, facts: {} };
    try {
      const raw = localStorage.getItem(playerKey('progress'));
      if (!raw) return empty;
      const data = JSON.parse(raw);
      return {
        feathers: Number(data.feathers) || 0,
        flights: Number(data.flights) || 0,
        facts: data.facts && typeof data.facts === 'object' ? data.facts : {}
      };
    } catch (error) {
      console.warn('Voortgang kon niet worden geladen:', error);
      return empty;
    }
  }

  saveProgress() {
    try {
      localStorage.setItem(playerKey('progress'), JSON.stringify(this.progress));
    } catch (error) {
      console.warn('Voortgang kon niet worden opgeslagen:', error);
    }
  }

  getFactStats(a, b) {
    const key = factKey(a, b);
    if (!this.progress.facts[key]) {
      this.progress.facts[key] = { seen: 0, correct: 0, wrong: 0, fast: 0, avgTime: null, box: 0 };
    }
    return this.progress.facts[key];
  }

  get totalFeathers() {
    return this.progress.feathers;
  }

  /** Veren uitgeven in het atelier. Geeft false als er te weinig zijn. */
  spendFeathers(amount) {
    if (this.progress.feathers < amount) return false;
    this.progress.feathers -= amount;
    this.saveProgress();
    return true;
  }

  /** Extra veren, bijv. uit de Gouden Duik. */
  addFeathers(amount) {
    this.progress.feathers += amount;
    this.saveProgress();
  }

  /** Na "Nieuw spel": alles opnieuw inlezen (is dan leeg). */
  reloadProgress() {
    this.progress = this.loadProgress();
    this.round = null;
    this.repeatQueue = [];
    this.recentKeys = [];
  }

  // -------------------------------------------------------------------
  // Vlucht (ronde)
  // -------------------------------------------------------------------
  /**
   * @param {number[]} tables  tafels van deze wereld
   * @param {string} mode      'normal' (som -> uitkomst) of 'reverse' (uitkomst -> som)
   */
  startRound(tables, mode = 'normal', mix = null) {
    this.tables = tables.slice();
    this.mode = mode;
    this.mix = mix;          // { share, tables } voor De Meeuwen-race, anders null
    this.repeatQueue = [];
    this.recentKeys = [];
    this.round = {
      asked: 0,
      correct: 0,
      wrong: 0,
      turbo: 0,
      nearMiss: 0,
      feathers: 0,
      times: [],
      bestStreak: 0,
      streak: 0,
      practiceKeys: []
    };
  }

  get roundFinished() {
    return this.round !== null && this.round.asked >= CONFIG.math.roundLength;
  }

  /** Gewicht van een som: lastige en nieuwe sommen komen vaker. */
  factWeight(table, times) {
    const stats = this.progress.facts[factKey(table, times)];
    if (!stats) return 2.2;                       // nog nooit gezien
    let weight = 1 + (MAX_BOX - stats.box) * 0.5;  // lager doosje = vaker
    if (stats.wrong > stats.correct) weight += 1.5;
    if (stats.avgTime !== null && stats.avgTime > CONFIG.math.masteredTime) weight += 1;
    return Math.max(0.3, weight);
  }

  /**
   * Gewicht in de mix (De Meeuwen-race): sommen die al eens haperden
   * komen veel vaker langs; nog nooit geziene sommen tellen gewoon mee.
   */
  mixWeight(table, times) {
    const stats = this.progress.facts[factKey(table, times)];
    if (!stats) return 1;
    const struggling = stats.wrong > 0
      || (stats.avgTime !== null && stats.avgTime > CONFIG.math.masteredTime);
    const weight = this.factWeight(table, times);
    return struggling ? weight * weight : weight * 0.5;
  }

  pickNewFact() {
    const candidates = [];
    const useMix = this.mix && Math.random() < this.mix.share;
    const tables = useMix ? this.mix.tables : this.tables;
    for (const table of tables) {
      for (const times of CONFIG.math.multipliers) {
        const key = factKey(table, times);
        if (this.recentKeys.includes(key)) continue;
        const weight = useMix ? this.mixWeight(table, times) : this.factWeight(table, times);
        candidates.push({ table, times, weight });
      }
    }
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    let roll = Math.random() * total;
    for (const candidate of candidates) {
      roll -= candidate.weight;
      if (roll <= 0) return candidate;
    }
    return candidates[candidates.length - 1];
  }

  /**
   * Volgende som.
   * @param {number} currentLane  op welke hoogte (0 boven, 1 midden, 2 onder) de vogel nu vliegt
   */
  nextQuestion(currentLane) {
    // 1. Staat er een herhaling klaar?
    let fact = null;
    let isRepeat = false;
    const dueIndex = this.repeatQueue.findIndex((entry) => entry.remaining <= 0);
    if (dueIndex >= 0) {
      fact = this.repeatQueue[dueIndex];
      this.repeatQueue.splice(dueIndex, 1);
      isRepeat = true;
    }
    for (const entry of this.repeatQueue) entry.remaining -= 1;

    // 2. Anders een nieuwe som kiezen
    if (!fact) fact = this.pickNewFact();

    const table = fact.table;
    const times = fact.times;
    const answer = table * times;
    const key = factKey(table, times);

    this.recentKeys.push(key);
    if (this.recentKeys.length > 3) this.recentKeys.shift();

    // 3. Antwoorden over de drie ringen verdelen. Het goede antwoord
    //    komt liever niet op de hoogte waar de vogel al vliegt.
    const text = sumLabel(times, table);
    const reverse = this.mode === 'reverse';
    const correctLabel = reverse ? text : String(answer);
    const labels = reverse
      ? [correctLabel, ...makeReverseDistractors(table, times).map(([a, b]) => sumLabel(a, b))]
      : [correctLabel, ...makeDistractors(table, times).map(String)];

    let options = shuffle(labels);
    let correctSlot = options.indexOf(correctLabel);
    if (correctSlot === currentLane) {
      options = shuffle(options);
      correctSlot = options.indexOf(correctLabel);
    }

    this.round.asked += 1;

    return {
      table,
      times,
      answer,
      key,
      text,
      prompt: reverse ? `? × ? = ${answer}` : `${text} = ?`,   // in de banner tijdens het vragen
      solution: `${text} = ${answer}`,                         // in de banner na het antwoord
      reverse,
      options,
      correctSlot,
      isRepeat,
      number: this.round.asked
    };
  }

  /**
   * Verwerkt een antwoord.
   * @param {object} question   resultaat van nextQuestion()
   * @param {number} chosenSlot 0/1/2, of -1 als de vogel geen ring raakte
   * @param {number} time       reactietijd in seconden
   */
  submitAnswer(question, chosenSlot, time, nearMiss = false) {
    const m = CONFIG.math;
    const correct = chosenSlot === question.correctSlot;
    // Net mis: geen ring geraakt, maar wel op weg naar de goede (zie physics.js).
    // Telt in de statistiek als "weet het"; in het spel blijft het een misser.
    const knew = correct || nearMiss;
    const answered = chosenSlot >= 0;
    const fast = correct && time <= m.fastThreshold;
    const slow = time > m.slowThreshold;

    // Statistiek per som
    const stats = this.getFactStats(question.table, question.times);
    stats.seen += 1;
    stats.lastFast = correct && fast;   // voor de badge "Tafelridder"
    stats.lastCorrect = knew;           // voor het voortgangsscherm (hapert de som nog?)
    if (nearMiss) {
      stats.nearMiss = (stats.nearMiss || 0) + 1;
      stats.avgTime = stats.avgTime === null ? time : stats.avgTime * 0.7 + time * 0.3;
    } else if (correct) {
      stats.correct += 1;
      if (fast) stats.fast += 1;
      // Binnen 2 seconden goed = beheerst: hoger doosje, komt minder vaak langs
      if (time <= m.masteredTime) {
        stats.box = Math.min(MAX_BOX, stats.box + 1);
      }
      stats.avgTime = stats.avgTime === null ? time : stats.avgTime * 0.7 + time * 0.3;
    } else {
      stats.wrong += 1;
      stats.box = 0;
    }

    // Ronde-statistiek
    const r = this.round;
    let feathers = 0;
    if (correct) {
      r.correct += 1;
      r.times.push(time);
      r.streak += 1;
      r.bestStreak = Math.max(r.bestStreak, r.streak);
      feathers = fast ? m.feathersTurbo : m.feathersCorrect;
      if (fast) r.turbo += 1;
    } else if (nearMiss) {
      r.nearMiss += 1;
      r.streak = 0;
    } else {
      r.wrong += 1;
      r.streak = 0;
    }
    r.feathers += feathers;
    this.progress.feathers += feathers;

    // Spaced repetition: fout of traag -> komt terug na 3 à 4 sommen
    const needsRepeat = !knew || time > m.repeatSlowerThan;
    let repeatScheduled = false;
    const alreadyQueued = this.repeatQueue.some((entry) => entry.key === question.key);
    if (needsRepeat && !alreadyQueued) {
      this.repeatQueue.push({
        table: question.table,
        times: question.times,
        key: question.key,
        remaining: randomInt(m.repeatGapMin, m.repeatGapMax)
      });
      repeatScheduled = true;
    }
    if (needsRepeat && !r.practiceKeys.includes(question.text)) {
      r.practiceKeys.push(question.text);
    }

    this.saveProgress();

    return { correct, answered, fast, slow, feathers, repeatScheduled, time, nearMiss: !correct && nearMiss };
  }

  /** Samenvatting voor het eindscherm. */
  finishRound() {
    const r = this.round;
    this.progress.flights += 1;
    this.saveProgress();
    const average = r.times.length
      ? r.times.reduce((sum, t) => sum + t, 0) / r.times.length
      : null;
    return {
      asked: r.asked,
      correct: r.correct,
      wrong: r.wrong,
      nearMiss: r.nearMiss,
      turbo: r.turbo,
      feathers: r.feathers,
      totalFeathers: this.progress.feathers,
      bestStreak: r.bestStreak,
      averageTime: average,
      practice: r.practiceKeys.slice()
    };
  }
}
