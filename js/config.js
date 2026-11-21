// =====================================================================
// config.js — Centrale parameters voor Rekenvogels
// ---------------------------------------------------------------------
// Alle "knoppen" van de game staan hier op één plek. Andere modules
// lezen deze waarden elk frame, zodat het Tuning-paneel ze live kan
// aanpassen.
// Stap 1: vliegfysica   ·   Stap 2: rekenkern (sectie "math")
// =====================================================================

export const CONFIG = {
  version: '0.10.0 · stap 4c',  // staat op het startscherm: zo zie je of een update is aangekomen

  world: {
    logicalHeight: 720,      // alle tekenwerk rekent in een virtuele hoogte van 720 px
    birdScreenX: 0.24        // vogel staat op 24% van de schermbreedte
  },

  physics: {
    // --- Live te tunen (zie TUNING_PARAMS hieronder) ---
    gravity: 700,            // Zwaartekracht (px/s²)
    diveForce: 1100,         // Duikkracht: extra neerwaartse kracht bij ingedrukt houden
    glideLift: 640,          // Zweeflift bij basissnelheid (stijgt mee met snelheid²)
    baseSpeed: 380,          // Basissnelheid vooruit (px/s)

    // --- Energie-overdracht (Tiny Wings-gevoel) ---
    diveGain: 0.55,          // deel van de valsnelheid dat wordt omgezet in voorwaartse snelheid
    glideFallGain: 0.2,      // tijdens zweven-en-dalen wordt ook een beetje snelheid opgebouwd
    diveAccel: 60,           // extra voorwaartse versnelling tijdens duiken (px/s²)
    climbCost: 0.32,         // stijgen kost voorwaartse snelheid (energie -> hoogte)
    speedDrag: 0.22,         // hoe snel de snelheid terugzakt naar basissnelheid (per seconde)
    liftMaxFactor: 3.2,      // maximale lift als veelvoud van glideLift
    glideDamping: 1.6,       // luchtweerstand verticaal tijdens zweven
    diveDamping: 0.25,       // luchtweerstand verticaal tijdens duiken
    flapImpulse: 140,        // kleine opwaartse tik bij het loslaten (vleugelslag)
    tapMaxDuration: 0.22,    // korter ingedrukt dan dit = een "tik" -> fladderen
    tapFlapImpulse: 330,     // extra opwaartse kracht van een tik (zo kom je zonder trucjes bij de bovenste ring)
    minSpeedFactor: 0.65,    // ondergrens snelheid (x basissnelheid)
    maxSpeedFactor: 3.0,     // bovengrens snelheid (x basissnelheid)
    maxFallSpeed: 1100,      // maximale valsnelheid (px/s)
    maxRiseSpeed: 900,       // maximale stijgsnelheid (px/s)

    // --- Grenzen van de wereld ---
    ceilingY: 70,            // vanaf hier wordt de lucht "dun" en verdwijnt de lift
    thinAirBand: 110,        // overgangszone van de dunne lucht (px)
    hardCeilingY: 24,        // de vogel kan nooit hoger dan dit
    groundBounce: 0.35,      // stuitering bij een harde landing
    groundDrag: 140,         // snelheidsverlies per seconde bij over de grond schuiven
    birdRadius: 22           // botsingsstraal van de vogel
  },

  rings: {
    radius: 60,              // straal van een ring (px)
    rows: [0.255, 0.485, 0.715],// verticale posities (deel van de schermhoogte): boven, midden, onder
    hitTolerance: 0.9,       // hoe ruim de ring is (1 = precies de straal)
    finalApproach: 200,      // laatste stuk (px) waarin de ringen op volle snelheid aankomen
    blendZone: 120           // overgangszone tussen "aandrijven" en "volle snelheid"
  },

  // ---------------------------------------------------------------
  // Stap 2 — Rekenkern
  // ---------------------------------------------------------------
  math: {
    roundLength: 20,         // aantal sommen per vlucht
    multipliers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // 1×7 t/m 10×7
    questionWindow: 6,       // seconden tot de ringen bij de vogel zijn (bij basissnelheid, zonder duiken)
    fastThreshold: 2.5,      // sneller dan dit = Turbo-thermiek
    slowThreshold: 5,        // trager dan dit = de wind zakt weg
    repeatSlowerThan: 2.5,   // goed, maar trager dan dit -> som komt terug
    masteredTime: 2.0,       // goed binnen deze tijd = "beheerst": de som verdwijnt naar de achtergrond
    repeatGapMin: 3,         // som komt terug na minimaal ... andere sommen
    repeatGapMax: 4,         // ... en maximaal zoveel andere sommen
    laneDwell: 0.4,          // zo lang (s) moet de vogel op één hoogte blijven voordat dat als "keuze" telt
    firstQuestionDelay: 1.2, // eerste som na het starten
    gapAfterAnswer: 1.0,     // pauze tussen twee sommen
    feedbackDuration: 1.6,   // zo lang blijft "goed/fout" in beeld
    feathersCorrect: 1,      // veren voor een goed antwoord
    feathersTurbo: 3,        // veren voor een goed én snel antwoord
    turboBoost: 300,         // extra snelheid bij Turbo-thermiek (px/s)
    turboDuration: 1.6,      // duur van de Turbo-thermiek (s)
    windDropFactor: 0.7,     // snelheid x deze factor als de wind wegzakt
    windDropSink: 180        // extra daalsnelheid als de wind wegzakt (px/s)
  },

  // ---------------------------------------------------------------
  // Stap 3a — Werelden, sterren en het Gouden Duik-tussenspel
  // ---------------------------------------------------------------
  progression: {
    unlockScore: 15,         // zoveel goed (van de 20) opent de volgende wereld
    starScores: [10, 15, 18] // 1, 2 en 3 sterren (15 = 2 sterren = volgende wereld open)
  },

  goldenDive: {
    duration: 15,            // seconden
    introTime: 1.6,          // "Gouden Duik!" in beeld voor het begint
    startFallSpeed: 480,     // hoe snel de veren omhoog komen aan het begin (px/s)
    endFallSpeed: 900,       // ... en aan het eind
    spawnInterval: 0.45,     // tijd tussen twee veren (s) — bewust minder veren dan een vlucht met sommen oplevert
    goldChance: 0.1,         // kans op een gouden veer
    featherValue: 1,
    goldValue: 3,
    catchRadius: 52,         // hoe ruim je een veer vangt (px)
    birdFollow: 9,           // hoe snel de vogel je vinger volgt
    shaftWidth: 0.72         // breedte van de koker (deel van het scherm)
  },

  // ---------------------------------------------------------------
  // Stap 3b — Stormachtig Schiereiland
  // ---------------------------------------------------------------
  storm: {
    gustForce: 320,          // kracht van een windvlaag (px/s², omhoog of omlaag)
    gustDuration: 1.1,       // hoe lang een windvlaag duurt (s)
    gustWarning: 0.8,        // zo lang van tevoren zie je de windvlaag aankomen (s)
    gustIntervalMin: 4,      // tijd tussen windvlagen (s) ...
    gustIntervalMax: 7,      // ... willekeurig tussen min en max
    lightningMin: 6,         // onweer op de achtergrond, elke 6 tot 11 seconden
    lightningMax: 11,
    rainDrops: 140,          // aantal regendruppels in beeld
    shockSink: 380,          // hoogteverlies bij een schok (px/s naar beneden)
    shockSpeedFactor: 0.8,   // snelheid x deze factor bij een schok
    sootTime: 4              // zo lang (s) zit er roet op de vogel
  },

  // ---------------------------------------------------------------
  // Stap 3c — De Nachtvlucht
  // ---------------------------------------------------------------
  night: {
    darkness: 0.62,          // hoe donker het is (0 = niet, 1 = pikdonker)
    beamLength: 560,         // lengte van de lichtbundel van het koplampje (px)
    beamSpread: 0.33,        // halve breedte van de bundel (radialen)
    haloRadius: 120,         // zachte gloed rond de vogel (px)
    stars: 110,
    fireflies: 14
  },

  // ---------------------------------------------------------------
  // Stap 3d — De Meeuwen-race
  // ---------------------------------------------------------------
  race: {
    fastGain: 1.5,           // snel goed (Turbo) = windstoot: zoveel vleugellengtes vooruit
    correctGain: 0.25,       // goed (niet snel)
    slowLoss: -0.5,          // goed maar heel traag (> 5 s): Karel loopt in
    wrongLoss: -1,           // fout of geen ring
    streetLength: 8,         // zoveel voorsprong = gewonnen op een straatlengte
    pxPerLength: 26,         // afstand op het scherm per vleugellengte
    karelStartOffset: 45,    // Karel begint net vóór de vogel (hij is eigenwijs); met een jetpack-voorsprong zit hij er meteen achter
    bubbleTime: 2.8,         // hoe lang een tekstballon blijft staan (s)
    idleMin: 7,              // tussendoor-praatjes elke 7 tot 12 seconden
    idleMax: 12
  },

  // ---------------------------------------------------------------
  // Stap 4b — Vogel-atelier: de vliegende start per jetpack
  // (de eerste som komt pas na de lancering + een korte pauze)
  // ---------------------------------------------------------------
  launch: {
    1: { boost: 250, duration: 2.0, rise: 380, headStart: 1 },   // Jetpack
    2: { boost: 420, duration: 3.0, rise: 440, headStart: 2 },   // Turbo-jetpack
    3: { boost: 650, duration: 4.0, rise: 500, headStart: 3 }    // Megaturbo-jetpack
  },
  launchQuestionPause: 1.5,  // extra wachttijd na de lancering voor de eerste som

  render: {
    maxDpr: 2,               // maximale pixeldichtheid (sneller op oudere tablets)
    speedLineThreshold: 1.35,// vanaf deze snelheidsfactor verschijnen snelheidsstrepen
    trailThreshold: 1.25     // vanaf deze snelheidsfactor verschijnt een spoor achter de vogel
  },

  audio: {
    masterVolume: 0.8
  },

  storageKeys: {
    tuning: 'rekenvogels.tuning.v1',
    muted: 'rekenvogels.muted.v1',
    progress: 'rekenvogels.progress.v1',
    profile: 'rekenvogels.profile.v1',
    worlds: 'rekenvogels.worlds.v1',
    items: 'rekenvogels.items.v1',
    badges: 'rekenvogels.badges.v1'
  }
};

