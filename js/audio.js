// =====================================================================
// audio.js — Procedurele geluiden met de Web Audio API
// ---------------------------------------------------------------------
// Geen mp3/wav-bestanden: alles wordt live opgewekt.
//  - Windruis (gefilterde ruis) die aanzwelt tijdens het duiken
//  - Marimba-achtige ping bij een gouden ring
//  - Zachte "fwiep" bij een vleugelslag en een "plof" bij de grond
//
// Belangrijk voor iPad Safari: een AudioContext mag pas starten na een
// aanraking door de gebruiker. Roep daarom unlock() aan in een
// pointerdown-handler.
// =====================================================================

import { CONFIG } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.windFilter = null;
    this.noiseBuffer = null;
    this.lastWindUpdate = 0;
    this.muted = false;

    try {
      this.muted = localStorage.getItem(CONFIG.storageKeys.muted) === '1';
    } catch (error) {
      this.muted = false;
    }

    // Pauzeer het geluid als de app naar de achtergrond gaat
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.ctx.suspend();
      } else {
        this.ctx.resume();
      }
    });
  }

  /** Maak of hervat de AudioContext. Aanroepen bij elke schermtik. */
  unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      this.buildGraph();

      // iOS-truc: speel direct een stille buffer af om de audio te "ontgrendelen"
      const silent = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const source = this.ctx.createBufferSource();
      source.buffer = silent;
      source.connect(this.ctx.destination);
      source.start(0);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  buildGraph() {
    const ctx = this.ctx;

    // Master-volume -> compressor -> luidsprekers
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 4;
    compressor.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : CONFIG.audio.masterVolume;
    this.master.connect(compressor);

    // Ruisbuffer van 2 seconden (wordt hergebruikt voor wind en fwiep)
    const length = Math.floor(ctx.sampleRate * 2);
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    // Windkanaal: lussende ruis -> bandpass-filter -> volume
    const windSource = ctx.createBufferSource();
    windSource.buffer = this.noiseBuffer;
    windSource.loop = true;

    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.8;

    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;

    windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    windSource.start();
  }

  /**
   * Past de windruis aan op de vliegtoestand. Elk frame aanroepen;
   * intern wordt dit beperkt tot ±20 keer per seconde.
   */
  updateWind(diving, speedFactor) {
    if (!this.ctx || !this.windGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastWindUpdate < 0.05) return;
    this.lastWindUpdate = now;

    const fast = Math.min(1, Math.max(0, (speedFactor - 0.8) / 1.6));
    const volume = diving
      ? 0.06 + 0.16 * fast
      : 0.012 + 0.05 * Math.max(0, (speedFactor - 1.1) / 1.5);
    const frequency = diving ? 450 + 1100 * fast : 320 + 400 * fast;

    this.windGain.gain.setTargetAtTime(volume, now, 0.12);
    this.windFilter.frequency.setTargetAtTime(frequency, now, 0.15);
  }

  /** Stopt de wind (bijv. op het startscherm). */
  silenceWind() {
    if (!this.ctx || !this.windGain) return;
    this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  /** Eén marimba-toon: grondtoon + boventoon (4x) die sneller uitsterft. */
  marimbaNote(frequency, when, volume) {
    const ctx = this.ctx;

    const fundamental = ctx.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.value = frequency;

    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.value = frequency * 4;

    const gainMain = ctx.createGain();
    gainMain.gain.setValueAtTime(0.0001, when);
    gainMain.gain.exponentialRampToValueAtTime(volume, when + 0.006);
    gainMain.gain.exponentialRampToValueAtTime(0.0001, when + 0.55);

    const gainOver = ctx.createGain();
    gainOver.gain.setValueAtTime(0.0001, when);
    gainOver.gain.exponentialRampToValueAtTime(volume * 0.35, when + 0.004);
    gainOver.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);

    fundamental.connect(gainMain);
    overtone.connect(gainOver);
    gainMain.connect(this.master);
    gainOver.connect(this.master);

    fundamental.start(when);
    overtone.start(when);
    fundamental.stop(when + 0.6);
    overtone.stop(when + 0.6);
  }

  /** Vrolijke ping (C - E - G) voor de gouden ring. */
  playGoldPing() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.01;
    this.marimbaNote(1046.5, now, 0.32);
    this.marimbaNote(1318.5, now + 0.07, 0.28);
    this.marimbaNote(1568.0, now + 0.14, 0.3);
  }

  /** Heel zacht tikje bij een gewone ring. */
  playRingTick() {
    if (!this.ctx) return;
    this.marimbaNote(784.0, this.ctx.currentTime + 0.01, 0.08);
  }

  /** Korte "fwiep" van de vleugels bij het loslaten. */
  playFlap(speedFactor = 1) {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(700, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 0.12);

    const gain = ctx.createGain();
    const volume = Math.min(0.22, 0.08 + 0.06 * speedFactor);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now, Math.random() * 1.5);
    source.stop(now + 0.2);
  }

  /** Doffe plof bij het raken van de grond. */
  playThud(strength = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15 + 0.3 * strength, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // -------------------------------------------------------------------
  // Stap 2: geluiden bij de rekensommen
  // -------------------------------------------------------------------

  /** Nieuwe som verschijnt: zacht "pling-plong". */
  playQuestion() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.01;
    this.marimbaNote(659.3, now, 0.1);
    this.marimbaNote(880.0, now + 0.08, 0.1);
  }

  /** Goed antwoord (gewone snelheid): twee vrolijke tonen. */
  playCorrect() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.01;
    this.marimbaNote(784.0, now, 0.26);
    this.marimbaNote(1046.5, now + 0.09, 0.28);
  }

  /** Turbo-thermiek: snelle opwaartse marimba-loop + aanzwellende wind. */
  playTurbo() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const notes = [784.0, 987.8, 1174.7, 1568.0, 1975.5];
    notes.forEach((frequency, index) => {
      this.marimbaNote(frequency, now + index * 0.055, 0.26);
    });

    if (!this.noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now, Math.random());
    source.stop(now + 1);
  }

  /** Fout antwoord: vriendelijke, zakkende "boing" (niet hard of naar). */
  playWrong() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  /** De wind zakt weg: zuchtende, dalende ruis. */
  playWindDrop() {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now, Math.random());
    source.stop(now + 1.05);
  }

  /** Einde van de vlucht: klein fanfaretje. */
  playFanfare() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.02;
    const notes = [523.3, 659.3, 784.0, 1046.5, 784.0, 1046.5];
    const times = [0, 0.12, 0.24, 0.36, 0.56, 0.68];
    notes.forEach((frequency, index) => {
      this.marimbaNote(frequency, now + times[index], 0.3);
    });
  }

  // -------------------------------------------------------------------
  // Stap 3a: Gouden Duik en werelden
  // -------------------------------------------------------------------

  /** Veer gevangen: toon klimt mee met de reeks ("combo"). */
  playCatch(combo = 1, gold = false) {
    if (!this.ctx) return;
    const scale = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 1174.7, 1318.5];
    const frequency = scale[Math.min(scale.length - 1, combo - 1)] * (gold ? 1.5 : 1);
    const now = this.ctx.currentTime + 0.005;
    this.marimbaNote(frequency, now, gold ? 0.3 : 0.2);
    if (gold) this.marimbaNote(frequency * 1.5, now + 0.06, 0.22);
  }

  /** Nieuwe wereld open: vrolijk loopje omhoog. */
  playUnlock() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.3;
    [523.3, 659.3, 784.0, 1046.5, 1318.5, 1568.0].forEach((frequency, index) => {
      this.marimbaNote(frequency, now + index * 0.09, 0.28);
    });
  }

  /** Wind bij de Gouden Duik: hard en hoog. */
  setDiveWind(active) {
    if (!this.ctx || !this.windGain) return;
    const now = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(active ? 0.16 : 0, now, 0.2);
    this.windFilter.frequency.setTargetAtTime(active ? 1300 : 500, now, 0.3);
  }

  // -------------------------------------------------------------------
  // Stap 3b: Stormachtig Schiereiland
  // -------------------------------------------------------------------

  /** Ruis door een filter met een volume-omhullende (hulpje voor stormgeluiden). */
  noiseBurst({ when, type, frequency, frequencyEnd, q = 1, volume, attack, duration, offset = Math.random() * 1.5 }) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;   // lange geluiden (donder) lopen niet tegen het einde van de ruisbuffer aan
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(frequency, when);
    if (frequencyEnd) filter.frequency.exponentialRampToValueAtTime(frequencyEnd, when + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(when, offset);
    source.stop(when + duration + 0.05);
  }

  /** Zacht ruisende regen op de achtergrond (aan/uit). */
  setRain(on) {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    if (!this.rainGain) {
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 2500;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 7000;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(this.rainGain);
      this.rainGain.connect(this.master);
      source.start(0, 0.7);
    }
    this.rainGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.4);
  }

  /** Donder in de verte: lage rommel, iets na de flits. */
  playThunder(delay = 0.4) {
    if (!this.ctx || !this.noiseBuffer) return;
    const when = this.ctx.currentTime + delay;
    this.noiseBurst({ when, type: 'lowpass', frequency: 260, frequencyEnd: 90, volume: 0.32, attack: 0.08, duration: 2.2 });
    this.noiseBurst({ when, type: 'bandpass', frequency: 900, q: 0.8, volume: 0.08, attack: 0.01, duration: 0.25 });
  }

  /** Elektrische zap bij een onweersschok. */
  playZap() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.4);
    if (this.noiseBuffer) {
      this.noiseBurst({ when: now, type: 'highpass', frequency: 2500, volume: 0.18, attack: 0.005, duration: 0.3 });
    }
  }

  /** Komisch hoestje: "kuch-kuch". */
  playCough() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + 0.01;
    for (const start of [0, 0.26]) {
      this.noiseBurst({ when: now + start, type: 'bandpass', frequency: 650, frequencyEnd: 380, q: 2.2, volume: 0.32, attack: 0.012, duration: 0.16 });
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, now + start);
      osc.frequency.exponentialRampToValueAtTime(150, now + start + 0.14);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.12, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.15);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + start);
      osc.stop(now + start + 0.2);
    }
  }

  /** Aanzwellende windvlaag. */
  playGust() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + 0.01;
    this.noiseBurst({ when: now, type: 'bandpass', frequency: 300, frequencyEnd: 1100, q: 0.9, volume: 0.17, attack: 0.6, duration: 1.8 });
  }

  // -------------------------------------------------------------------
  // Stap 3d: De Meeuwen-race
  // -------------------------------------------------------------------

  /** Meeuwengekrijs van Karel: "kraaa-kra!" */
  playSquawk() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    for (const [start, length, from, to] of [[0, 0.22, 1150, 820], [0.26, 0.14, 1250, 900]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(from, now + start);
      osc.frequency.exponentialRampToValueAtTime(to, now + start + length);
      const wobble = ctx.createOscillator();
      wobble.frequency.value = 38;
      const wobbleGain = ctx.createGain();
      wobbleGain.gain.value = 60;
      wobble.connect(wobbleGain);
      wobbleGain.connect(osc.frequency);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1600;
      filter.Q.value = 1.4;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.13, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start(now + start);
      wobble.start(now + start);
      osc.stop(now + start + length + 0.02);
      wobble.stop(now + start + length + 0.02);
    }
  }

  // -------------------------------------------------------------------
  // Stap 4b: Vogel-atelier
  // -------------------------------------------------------------------

  /** Kassa! Iets gekocht. */
  playBuy() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.01;
    [1318.5, 1568.0, 2093.0].forEach((frequency, index) => {
      this.marimbaNote(frequency, now + index * 0.06, 0.24);
    });
    this.marimbaNote(1046.5, now + 0.22, 0.3);
  }

  /** Pfrrt! (scheetwolkje bij een Turbo) */
  playFart() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.45);
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 28;
    const wobbleGain = ctx.createGain();
    wobbleGain.gain.value = 25;
    wobble.connect(wobbleGain);
    wobbleGain.connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    wobble.start(now);
    osc.stop(now + 0.55);
    wobble.stop(now + 0.55);
  }

  /** Jetpack-lancering: brullende raket, groter bij hogere niveaus. */
  playLaunch(tier = 1) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + 0.01;
    const length = 1 + tier * 0.5;
    this.noiseBurst({ when: now, type: 'lowpass', frequency: 300, frequencyEnd: 1400 + tier * 400, volume: 0.22 + tier * 0.04, attack: 0.08, duration: length });
    this.noiseBurst({ when: now, type: 'bandpass', frequency: 800, frequencyEnd: 3000, q: 1, volume: 0.1, attack: 0.3, duration: length * 0.8 });
    if (tier === 3) {
      // MEGA: knal + vrolijk loopje
      this.noiseBurst({ when: now + 0.05, type: 'lowpass', frequency: 180, volume: 0.35, attack: 0.005, duration: 0.6 });
      [784.0, 1046.5, 1318.5, 1568.0, 2093.0].forEach((frequency, index) => {
        this.marimbaNote(frequency, now + 0.3 + index * 0.07, 0.22);
      });
    }
  }

  // -------------------------------------------------------------------
  // Stap 4c: Badges
  // -------------------------------------------------------------------

  /** Nieuwe badge: feestelijk loopje met glinster erachteraan. */
  playBadge() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.02;
    [523.3, 659.3, 784.0, 1046.5].forEach((frequency, index) => {
      this.marimbaNote(frequency, now + index * 0.1, 0.3);
    });
    this.marimbaNote(1318.5, now + 0.45, 0.28);
    this.marimbaNote(1568.0, now + 0.45, 0.22);
    [2093.0, 2637.0, 3136.0].forEach((frequency, index) => {
      this.marimbaNote(frequency, now + 0.65 + index * 0.05, 0.1);
    });
  }

  /** Zet geluid aan/uit en onthoud de keuze. Geeft de nieuwe toestand terug. */
  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(CONFIG.storageKeys.muted, muted ? '1' : '0');
    } catch (error) {
      // localStorage niet beschikbaar (bijv. privémodus) — geen probleem
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : CONFIG.audio.masterVolume, this.ctx.currentTime, 0.05);
    }
  }
}
