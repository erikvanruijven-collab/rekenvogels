// =====================================================================
// Wereld 2 — Stormachtig Schiereiland (tafels 3, 4, 6)
// Stap 3a: speelbaar met de basisregels en eigen kleuren.
// Stap 3b: onweerswolken rond alle ringen, zijwind en een komische
//          schok (roetveeg, hoesten) bij een fout antwoord.
// =====================================================================

import { WORLD_PRESETS } from '../config.js';

export const stormschiereiland = {
  id: 'stormschiereiland',
  number: 2,
  name: 'Stormachtig Schiereiland',
  icon: '⛈️',
  tables: [3, 4, 6],
  colors: WORLD_PRESETS.stormschiereiland,
  darkCard: true,
  intro: 'Het stormt! Kies je ring goed.'
};
