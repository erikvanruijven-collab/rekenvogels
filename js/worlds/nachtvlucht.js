// =====================================================================
// Wereld 3 — De Nachtvlucht (tafels 7, 8, 9)
// ---------------------------------------------------------------------
// Eigen regels (Stap 3c):
//  - Omgekeerde sommen: bovenin staat de uitkomst ("? × ? = 56"), in de
//    ringen staan sommen ("7 × 8", "6 × 9", "7 × 7"). De foute sommen
//    hebben nooit dezelfde uitkomst (zie makeReverseDistractors in math.js).
//  - Het is donker: een sterrenhemel, vuurvliegjes en een koplampje op
//    de vogel dat een lichtbundel vooruit werpt.
//  - Leesbaarheid gaat voor sfeer: de getallen/sommen in de ringen worden
//    BOVEN het donker getekend en zijn dus altijd goed te lezen.
// =====================================================================

import { CONFIG, WORLD_PRESETS } from '../config.js';
import { lampPosition } from '../birds.js';

const TWO_PI = Math.PI * 2;

class NightEffects {
  constructor({ physics, renderer }) {
    this.physics = physics;
    this.renderer = renderer;
    this.time = 0;
    this.headlamp = true;      // renderer tekent het lampje op de vogel
    this.labelsOnTop = true;   // renderer tekent de ring-teksten boven het donker

    const n = CONFIG.night;
    const H = CONFIG.world.logicalHeight;

    // Sterren: vaste plekken die heel langzaam meeschuiven
    this.starWrap = 2400;
    this.stars = [];
    for (let i = 0; i < n.stars; i += 1) {
      this.stars.push({
        x: Math.random() * this.starWrap,
        y: Math.random() * H * 0.62,
        r: 0.8 + Math.random() * 1.8,
        phase: Math.random() * TWO_PI,
        speed: 1 + Math.random() * 2.5
      });
    }

    // Vuurvliegjes
    this.fireflies = [];
    for (let i = 0; i < n.fireflies; i += 1) {
      this.fireflies.push(this.makeFirefly(Math.random() * (renderer.viewWidth + 200)));
    }

    // Klein canvas voor het donker (half zo groot: sneller, en de randen worden mooi zacht)
    this.darkCanvas = document.createElement('canvas');
    this.darkCtx = this.darkCanvas.getContext('2d');
  }

  makeFirefly(x) {
    const H = CONFIG.world.logicalHeight;
    return {
      x,
      y: H * (0.3 + Math.random() * 0.55),
      phase: Math.random() * TWO_PI,
      drift: 0.4 + Math.random() * 0.4
    };
  }

  dispose() {}

  update(dt) {
    this.time += dt;
    const bird = this.physics.bird;
    for (const fly of this.fireflies) {
      fly.x -= bird.speed * fly.drift * dt;
      fly.y += Math.sin(this.time * 1.7 + fly.phase) * 18 * dt;
      if (fly.x < -40) Object.assign(fly, this.makeFirefly(this.renderer.viewWidth + 40 + Math.random() * 200));
    }
  }

  /** Positie en richting van het koplampje in het speelveld. */
  lampInWorld() {
    const bird = this.physics.bird;
    const local = lampPosition(this.renderer.birdId);
    const cos = Math.cos(bird.angle);
    const sin = Math.sin(bird.angle);
    return {
      x: bird.x + cos * local.x - sin * local.y,
      y: bird.y + sin * local.x + cos * local.y,
      angle: bird.angle
    };
  }

  /** Sterrenhemel (achter de wolken en bergen). */
  drawSky(ctx, W) {
    const offset = this.physics.distance * 0.02;
    ctx.fillStyle = '#ffffff';
    for (const star of this.stars) {
      let x = (star.x - offset) % this.starWrap;
      if (x < 0) x += this.starWrap;
      if (x > W + 10) continue;
      ctx.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * star.speed + star.phase));
      ctx.beginPath();
      ctx.arc(x, star.y, star.r, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Het donker, met een gat voor de lichtbundel en een gloed rond de vogel. */
  drawFront(ctx, W, H) {
    const n = CONFIG.night;
    const k = 0.5;
    const canvas = this.darkCanvas;
    const width = Math.ceil(W * k);
    const height = Math.ceil(H * k);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const d = this.darkCtx;
    d.setTransform(k, 0, 0, k, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    d.fillStyle = `rgba(4, 6, 24, ${n.darkness})`;
    d.fillRect(0, 0, W, H);

    // Licht "uitgummen"
    d.globalCompositeOperation = 'destination-out';
    const bird = this.physics.bird;

    // Zachte gloed rond de vogel
    const halo = d.createRadialGradient(bird.x, bird.y, 10, bird.x, bird.y, n.haloRadius);
    halo.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    d.fillStyle = halo;
    d.beginPath();
    d.arc(bird.x, bird.y, n.haloRadius, 0, TWO_PI);
    d.fill();

    // Lichtbundel van het koplampje
    const lamp = this.lampInWorld();
    d.save();
    d.translate(lamp.x, lamp.y);
    d.rotate(lamp.angle);
    const beam = d.createRadialGradient(0, 0, 8, 0, 0, n.beamLength);
    beam.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    beam.addColorStop(0.65, 'rgba(0, 0, 0, 0.7)');
    beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
    d.fillStyle = beam;
    d.beginPath();
    d.moveTo(0, 0);
    d.arc(0, 0, n.beamLength, -n.beamSpread, n.beamSpread);
    d.closePath();
    d.fill();
    d.restore();

    // Kleine lichtvlekjes rond de vuurvliegjes
    for (const fly of this.fireflies) {
      const glow = d.createRadialGradient(fly.x, fly.y, 0, fly.x, fly.y, 34);
      glow.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      d.fillStyle = glow;
      d.beginPath();
      d.arc(fly.x, fly.y, 34, 0, TWO_PI);
      d.fill();
    }
    d.globalCompositeOperation = 'source-over';

    ctx.drawImage(canvas, 0, 0, width, height, 0, 0, W, H);

    // Warme gloed in de lichtbundel
    ctx.save();
    ctx.translate(lamp.x, lamp.y);
    ctx.rotate(lamp.angle);
    const warm = ctx.createRadialGradient(0, 0, 4, 0, 0, n.beamLength * 0.8);
    warm.addColorStop(0, 'rgba(255, 240, 170, 0.22)');
    warm.addColorStop(1, 'rgba(255, 240, 170, 0)');
    ctx.fillStyle = warm;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, n.beamLength * 0.8, -n.beamSpread * 0.9, n.beamSpread * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Vuurvliegjes boven alles (ze geven zelf licht). */
  drawOverlay(ctx) {
    for (const fly of this.fireflies) {
      const blink = 0.4 + 0.6 * Math.max(0, Math.sin(this.time * 2.4 + fly.phase));
      ctx.fillStyle = `rgba(220, 255, 140, ${0.25 * blink})`;
      ctx.beginPath();
      ctx.arc(fly.x, fly.y, 9, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = `rgba(240, 255, 190, ${0.9 * blink})`;
      ctx.beginPath();
      ctx.arc(fly.x, fly.y, 3, 0, TWO_PI);
      ctx.fill();
    }
  }
}

export const nachtvlucht = {
  id: 'nachtvlucht',
  number: 3,
  name: 'De Nachtvlucht',
  icon: '🌙',
  tables: [7, 8, 9],
  colors: WORLD_PRESETS.nachtvlucht,
  darkCard: true,
  questionMode: 'reverse',
  intro: 'Bovenin staat de uitkomst: vlieg door de goede som!',
  createEffects: (context) => new NightEffects(context)
};
