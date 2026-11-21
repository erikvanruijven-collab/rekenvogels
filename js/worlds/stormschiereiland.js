// =====================================================================
// Wereld 2 — Stormachtig Schiereiland (tafels 3, 4, 6)
// ---------------------------------------------------------------------
// Eigen regels (Stap 3b):
//  - Regen en onweer op de achtergrond (sfeer, geen invloed op het spel)
//  - Windvlagen: duwen de vogel even omhoog of omlaag. Je ziet ze
//    0,8 s van tevoren aankomen ("Windvlaag ↑"), zodat je kunt bijsturen.
//  - Onweerswolken: ALLE drie de ringen hangen in grijze wolken (zo
//    verraden de wolken het goede antwoord niet). Vlieg je door een
//    foute ring, dan wordt die wolk zwart en krijgt de vogel een
//    komische schok: bliksem, roet, "kuch kuch" en hoogteverlies.
//
// De renderer tekent de wolken om de ringen (ringStyle 'storm') en het
// roet op de vogel; deze module doet regen, onweer en windvlagen.
// =====================================================================

import { CONFIG, WORLD_PRESETS } from '../config.js';
import { makeBoltPoints, drawBolt } from '../fx.js';

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

class StormEffects {
  constructor({ physics, renderer, audio }) {
    this.physics = physics;
    this.renderer = renderer;
    this.audio = audio;
    this.time = 0;
    this.flash = 0;
    this.skyBolts = [];
    this.lightningTimer = randomBetween(2.5, 4);
    this.gust = { state: 'idle', timer: randomBetween(3, 5), dir: 0, t: 0 };
    this.gustLines = [];
    this.pendingCough = -1;

    const W = renderer.viewWidth;
    const H = CONFIG.world.logicalHeight;
    this.drops = [];
    for (let i = 0; i < CONFIG.storm.rainDrops; i += 1) {
      this.drops.push({
        x: Math.random() * (W + 200),
        y: Math.random() * H,
        length: 14 + Math.random() * 14,
        speed: 650 + Math.random() * 350
      });
    }

    audio.setRain(true);
  }

  /** Opruimen als de vlucht stopt. */
  dispose() {
    this.physics.gustForce = 0;
    this.audio.setRain(false);
  }

  update(dt) {
    const st = CONFIG.storm;
    const W = this.renderer.viewWidth;
    const H = CONFIG.world.logicalHeight;
    const bird = this.physics.bird;
    this.time += dt;

    // ---------- Regen ----------
    for (const drop of this.drops) {
      drop.y += drop.speed * dt;
      drop.x -= (drop.speed * 0.3 + bird.speed * 0.5) * dt;
      if (drop.y > H + 20 || drop.x < -40) {
        drop.y = -20 - Math.random() * 60;
        drop.x = Math.random() * (W + 200);
      }
    }

    // ---------- Onweer in de verte ----------
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      const x = randomBetween(W * 0.15, W * 0.9);
      this.skyBolts.push({
        points: makeBoltPoints(x, -10, x + randomBetween(-80, 80), H * randomBetween(0.45, 0.6), 30),
        age: 0,
        life: 0.35
      });
      this.flash = Math.max(this.flash, 0.45);
      this.audio.playThunder(randomBetween(0.3, 0.8));
      this.lightningTimer = randomBetween(st.lightningMin, st.lightningMax);
    }
    for (const bolt of this.skyBolts) bolt.age += dt;
    this.skyBolts = this.skyBolts.filter((bolt) => bolt.age < bolt.life);
    this.flash *= Math.exp(-dt * 6);

