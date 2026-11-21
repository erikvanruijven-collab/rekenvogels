// =====================================================================
// progress.js — Het profiel van de speler
// ---------------------------------------------------------------------
// Stap 4a: gekozen vogel en zelfgekozen naam.
// Stap 3a: open werelden, beste resultaat per wereld, "Nieuw spel".
// Later komen hier items en badges bij.
// (De veren en de statistiek per som beheert math.js.)
// Alles wordt bewaard in localStorage op het apparaat zelf.
// =====================================================================

import { CONFIG } from './config.js';
import { BIRDS, DEFAULT_BIRD } from './birds.js';
import { WORLDS, FIRST_WORLD, nextWorld } from './worlds/index.js';

export const MAX_NAME_LENGTH = 14;

export const NAME_SUGGESTIONS = [
  'Pluim', 'Flits', 'Veertje', 'Wolkje', 'Zoef', 'Pieper',
  'Snavel', 'Donsje', 'Sterretje', 'Bliksem', 'Kuifje', 'Wervel',
  'Tjilp', 'Raket', 'Fladder', 'Storm'
];

/** Maakt een naam netjes: geen spaties aan de randen, niet te lang. */
export function sanitizeName(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/** Verzint een naam die anders is dan de huidige. */
export function randomName(current = '') {
  const options = NAME_SUGGESTIONS.filter((name) => name !== current);
  return options[Math.floor(Math.random() * options.length)];
}

export function loadProfile() {
  const empty = { birdId: DEFAULT_BIRD, name: '', complete: false };
  try {
    const raw = localStorage.getItem(CONFIG.storageKeys.profile);
    if (!raw) return empty;
    const data = JSON.parse(raw);
    const birdId = BIRDS[data.birdId] ? data.birdId : DEFAULT_BIRD;
    const name = sanitizeName(data.name);
    return { birdId, name, complete: Boolean(name) };
  } catch (error) {
    console.warn('Profiel kon niet worden geladen:', error);
    return empty;
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(CONFIG.storageKeys.profile, JSON.stringify({
      birdId: profile.birdId,
      name: sanitizeName(profile.name)
    }));
  } catch (error) {
    console.warn('Profiel kon niet worden opgeslagen:', error);
  }
}

// =====================================================================
// Stap 3a — Voortgang door de werelden
// ---------------------------------------------------------------------
// Welke werelden open zijn en het beste resultaat (sterren) per wereld.
// =====================================================================

function emptyWorldProgress() {
  return { unlocked: [FIRST_WORLD], best: {} };
}

let worldProgress = loadWorldProgress();

function loadWorldProgress() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKeys.worlds);
    if (!raw) return emptyWorldProgress();
    const data = JSON.parse(raw);
    const validIds = WORLDS.map((world) => world.id);
    const unlocked = Array.isArray(data.unlocked)
      ? data.unlocked.filter((id) => validIds.includes(id))
      : [];
    if (!unlocked.includes(FIRST_WORLD)) unlocked.unshift(FIRST_WORLD);
    return { unlocked, best: data.best && typeof data.best === 'object' ? data.best : {} };
  } catch (error) {
    console.warn('Wereld-voortgang kon niet worden geladen:', error);
    return emptyWorldProgress();
  }
}

function saveWorldProgress() {
  try {
    localStorage.setItem(CONFIG.storageKeys.worlds, JSON.stringify(worldProgress));
  } catch (error) {
    console.warn('Wereld-voortgang kon niet worden opgeslagen:', error);
  }
}

export function isWorldUnlocked(worldId) {
  return worldProgress.unlocked.includes(worldId);
}

/** Beste resultaat in een wereld: { correct, asked, turbo, stars } of null. */
export function bestResult(worldId) {
  return worldProgress.best[worldId] || null;
}

/** Aantal sterren voor een score (omgerekend naar een vlucht van 20). */
export function starsFor(correct, asked) {
  if (!asked) return 0;
  const scaled = (correct / asked) * 20;
  return CONFIG.progression.starScores.filter((score) => scaled >= score).length;
}

/**
 * Verwerkt het resultaat van een vlucht.
 * @returns {{stars:number, newBest:boolean, unlockedWorld:object|null}}
 */
export function recordWorldResult(worldId, summary) {
  const stars = starsFor(summary.correct, summary.asked);
  const previous = worldProgress.best[worldId];
  const newBest = !previous || summary.correct > previous.correct
    || (summary.correct === previous.correct && summary.turbo > previous.turbo);
  if (newBest) {
    worldProgress.best[worldId] = {
      correct: summary.correct,
      asked: summary.asked,
      turbo: summary.turbo,
      stars: Math.max(stars, previous ? previous.stars : 0)
    };
  }

  let unlockedWorld = null;
  const scaled = summary.asked ? (summary.correct / summary.asked) * 20 : 0;
  const next = nextWorld(worldId);
  if (next && scaled >= CONFIG.progression.unlockScore && !isWorldUnlocked(next.id)) {
    worldProgress.unlocked.push(next.id);
    unlockedWorld = next;
  }

  saveWorldProgress();
  return { stars, newBest, unlockedWorld };
}

/** Testknop in het tandwiel-paneel: alle werelden open. */
export function unlockAllWorlds() {
  worldProgress.unlocked = WORLDS.map((world) => world.id);
  saveWorldProgress();
}

/**
 * Nieuw spel: werelden weer op slot, veren en sommen-statistiek gewist.
 * De gekozen vogel en naam blijven bewaard.
 */
export function resetGameProgress() {
  worldProgress = emptyWorldProgress();
  try {
    localStorage.removeItem(CONFIG.storageKeys.worlds);
    localStorage.removeItem(CONFIG.storageKeys.progress);
  } catch (error) {
    console.warn('Voortgang kon niet worden gewist:', error);
  }
}
