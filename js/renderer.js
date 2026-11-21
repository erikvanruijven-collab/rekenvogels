// =====================================================================
// renderer.js — Alles wat op het 60fps-canvas getekend wordt
// ---------------------------------------------------------------------
//  - Parallax: luchtverloop, zon, bergen, 3 wolkenlagen, heuvels
//  - Ringen met antwoorden (achterste helft vóór de vogel, voorste helft
//    erna, zodat de vogel er echt dóórheen vliegt)
//  - De som bovenin met de thermiek-meter, veren-teller, zwevende teksten
//  - De vogel met vliegbril, draaiend met zijn hoek en klapperend
//  - Deeltjes (veren, sterretjes, stof), snelheidsstrepen, spoor
//  - Screen-shake en een kleine HUD
//
// De renderer leest de toestand uit FlightPhysics, maar verandert die
// nooit. Tekenen gebeurt in "logische" pixels (hoogte 720).
// =====================================================================

import { CONFIG } from './config.js';
import { groundY } from './physics.js';
import { drawBirdBody, drawHeadlamp, DEFAULT_BIRD } from './birds.js';
import { drawBolt } from './fx.js';

const TWO_PI = Math.PI * 2;
const CLOUD_WRAP = 2600; // breedte waarover wolken zich herhalen

