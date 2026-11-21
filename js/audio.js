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
