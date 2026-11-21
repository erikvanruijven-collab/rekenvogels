// =====================================================================
// storage.js — Meerdere spelers op één tablet
// ---------------------------------------------------------------------
// Elke speler heeft zijn eigen opslag in localStorage:
//   rekenvogels.p.<speler-id>.<soort>.v1
// met als soorten: profile (vogel + naam), progress (veren + sommen),
// worlds (werelden, sterren, race), items (atelier), badges.
//
// De lijst met spelers en wie er nu speelt staat in
//   rekenvogels.players.v1
//
// Wisselen van speler = opslaan wie er speelt en de pagina herladen.
// Zo begint elke module schoon met de gegevens van de nieuwe speler.
//
// Bestaande voortgang van vóór de spelersprofielen (één speler) wordt
// bij de eerste start automatisch speler 1. Er gaat niets verloren.
//
// Tuning en geluid-aan/uit blijven voor de hele tablet hetzelfde.
// =====================================================================

const PLAYERS_KEY = 'rekenvogels.players.v1';
const SKIP_CHOOSER_KEY = 'rekenvogels.skipChooser';
export const PLAYER_KINDS = ['profile', 'progress', 'worlds', 'items', 'badges'];
export const MAX_PLAYERS = 40;

// Oude sleutels (één speler) -> worden bij de eerste start overgezet
const LEGACY_KEYS = {
  profile: 'rekenvogels.profile.v1',
  progress: 'rekenvogels.progress.v1',
  worlds: 'rekenvogels.worlds.v1',
  items: 'rekenvogels.items.v1',
  badges: 'rekenvogels.badges.v1'
};

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Opslaan mislukt:', error);
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // niets aan de hand
  }
}