/** Kleine voorspelbare random-generator, zodat wolken er elke keer hetzelfde uitzien. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mountainY(x, h) {
  return h * 0.6
    - Math.sin(x * 0.0021) * 55
    - Math.sin(x * 0.0057 + 2) * 30
    - Math.abs(Math.sin(x * 0.0013)) * 70;
}

function midHillY(x, h) {
  return h * 0.77
    - Math.sin(x * 0.0035) * 30
    - Math.sin(x * 0.009 + 1) * 16;
}

export class Renderer {
  constructor(canvas, preset) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.preset = preset;
    this.height = CONFIG.world.logicalHeight;
    this.scale = 1;
    this.viewWidth = 1280;

    this.particles = [];
    this.floatTexts = [];
    this.trail = [];
    this.speedLines = [];
    this.shakeAmount = 0;
    this.time = 0;
    this.skyGradient = null;

    this.cloudLayers = this.createCloudLayers();
    this.birdId = DEFAULT_BIRD;
    this.effects = null;        // wereld-effecten (regen, onweer...) of null
    this.ringStyle = 'normal';  // 'normal' of 'storm' (ringen in onweerswolken)
    this.bolts = [];            // bliksemschichten op de voorgrond
  }

  /** Wereld-specifieke effecten en ringstijl (zie worlds/). */
  setEffects(effects, ringStyle = 'normal') {
    this.effects = effects;
    this.ringStyle = ringStyle;
    this.bolts = [];
  }

  /** Bliksemschicht op de voorgrond (bijv. van wolk naar vogel). */
  addBolt(points) {
    this.bolts.push({ points, age: 0, life: 0.4 });
  }

  /** Welke vogel er getekend wordt (zie birds.js). */
  setBird(birdId) {
    this.birdId = birdId;
  }

  /** Past de canvasgrootte aan het scherm aan. Geeft de logische breedte terug. */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxDpr);
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.scale = this.canvas.height / this.height;
    this.viewWidth = this.canvas.width / this.scale;

    this.buildSkyGradient();
    return this.viewWidth;
  }

  buildSkyGradient() {
    const sky = this.ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, this.preset.sky[0]);
    sky.addColorStop(0.55, this.preset.sky[1]);
    sky.addColorStop(1, this.preset.sky[2]);
    this.skyGradient = sky;
  }

  /** Wisselt naar de kleuren van een andere wereld. */
  setWorld(preset) {
    this.preset = preset;
    this.buildSkyGradient();
  }

  /**
   * Laat een andere module (bijv. de Gouden Duik) zelf tekenen, met
   * dezelfde schaal en screen-shake als de gewone game.
   */
  renderCustom(drawFn) {
    const ctx = this.ctx;
    const s = this.scale;
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeAmount > 0) {
      shakeX = (Math.random() - 0.5) * 2 * this.shakeAmount;
      shakeY = (Math.random() - 0.5) * 2 * this.shakeAmount;
    }
    ctx.setTransform(s, 0, 0, s, shakeX * s, shakeY * s);
    drawFn(ctx, this.viewWidth, this.height);
  }

  /** Alleen de screen-shake laten uitdempen (tijdens de Gouden Duik). */
  updateShake(dt) {
    this.time += dt;
    this.shakeAmount *= Math.exp(-dt * 9);
    if (this.shakeAmount < 0.05) this.shakeAmount = 0;
  }

  createCloudLayers() {
    const random = seededRandom(20261121);
    const definitions = [
      { factor: 0.06, count: 6, yMin: 50, yMax: 200, size: 0.65, alpha: 0.5 },
      { factor: 0.18, count: 6, yMin: 70, yMax: 300, size: 0.95, alpha: 0.75 },
      { factor: 0.42, count: 5, yMin: 100, yMax: 400, size: 1.3, alpha: 0.92 }
    ];

    return definitions.map((def) => {
      const clouds = [];
      for (let i = 0; i < def.count; i += 1) {
        const puffs = [];
        const puffCount = 4 + Math.floor(random() * 3);
        for (let j = 0; j < puffCount; j += 1) {
          puffs.push({
            dx: (j - (puffCount - 1) / 2) * 26 + (random() - 0.5) * 10,
            dy: -random() * 22,
            r: 22 + random() * 18
          });
        }
        clouds.push({
          x: (i / def.count) * CLOUD_WRAP + random() * 200,
          y: def.yMin + random() * (def.yMax - def.yMin),
          s: def.size * (0.8 + random() * 0.4),
          puffs
        });
      }
      return { ...def, clouds };
    });
  }

  // -------------------------------------------------------------------
  // Effecten (aangeroepen vanuit main.js bij events)
  // -------------------------------------------------------------------

  addShake(amount) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  /** Feestelijke explosie van veren en sterretjes. */
  burst(x, y) {
    const featherColors = ['#ffffff', '#ffe27a', '#7cc8ff', '#ff9f6b'];
    for (let i = 0; i < 18; i += 1) {
      const angle = Math.random() * TWO_PI;
      const speed = 150 + Math.random() * 320;
      this.particles.push({
        type: 'star',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 260,
        drag: 1.6,
        life: 0.6 + Math.random() * 0.4,
        age: 0,
        size: 6 + Math.random() * 6,
        rot: Math.random() * TWO_PI,
        vr: (Math.random() - 0.5) * 10,
        color: Math.random() < 0.7 ? '#ffd23f' : '#fff6c9'
      });
    }
    for (let i = 0; i < 10; i += 1) {
      const angle = Math.random() * TWO_PI;
      const speed = 80 + Math.random() * 180;
      this.particles.push({
        type: 'feather',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        gravity: 120,
        drag: 2.2,
        life: 1.1 + Math.random() * 0.6,
        age: 0,
        size: 9 + Math.random() * 6,
        rot: Math.random() * TWO_PI,
        vr: (Math.random() - 0.5) * 6,
        color: featherColors[Math.floor(Math.random() * featherColors.length)]
      });
    }
  }

  /** Klein wolkje sterretjes bij een gewone ring. */
  sparkle(x, y) {
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.random() * TWO_PI;
      const speed = 60 + Math.random() * 120;
      this.particles.push({
        type: 'star',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 100,
        drag: 2,
        life: 0.4 + Math.random() * 0.2,
        age: 0,
        size: 4 + Math.random() * 3,
        rot: Math.random() * TWO_PI,
        vr: (Math.random() - 0.5) * 8,
        color: '#ffffff'
      });
    }
  }

  /** Zwevende tekst, bijv. "+3" of "Turbo!". */
  floatText(text, x, y, color = '#ffffff', size = 34) {
    this.floatTexts.push({ text, x, y, color, size, age: 0, life: 1.3 });
  }

  /** Rode/grijze puf bij een fout antwoord. */
  puff(x, y) {
    for (let i = 0; i < 8; i += 1) {
      const angle = Math.random() * TWO_PI;
      const speed = 40 + Math.random() * 90;
      this.particles.push({
        type: 'dust',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: -30,
        drag: 2,
        life: 0.6 + Math.random() * 0.3,
        age: 0,
        size: 6 + Math.random() * 6,
        rot: 0,
        vr: 0,
        color: 'rgba(200, 200, 210, 0.6)'
      });
    }
  }

  /** Vuurdeeltjes achter de vogel tijdens Turbo-thermiek. */
  emitFire(bird) {
    const colors = ['#ffdf4a', '#ff9f1c', '#ff5a1f', '#ffd166'];
    for (let i = 0; i < 3; i += 1) {
      const back = -32 - Math.random() * 10;
      const cos = Math.cos(bird.angle);
      const sin = Math.sin(bird.angle);
      this.particles.push({
        type: 'fire',
        x: bird.x + back * cos,
        y: bird.y + back * sin + (Math.random() - 0.5) * 12,
        vx: -60 - Math.random() * 80,
        vy: (Math.random() - 0.5) * 60 - 30,
        gravity: -80,
        drag: 1.5,
        life: 0.35 + Math.random() * 0.25,
        age: 0,
        size: 7 + Math.random() * 7,
        rot: 0,
        vr: 0,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  /** Stofwolkje bij het raken van de grond. */
  dust(x, y, strength) {
    const count = 6 + Math.floor(strength * 10);
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        type: 'dust',
        x: x + (Math.random() - 0.5) * 30,
        y,
        vx: -60 - Math.random() * 140,
        vy: -40 - Math.random() * 120 * strength,
        gravity: 220,
        drag: 2.5,
        life: 0.5 + Math.random() * 0.4,
        age: 0,
        size: 5 + Math.random() * 7,
        rot: 0,
        vr: 0,
        color: 'rgba(160, 120, 80, 0.55)'
      });
    }
  }

  // -------------------------------------------------------------------
  // Update van puur visuele dingen (deeltjes, spoor, strepen, shake)
  // -------------------------------------------------------------------

  update(dt, physics) {
    this.time += dt;
    const bird = physics.bird;
    const worldSpeed = bird.speed;
    const speedFactor = physics.speedFactor;

    // Deeltjes
    for (const p of this.particles) {
      p.age += dt;
      p.vx *= Math.max(0, 1 - p.drag * dt);
      p.vy *= Math.max(0, 1 - p.drag * dt);
      p.vy += p.gravity * dt;
      p.x += (p.vx - worldSpeed * 0.35) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);

    // Vuurspoor tijdens Turbo-thermiek
    if (bird.turboTime > 0) this.emitFire(bird);

    // Rookpluimpjes uit een beroete vogel
    if (bird.soot > CONFIG.storm.sootTime - 1.6 && Math.random() < dt * 14) {
      this.particles.push({
        type: 'dust',
        x: bird.x + (Math.random() - 0.5) * 30,
        y: bird.y - 10,
        vx: -40 - Math.random() * 40,
        vy: -40 - Math.random() * 40,
        gravity: -40,
        drag: 1.5,
        life: 0.7 + Math.random() * 0.4,
        age: 0,
        size: 6 + Math.random() * 6,
        rot: 0,
        vr: 0,
        color: 'rgba(70, 70, 78, 0.5)'
      });
    }

    // Bliksemschichten
    for (const bolt of this.bolts) bolt.age += dt;
    this.bolts = this.bolts.filter((bolt) => bolt.age < bolt.life);

    // Zwevende teksten
    for (const t of this.floatTexts) {
      t.age += dt;
      t.y -= 55 * dt;
    }
    this.floatTexts = this.floatTexts.filter((t) => t.age < t.life);

    // Spoor achter de vogel
    for (const t of this.trail) {
      t.x -= worldSpeed * dt;
      t.age += dt;
    }
    this.trail = this.trail.filter((t) => t.age < 0.35);
    if (speedFactor > CONFIG.render.trailThreshold || bird.turboTime > 0) {
      this.trail.push({ x: bird.x - 18, y: bird.y, age: 0, gold: bird.turboTime > 0 });
    }

    // Snelheidsstrepen
    for (const line of this.speedLines) {
      line.x -= worldSpeed * 2.4 * dt;
    }
    this.speedLines = this.speedLines.filter((line) => line.x + line.length > -20);
    if (speedFactor > CONFIG.render.speedLineThreshold) {
      const chance = Math.min(1, (speedFactor - CONFIG.render.speedLineThreshold) * 1.5);
      if (Math.random() < chance) {
        this.speedLines.push({
          x: this.viewWidth + 20,
          y: 40 + Math.random() * (this.height * 0.8),
          length: 60 + Math.random() * 120,
          alpha: 0.25 + Math.random() * 0.35 * chance
        });
      }
    }

    // Screen-shake dempen
    this.shakeAmount *= Math.exp(-dt * 9);
    if (this.shakeAmount < 0.05) this.shakeAmount = 0;
  }

  // -------------------------------------------------------------------
  // Tekenen
  // -------------------------------------------------------------------

  render(physics, hud) {
    const ctx = this.ctx;
    const s = this.scale;
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeAmount > 0) {
      shakeX = (Math.random() - 0.5) * 2 * this.shakeAmount;
      shakeY = (Math.random() - 0.5) * 2 * this.shakeAmount;
    }

    ctx.setTransform(s, 0, 0, s, shakeX * s, shakeY * s);

    const distance = physics.distance;
    this.drawSky();
    if (this.effects && this.effects.drawSky) this.effects.drawSky(ctx, this.viewWidth, this.height);
    this.drawCloudLayer(this.cloudLayers[0], distance);
    this.drawMountains(distance);
    this.drawCloudLayer(this.cloudLayers[1], distance);
    this.drawMidHills(distance);
    this.drawCloudLayer(this.cloudLayers[2], distance);
    this.drawSpeedLines();
    if (this.effects && this.effects.drawBehind) this.effects.drawBehind(ctx, this.viewWidth, this.height);
    this.drawFrontHills(distance);

    // Ringen: achterkant + getallen -> vogel -> voorkant
    for (const column of physics.columns) {
      for (const ring of column.rings) this.drawRingHalf(ring, column.x, false);
    }
    const labelsOnTop = Boolean(this.effects && this.effects.labelsOnTop);
    if (!labelsOnTop) {
      for (const column of physics.columns) {
        for (const ring of column.rings) this.drawRingLabel(ring, column.x);
      }
    }
    this.drawTrail();
    this.drawBird(physics.bird);
    for (const column of physics.columns) {
      for (const ring of column.rings) this.drawRingHalf(ring, column.x, true);
    }

    this.drawParticles();
    for (const bolt of this.bolts) drawBolt(ctx, bolt.points, 1 - bolt.age / bolt.life);
    if (this.effects && this.effects.drawFront) this.effects.drawFront(ctx, this.viewWidth, this.height);
    if (labelsOnTop) {
      // In het donker blijven de getallen altijd goed leesbaar
      for (const column of physics.columns) {
        for (const ring of column.rings) this.drawRingLabel(ring, column.x);
      }
    }
    if (this.effects && this.effects.drawOverlay) this.effects.drawOverlay(ctx, this.viewWidth, this.height);
    this.drawFloatTexts();

    // HUD zonder shake
    ctx.setTransform(s, 0, 0, s, 0, 0);
    this.drawHud(physics, hud);
  }

  drawSky() {
    const ctx = this.ctx;
    const p = this.preset;
    ctx.fillStyle = this.skyGradient;
    ctx.fillRect(-20, -20, this.viewWidth + 40, this.height + 40);

    // Zon met zachte gloed
    const sunX = this.viewWidth * 0.78;
    const sunY = this.height * 0.2;
    const pulse = 1 + Math.sin(this.time * 0.8) * 0.03;
    ctx.fillStyle = p.sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 95 * pulse, 0, TWO_PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sunX, sunY, 68 * pulse, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = p.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 46, 0, TWO_PI);
    ctx.fill();
  }

  drawCloudLayer(layer, distance) {
    const ctx = this.ctx;
    const offset = distance * layer.factor;
    ctx.globalAlpha = layer.alpha;
    for (const cloud of layer.clouds) {
      let x = (cloud.x - offset) % CLOUD_WRAP;
      if (x < 0) x += CLOUD_WRAP;
      x -= 250;
      if (x > this.viewWidth + 250) continue;
      this.drawCloud(x, cloud.y, cloud.s, cloud.puffs);
    }
    ctx.globalAlpha = 1;
  }

  drawCloud(x, y, s, puffs) {
    const ctx = this.ctx;
    // schaduwkant
    ctx.fillStyle = this.preset.cloudShade;
    ctx.beginPath();
    for (const puff of puffs) {
      ctx.moveTo(x + puff.dx * s + puff.r * s, y + puff.dy * s + 6 * s);
      ctx.arc(x + puff.dx * s, y + puff.dy * s + 6 * s, puff.r * s, 0, TWO_PI);
    }
    ctx.fill();
    // lichte kant
    ctx.fillStyle = this.preset.cloud;
    ctx.beginPath();
    for (const puff of puffs) {
      ctx.moveTo(x + puff.dx * s + puff.r * s, y + puff.dy * s);
      ctx.arc(x + puff.dx * s, y + puff.dy * s, puff.r * s, 0, TWO_PI);
    }
    ctx.fill();
  }

  drawMountains(distance) {
    const ctx = this.ctx;
    const offset = distance * 0.1;
    ctx.fillStyle = this.preset.mountains;
    ctx.beginPath();
    ctx.moveTo(-20, this.height + 20);
    for (let sx = -20; sx <= this.viewWidth + 20; sx += 12) {
      ctx.lineTo(sx, mountainY(sx + offset, this.height));
    }
    ctx.lineTo(this.viewWidth + 20, this.height + 20);
    ctx.closePath();
    ctx.fill();
  }

  drawMidHills(distance) {
    const ctx = this.ctx;
    const offset = distance * 0.35;
    ctx.fillStyle = this.preset.hillsMid;
    ctx.beginPath();
    ctx.moveTo(-20, this.height + 20);
    for (let sx = -20; sx <= this.viewWidth + 20; sx += 10) {
      ctx.lineTo(sx, midHillY(sx + offset, this.height));
    }
    ctx.lineTo(this.viewWidth + 20, this.height + 20);
    ctx.closePath();
    ctx.fill();

    // Ronde boompjes op de middelste heuvels
    ctx.fillStyle = this.preset.trees;
    const spacing = 170;
    const first = Math.floor((offset - 60) / spacing);
    const last = Math.ceil((offset + this.viewWidth + 60) / spacing);
    for (let i = first; i <= last; i += 1) {
      const hash = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
      if (hash < 0.35) continue;
      const worldX = i * spacing + hash * 80;
      const sx = worldX - offset;
      const baseY = midHillY(worldX, this.height);
      const r = 12 + hash * 10;
      ctx.beginPath();
      ctx.arc(sx, baseY - r * 0.6, r, 0, TWO_PI);
      ctx.arc(sx + r * 0.7, baseY - r * 0.3, r * 0.7, 0, TWO_PI);
      ctx.fill();
    }
  }

  drawFrontHills(distance) {
    const ctx = this.ctx;
    const p = this.preset;

    const gradient = ctx.createLinearGradient(0, this.height * 0.84, 0, this.height);
    gradient.addColorStop(0, p.hillsFront);
    gradient.addColorStop(1, p.hillsFrontDark);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-20, this.height + 20);
    for (let sx = -20; sx <= this.viewWidth + 20; sx += 8) {
      ctx.lineTo(sx, groundY(sx + distance, this.height));
    }
    ctx.lineTo(this.viewWidth + 20, this.height + 20);
    ctx.closePath();
    ctx.fill();

    // Lichte grasrand
    ctx.strokeStyle = p.grassEdge;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let sx = -20; sx <= this.viewWidth + 20; sx += 8) {
      const y = groundY(sx + distance, this.height) + 2;
      if (sx === -20) ctx.moveTo(sx, y);
      else ctx.lineTo(sx, y);
    }
    ctx.stroke();

    // Bloemetjes die meebewegen
    const spacing = 90;
    const first = Math.floor(distance / spacing);
    const last = Math.ceil((distance + this.viewWidth) / spacing);
    for (let i = first; i <= last; i += 1) {
      const hash = Math.abs(Math.sin(i * 78.233) * 12345.678) % 1;
      if (hash < 0.55) continue;
      const worldX = i * spacing + hash * 40;
      const sx = worldX - distance;
      const y = groundY(worldX, this.height) + 14 + hash * 18;
      ctx.fillStyle = hash > 0.8 ? '#ffffff' : '#ffe066';
      ctx.beginPath();
      ctx.arc(sx, y, 3.5, 0, TWO_PI);
      ctx.fill();
    }
  }

  drawSpeedLines() {
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const line of this.speedLines) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${line.alpha})`;
      ctx.beginPath();
      ctx.moveTo(line.x, line.y);
      ctx.lineTo(line.x + line.length, line.y);
      ctx.stroke();
    }
  }

  /** Kleuren van een ring, afhankelijk van zijn toestand. */
  ringColors(ring) {
    switch (ring.state) {
      case 'correct':
        return { outline: '#1f8a3a', back: '#4cc46a', front: '#7ee08f', glow: 'rgba(90, 220, 120, 0.4)' };
      case 'wrong':
        return { outline: '#a83232', back: '#e06060', front: '#ff8a8a', glow: 'rgba(255, 110, 110, 0.35)' };
      case 'reveal':
        return { outline: '#1f8a3a', back: '#4cc46a', front: '#7ee08f', glow: 'rgba(90, 220, 120, 0.3)' };
      default:
        return { outline: 'rgba(40, 90, 140, 0.5)', back: '#cfe6f7', front: '#f4fbff', glow: null };
    }
  }

  /** Doorzichtigheid en groei na een antwoord. */
  ringFade(ring) {
    if (ring.state === 'correct') {
      return { alpha: Math.max(0, 1 - ring.stateAge / 0.6), grow: 1 + ring.stateAge * 0.9 };
    }
    if (ring.state === 'wrong') {
      return { alpha: Math.max(0, 1 - ring.stateAge / 0.9), grow: 1 };
    }
    if (ring.state === 'faded') {
      return { alpha: Math.max(0, 0.45 - ring.stateAge), grow: 1 };
    }
    return { alpha: 1, grow: 1 };
  }

  /** Tekent de achterste (front=false) of voorste (front=true) helft van een ring. */
  drawRingHalf(ring, x, front) {
    const ctx = this.ctx;
    const { alpha, grow } = this.ringFade(ring);
    if (alpha <= 0) return;

    const rx = ring.r * 0.42;
    const ry = ring.r;
    const start = front ? Math.PI / 2 : -Math.PI / 2;
    const end = front ? Math.PI * 1.5 : Math.PI / 2;
    const colors = this.ringColors(ring);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, ring.y);
    ctx.scale(grow, grow);
    ctx.lineCap = 'round';

    // Onweerswolk om de ring: achterste puffen achter de ring
    if (this.ringStyle === 'storm' && !front) this.drawStormCloud(ring, false);

    if (colors.glow) {
      ctx.strokeStyle = colors.glow;
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, start, end);
      ctx.stroke();
    }

    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, start, end);
    ctx.stroke();

    ctx.strokeStyle = front ? colors.front : colors.back;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, start, end);
    ctx.stroke();

    if (front) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(-1.5, 0, rx - 2, ry - 4, 0, Math.PI * 0.75, Math.PI * 1.15);
      ctx.stroke();
      // Onweerswolk: voorste puffen over de ring heen
      if (this.ringStyle === 'storm') this.drawStormCloud(ring, true);
    }
    ctx.restore();
  }

  /**
   * Grijze onweerswolk rond een ring (Stormachtig Schiereiland).
   * Alle ringen krijgen dezelfde grijze wolk; alleen na een foute keuze
   * wordt die wolk zwart. Zo verraadt de wolk het antwoord niet.
   */
  drawStormCloud(ring, front) {
    const ctx = this.ctx;
    if (!ring.puffs) {
      // Vaste, licht willekeurige puffen per ring
      ring.puffs = [];
      const count = 11;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * TWO_PI + Math.random() * 0.25;
        ring.puffs.push({
          angle,
          r: 17 + Math.random() * 9,
          wobble: Math.random() * TWO_PI
        });
      }
    }

    let fill = '#a7afbd';
    let shade = '#7f8898';
    if (ring.state === 'wrong') {
      fill = '#2b2d34';
      shade = '#16171b';
    } else if (ring.state === 'correct' || ring.state === 'reveal') {
      fill = '#f2f5f9';
      shade = '#cfd7e2';
    }

    const rx = ring.r * 0.42 + 24;
    const ry = ring.r + 10;
    for (const puff of ring.puffs) {
      const px = Math.cos(puff.angle) * rx;
      const isFront = px < 0;
      if (isFront !== front) continue;
      const py = Math.sin(puff.angle) * ry;
      const r = puff.r + Math.sin(this.time * 2 + puff.wobble) * 1.5;
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(px, py + 4, r, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, TWO_PI);
      ctx.fill();
    }

    // Flitsje in een zwarte wolk
    if (ring.state === 'wrong' && ring.stateAge < 0.35 && front) {
      ctx.fillStyle = `rgba(255, 245, 170, ${0.8 * (1 - ring.stateAge / 0.35)})`;
      ctx.beginPath();
      ctx.arc(0, -ry * 0.6, 26, 0, TWO_PI);
      ctx.fill();
    }
  }

  /** Het antwoord (of de som) in het midden van de ring. */
  drawRingLabel(ring, x) {
    const ctx = this.ctx;
    const { alpha } = this.ringFade(ring);
    if (alpha <= 0 || ring.state === 'correct') return;

    ctx.save();
    ctx.globalAlpha = alpha;
    const long = ring.label.length > 3;          // bijv. "7 × 8" in De Nachtvlucht
    const size = long ? 27 : ring.label.length >= 3 ? 27 : 33;
    ctx.font = `bold ${size}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;

    ctx.fillStyle = ring.state === 'reveal'
      ? 'rgba(220, 255, 225, 0.95)'
      : ring.state === 'wrong'
        ? 'rgba(255, 225, 225, 0.95)'
        : 'rgba(255, 255, 255, 0.92)';
    if (long) {
      const width = ctx.measureText(ring.label).width + 26;
      this.roundRect(x - width / 2, ring.y - 24, width, 48, 24);
    } else {
      ctx.beginPath();
      ctx.arc(x, ring.y, 31, 0, TWO_PI);
    }
    ctx.fill();
    ctx.strokeStyle = ring.state === 'reveal' ? '#2f9e4a' : 'rgba(40, 90, 140, 0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#21324f';
    ctx.fillText(ring.label, x, ring.y + 2);
    ctx.restore();
  }

  drawFloatTexts() {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.floatTexts) {
      const life = 1 - t.age / t.life;
      const pop = t.age < 0.15 ? 0.6 + (t.age / 0.15) * 0.4 : 1;
      ctx.globalAlpha = Math.min(1, life * 1.6);
      ctx.font = `bold ${Math.round(t.size * pop)}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(30, 45, 70, 0.55)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  drawTrail() {
    const ctx = this.ctx;
    if (this.trail.length < 2) return;
    ctx.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i += 1) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      const life = 1 - b.age / 0.35;
      ctx.strokeStyle = b.gold
        ? `rgba(255, 200, 60, ${0.7 * life})`
        : `rgba(255, 255, 255, ${0.45 * life})`;
      ctx.lineWidth = (b.gold ? 10 : 6) * life;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  drawBird(bird) {
    const ctx = this.ctx;
    const open = bird.wingOpen;
    const flapping = bird.flapTime > 0;
    const flapOsc = flapping
      ? Math.sin(bird.flapPhase) * 0.9 * (bird.flapTime / 0.45 + 0.3)
      : Math.sin(bird.flapPhase) * 0.12;

    ctx.save();
    ctx.translate(bird.x, bird.y);
    const wobble = bird.wobble > 0 ? Math.sin(this.time * 40) * 0.25 * (bird.wobble / 0.6) : 0;
    ctx.rotate(bird.angle + wobble);
    // Gestroomlijnd tijdens duiken
    const stretch = 1 + (1 - open) * 0.1;
    ctx.scale(stretch, 2 - stretch);

    drawBirdBody(ctx, this.birdId, {
      open,
      flapOsc,
      lookY: Math.max(-2, Math.min(2, bird.vy / 300)),
      time: this.time,
      diving: bird.diving,
      turbo: bird.turboTime > 0
    });

    // Koplampje (De Nachtvlucht)
    if (this.effects && this.effects.headlamp) drawHeadlamp(ctx, this.birdId);

    // Roetvlekken na een onweersschok
    if (bird.soot > 0) {
      const alpha = Math.min(1, bird.soot / 1.2) * 0.8;
      ctx.fillStyle = `rgba(28, 28, 34, ${alpha})`;
      for (const [sx, sy, rx, ry] of [[-6, -6, 12, 7], [9, 7, 10, 6], [21, -14, 8, 6], [-19, 5, 7, 5], [2, -15, 6, 4]]) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0.3, 0, TWO_PI);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  drawStar(size) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? size : size * 0.45;
      const angle = (i / 10) * TWO_PI - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const life = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, life * 1.4));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.type === 'star') {
        this.drawStar(p.size * (0.6 + life * 0.4));
      } else if (p.type === 'feather') {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-p.size * 1.1, 0);
        ctx.lineTo(p.size, 0);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.4 - life * 0.4), 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** Klein veertje als icoon. */
  drawFeatherIcon(x, y, size) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.6);
    ctx.fillStyle = '#7cc8ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.38, 0, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = '#4fa3e6';
    ctx.beginPath();
    ctx.ellipse(size * 0.25, 0, size * 0.6, size * 0.22, 0, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = '#2a5f96';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-size * 1.25, 0);
    ctx.lineTo(size * 0.95, 0);
    ctx.stroke();
    ctx.restore();
  }

  drawHud(physics, hud) {
    const ctx = this.ctx;
    if (!hud || !hud.visible) return;
    const font = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

    // ---------- Linksboven: veren en voortgang ----------
    const x = 22;
    const y = 22;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    this.roundRect(x, y, 196, 96, 18);
    ctx.fill();

    this.drawFeatherIcon(x + 32, y + 30, 16);
    ctx.fillStyle = '#2a3a55';
    ctx.font = `bold 28px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(String(hud.feathers), x + 62, y + 31);

    ctx.font = `bold 17px ${font}`;
    ctx.fillStyle = '#5a6a85';
    ctx.fillText(`Som ${Math.max(1, hud.questionNumber)} van ${hud.roundLength}`, x + 16, y + 72);

    // ---------- Snelheidsmeter onder het paneel ----------
    const p = CONFIG.physics;
    const factor = physics.speedFactor;
    const fraction = Math.max(0, Math.min(1, (factor - p.minSpeedFactor) / (p.maxSpeedFactor - p.minSpeedFactor)));
    const barX = x;
    const barY = y + 106;
    const barW = 196;
    const barH = 12;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();
    ctx.fillStyle = physics.bird.turboTime > 0 ? '#ff7a2f' : factor > 1.25 ? '#ffc928' : '#4fc3f7';
    this.roundRect(barX, barY, Math.max(barH, barW * fraction), barH, 6);
    ctx.fill();

    // ---------- Midden boven: de som ----------
    const q = hud.question;
    if (q) {
      const m = CONFIG.math;
      const cx = this.viewWidth / 2;
      ctx.font = `bold 50px ${font}`;
      const boxW = Math.max(330, ctx.measureText(q.state === 'asking' ? q.prompt : q.solution).width + 60);
      const boxH = q.state === 'asking' ? 96 : 84;
      const boxY = 18;

      let fill = 'rgba(255, 255, 255, 0.92)';
      let border = 'rgba(42, 58, 85, 0.15)';
      let text = q.prompt;
      let textColor = '#21324f';
      if (q.state === 'answered') {
        text = q.solution;
        if (q.correct) {
          fill = q.fast ? 'rgba(255, 236, 170, 0.96)' : 'rgba(220, 250, 225, 0.96)';
          border = q.fast ? '#ff9f1c' : '#3fb85a';
          textColor = q.fast ? '#8a4b00' : '#1f6e33';
        } else {
          fill = 'rgba(255, 236, 228, 0.96)';
          border = '#ff8a65';
          textColor = '#8a3a22';
        }
      }

      ctx.fillStyle = fill;
      this.roundRect(cx - boxW / 2, boxY, boxW, boxH, 24);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = textColor;
      ctx.font = `bold 50px ${font}`;
      ctx.fillText(text, cx, boxY + 44);

      if (q.state === 'asking') {
        // Thermiek-meter: oranje = nog Turbo-tijd, blauw = nog op tijd, leeg = wind zakt weg
        const meterW = 250;
        const meterX = cx - meterW / 2;
        const meterY = boxY + 76;
        ctx.fillStyle = 'rgba(42, 58, 85, 0.12)';
        this.roundRect(meterX, meterY, meterW, 10, 5);
        ctx.fill();
        let width = 0;
        let color = '#ff9f1c';
        if (q.age < m.fastThreshold) {
          width = meterW * (1 - q.age / m.fastThreshold);
        } else if (q.age < m.slowThreshold) {
          width = meterW * (1 - (q.age - m.fastThreshold) / (m.slowThreshold - m.fastThreshold));
          color = '#4fc3f7';
        }
        if (width > 0) {
          ctx.fillStyle = color;
          this.roundRect(meterX, meterY, Math.max(10, width), 10, 5);
          ctx.fill();
        }
      } else if (q.message) {
        ctx.font = `bold 20px ${font}`;
        const msgW = ctx.measureText(q.message).width + 36;
        ctx.fillStyle = 'rgba(30, 45, 70, 0.62)';
        this.roundRect(cx - msgW / 2, boxY + boxH + 8, msgW, 36, 18);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(q.message, cx, boxY + boxH + 27);
      }
    }

    // ---------- Wereldnaam bij de start ----------
    if (hud.worldTitleAlpha > 0 && hud.worldTitle) {
      ctx.globalAlpha = hud.worldTitleAlpha;
      ctx.font = `bold 44px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(30, 45, 70, 0.55)';
      ctx.strokeText(hud.worldTitle, this.viewWidth / 2, this.height * 0.4);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(hud.worldTitle, this.viewWidth / 2, this.height * 0.4);
      ctx.globalAlpha = 1;
    }

    // ---------- Uitleg in de eerste seconden ----------
    if (hud.hintAlpha > 0) {
      ctx.globalAlpha = hud.hintAlpha;
      const text = hud.hintText || 'Vlieg door de ring met het goede antwoord!';
      ctx.font = `bold 26px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const width = ctx.measureText(text).width + 48;
      ctx.fillStyle = 'rgba(30, 45, 70, 0.6)';
      this.roundRect(this.viewWidth / 2 - width / 2, this.height - 92, width, 52, 26);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, this.viewWidth / 2, this.height - 65);
      ctx.globalAlpha = 1;
    }
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
