// =====================================================================
// items.js — Het vogel-atelier: alle spullen die je kunt kopen
// ---------------------------------------------------------------------
// Vier "plekken" (slots); per plek kan de vogel één ding aanhebben:
//   hat    — piratenhoed, ridderhelm, kroon
//   trail  — regenboogspoor
//   turbo  — scheetwolkje bij elke Turbo-thermiek
//   start  — jetpack, turbo-jetpack, megaturbo-jetpack (vliegende start)
//
// De jetpacks waren een idee van de speler zelf! Ze geven een
// vliegende start (en in de Meeuwen-race een voorsprong op Karel).
// De bedenktijd voor de sommen verandert er niet door: de eerste som
// komt pas als de lancering voorbij is.
//
// Deze module tekent ook de uitrusting op de vogel.
// =====================================================================

import { drawBirdBody, DEFAULT_BIRD } from './birds.js';

const TWO_PI = Math.PI * 2;

export const ITEMS = [
  { id: 'pirate',  slot: 'hat',   icon: '🏴‍☠️', name: 'Piratenhoed',       price: 60,  description: 'Arrr! Een echte piratenhoed met doodshoofd.' },
  { id: 'knight',  slot: 'hat',   icon: '🛡️', name: 'Ridderhelm',        price: 120, description: 'Glanzende helm met een rode pluim.' },
  { id: 'crown',   slot: 'hat',   icon: '👑', name: 'Kroon',             price: 250, description: 'Voor de koning(in) van de tafels.' },
  { id: 'rainbow', slot: 'trail', icon: '🌈', name: 'Regenboogspoor',    price: 100, description: 'Je vogel laat een regenboog achter in de lucht.' },
  { id: 'fart',    slot: 'turbo', icon: '💨', name: 'Scheetwolkje',      price: 50,  description: 'Pfrrt! Een groen wolkje bij elke Turbo-thermiek.' },
  { id: 'jetpack', slot: 'start', icon: '🚀', name: 'Jetpack',           price: 80,  tier: 1, description: 'Vliegende start! In de race: 1 vleugellengte voorsprong.' },
  { id: 'turbojet', slot: 'start', icon: '🔥', name: 'Turbo-jetpack',    price: 200, tier: 2, requires: 'jetpack',  description: 'Nog snellere start! In de race: 2 vleugellengtes voorsprong.' },
  { id: 'megajet', slot: 'start', icon: '⚡', name: 'Megaturbo-jetpack', price: 400, tier: 3, requires: 'turbojet', description: 'MEGA-lancering met sterren! In de race: 3 vleugellengtes voorsprong.' }
];

export const SLOTS = ['hat', 'trail', 'turbo', 'start'];

export function getItem(id) {
  return ITEMS.find((item) => item.id === id) || null;
}

/** Waar hoed en rugzak zitten, per vogel (lokale coördinaten). */
const ANCHORS = {
  valk:    { hat: { x: 22, y: -22, tilt: -0.12 }, back: { x: -14, y: -14 } },
  dodo:    { hat: { x: 18, y: -30, tilt: -0.1 },  back: { x: -14, y: -18 } },
  pinguin: { hat: { x: 21, y: -24, tilt: -0.1 },  back: null }   // de pinguïn heeft al een jetpack
};

function anchorsFor(birdId) {
  return ANCHORS[birdId] || ANCHORS[DEFAULT_BIRD];
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------
// Hoeden
// ---------------------------------------------------------------------
function drawPirateHat(ctx) {
  // zwarte steek met omhoog gekrulde rand
  ctx.fillStyle = '#1f1f26';
  ctx.beginPath();
  ctx.moveTo(-20, 2);
  ctx.quadraticCurveTo(-16, -8, -9, -12);
  ctx.quadraticCurveTo(0, -24, 10, -12);
  ctx.quadraticCurveTo(17, -8, 21, 2);
  ctx.quadraticCurveTo(0, -4, -20, 2);
  ctx.closePath();
  ctx.fill();
  // gouden randje
  ctx.strokeStyle = '#d4a72c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-19, 1);
  ctx.quadraticCurveTo(0, -5, 20, 1);
  ctx.stroke();
  // doodshoofdje
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -10, 3.6, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = '#1f1f26';
  ctx.beginPath();
  ctx.arc(-1.3, -10.5, 0.9, 0, TWO_PI);
  ctx.arc(1.3, -10.5, 0.9, 0, TWO_PI);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-4, -4.5);
  ctx.lineTo(4, -7.5);
  ctx.moveTo(-4, -7.5);
  ctx.lineTo(4, -4.5);
  ctx.stroke();
}

