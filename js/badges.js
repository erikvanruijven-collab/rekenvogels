// =====================================================================
// badges.js — Prestaties voor rekenen én vliegkunsten
// ---------------------------------------------------------------------
// Uit het plan:
//   Door de Geluidsbarrière — 5 sommen achter elkaar binnen 2 s goed
//   Buikschuiver           — 1,5 s rakelings boven de grond, zonder te raken
//   Tafelridder van de …   — elke som van een tafel goed én op turbo-snelheid
//                            (de laatste keer dat hij langskwam), 12 stuks
//   Verdwaalde Postduif    — 3 keer op rij een foute ring en tóch de finish
//   Karel Verslagen        — Karel op een straatlengte verslaan
// Extra, om te blijven ontdekken:
//   Eerste Vlucht, Foutloos (20/20), Goudvanger (Gouden Duik),
//   Wereldreiziger (alle werelden open), Modeshow (eerste aankoop),
//   Megalancering (Megaturbo-jetpack)
//
// Deze module houdt bij wat er gehaald is (localStorage) en geeft bij
// elke gebeurtenis een lijst met NIEUWE badges terug; main.js laat dan
// een melding met fanfare zien.
// =====================================================================

import { CONFIG } from './config.js';
import { groundY } from './physics.js';

export const BADGES = [
  { id: 'eerste-vlucht',  icon: '🐣', name: 'Eerste Vlucht',            hint: 'Vlieg je eerste vlucht helemaal uit.' },
  { id: 'geluidsbarriere', icon: '💥', name: 'Door de Geluidsbarrière', hint: '5 sommen achter elkaar binnen 2 seconden goed.' },
  { id: 'buikschuiver',   icon: '🛷', name: 'Buikschuiver',             hint: 'Scheer 1,5 seconde rakelings over de grond, zonder hem te raken.' },
  { id: 'postduif',       icon: '🧭', name: 'Verdwaalde Postduif',      hint: '3 keer op rij door een foute ring… en tóch de finish halen.' },
  { id: 'foutloos',       icon: '💯', name: 'Foutloos',                 hint: 'Een hele vlucht van 20 sommen zonder één fout.' },
  { id: 'goudvanger',     icon: '✨', name: 'Goudvanger',               hint: 'Vang 25 veren of meer in één Gouden Duik.' },
  { id: 'wereldreiziger', icon: '🗺️', name: 'Wereldreiziger',           hint: 'Speel alle vier de werelden vrij.' },
  { id: 'karel',          icon: '🧢', name: 'Karel Verslagen',          hint: 'Versla Karel de Kapitein-Meeuw op een straatlengte.' },
  { id: 'modeshow',       icon: '🎩', name: 'Modeshow',                 hint: 'Koop je eerste spullen in het vogel-atelier.' },
  { id: 'megalancering',  icon: '⚡', name: 'Megalancering',            hint: 'Koop de Megaturbo-jetpack.' }
];

export const KNIGHT_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function knightId(table) {
  return `tafelridder-${table}`;
}

/** Naam en uitleg van elke badge, ook de 12 tafelridders. */
export function badgeInfo(id) {
  const found = BADGES.find((badge) => badge.id === id);
  if (found) return found;
  const table = Number(String(id).replace('tafelridder-', ''));
  return {
    id,
    icon: '🛡️',
    name: `Tafelridder van de ${table}`,
    hint: `Elke som van de tafel van ${table} goed én op turbo-snelheid.`
  };
}

export const TOTAL_BADGES = BADGES.length + KNIGHT_TABLES.length;

const BARRIER_TIME = 2.0;      // "binnen 2 seconden"
const BARRIER_STREAK = 5;
const BELLY_HEIGHT = 40;       // rakelings = minder dan 40 px boven de grond
const BELLY_TIME = 1.5;
const LOST_STREAK = 3;
const GOLD_CATCH = 25;

export class BadgeTracker {
  constructor() {
    this.earned = this.load();
    this.startFlight();
  }

