// =====================================================================
// progress.js — Het profiel van de speler
// ---------------------------------------------------------------------
// Stap 4a: gekozen vogel en zelfgekozen naam.
// In Stap 3a komt hier ook de rest van de voortgang bij (open werelden,
// "Nieuw spel"), en later items en badges.
// Alles wordt bewaard in localStorage op het apparaat zelf.
// =====================================================================

import { CONFIG } from './config.js';
import { BIRDS, DEFAULT_BIRD } from './birds.js';

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
