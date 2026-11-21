// =====================================================================
// Wereld 4 — De Meeuwen-race (tafels 11, 12 & mix)
// ---------------------------------------------------------------------
// Eigen regels (Stap 3d):
//  - Karel de Kapitein-Meeuw vliegt mee (op de achtergrond, achter de
//    ringen) en roept flauwe opmerkingen in tekstballonnetjes.
//  - "Voorsprong" in vleugellengtes: snel goed = windstoot (+1,5),
//    goed = +0,25, traag = -0,5, fout = -1. Wie na 20 sommen voor ligt,
//    wint. 8 vleugellengtes of meer = een straatlengte!
//  - Een racebalk rechtsboven laat zien wie er voor ligt.
//  - Sommen: helft uit de tafels van 11 en 12, helft een mix van álle
//    tafels waarin haperende sommen extra vaak langskomen (math.js).
// =====================================================================

import { CONFIG, WORLD_PRESETS } from '../config.js';
import { drawWing, drawBirdBody } from '../birds.js';

const TWO_PI = Math.PI * 2;
const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

// ---------------------------------------------------------------------
// Karels uitspraken (vriendelijk plagerig, nooit gemeen)
// ---------------------------------------------------------------------
const LINES = {
  start: [
    'Ahoi! Kapitein Karel gaat altijd vóór!',
    'Klaar voor de race, matroos? Ik wel!'
  ],
  ahead: [
    'Ahoi, slakkenvogel!',
    'Zit er lijm aan je veren?',
    'Was dat een som of een gok?',
    'Ha! Ik vlieg op één vleugel nog sneller!',
    'Ik ruik vis... en winst!',
    'Matroos, je loopt achter!',
    'Volgens mijn kompas ben ik de snelste!',
    'Zelfs mijn pet is sneller dan jij!',
    'Kraaa! Ik zie je in mijn achteruitkijkspiegel!',
    'Even wachten hoor, ik moet zo lachen!',
    'Tafels zijn net golven: je moet ze leren rijden!'
  ],
  behind: [
    'Hé! Niet zo snel!',
    'Wacht even, mijn pet waait af!',
    'Dat was geluk, matroos!',
    'Huh? Waar kwam die windstoot vandaan?',
    'Ik liet je expres winnen... denk ik.',
    'Kraaa! Mijn veren zitten in de war!',
    'Oké, oké, jij kunt rekenen.',
    'Nu ga ik écht mijn best doen!',
    'Wie heeft jou zo leren vliegen?!',
    'Help, een raket met veren!'
  ],
  idle: [
    'Wist je dat meeuwen nooit verdwalen? Behalve ik, soms.',
    'Ik ben kapitein van de lucht én van de patatkraam.',
    '11 × 3 = 33. Zie je het trucje?',
    'Zeewind in mijn veren, heerlijk!',
    'Ik heb ooit een vis van een boot gepikt. Spannend!',
    'Nog even en daar is de finish!'
  ],
  won: 'Kraaa... jij wint. Volgende keer ben ik er klaar voor!',
  street: 'WAAAT?! Een straatlengte?! Ik ga met pensioen!',
  lost: 'Hahaha! Kapitein Karel wint weer! Nog een rondje?'
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------
// Karel tekenen (lokale coördinaten, snavel naar rechts)
// ---------------------------------------------------------------------
export function drawKarel(ctx, flapOsc, time) {
  const grey = '#c4ccd7';
  const darkGrey = '#7d8795';
  const black = '#2a2d34';

  // Achterste vleugel: grijs met zwarte punt
  ctx.save();
  ctx.translate(2, -7);
  const backRot = 1.0 + flapOsc * 0.8;
  drawWing(ctx, 54, 13, backRot, black, black);
  drawWing(ctx, 42, 13, backRot, '#aeb7c3', darkGrey);
  ctx.restore();

  // Staart
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-22, -6);
  ctx.lineTo(-44, -10);
  ctx.lineTo(-42, 4);
  ctx.lineTo(-22, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = black;
  ctx.fillRect(-45, -9, 5, 12);

  // Lijf en kop
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 17, 0, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = '#eef2f6';
  ctx.beginPath();
  ctx.ellipse(4, 7, 20, 9, 0, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(22, -10, 13, 0, TWO_PI);
  ctx.fill();

  // Gele snavel met rood vlekje
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(32, -13);
  ctx.quadraticCurveTo(44, -12, 51, -8);
  ctx.quadraticCurveTo(48, -4, 33, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.arc(45, -6.5, 2, 0, TWO_PI);
  ctx.fill();

  // Eigenwijs oog met wenkbrauw
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(26, -12, 4.2, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = '#1b1b2f';
  ctx.beginPath();
  ctx.arc(27.5, -12, 2.2, 0, TWO_PI);
  ctx.fill();
  ctx.strokeStyle = black;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(21, -18 + Math.sin(time * 3) * 0.8);
  ctx.lineTo(31, -16);
  ctx.stroke();

  // Kapiteinspet: witte bol, zwarte klep, gouden anker-embleem
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#9aa3af';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(18, -24, 15, 6.5, -0.12, 0, TWO_PI);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = black;
  ctx.fillRect(9, -22, 19, 5);
  ctx.beginPath();
  ctx.ellipse(30, -17.5, 8, 2.6, 0.15, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(19, -20, 2.6, 0, TWO_PI);
  ctx.fill();

  // Voorste vleugel
  ctx.save();
  ctx.translate(0, -3);
  const frontRot = 1.15 + flapOsc;
  drawWing(ctx, 58, 14, frontRot, black, black);
  drawWing(ctx, 45, 14, frontRot, grey, darkGrey);
  ctx.restore();
}

// ---------------------------------------------------------------------
// De race
// ---------------------------------------------------------------------
class RaceEffects {
  constructor({ physics, renderer, audio }) {
    this.physics = physics;
    this.renderer = renderer;
    this.audio = audio;
    this.time = 0;
    this.lead = 0;            // voorsprong in vleugellengtes (+ = jij voor)
    this.shownLead = 0;       // vloeiend meebewegende versie voor het beeld
    this.answered = 0;
    this.bubble = null;
    this.idleTimer = randomBetween(CONFIG.race.idleMin, CONFIG.race.idleMax);
    this.karelY = CONFIG.world.logicalHeight * 0.35;
    this.startDelay = 2.8;    // eerst de wereldtitel, dan pas Karel aan het woord
  }

  dispose() {}

  /** Karel zegt iets (met of zonder krijs-geluid). */
  say(text, squawk = true) {
    this.bubble = { text, age: 0, life: CONFIG.race.bubbleTime };
    this.idleTimer = randomBetween(CONFIG.race.idleMin, CONFIG.race.idleMax);
    if (squawk) this.audio.playSquawk();
  }

  update(dt) {
    this.time += dt;
    this.shownLead += (this.lead - this.shownLead) * Math.min(1, dt * 2.5);
    const H = CONFIG.world.logicalHeight;
    // Eigen vliegbaan tussen de bovenste en middelste ring (achter de ringen langs)
    this.karelY = H * (0.35 + 0.05 * Math.sin(this.time * 0.45)) + Math.sin(this.time * 2.1) * 5;

    if (this.startDelay > 0) {
      this.startDelay -= dt;
      if (this.startDelay <= 0) this.say(this.startLine || pick(LINES.start), true);
      return;
    }

    if (this.bubble) {
      this.bubble.age += dt;
      if (this.bubble.age > this.bubble.life) this.bubble = null;
    } else {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) this.say(pick(LINES.idle), false);
    }
  }

  /** Vliegende start met een jetpack (atelier): voorsprong vanaf het begin. */
  giveHeadStart(lengths) {
    this.lead += lengths;
    // Karel reageert pas na de wereldtitel (zie update)
    this.startLine = lengths >= 3
      ? 'WAT?! Een MEGA-jetpack?! Dat is niet eerlijk!'
      : 'Hé! Een jetpack? Wacht maar, ik haal je wel in!';
  }

  /** Na elk antwoord: voorsprong aanpassen en Karel laten reageren. */
  onAnswer(result) {
    const r = CONFIG.race;
    let delta;
    if (result.nearMiss) delta = 0;   // net mis: wist het wel, Karel loopt niet uit
    else if (result.correct && result.fast) delta = r.fastGain;
    else if (result.correct && result.slow) delta = r.slowLoss;
    else if (result.correct) delta = r.correctGain;
    else delta = r.wrongLoss;

    this.lead += delta;
    this.answered += 1;

    const bird = this.physics.bird;
    if (result.correct && result.fast) {
      this.renderer.floatText('Windstoot!', bird.x + 70, bird.y + 40, '#e8f6ff', 26);
    }

    const last = this.answered >= CONFIG.math.roundLength;
    if (last) {
      const summary = this.summary();
      this.say(summary.street ? LINES.street : summary.won ? LINES.won : LINES.lost, true);
      return;
    }

    // Niet na elk antwoord praten, anders wordt het te druk
    if (delta < 0 && Math.random() < 0.7) this.say(pick(LINES.ahead), true);
    else if (delta >= r.fastGain && Math.random() < 0.45) this.say(pick(LINES.behind), true);
  }

  /** Uitslag voor het eindscherm en de badges. */
  summary() {
    return {
      lead: Math.round(this.lead * 10) / 10,
      won: this.lead > 0,
      street: this.lead >= CONFIG.race.streetLength
    };
  }

  /** Karels plek op het scherm: voor of achter de vogel, afhankelijk van de voorsprong. */
  karelX() {
    const bird = this.physics.bird;
    const x = bird.x + CONFIG.race.karelStartOffset - this.shownLead * CONFIG.race.pxPerLength;
    return Math.max(50, Math.min(this.renderer.viewWidth - 70, x));
  }

  /** Karel op de achtergrond (achter de ringen en de vogel). */
  drawBehind(ctx) {
    const x = this.karelX();
    const flap = Math.sin(this.time * 9) * 0.7;
    ctx.save();
    ctx.translate(x, this.karelY);
    ctx.rotate(Math.sin(this.time * 1.3) * 0.06);
    ctx.scale(0.85, 0.85);   // iets kleiner: hij vliegt een stukje verderop
    drawKarel(ctx, flap, this.time);
    ctx.restore();
  }

  /** Tekstballon en racebalk (boven alles). */
  drawOverlay(ctx, W) {
    // ---------- Tekstballon ----------
    if (this.bubble) {
      const b = this.bubble;
      const fadeIn = Math.min(1, b.age / 0.15);
      const fadeOut = Math.min(1, (b.life - b.age) / 0.3);
      ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
      ctx.font = `bold 20px ${FONT}`;
      const lines = this.wrap(ctx, b.text, 240);
      const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 28;
      const height = lines.length * 24 + 18;
      const kx = this.karelX();
      const by = Math.max(124, this.karelY - 48 - height);   // nooit over de som-banner bovenin
      let bx = kx - width / 2 + 20;
      const minX = by < 150 ? 232 : 10;                        // niet over de veren-teller linksboven
      bx = Math.max(minX, Math.min(W - width - 10, bx));

      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.strokeStyle = '#2a3a55';
      ctx.lineWidth = 2.5;
      this.roundRect(ctx, bx, by, width, height, 14);
      ctx.fill();
      ctx.stroke();
      // staartje naar Karel
      ctx.beginPath();
      ctx.moveTo(kx + 8, by + height - 1);
      ctx.lineTo(kx + 22, by + height + 18);
      ctx.lineTo(kx + 28, by + height - 1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(kx + 8, by + height);
      ctx.lineTo(kx + 22, by + height + 18);
      ctx.lineTo(kx + 28, by + height);
      ctx.stroke();

      ctx.fillStyle = '#21324f';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      lines.forEach((line, i) => ctx.fillText(line, bx + 14, by + 21 + i * 24));
      ctx.globalAlpha = 1;
    }

    // ---------- Racebalk (rechtsboven, onder de knoppen) ----------
    const trackW = Math.min(300, W * 0.28);
    const x0 = W - trackW - 30;
    const y = 104;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.roundRect(ctx, x0 - 18, y - 26, trackW + 46, 52, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(42, 58, 85, 0.35)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y + 8);
    ctx.lineTo(x0 + trackW, y + 8);
    ctx.stroke();
    ctx.font = `22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏁', x0 + trackW + 6, y - 2);

    const base = Math.min(1, this.answered / CONFIG.math.roundLength);
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const playerPos = clamp(base * 0.88 + this.shownLead / 28);
    const karelPos = clamp(base * 0.88);

    ctx.save();
    ctx.translate(x0 + trackW * karelPos, y);
    ctx.scale(0.36, 0.36);
    drawKarel(ctx, Math.sin(this.time * 9) * 0.5, this.time);
    ctx.restore();

    ctx.save();
    ctx.translate(x0 + trackW * playerPos, y + 2);
    ctx.scale(0.4, 0.4);
    drawBirdBody(ctx, this.renderer.birdId, {
      open: 1, flapOsc: Math.sin(this.time * 8) * 0.5, lookY: 0, time: this.time, diving: false, turbo: false
    });
    ctx.restore();
  }

  /** Tekst over meerdere regels verdelen. */
  wrap(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
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

export const meeuwenrace = {
  id: 'meeuwenrace',
  number: 4,
  name: 'De Meeuwen-race',
  icon: '🏁',
  tables: [11, 12],
  tablesText: '11 · 12 + mix',
  mix: { share: 0.5, tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  colors: WORLD_PRESETS.meeuwenrace,
  darkCard: false,
  intro: 'Race tegen Karel! Snel goed = windstoot!',
  createEffects: (context) => new RaceEffects(context)
};
