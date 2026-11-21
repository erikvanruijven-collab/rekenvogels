// =====================================================================
// worlds/index.js — Overzicht van alle werelden
// ---------------------------------------------------------------------
// Elke wereld heeft een eigen bestand met naam, tafels en kleuren.
// In Stap 3b–3d krijgen de werelden daar ook hun eigen spelregels.
// =====================================================================

import { wolkenvallei } from './wolkenvallei.js';
import { stormschiereiland } from './stormschiereiland.js';
import { nachtvlucht } from './nachtvlucht.js';
import { meeuwenrace } from './meeuwenrace.js';

export const WORLDS = [wolkenvallei, stormschiereiland, nachtvlucht, meeuwenrace];

export const FIRST_WORLD = wolkenvallei.id;

export function getWorld(id) {
  return WORLDS.find((world) => world.id === id) || wolkenvallei;
}

/** De wereld die na deze wereld komt (of null bij de laatste). */
export function nextWorld(id) {
  const index = WORLDS.findIndex((world) => world.id === id);
  return index >= 0 && index < WORLDS.length - 1 ? WORLDS[index + 1] : null;
}

/** Bijv. "1 · 2 · 5 · 10" */
export function tablesLabel(world) {
  return world.tables.join(' · ');
}