// ---------------------------------------------------------------------
// Waarden die in het Tuning-paneel (tandwiel) verschijnen.
// "section" zegt in welk deel van CONFIG de waarde staat.
// ---------------------------------------------------------------------
export const TUNING_PARAMS = [
  { section: 'physics', key: 'gravity',        label: 'Zwaartekracht',       min: 300, max: 1500, step: 10 },
  { section: 'physics', key: 'diveForce',      label: 'Duikkracht',          min: 300, max: 2500, step: 10 },
  { section: 'physics', key: 'glideLift',      label: 'Zweeflift',           min: 200, max: 1400, step: 10 },
  { section: 'physics', key: 'baseSpeed',      label: 'Basissnelheid',       min: 150, max: 700,  step: 5 },
  { section: 'math',    key: 'questionWindow', label: 'Aanvliegtijd ringen (s)', min: 3, max: 10, step: 0.5 },
  { section: 'math',    key: 'fastThreshold',  label: 'Turbo-grens (s)',     min: 1.5, max: 5, step: 0.1 }
];

// Kopie van de fabriekswaarden, zodat "Herstel" altijd terug kan
const DEFAULT_TUNING = {};
for (const param of TUNING_PARAMS) {
  DEFAULT_TUNING[param.key] = CONFIG[param.section][param.key];
}

