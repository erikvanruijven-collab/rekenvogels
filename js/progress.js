// =====================================================================
// progress.js — Het profiel van de speler
// ---------------------------------------------------------------------
// Stap 4a: gekozen vogel en zelfgekozen naam.
// Stap 3a: open werelden, beste resultaat per wereld, "Nieuw spel".
// Stap 4b: gekochte en aangetrokken spullen uit het vogel-atelier.
// Later komen hier de badges bij.
// (De veren en de statistiek per som beheert math.js.)
// Alles wordt bewaard in localStorage op het apparaat zelf.
// =====================================================================

import { CONFIG } from './config.js';
import { playerKey, updateCurrentPlayer } from './storage.js';
import { BIRDS, DEFAULT_BIRD } from './birds.js';
import { WORLDS, FIRST_WORLD, nextWorld } from './worlds/index.js';
import { ITEMS, SLOTS, getItem } from './items.js';

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
    const raw = localStorage.getItem(playerKey('profile'));
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
  updateCurrentPlayer({ name: sanitizeName(profile.name), birdId: profile.birdId });
  try {
    localStorage.setItem(playerKey('profile'), JSON.stringify({
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
  return { unlocked: [FIRST_WORLD], best: {}, race: null };
}

let worldProgress = loadWorldProgress();

function loadWorldProgress() {
  try {
    const raw = localStorage.getItem(playerKey('worlds'));
    if (!raw) return emptyWorldProgress();
    const data = JSON.parse(raw);
    const validIds = WORLDS.map((world) => world.id);
    const unlocked = Array.isArray(data.unlocked)
      ? data.unlocked.filter((id) => validIds.includes(id))
      : [];
    if (!unlocked.includes(FIRST_WORLD)) unlocked.unshift(FIRST_WORLD);
    return {
      unlocked,
      best: data.best && typeof data.best === 'object' ? data.best : {},
      race: data.race && typeof data.race === 'object' ? data.race : null
    };
  } catch (error) {
    console.warn('Wereld-voortgang kon niet worden geladen:', error);
    return emptyWorldProgress();
  }
}

function saveWorldProgress() {
  try {
    localStorage.setItem(playerKey('worlds'), JSON.stringify(worldProgress));
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

/**
 * Uitslag van de Meeuwen-race bewaren (voor de badge "Karel Verslagen").
 * @returns {{bestLead:number, firstWin:boolean, firstStreet:boolean}}
 */
export function recordRaceResult(race) {
  const previous = worldProgress.race || { bestLead: null, wins: 0, streetWins: 0 };
  const firstWin = race.won && previous.wins === 0;
  const firstStreet = race.street && previous.streetWins === 0;
  worldProgress.race = {
    bestLead: previous.bestLead === null ? race.lead : Math.max(previous.bestLead, race.lead),
    wins: previous.wins + (race.won ? 1 : 0),
    streetWins: previous.streetWins + (race.street ? 1 : 0)
  };
  saveWorldProgress();
  return { bestLead: worldProgress.race.bestLead, firstWin, firstStreet };
}

/** Uitslagen tegen Karel (voor het voortgangsscherm), of null. */
export function getRaceStats() {
  return worldProgress.race || null;
}

/** Testknop in het tandwiel-paneel: alle werelden open. */
export function unlockAllWorlds() {
  worldProgress.unlocked = WORLDS.map((world) => world.id);
  saveWorldProgress();
}

/**
 * Nieuw spel: werelden weer op slot; veren, sommen-statistiek en
 * gekochte spullen gewist. De gekozen vogel en naam blijven bewaard.
 */
export function resetGameProgress() {
  worldProgress = emptyWorldProgress();
  items = emptyItems();
  try {
    localStorage.removeItem(playerKey('worlds'));
    localStorage.removeItem(playerKey('progress'));
    localStorage.removeItem(playerKey('items'));
  } catch (error) {
    console.warn('Voortgang kon niet worden gewist:', error);
  }
}

// =====================================================================
// Stap 4b — Vogel-atelier: gekochte en aangetrokken spullen
// =====================================================================

function emptyItems() {
  return { owned: [], equipped: { hat: null, trail: null, turbo: null, start: null } };
}

let items = loadItems();

function loadItems() {
  try {
    const raw = localStorage.getItem(playerKey('items'));
    if (!raw) return emptyItems();
    const data = JSON.parse(raw);
    const validIds = ITEMS.map((item) => item.id);
    const owned = Array.isArray(data.owned) ? data.owned.filter((id) => validIds.includes(id)) : [];
    const equipped = emptyItems().equipped;
    for (const slot of SLOTS) {
      const id = data.equipped ? data.equipped[slot] : null;
      const item = getItem(id);
      if (item && item.slot === slot && owned.includes(id)) equipped[slot] = id;
    }
    return { owned, equipped };
  } catch (error) {
    console.warn('Spullen konden niet worden geladen:', error);
    return emptyItems();
  }
}

function saveItems() {
  try {
    localStorage.setItem(playerKey('items'), JSON.stringify(items));
  } catch (error) {
    console.warn('Spullen konden niet worden opgeslagen:', error);
  }
}

export function ownsItem(id) {
  return items.owned.includes(id);
}

export function isEquipped(id) {
  const item = getItem(id);
  return Boolean(item) && items.equipped[item.slot] === id;
}

/** Kopie van wat de vogel nu aanheeft: { hat, trail, turbo, start }. */
export function getEquipment() {
  return { ...items.equipped };
}

/** Kan dit gekocht worden (los van het aantal veren)? Jetpacks gaan op volgorde. */
export function itemUnlocked(id) {
  const item = getItem(id);
  return Boolean(item) && (!item.requires || ownsItem(item.requires));
}

/** Na het betalen: in bezit nemen en meteen aantrekken. */
export function addOwnedItem(id) {
  const item = getItem(id);
  if (!item) return;
  if (!items.owned.includes(id)) items.owned.push(id);
  items.equipped[item.slot] = id;
  saveItems();
}

/** Aantrekken (vervangt wat er op die plek zat) of uittrekken. */
export function setEquipped(id, on) {
  const item = getItem(id);
  if (!item || !ownsItem(id)) return;
  items.equipped[item.slot] = on ? id : null;
  saveItems();
}
