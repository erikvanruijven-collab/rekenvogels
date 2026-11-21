// =====================================================================
// birds.js — De drie speelbare vogels
// ---------------------------------------------------------------------
//  - Slechtvalk         strak en snel-ogend
//  - Dodo met vliegbril klunzig, mini-vleugeltjes die als een gek klapperen
//  - Pinguïn met jetpack vlammetjes uit de jetpack, rood sjaaltje
//
// Alle vogels zijn even groot en vliegen precies hetzelfde: het verschil
// is alleen hoe ze eruitzien. Zo is geen enkele vogel "beter".
//
// Elke vogel tekent zichzelf in lokale coördinaten: (0,0) is het midden
// van het lijf, de snavel wijst naar rechts (+x). De renderer zorgt voor
// positie, draaihoek en schudden; birds.js alleen voor het uiterlijk.
//
// "pose" bevat:
//   open      0..1   vleugels ingevouwen (0) of gespreid (1)
//   flapOsc   -1..1  huidige stand van de vleugelslag
//   lookY     -2..2  oog kijkt mee omhoog/omlaag
//   time      s      lopende tijd (voor wiebelen en vlammetjes)
//   diving    bool   duikt de vogel?
//   turbo     bool   Turbo-thermiek actief?
// =====================================================================

const TWO_PI = Math.PI * 2;

/** Eén vleugel, in lokale coördinaten wijzend naar achteren (-x). */
export function drawWing(ctx, length, width, rotation, fill, edge) {
  ctx.save();
  ctx.rotate(rotation);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(4, -2);
  ctx.quadraticCurveTo(-length * 0.45, -width * 1.1, -length, -width * 0.25);
  ctx.lineTo(-length * 0.86, width * 0.12);
  ctx.lineTo(-length * 0.72, width * 0.05);
  ctx.lineTo(-length * 0.6, width * 0.32);
  ctx.lineTo(-length * 0.46, width * 0.2);
  ctx.quadraticCurveTo(-length * 0.2, width * 0.55, 4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** Afgeronde rechthoek (eigen versie, werkt ook op oudere iPads). */
function roundedRect(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TWO_PI);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, rotation, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TWO_PI);
  ctx.fill();
}

/** Een tekenfilm-oog met glimlichtje. */
function drawEye(ctx, x, y, size, lookY, ringColor) {
  if (ringColor) circle(ctx, x, y, size + 1.6, ringColor);
  circle(ctx, x, y, size, '#ffffff');
  circle(ctx, x + size * 0.32, y + lookY * (size / 4.6), size * 0.55, '#1b1b2f');
  circle(ctx, x + size * 0.5, y - size * 0.3 + lookY * 0.3, size * 0.2, '#ffffff');
}

/** Vliegbril met messing rand (zelfde stijl als de vogel uit Stap 1). */
function drawGoggles(ctx, x, y, lookY) {
  ctx.fillStyle = 'rgba(170, 225, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, TWO_PI);
  ctx.fill();

  circle(ctx, x + 1, y, 4.6, '#ffffff');
  circle(ctx, x + 2.5, y + lookY, 2.4, '#1b1b2f');

  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, TWO_PI);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, 5, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
}