function newId() {
  return `s${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function keyFor(playerId, kind) {
  return `rekenvogels.p.${playerId}.${kind}.v1`;
}

function readJson(key) {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

// ---------------------------------------------------------------------
// Opstarten (gebeurt één keer, vóór alle andere modules hun gegevens laden)
// ---------------------------------------------------------------------
let state = readJson(PLAYERS_KEY);

if (!state || !Array.isArray(state.players)) {
  state = { players: [], current: null };

  // Oude, losse opslag gevonden? Dan wordt dat speler 1.
  const hasLegacy = Object.values(LEGACY_KEYS).some((key) => safeGet(key) !== null);
  const id = newId();
  if (hasLegacy) {
    for (const [kind, legacyKey] of Object.entries(LEGACY_KEYS)) {
      const value = safeGet(legacyKey);
      if (value !== null) safeSet(keyFor(id, kind), value);
    }
    for (const legacyKey of Object.values(LEGACY_KEYS)) safeRemove(legacyKey);
  }
  const profile = readJson(keyFor(id, 'profile')) || {};
  state.players.push({ id, name: profile.name || '', birdId: profile.birdId || 'valk', created: Date.now() });
  state.current = id;
  safeSet(PLAYERS_KEY, JSON.stringify(state));
}

if (state.players.length === 0) {
  const id = newId();
  state.players.push({ id, name: '', birdId: 'valk', created: Date.now() });
  state.current = id;
}
if (!state.players.some((player) => player.id === state.current)) {
  state.current = state.players[0].id;
}
safeSet(PLAYERS_KEY, JSON.stringify(state));

function save() {
  safeSet(PLAYERS_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------
// Voor de andere modules
// ---------------------------------------------------------------------

/** Opslagsleutel voor de speler die nu speelt, bijv. playerKey('progress'). */
export function playerKey(kind) {
  return keyFor(state.current, kind);
}

export function currentPlayerId() {
  return state.current;
}

/** Kopie van de spelerslijst (id, name, birdId). */
export function listPlayers() {
  return state.players.map((player) => ({ ...player }));
}

/** Naam of vogel van de huidige speler veranderd (vanuit het keuzescherm). */
export function updateCurrentPlayer({ name, birdId }) {
  const player = state.players.find((p) => p.id === state.current);
  if (!player) return;
  if (name !== undefined) player.name = name;
  if (birdId !== undefined) player.birdId = birdId;
  save();
}

/** Herladen, en daarbij het spelerskeuzescherm overslaan. */
function reloadSkippingChooser() {
  try {
    sessionStorage.setItem(SKIP_CHOOSER_KEY, '1');
  } catch (error) {
    // niets aan de hand
  }
  window.location.reload();
}

/** Moet het keuzescherm deze keer worden overgeslagen? (eenmalig) */
export function consumeSkipChooser() {
  try {
    const skip = sessionStorage.getItem(SKIP_CHOOSER_KEY) === '1';
    sessionStorage.removeItem(SKIP_CHOOSER_KEY);
    return skip;
  } catch (error) {
    return false;
  }
}

/** Wissel naar een andere speler (laadt de pagina opnieuw). */
export function switchPlayer(id) {
  if (!state.players.some((p) => p.id === id)) return;
  state.current = id;
  save();
  reloadSkippingChooser();
}

/** Nieuwe speler maken en meteen kiezen (laadt de pagina opnieuw). */
export function createPlayer() {
  if (state.players.length >= MAX_PLAYERS) return false;
  const id = newId();
  state.players.push({ id, name: '', birdId: 'valk', created: Date.now() });
  state.previous = state.current;   // om terug te kunnen als het per ongeluk was
  state.current = id;
  save();
  reloadSkippingChooser();
  return true;
}

/** Speler verwijderen, met al zijn gegevens. */
export function deletePlayer(id) {
  const index = state.players.findIndex((p) => p.id === id);
  if (index < 0) return;
  for (const kind of PLAYER_KINDS) safeRemove(keyFor(id, kind));
  state.players.splice(index, 1);
  const wasCurrent = state.current === id;
  if (state.players.length === 0) {
    const fresh = newId();
    state.players.push({ id: fresh, name: '', birdId: 'valk', created: Date.now() });
    state.current = fresh;
  } else if (wasCurrent) {
    const previous = state.players.find((p) => p.id === state.previous);
    state.current = previous ? previous.id : state.players[Math.max(0, index - 1)].id;
  }
  state.previous = null;
  save();
  if (wasCurrent) reloadSkippingChooser();
}

/** Alle gegevens van één speler (voor het klasoverzicht en export). */
export function readPlayerData(id) {
  const data = {};
  for (const kind of PLAYER_KINDS) data[kind] = readJson(keyFor(id, kind));
  return data;
}

// ---------------------------------------------------------------------
// Exporteren en importeren (bestand), bijv. naar een andere tablet
// ---------------------------------------------------------------------

export function exportPlayers(ids) {
  return {
    format: 'rekenvogels-export',
    version: 1,
    exported: new Date().toISOString(),
    players: ids
      .map((id) => state.players.find((p) => p.id === id))
      .filter(Boolean)
      .map((player) => ({ name: player.name, birdId: player.birdId, data: readPlayerData(player.id) }))
  };
}

/**
 * Spelers uit een exportbestand toevoegen (altijd als nieuwe spelers;
 * bestaat de naam al, dan komt er "(2)" achter).
 * @returns {number} aantal toegevoegde spelers
 */
export function importPlayers(payload) {
  if (!payload || payload.format !== 'rekenvogels-export' || !Array.isArray(payload.players)) {
    throw new Error('Dit is geen Rekenvogels-bestand.');
  }
  let added = 0;
  for (const incoming of payload.players) {
    if (state.players.length >= MAX_PLAYERS) break;
    const id = newId();
    let name = String(incoming.name || 'Speler').slice(0, 14);
    const taken = (candidate) => state.players.some((p) => p.name === candidate);
    if (taken(name)) {
      let n = 2;
      while (taken(`${name.slice(0, 10)} (${n})`)) n += 1;
      name = `${name.slice(0, 10)} (${n})`;
    }
    const data = incoming.data || {};
    for (const kind of PLAYER_KINDS) {
      if (data[kind] !== null && data[kind] !== undefined) {
        const value = kind === 'profile' ? { ...data[kind], name } : data[kind];
        safeSet(keyFor(id, kind), JSON.stringify(value));
      }
    }
    state.players.push({ id, name, birdId: incoming.birdId || 'valk', created: Date.now() });
    added += 1;
  }
  save();
  return added;
}