function clampToParam(param, value) {
  return Math.min(param.max, Math.max(param.min, value));
}

export function getTuningValue(param) {
  return CONFIG[param.section][param.key];
}

export function setTuningValue(param, value) {
  CONFIG[param.section][param.key] = clampToParam(param, value);
}

/** Laadt eerder opgeslagen tuning-waarden uit localStorage. */
export function loadTuning() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKeys.tuning);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const param of TUNING_PARAMS) {
      const value = Number(saved[param.key]);
      if (saved[param.key] !== undefined && Number.isFinite(value)) {
        setTuningValue(param, value);
      }
    }
  } catch (error) {
    console.warn('Tuning kon niet worden geladen:', error);
  }
}

/** Slaat de huidige tuning-waarden op in localStorage. */
export function saveTuning() {
  try {
    const data = {};
    for (const param of TUNING_PARAMS) {
      data[param.key] = getTuningValue(param);
    }
    localStorage.setItem(CONFIG.storageKeys.tuning, JSON.stringify(data));
  } catch (error) {
    console.warn('Tuning kon niet worden opgeslagen:', error);
  }
}

/** Zet de tuning-waarden terug naar de fabriekswaarden. */
export function resetTuning() {
  for (const param of TUNING_PARAMS) {
    CONFIG[param.section][param.key] = DEFAULT_TUNING[param.key];
  }
  saveTuning();
}