// ---------------------------------------------------------------------
// 1. Slechtvalk
// ---------------------------------------------------------------------
function drawFalcon(ctx, pose) {
  const { open, flapOsc, lookY } = pose;
  const back = '#4f5d6e';
  const body = '#5d6f84';
  const dark = '#2f3946';
  const cream = '#f3e6cf';

  // Achterste vleugel (lang en spits)
  ctx.save();
  ctx.translate(2, -8);
  drawWing(ctx, 28 + 32 * open, 10 + 3 * open, 0.1 + open * (1.0 + flapOsc * 0.8), back, dark);
  ctx.restore();

  // Staart: smal en lang
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.moveTo(-22, -5);
  ctx.lineTo(-52, -9);
  ctx.lineTo(-54, -2);
  ctx.lineTo(-52, 5);
  ctx.lineTo(-22, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 35, 45, 0.45)';
  ctx.lineWidth = 2;
  for (const tx of [-34, -42]) {
    ctx.beginPath();
    ctx.moveTo(tx, -6);
    ctx.lineTo(tx, 5);
    ctx.stroke();
  }

  // Lijf (gestroomlijnd)
  ellipse(ctx, 0, 0, 32, 18, 0, body);

  // Lichte borst met streepjes
  ellipse(ctx, 6, 6, 22, 11, 0.05, cream);
  ctx.strokeStyle = 'rgba(90, 70, 50, 0.5)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (const [sx, sy] of [[-4, 6], [3, 4], [10, 6], [0, 11], [7, 12], [14, 10]]) {
    ctx.beginPath();
    ctx.moveTo(sx - 2.5, sy);
    ctx.lineTo(sx + 2.5, sy + 0.8);
    ctx.stroke();
  }

  // Kop met donkere kap
  circle(ctx, 24, -8, 15, '#3f4b5a');
  ellipse(ctx, 29, -1, 8, 6, 0, cream);         // witte wang
  ellipse(ctx, 26, 0, 3, 7, 0.25, dark);         // "snor"-streep

  // Snavel: geel neusje + donkere haaksnavel
  ctx.fillStyle = '#3a3f47';
  ctx.beginPath();
  ctx.moveTo(36, -13);
  ctx.quadraticCurveTo(46, -12, 47, -7);
  ctx.quadraticCurveTo(47, -3, 44, -2);
  ctx.quadraticCurveTo(44, -5, 41, -5);
  ctx.lineTo(36, -4);
  ctx.closePath();
  ctx.fill();
  circle(ctx, 36.5, -9, 3.2, '#ffcb3d');

  // Oog met gele ring
  drawEye(ctx, 29, -12, 4.4, lookY, '#ffd23f');

  // Voorste vleugel
  ctx.save();
  ctx.translate(0, -4);
  drawWing(ctx, 30 + 32 * open, 11 + 4 * open, 0.12 + open * (1.2 + flapOsc), '#6f8196', dark);
  ctx.restore();
}

