// =====================================================================
// minigames/gouden-duik.js — Tussenspel na elke vlucht
// ---------------------------------------------------------------------
// 15 seconden lang duikt de vogel recht naar beneden door een koker.
// Van onderen komen veren aanvliegen; de speler stuurt de vogel naar
// links/rechts door haar vinger op het scherm te houden (de vogel volgt
// de vinger). Puur reflex, geen rekenen. Gouden veren tellen extra.
//
// Deze module tekent zelf (op het canvas van de renderer) en geeft
// events terug aan main.js voor geluid en het optellen van veren.
// =====================================================================

import { CONFIG } from '../config.js';
import { drawBirdBody } from '../birds.js';

const TWO_PI = Math.PI * 2;
const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class GoldenDive {
  constructor() {
    this.height = CONFIG.world.logicalHeight;
    this.viewWidth = 1280;
    this.finished = true;
  }

  setViewWidth(width) {
    this.viewWidth = width;
  }

  get shaftLeft() {
    return this.viewWidth * (1 - CONFIG.goldenDive.shaftWidth) / 2;
  }

  get shaftRight() {
    return this.viewWidth - this.shaftLeft;
  }

  start(viewWidth) {
    this.viewWidth = viewWidth;
    this.phase = 'intro';       // intro -> diving -> outro
    this.phaseTime = 0;
    this.time = 0;
    this.finished = false;
    this.x = viewWidth / 2;
    this.vx = 0;
    this.birdY = this.height * 0.27;
    this.scroll = 0;
    this.feathers = [];
    this.sparkles = [];
    this.streaks = [];
    this.spawnTimer = 0;
    this.spawnCount = 0;
    this.pathSeed = Math.random() * 10;
    this.caught = 0;
    this.bonus = 0;
    this.combo = 0;
    this.comboTimer = 0;
  }

  /** Huidige valsnelheid: wordt in de loop van de duik steeds hoger. */
  get fallSpeed() {
    const g = CONFIG.goldenDive;
    if (this.phase === 'intro') return g.startFallSpeed * 0.6;
    if (this.phase === 'outro') return g.startFallSpeed * 0.5;
    const t = clamp(this.phaseTime / g.duration, 0, 1);
    return g.startFallSpeed + (g.endFallSpeed - g.startFallSpeed) * t;
  }

  /** Hoeveel seconden er nog over zijn (voor de HUD). */
  get timeLeft() {
    if (this.phase !== 'diving') return this.phase === 'intro' ? CONFIG.goldenDive.duration : 0;
    return Math.max(0, CONFIG.goldenDive.duration - this.phaseTime);
  }

  /**
   * @param {number} dt
   * @param {{targetX:number|null, left:boolean, right:boolean}} input
   */
  update(dt, input) {
    const g = CONFIG.goldenDive;
    const events = [];
    if (this.finished) return events;

    this.time += dt;
    this.phaseTime += dt;
    const fall = this.fallSpeed;
    this.scroll += fall * dt;

    // ---------- Fases ----------
    if (this.phase === 'intro' && this.phaseTime >= g.introTime) {
      this.phase = 'diving';
      this.phaseTime = 0;
      events.push({ type: 'diveStart' });
    } else if (this.phase === 'diving' && this.phaseTime >= g.duration) {
      this.phase = 'outro';
      this.phaseTime = 0;
      events.push({ type: 'diveEnd', bonus: this.bonus, caught: this.caught });
    } else if (this.phase === 'outro' && this.phaseTime >= 1.8) {
      this.finished = true;
      events.push({ type: 'finished', bonus: this.bonus });
      return events;
    }

    // ---------- Vogel volgt de vinger ----------
    const previousX = this.x;
    if (input.targetX !== null && input.targetX !== undefined) {
      this.x += (input.targetX - this.x) * Math.min(1, dt * g.birdFollow);
    }
    if (input.left) this.x -= 650 * dt;
    if (input.right) this.x += 650 * dt;
    this.x = clamp(this.x, this.shaftLeft + 40, this.shaftRight - 40);
    this.vx = (this.x - previousX) / Math.max(dt, 0.001);

    // ---------- Veren laten verschijnen ----------
    if (this.phase === 'diving') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnFeather();
        this.spawnTimer = g.spawnInterval * (0.8 + Math.random() * 0.4);
      }
    }

    // ---------- Veren bewegen en vangen ----------
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;

    for (const feather of this.feathers) {
      feather.y -= fall * dt;
      feather.x += Math.sin(this.time * 3 + feather.phase) * 22 * dt;
      feather.rot += feather.vr * dt;

      if (!feather.caught && this.phase === 'diving') {
        const dx = feather.x - this.x;
        const dy = feather.y - this.birdY;
        if (dx * dx + dy * dy < g.catchRadius * g.catchRadius) {
          feather.caught = true;
          this.combo += 1;
          this.comboTimer = 0.9;
          const value = feather.gold ? g.goldValue : g.featherValue;
          this.bonus += value;
          this.caught += 1;
          this.addSparkles(feather.x, feather.y, feather.gold);
          events.push({ type: 'catch', gold: feather.gold, value, combo: this.combo, x: feather.x, y: feather.y });
        }
      }
    }
    this.feathers = this.feathers.filter((f) => !f.caught && f.y > -60);

    // ---------- Vonkjes en windstrepen ----------
    for (const s of this.sparkles) {
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt - fall * 0.3 * dt;
      s.vy += 200 * dt;
    }
    this.sparkles = this.sparkles.filter((s) => s.age < s.life);

    if (Math.random() < dt * 14) {
      this.streaks.push({
        x: this.shaftLeft + Math.random() * (this.shaftRight - this.shaftLeft),
        y: this.height + 30,
        length: 40 + Math.random() * 90,
        alpha: 0.2 + Math.random() * 0.3
      });
    }
    for (const streak of this.streaks) streak.y -= fall * 1.6 * dt;
    this.streaks = this.streaks.filter((streak) => streak.y + streak.length > -20);

    return events;
  }

  spawnFeather() {
    const g = CONFIG.goldenDive;
    const left = this.shaftLeft + 50;
    const right = this.shaftRight - 50;
    const center = (left + right) / 2;
    const half = (right - left) / 2;

    // Meestal een slingerend "spoor" dat je kunt volgen, soms een losse veer
    this.spawnCount += 1;
    if (this.spawnCount % 9 === 0) this.pathSeed = Math.random() * 10;
    const onPath = Math.random() < 0.7;
    const x = onPath
      ? center + Math.sin(this.spawnCount * 0.5 + this.pathSeed) * half * 0.85
      : left + Math.random() * (right - left);

    this.feathers.push({
      x,
      y: this.height + 40,
      gold: Math.random() < g.goldChance,
      rot: Math.random() * TWO_PI,
      vr: (Math.random() - 0.5) * 3,
      phase: Math.random() * TWO_PI,
      caught: false
    });
  }

  addSparkles(x, y, gold) {
    const count = gold ? 14 : 7;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TWO_PI;
      const speed = 80 + Math.random() * 200;
      this.sparkles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.4 + Math.random() * 0.3,
        size: gold ? 7 : 5,
        color: gold ? '#ffd23f' : '#ffffff'
      });
    }
  }

  // -------------------------------------------------------------------
  // Tekenen (logische coördinaten, hoogte 720)
  // -------------------------------------------------------------------

  /** Rand van de rotswand op hoogte y (links of rechts). */
  wallEdge(y, side) {
    const s = y + this.scroll;
    const wobble = Math.sin(s * 0.012 + (side > 0 ? 2 : 0)) * 22 + Math.sin(s * 0.035 + side) * 9;
    return side < 0 ? this.shaftLeft - 10 + wobble : this.shaftRight + 10 + wobble;
  }

  draw(ctx, birdId) {
    const W = this.viewWidth;
    const H = this.height;

    // Lucht in de koker: van lichtgoud naar warm oranje
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#fff3c4');
    sky.addColorStop(0.55, '#ffd27a');
    sky.addColorStop(1, '#ff9f5a');
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Windstrepen (bewegen omhoog = wij vallen)
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    for (const streak of this.streaks) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${streak.alpha})`;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(streak.x, streak.y + streak.length);
      ctx.stroke();
    }

    // Rotswanden
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#b9773f';
      ctx.beginPath();
      const outer = side < 0 ? -20 : W + 20;
      ctx.moveTo(outer, -20);
      for (let y = -20; y <= H + 20; y += 12) {
        ctx.lineTo(this.wallEdge(y, side), y);
      }
      ctx.lineTo(outer, H + 20);
      ctx.closePath();
      ctx.fill();

      // lichtere rand
      ctx.strokeStyle = '#e0a463';
      ctx.lineWidth = 7;
      ctx.beginPath();
      for (let y = -20; y <= H + 20; y += 12) {
        const x = this.wallEdge(y, side) - side * 3;
        if (y === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // stenen in de wand
      ctx.fillStyle = 'rgba(120, 70, 35, 0.45)';
      const spacing = 90;
      const first = Math.floor((this.scroll - 40) / spacing);
      const last = Math.ceil((this.scroll + H + 40) / spacing);
      for (let i = first; i <= last; i += 1) {
        const hash = Math.abs(Math.sin(i * 91.7 + side * 13.1) * 9301.7) % 1;
        const y = i * spacing - this.scroll + hash * 30;
        const edge = this.wallEdge(y, side);
        const x = edge + side * (25 + hash * 60);
        ctx.beginPath();
        ctx.ellipse(x, y, 12 + hash * 10, 8 + hash * 6, hash, 0, TWO_PI);
        ctx.fill();
      }
    }

    // Veren
    for (const feather of this.feathers) {
      this.drawFeather(ctx, feather);
    }

    // Vogel, met de kop naar beneden
    const lean = clamp(this.vx / 1400, -0.45, 0.45);
    ctx.save();
    ctx.translate(this.x, this.birdY);
    ctx.rotate(Math.PI / 2 - lean);
    ctx.scale(1.08, 0.92);
    drawBirdBody(ctx, birdId, {
      open: 0.08,
      flapOsc: 0,
      lookY: 2,
      time: this.time,
      diving: true,
      turbo: this.combo >= 5
    });
    ctx.restore();

    // Vonkjes
    for (const s of this.sparkles) {
      const life = 1 - s.age / s.life;
      ctx.globalAlpha = Math.max(0, life);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * life + 1, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.drawHud(ctx);
  }

  drawFeather(ctx, feather) {
    ctx.save();
    ctx.translate(feather.x, feather.y);
    ctx.rotate(feather.rot);
    if (feather.gold) {
      ctx.fillStyle = 'rgba(255, 220, 90, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, TWO_PI);
      ctx.fill();
    }
    const size = feather.gold ? 30 : 25;
    ctx.fillStyle = feather.gold ? '#ffcf33' : '#ffffff';
    ctx.strokeStyle = feather.gold ? '#c98a00' : '#5b9bd5';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.38, 0, 0, TWO_PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = feather.gold ? '#f0a500' : '#a9d3f5';
    ctx.beginPath();
    ctx.ellipse(size * 0.25, 0, size * 0.6, size * 0.2, 0, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = feather.gold ? '#a86f00' : '#7aa5c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-size * 1.25, 0);
    ctx.lineTo(size * 0.95, 0);
    ctx.stroke();
    ctx.restore();
  }

  drawText(ctx, text, x, y, size, color) {
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(4, size / 7);
    ctx.strokeStyle = 'rgba(120, 60, 0, 0.6)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  drawHud(ctx) {
    const W = this.viewWidth;
    const H = this.height;
    const g = CONFIG.goldenDive;
    const cx = W / 2;

    if (this.phase === 'intro') {
      const pop = Math.min(1, this.phaseTime / 0.3);
      this.drawText(ctx, 'Gouden Duik!', cx, H * 0.55, Math.round(70 * (0.6 + 0.4 * pop)), '#ffd23f');
      this.drawText(ctx, 'Houd je vinger op het scherm: de vogel volgt je vinger', cx, H * 0.55 + 70, 26, '#ffffff');
      return;
    }

    if (this.phase === 'diving') {
      // Tijdbalk
      const barW = Math.min(420, W * 0.5);
      const fraction = this.timeLeft / g.duration;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.roundRect(ctx, cx - barW / 2, 22, barW, 16, 8);
      ctx.fill();
      ctx.fillStyle = fraction < 0.25 ? '#ff7a2f' : '#ffb020';
      this.roundRect(ctx, cx - barW / 2, 22, Math.max(16, barW * fraction), 16, 8);
      ctx.fill();

      this.drawText(ctx, `+${this.bonus}`, cx, 76, 44, '#ffffff');
      if (this.combo >= 3) {
        this.drawText(ctx, `${this.combo}x achter elkaar!`, cx, 120, 24, '#fff3c4');
      }
      return;
    }

    // Outro
    this.drawText(ctx, `+${this.bonus} veren!`, cx, H * 0.6, 64, '#ffd23f');
  }

  roundRect(ctx, x, y, w, h, r) {
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