    // ---------- Windvlagen ----------
    const gust = this.gust;
    if (gust.state === 'idle') {
      gust.timer -= dt;
      if (gust.timer <= 0) {
        // Nooit de grond in of tegen het plafond aan blazen
        if (bird.y > H * 0.62) gust.dir = -1;
        else if (bird.y < H * 0.3) gust.dir = 1;
        else gust.dir = Math.random() < 0.5 ? -1 : 1;
        gust.state = 'warn';
        gust.t = 0;
        this.renderer.floatText(
          gust.dir < 0 ? 'Windvlaag ↑' : 'Windvlaag ↓',
          bird.x + 60,
          bird.y + (gust.dir < 0 ? 60 : -60),
          '#e3ecf7',
          26
        );
        this.audio.playGust();
      }
    } else if (gust.state === 'warn') {
      gust.t += dt;
      if (gust.t >= st.gustWarning) {
        gust.state = 'blow';
        gust.t = 0;
      }
    } else if (gust.state === 'blow') {
      gust.t += dt;
      const envelope = Math.sin(Math.PI * Math.min(1, gust.t / st.gustDuration));
      this.physics.gustForce = gust.dir * st.gustForce * envelope;
      if (gust.t >= st.gustDuration) {
        this.physics.gustForce = 0;
        gust.state = 'idle';
        gust.timer = randomBetween(st.gustIntervalMin, st.gustIntervalMax);
      }
    }

    // Windstrepen tijdens waarschuwing en vlaag
    if (gust.state !== 'idle' && Math.random() < dt * 30) {
      this.gustLines.push({
        x: W + 20,
        y: randomBetween(H * 0.1, H * 0.85),
        length: randomBetween(80, 180),
        age: 0
      });
    }
    for (const line of this.gustLines) {
      line.x -= (bird.speed * 1.8 + 500) * dt;
      line.y += gust.dir * 160 * dt;
      line.age += dt;
    }
    this.gustLines = this.gustLines.filter((line) => line.x + line.length > -20 && line.age < 2);

    // ---------- Hoestje na een schok ----------
    if (this.pendingCough >= 0) {
      this.pendingCough -= dt;
      if (this.pendingCough < 0) {
        this.audio.playCough();
        this.renderer.floatText('Kuch! Kuch!', bird.x + 10, bird.y - 50, '#d8dde6', 30);
      }
    }
  }

  /**
   * Fout antwoord: zwarte wolk, bliksem naar de vogel, roet en hoogteverlies.
   * @returns {boolean} true = de standaard "fout"-effecten overslaan
   */
  onWrongAnswer(event) {
    const bird = this.physics.bird;
    if (event.chosenSlot >= 0) {
      this.renderer.addBolt(makeBoltPoints(event.x, event.y - 70, bird.x, bird.y, 14));
    }
    this.physics.applyShock();
    this.renderer.addShake(11);
    this.flash = Math.max(this.flash, 0.6);
    this.audio.playZap();
    this.pendingCough = 0.45;
    return true;
  }

  /** Achter de bergen: bliksem in de verte. */
  drawSky(ctx) {
    for (const bolt of this.skyBolts) {
      drawBolt(ctx, bolt.points, 1 - bolt.age / bolt.life);
    }
  }

  /** Voor alles (behalve de HUD): regen, windstrepen en de flits. */
  drawFront(ctx, W, H) {
    // Regen
    ctx.strokeStyle = 'rgba(205, 218, 236, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const drop of this.drops) {
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - drop.length * 0.35, drop.y + drop.length);
    }
    ctx.stroke();

    // Windstrepen (licht gebogen in de richting van de vlaag)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 3;
    for (const line of this.gustLines) {
      ctx.globalAlpha = Math.max(0, 1 - line.age / 2);
      ctx.beginPath();
      ctx.moveTo(line.x, line.y);
      ctx.quadraticCurveTo(
        line.x + line.length * 0.5, line.y - this.gust.dir * 14,
        line.x + line.length, line.y - this.gust.dir * 30
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Flits over het hele scherm
    if (this.flash > 0.02) {
      ctx.fillStyle = `rgba(235, 240, 255, ${this.flash * 0.45})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
  }
}

export const stormschiereiland = {
  id: 'stormschiereiland',
  number: 2,
  name: 'Stormachtig Schiereiland',
  icon: '⛈️',
  tables: [3, 4, 6],
  colors: WORLD_PRESETS.stormschiereiland,
  darkCard: true,
  ringStyle: 'storm',
  intro: 'Pas op voor windvlagen en onweerswolken!',
  createEffects: (context) => new StormEffects(context)
};