// ---------------------------------------------------------------------
// 2. Dodo met vliegbril
// ---------------------------------------------------------------------
function drawDodo(ctx, pose) {
  const { open, flapOsc, lookY, time } = pose;
  const body = '#9c8b7b';
  const dark = '#6b5c4d';
  const bob = Math.sin(time * 9) * 1.5;            // klunzig gewiebel
  const frantic = Math.sin(time * 24) * 0.35 * open; // mini-vleugels klapperen als een gek

  ctx.save();
  ctx.translate(0, bob);

  // Achterste mini-vleugel
  ctx.save();
  ctx.translate(-2, -10);
  drawWing(ctx, 14 + 10 * open, 9, 0.2 + open * (1.1 + flapOsc * 1.2 + frantic), '#857464', dark);
  ctx.restore();

  // Krullerige witte staartpluim
  for (const [px, py, r] of [[-30, -10, 7], [-37, -4, 6.5], [-32, 3, 6]]) {
    circle(ctx, px, py, r, '#fbf7ee');
  }
  ctx.strokeStyle = 'rgba(120, 100, 80, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-37, -4, 3, 0, Math.PI * 1.5);
  ctx.stroke();

  // Pootjes bungelen
  ctx.strokeStyle = '#e0a030';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  const dangle = Math.sin(time * 7) * 3;
  for (const fx of [-6, 6]) {
    ctx.beginPath();
    ctx.moveTo(fx, 22);
    ctx.lineTo(fx - 6, 32 + dangle);
    ctx.lineTo(fx - 1, 34 + dangle);
    ctx.stroke();
  }

  // Dik rond lijf
  ellipse(ctx, 0, 2, 32, 26, 0, body);
  ellipse(ctx, 6, 10, 20, 15, 0, '#c9b9a3');

  // Kop
  circle(ctx, 22, -14, 15, body);

  // Grote haaksnavel
  ctx.fillStyle = '#e9d8a6';
  ctx.beginPath();
  ctx.moveTo(31, -21);
  ctx.quadraticCurveTo(50, -22, 56, -12);
  ctx.quadraticCurveTo(57, -5, 52, -3);
  ctx.quadraticCurveTo(50, -8, 46, -8);
  ctx.quadraticCurveTo(38, -4, 31, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b5651d';
  ctx.beginPath();
  ctx.moveTo(50, -17);
  ctx.quadraticCurveTo(56, -15, 56, -11);
  ctx.quadraticCurveTo(57, -5, 52, -3);
  ctx.quadraticCurveTo(51, -9, 48, -11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 90, 40, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(33, -12);
  ctx.quadraticCurveTo(42, -11, 47, -10);
  ctx.stroke();

  // Leren vliegmuts met oorklep
  ctx.fillStyle = '#8b5a2b';
  ctx.beginPath();
  ctx.arc(21, -16, 15.5, Math.PI * 1.02, Math.PI * 1.98);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, 9, -12, 5, 8, 0.3, '#a8703a');

  // Brilband + vliegbril
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(8, -19);
  ctx.lineTo(22, -21);
  ctx.stroke();
  drawGoggles(ctx, 27, -19, lookY);

  // Blosje
  circle(ctx, 26, -7, 3.5, 'rgba(255, 120, 140, 0.4)');

  // Voorste mini-vleugel
  ctx.save();
  ctx.translate(2, -4);
  drawWing(ctx, 16 + 12 * open, 10, 0.25 + open * (1.25 + flapOsc * 1.2 - frantic), '#b3a290', dark);
  ctx.restore();

  ctx.restore();
}

// ---------------------------------------------------------------------
// 3. Pinguïn met jetpack
// ---------------------------------------------------------------------
function drawJetFlame(ctx, x, y, length, time) {
  const flicker = 0.8 + Math.sin(time * 40 + x) * 0.15 + Math.random() * 0.1;
  const len = length * flicker;
  ctx.fillStyle = 'rgba(255, 140, 30, 0.85)';
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.quadraticCurveTo(x - len * 0.6, y - 6, x - len, y);
  ctx.quadraticCurveTo(x - len * 0.6, y + 6, x, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 235, 120, 0.95)';
  ctx.beginPath();
  ctx.moveTo(x, y - 2.5);
  ctx.quadraticCurveTo(x - len * 0.35, y - 3, x - len * 0.55, y);
  ctx.quadraticCurveTo(x - len * 0.35, y + 3, x, y + 2.5);
  ctx.closePath();
  ctx.fill();
}

function drawPenguin(ctx, pose) {
  const { open, flapOsc, lookY, time, diving, turbo } = pose;
  const black = '#23262e';

  // Vlammen uit de jetpack: groter bij duiken en turbo
  const flameLength = 12 + (diving ? 14 : 0) + (turbo ? 22 : 0);
  drawJetFlame(ctx, -38, -14, flameLength, time);
  drawJetFlame(ctx, -38, 2, flameLength, time + 0.37);

  // Jetpack (op de rug, achter het lijf)
  roundedRect(ctx, -38, -24, 22, 34, 7, pose.packColor || '#9aa5b1');   // kleur = gekochte jetpack (atelier)
  roundedRect(ctx, -35, -21, 7, 28, 3, '#c3ccd6');
  circle(ctx, -24, -16, 2.6, '#e04f4f');
  ctx.fillStyle = '#6b7682';
  ctx.fillRect(-41, -18, 5, 8);
  ctx.fillRect(-41, -2, 5, 8);

  // Achterste flipper
  ctx.save();
  ctx.translate(0, -6);
  drawWing(ctx, 16 + 12 * open, 8, 0.15 + open * (1.0 + flapOsc * 0.8), '#15171c', '#000000');
  ctx.restore();

  // Oranje voetjes
  ctx.fillStyle = '#ff9a2e';
  for (const fx of [-10, 0]) {
    ctx.beginPath();
    ctx.moveTo(fx, 18);
    ctx.lineTo(fx - 12, 22);
    ctx.lineTo(fx - 1, 25);
    ctx.closePath();
    ctx.fill();
  }

  // Wapperende punt van het sjaaltje (achter het lijf, boven de rug)
  const wave = Math.sin(time * 14) * 3;
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.moveTo(12, -2);
  ctx.quadraticCurveTo(0, -20 + wave * 0.5, -16, -30 + wave * 1.4);
  ctx.lineTo(-12, -23 + wave * 1.4);
  ctx.quadraticCurveTo(2, -14 + wave * 0.5, 14, 4);
  ctx.closePath();
  ctx.fill();

  // Lijf + witte buik
  ellipse(ctx, 0, 0, 30, 22, 0, black);
  ellipse(ctx, 8, 6, 20, 14, 0.05, '#ffffff');

  // Riem van de jetpack
  ctx.strokeStyle = '#5b6470';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, -18);
  ctx.quadraticCurveTo(4, -4, -2, 18);
  ctx.stroke();

  // Kop
  circle(ctx, 22, -10, 15, black);
  ellipse(ctx, 27, -6, 9, 8, 0, '#ffffff');      // wit gezichtje
  ellipse(ctx, 18, 2, 6, 3.5, 0.3, '#ffc94d');   // geel halsvlekje

  // Rood sjaaltje om de nek
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.ellipse(16, 3, 9, 4, 0.2, 0, TWO_PI);
  ctx.fill();

  // Snavel
  ctx.fillStyle = '#ff9a2e';
  ctx.beginPath();
  ctx.moveTo(35, -12);
  ctx.quadraticCurveTo(44, -11, 48, -8);
  ctx.quadraticCurveTo(44, -5, 35, -5);
  ctx.closePath();
  ctx.fill();

  // Oog
  drawEye(ctx, 29, -12, 4.2, lookY, null);

  // Voorste flipper
  ctx.save();
  ctx.translate(2, -2);
  drawWing(ctx, 18 + 14 * open, 9, 0.18 + open * (1.15 + flapOsc), '#2e323b', '#000000');
  ctx.restore();
}