  // -------------------------------------------------------------------
  // Opslag
  // -------------------------------------------------------------------
  load() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKeys.badges);
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === 'object' ? data : {};
    } catch (error) {
      console.warn('Badges konden niet worden geladen:', error);
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(CONFIG.storageKeys.badges, JSON.stringify(this.earned));
    } catch (error) {
      console.warn('Badges konden niet worden opgeslagen:', error);
    }
  }

  /** Nieuw spel: alle badges weer weg. */
  reset() {
    this.earned = {};
    try {
      localStorage.removeItem(CONFIG.storageKeys.badges);
    } catch (error) {
      // niets aan de hand
    }
  }

  has(id) {
    return Boolean(this.earned[id]);
  }

  get count() {
    return Object.keys(this.earned).length;
  }

  /** Geeft de badge terug als hij NIEUW is, anders null. */
  award(id) {
    if (this.has(id)) return null;
    this.earned[id] = new Date().toISOString().slice(0, 10);
    this.save();
    return badgeInfo(id);
  }

  // -------------------------------------------------------------------
  // Gebeurtenissen
  // -------------------------------------------------------------------

  /** Begin van een vlucht: tellers op nul. */
  startFlight() {
    this.fastStreak = 0;
    this.wrongStreak = 0;
    this.maxWrongStreak = 0;
    this.bellyTimer = 0;
  }

  /**
   * Na elk antwoord.
   * @param {object} result   uit math.submitAnswer
   * @param {object} question uit math.nextQuestion
   * @param {object} facts    math.progress.facts (statistiek per som)
   */
  onAnswer(result, question, facts) {
    const fresh = [];

    // Door de Geluidsbarrière
    if (result.correct && result.time <= BARRIER_TIME) {
      this.fastStreak += 1;
      if (this.fastStreak >= BARRIER_STREAK) fresh.push(this.award('geluidsbarriere'));
    } else {
      this.fastStreak = 0;
    }

    // Reeks foute ringen (voor de Verdwaalde Postduif)
    if (result.correct) {
      this.wrongStreak = 0;
    } else {
      this.wrongStreak += 1;
      this.maxWrongStreak = Math.max(this.maxWrongStreak, this.wrongStreak);
    }

    // Tafelridder: alle sommen van deze tafel laatst goed op turbo-snelheid
    const table = question.table;
    if (KNIGHT_TABLES.includes(table) && !this.has(knightId(table))) {
      const all = CONFIG.math.multipliers.every((times) => {
        const stats = facts[`${table}x${times}`];
        return stats && stats.lastFast;
      });
      if (all) fresh.push(this.award(knightId(table)));
    }

    return fresh.filter(Boolean);
  }

  /** Elk frame tijdens het vliegen: Buikschuiver. */
  onFlightFrame(physics, dt) {
    const bird = physics.bird;
    const floor = groundY(physics.distance + bird.x, physics.height) - bird.radius * 0.8;
    const clearance = floor - bird.y;
    if (!bird.onGround && clearance > 2 && clearance < BELLY_HEIGHT) {
      this.bellyTimer += dt;
      if (this.bellyTimer >= BELLY_TIME) {
        const badge = this.award('buikschuiver');
        return badge ? [badge] : [];
      }
    } else {
      this.bellyTimer = 0;
    }
    return [];
  }

  /**
   * Na de 20e som.
   * @param {object} summary   uit math.finishRound
   * @param {object|null} race uitslag van de Meeuwen-race
   * @param {boolean} allWorldsOpen
   */
  onFlightEnd(summary, race, allWorldsOpen) {
    const fresh = [this.award('eerste-vlucht')];
    if (summary.asked >= CONFIG.math.roundLength && summary.correct === summary.asked) fresh.push(this.award('foutloos'));
    if (this.maxWrongStreak >= LOST_STREAK) fresh.push(this.award('postduif'));
    if (race && race.street) fresh.push(this.award('karel'));
    if (allWorldsOpen) fresh.push(this.award('wereldreiziger'));
    return fresh.filter(Boolean);
  }

  /** Na de Gouden Duik. */
  onDive(caught) {
    return caught >= GOLD_CATCH ? [this.award('goudvanger')].filter(Boolean) : [];
  }

  /** Na een aankoop in het atelier. */
  onPurchase(itemId) {
    const fresh = [this.award('modeshow')];
    if (itemId === 'megajet') fresh.push(this.award('megalancering'));
    return fresh.filter(Boolean);
  }

  /** Bij het opstarten: bijv. al alle werelden open (testknop). */
  onWorldsChanged(allWorldsOpen) {
    return allWorldsOpen ? [this.award('wereldreiziger')].filter(Boolean) : [];
  }
}