function drawKnightHelmet(ctx, time) {
  // rode pluim
  const sway = Math.sin(time * 6) * 2;
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.moveTo(-2, -16);
  ctx.quadraticCurveTo(-14 + sway, -30, -26 + sway, -22);
  ctx.quadraticCurveTo(-16 + sway, -22, -6, -12);
  ctx.closePath();
  ctx.fill();
  // helm
  ctx.fillStyle = '#b8c2cf';
  ctx.beginPath();
  ctx.arc(0, 0, 15.5, Math.PI, TWO_PI);
  ctx.lineTo(15.5, 4);
  ctx.lineTo(-15.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8eef5';
  ctx.beginPath();
  ctx.ellipse(-4, -9, 5, 3, -0.4, 0, TWO_PI);
  ctx.fill();
  // vizier met spleetjes
  ctx.fillStyle = '#7d8795';
  ctx.fillRect(-15.5, -2, 31, 6);
  ctx.fillStyle = '#2b2f36';
  for (const x of [2, 7, 12]) ctx.fillRect(x, -1, 3, 4);
  ctx.strokeStyle = '#6b7482';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(0, -2);
  ctx.stroke();
}

function drawCrown(ctx, time) {
  ctx.fillStyle = '#ffcf33';
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-14, 2);
  ctx.lineTo(-15, -12);
  ctx.lineTo(-8, -5);
  ctx.lineTo(-3, -16);
  ctx.lineTo(2, -5);
  ctx.lineTo(8, -14);
  ctx.lineTo(12, -4);
  ctx.lineTo(16, -11);
  ctx.lineTo(15, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [x, y, color] of [[-8, -1, '#e63946'], [1, -1, '#3a86ff'], [10, -1, '#2a9d8f']]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, TWO_PI);
    ctx.fill();
  }
  // twinkeling
  const twinkle = 0.5 + 0.5 * Math.sin(time * 5);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * twinkle})`;
  ctx.beginPath();
  ctx.arc(-3, -14, 1.8, 0, TWO_PI);
  ctx.fill();
}

function drawHat(ctx, birdId, hatId, time) {
  const anchor = anchorsFor(birdId).hat;
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.rotate(anchor.tilt);
  if (hatId === 'pirate') drawPirateHat(ctx);
  else if (hatId === 'knight') drawKnightHelmet(ctx, time);
  else if (hatId === 'crown') drawCrown(ctx, time);
  ctx.restore();
}

// ---------------------------------------------------------------------
// Jetpacks (drie niveaus)
// ---------------------------------------------------------------------
const JETPACK_STYLE = {
  1: { body: '#9aa5b1', stripe: '#e04f4f' },
  2: { body: '#ff8c2e', stripe: '#ffd23f' },
  3: { body: '#7b4dff', stripe: '#ffe14d' }
};

function drawFlame(ctx, x, y, length, tier, time) {
  const flicker = 0.8 + Math.sin(time * 40 + x) * 0.15 + Math.random() * 0.1;
  const len = length * flicker;
  const outer = tier === 3 ? `hsla(${(time * 400) % 360}, 95%, 60%, 0.85)` : 'rgba(255, 140, 30, 0.85)';
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.quadraticCurveTo(x - len * 0.6, y - 7, x - len, y);
  ctx.quadraticCurveTo(x - len * 0.6, y + 7, x, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 240, 140, 0.95)';
  ctx.beginPath();
  ctx.moveTo(x, y - 2.5);
  ctx.quadraticCurveTo(x - len * 0.35, y - 3, x - len * 0.55, y);
  ctx.quadraticCurveTo(x - len * 0.35, y + 3, x, y + 2.5);
  ctx.closePath();
  ctx.fill();
}

function drawJetpack(ctx, birdId, tier, pose) {
  const back = anchorsFor(birdId).back;
  if (!back) return;
  const style = JETPACK_STYLE[tier] || JETPACK_STYLE[1];
  ctx.save();
  ctx.translate(back.x, back.y);
  ctx.rotate(-0.25);

  if (pose.turbo) {
    const length = 16 + tier * 10 + (pose.diving ? 8 : 0);
    drawFlame(ctx, -16, -6, length, tier, pose.time);
    drawFlame(ctx, -16, 6, length, tier, pose.time + 0.3);
  }

  ctx.fillStyle = '#5b6470';
  ctx.fillRect(-19, -10, 6, 7);
  ctx.fillRect(-19, 3, 6, 7);
  ctx.fillStyle = style.body;
  roundedRect(ctx, -14, -15, 22, 30, 7);
  ctx.fill();
  ctx.fillStyle = style.stripe;
  ctx.fillRect(-14, -3, 22, 5);
  if (tier === 3) {
    // bliksemschichtje
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(-2, -13);
    ctx.lineTo(-7, -4);
    ctx.lineTo(-3, -4);
    ctx.lineTo(-6, 6);
    ctx.lineTo(2, -6);
    ctx.lineTo(-2, -6);
    ctx.closePath();
    ctx.fill();
  } else if (tier === 2) {
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(-3, 9, 3, 0, TWO_PI);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------
// Vogel + uitrusting in één keer
// ---------------------------------------------------------------------

/**
 * Tekent de vogel met alle aangetrokken spullen.
 * @param {object} equipment  { hat, trail, turbo, start } (ids of null)
 */
export function drawBirdWithGear(ctx, birdId, pose, equipment) {
  const startItem = equipment && equipment.start ? getItem(equipment.start) : null;
  let bodyPose = pose;
  if (startItem) {
    if (anchorsFor(birdId).back) {
      drawJetpack(ctx, birdId, startItem.tier, pose);
    } else {
      // De pinguïn heeft al een jetpack: die krijgt de kleur van het gekochte niveau
      bodyPose = { ...pose, packColor: (JETPACK_STYLE[startItem.tier] || JETPACK_STYLE[1]).body };
    }
  }
  drawBirdBody(ctx, birdId, bodyPose);
  if (equipment && equipment.hat) drawHat(ctx, birdId, equipment.hat, pose.time);
}

/**
 * Passpiegel / startscherm: fladderende vogel met uitrusting.
 * @param {boolean} spin  laat de vogel langzaam ronddraaien (passpiegel)
 */
export function drawGearPreview(canvas, birdId, time, equipment, spin = false) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const scale = Math.min(width / 150, height / 110);
  const cx = width * 0.55;
  const cy = height * 0.55 + Math.sin(time * 2.2) * 3 * scale;

  // Regenboogspoor achter de vogel
  if (equipment && equipment.trail === 'rainbow') {
    const colors = ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
    colors.forEach((color, i) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.2 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k <= 20; k += 1) {
        const x = cx - 20 * scale - k * 4.5 * scale;
        const y = cy + (i - 2.5) * 3.3 * scale + Math.sin(time * 3 - k * 0.35) * 5 * scale;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  // Scheetwolkje: af en toe een groen pufje
  if (equipment && equipment.turbo === 'fart') {
    const phase = (time * 0.6) % 1;
    if (phase < 0.6) {
      const t = phase / 0.6;
      ctx.fillStyle = `rgba(150, 195, 90, ${0.55 * (1 - t)})`;
      for (const [dx, dy, r] of [[0, 0, 10], [-9, -5, 8], [-6, 7, 7]]) {
        ctx.beginPath();
        ctx.arc(cx - (38 + t * 30) * scale + dx * scale, cy + 8 * scale + dy * scale, r * scale * (0.7 + t), 0, TWO_PI);
        ctx.fill();
      }
    }
  }

  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (spin) {
    // Passpiegel: de vogel draait langzaam rond (smal = van opzij gezien)
    const turn = Math.cos(time * 1.1);
    ctx.scale((turn >= 0 ? 1 : -1) * Math.max(0.25, Math.abs(turn)), 1);
  }
  ctx.rotate(Math.sin(time * 1.6) * 0.06);

  const startItem = equipment && equipment.start ? getItem(equipment.start) : null;
  drawBirdWithGear(ctx, birdId, {
    open: 1,
    flapOsc: Math.sin(time * 7) * 0.7,
    lookY: Math.sin(time * 1.3) * 1.2,
    time,
    diving: false,
    turbo: Boolean(startItem) && (time % 2.4) < 1.2   // jetpack-vlammen even aan, even uit
  }, equipment);
}