// ---------------------------------------------------------------------
// Overzicht
// ---------------------------------------------------------------------
export const BIRDS = {
  valk: {
    id: 'valk',
    name: 'Slechtvalk',
    description: 'Strak en razendsnel',
    lamp: { x: 26, y: -24 },     // plek van het koplampje (De Nachtvlucht)
    draw: drawFalcon
  },
  dodo: {
    id: 'dodo',
    name: 'Dodo',
    description: 'Klunzig, met vliegbril',
    lamp: { x: 20, y: -31 },
    draw: drawDodo
  },
  pinguin: {
    id: 'pinguin',
    name: 'Pinguïn',
    description: 'Vliegt op een jetpack',
    lamp: { x: 25, y: -26 },
    draw: drawPenguin
  }
};

export const BIRD_ORDER = ['valk', 'dodo', 'pinguin'];
export const DEFAULT_BIRD = 'valk';

/** Waar het koplampje zit (lokale coördinaten van de vogel). */
export function lampPosition(birdId) {
  const bird = BIRDS[birdId] || BIRDS[DEFAULT_BIRD];
  return bird.lamp;
}

/** Koplampje met hoofdband (De Nachtvlucht). */
export function drawHeadlamp(ctx, birdId) {
  const { x, y } = lampPosition(birdId);
  // hoofdband
  ctx.strokeStyle = '#3b3f4a';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(x - 6, y + 12, 13, Math.PI * 1.15, Math.PI * 1.9);
  ctx.stroke();
  // lampje
  ctx.fillStyle = '#4a4f5c';
  ctx.beginPath();
  ctx.ellipse(x, y, 6, 5, 0, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = '#fff6b0';
  ctx.beginPath();
  ctx.ellipse(x + 3, y, 3, 3.6, 0, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 246, 176, 0.35)';
  ctx.beginPath();
  ctx.arc(x + 4, y, 8, 0, TWO_PI);
  ctx.fill();
}

/** Tekent het lijf van de gekozen vogel (positie en hoek regelt de aanroeper). */
export function drawBirdBody(ctx, birdId, pose) {
  const bird = BIRDS[birdId] || BIRDS[DEFAULT_BIRD];
  bird.draw(ctx, pose);
}

/**
 * Tekent een fladderende vogel op een klein canvas (keuzescherm, startscherm).
 * @param {HTMLCanvasElement} canvas
 * @param {string} birdId
 * @param {number} time   seconden
 */
export function drawBirdPreview(canvas, birdId, time) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const scale = Math.min(width / 130, height / 95);
  ctx.translate(width * 0.5, height * 0.52 + Math.sin(time * 2.2) * 3 * scale);
  ctx.scale(scale, scale);
  ctx.rotate(Math.sin(time * 1.6) * 0.06);

  drawBirdBody(ctx, birdId, {
    open: 1,
    flapOsc: Math.sin(time * 7) * 0.7,
    lookY: Math.sin(time * 1.3) * 1.2,
    time,
    diving: false,
    turbo: false
  });
}
