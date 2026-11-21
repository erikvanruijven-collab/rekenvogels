// =====================================================================
// Wereld 3 — De Nachtvlucht (tafels 7, 8, 9)
// Stap 3a: speelbaar met de basisregels en eigen kleuren.
// Stap 3c: koplampje op de vogel en omgekeerde sommen
//          (bovenin de uitkomst, in de ringen de sommen).
// =====================================================================

import { WORLD_PRESETS } from '../config.js';

export const nachtvlucht = {
  id: 'nachtvlucht',
  number: 3,
  name: 'De Nachtvlucht',
  icon: '🌙',
  tables: [7, 8, 9],
  colors: WORLD_PRESETS.nachtvlucht,
  darkCard: true,
  intro: 'Het is nacht... vlieg voorzichtig!'
};
