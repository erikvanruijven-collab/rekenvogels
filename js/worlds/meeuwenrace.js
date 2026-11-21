// =====================================================================
// Wereld 4 — De Meeuwen-race (tafels 11, 12 & mix)
// Stap 3a: speelbaar met de basisregels en eigen kleuren.
// Stap 3d: race tegen Karel de Kapitein-Meeuw, tekstballonnetjes en
//          een mix van alle tafels met nadruk op lastige sommen.
// =====================================================================

import { WORLD_PRESETS } from '../config.js';

export const meeuwenrace = {
  id: 'meeuwenrace',
  number: 4,
  name: 'De Meeuwen-race',
  icon: '🏁',
  tables: [11, 12],
  colors: WORLD_PRESETS.meeuwenrace,
  darkCard: false,
  intro: 'Karel de Kapitein-Meeuw wacht op je...'
};