/** Geeft de huidige tuning-waarden als tekst (handig om door te sturen). */
export function tuningAsText() {
  return TUNING_PARAMS
    .map((param) => `${param.label}: ${getTuningValue(param)}`)
    .join('\n');
}

// ---------------------------------------------------------------------
// Wereld-presets — Stap 2 gebruikt alleen 'wolkenvallei'.
// De overige staan klaar voor latere stappen (kleuren + tafels).
// ---------------------------------------------------------------------
export const WORLD_PRESETS = {
  wolkenvallei: {
    name: 'De Wolkenvallei',
    tables: [1, 2, 5, 10],
    sky: ['#5fb4f2', '#9fd6fb', '#fde9c8'],
    sun: '#fff4b8',
    sunGlow: 'rgba(255, 236, 150, 0.35)',
    cloud: '#ffffff',
    cloudShade: '#dcecf8',
    mountains: '#a9c4ea',
    hillsMid: '#86cf7e',
    trees: '#5aab5e',
    hillsFront: '#4f9f4c',
    hillsFrontDark: '#3c7f3b',
    grassEdge: '#9be37f'
  },
  stormschiereiland: {
    name: 'Stormachtig Schiereiland',
    tables: [3, 4, 6],
    sky: ['#4a5a73', '#7b8ba3', '#b9c3cf'],
    sun: '#e6e9ee',
    sunGlow: 'rgba(230, 233, 238, 0.2)',
    cloud: '#c9d1dc',
    cloudShade: '#8f9aab',
    mountains: '#6d7c92',
    hillsMid: '#5f8a6a',
    trees: '#456b50',
    hillsFront: '#4a7354',
    hillsFrontDark: '#365640',
    grassEdge: '#7fa784'
  },
  nachtvlucht: {
    name: 'De Nachtvlucht',
    tables: [7, 8, 9],
    sky: ['#0b1030', '#1c2457', '#3a3f7a'],
    sun: '#f4f1d0',
    sunGlow: 'rgba(244, 241, 208, 0.18)',
    cloud: '#4a5390',
    cloudShade: '#2f3670',
    mountains: '#262c5c',
    hillsMid: '#1f3d3a',
    trees: '#16302d',
    hillsFront: '#183330',
    hillsFrontDark: '#0f2321',
    grassEdge: '#2f5a52'
  },
  meeuwenrace: {
    name: 'De Meeuwen-race',
    tables: [11, 12],
    sky: ['#3aa0e0', '#8fd3f5', '#fff0c0'],
    sun: '#fff8c8',
    sunGlow: 'rgba(255, 240, 160, 0.35)',
    cloud: '#ffffff',
    cloudShade: '#dbeaf5',
    mountains: '#9cc3dd',
    hillsMid: '#e8d39a',
    trees: '#c9b06e',
    hillsFront: '#e0c27a',
    hillsFrontDark: '#c4a45c',
    grassEdge: '#f3dea0'
  }
};

export const ACTIVE_WORLD = 'wolkenvallei';
