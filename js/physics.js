// =====================================================================
// physics.js — Vliegfysica (Tiny Wings-achtige energie-overdracht)
//              en de ringkolommen
// ---------------------------------------------------------------------
// Idee:  INGEDRUKT  -> vleugels in, extra zwaartekracht, valsnelheid
//                      wordt omgezet in voorwaartse snelheid.
//        KORTE TIK  -> fladderen: een flinke vleugelslag omhoog.
//        LOSGELATEN -> vleugels uit, lift groeit met snelheid²; stijgen
//                      kost weer snelheid. Zo "betaal" je hoogte met
//                      de energie die je in de duik hebt opgebouwd.
//
// Ringkolommen (Stap 2): een kolom van 3 ringen "drijft" eerst rustig
// op de wind aan (zodat er tijd is om te rekenen) en komt op het laatst
// op volle snelheid langs. Hoe sneller de vogel vliegt, hoe sneller de
// ringen er zijn — duiken versnelt dus ook het spel.
//
// Daarnaast houdt deze module bij op welke hoogte ("baan" 0/1/2) de
// vogel vliegt en wanneer hij voor die baan koos. Dat is de reactietijd.
//
// Deze module tekent niets en speelt geen geluid af. Ze geeft bij elke
// update een lijst "events" terug waar main.js op reageert.
// =====================================================================

import { CONFIG } from './config.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Hoogte van de voorste heuvels op wereldpositie x.
 * Wordt ook door de renderer gebruikt, zodat beeld en botsing kloppen.
 */
export function groundY(worldX, height) {
  return height * 0.9
    + Math.sin(worldX * 0.0042) * 26
    + Math.sin(worldX * 0.0113 + 1.3) * 11;
}

export class FlightPhysics {
  constructor() {
    this.height = CONFIG.world.logicalHeight;
    this.viewWidth = 1280;
    this.wantDive = false;
    this.pressTime = 0;
    this.reset();
  }

  /** Zet vogel, ringen en afgelegde afstand terug naar de start. */
  reset() {
    const p = CONFIG.physics;
    this.distance = 0;           // afgelegde wereldafstand (voor parallax en heuvels)
    this.time = 0;
    this.bird = {
      x: this.viewWidth * CONFIG.world.birdScreenX,
      y: this.height * CONFIG.rings.rows[1],
      vy: 0,
      speed: p.baseSpeed,
      diving: false,
      angle: 0,
      wingOpen: 1,               // 0 = ingevouwen, 1 = gespreid
      flapTime: 0,               // hoe lang de klap-animatie nog duurt
      flapPhase: 0,
      onGround: false,
      boostTime: 0,              // zolang > 0 remt de snelheid niet af
      turboTime: 0,              // zolang > 0 brandt het vuurspoor
      wobble: 0,                 // schudden na een fout antwoord
      soot: 0,                   // roet op de vogel na een onweersschok (s)
      launchTime: 0,             // vliegende start met jetpack: zolang > 0 stuurt de jetpack
      radius: p.birdRadius
    };
    this.columns = [];
    this.columnId = 0;
    this.gustForce = 0;          // windvlaag van de wereld (px/s², + = omlaag)

    // Baan-detectie (0 = boven, 1 = midden, 2 = onder)
    this.lane = 1;
    this.candidateLane = 1;
    this.candidateSince = 0;     // kolom-leeftijd waarop de vogel de kandidaat-baan binnenvloog
    this.candidateDwell = 0;
  }

  setViewWidth(width) {
    this.viewWidth = width;
    this.bird.x = width * CONFIG.world.birdScreenX;
  }

  setDiving(isPressed) {
    this.wantDive = isPressed;
  }

  /** Snelheid als veelvoud van de basissnelheid (1 = normaal). */
  get speedFactor() {
    return this.bird.speed / CONFIG.physics.baseSpeed;
  }

  /** Is er nog een kolom onderweg die nog niet gepasseerd is? */
  get hasActiveColumn() {
    return this.columns.some((column) => !column.passed);
  }

  get activeColumn() {
    return this.columns.find((column) => !column.passed) || null;
  }

  /** Effect: Turbo-thermiek (snel én goed antwoord). */
  applyTurbo() {
    const m = CONFIG.math;
    const b = this.bird;
    b.speed += m.turboBoost;
    b.boostTime = m.turboDuration;
    b.turboTime = m.turboDuration;
    b.vy = Math.min(b.vy, 0) - 120;
  }

  /**
   * Vliegende start met een jetpack (atelier): de vogel raast van laag
   * naar boven met extra snelheid en vlammen.
   */
  applyLaunch(launch) {
    const b = this.bird;
    b.y = this.height * 0.72;
    b.vy = -launch.rise;
    b.speed += launch.boost;
    b.boostTime = launch.duration;
    b.turboTime = launch.duration;
    b.launchTime = launch.duration;
    b.flapTime = 0;
  }

  /** Effect: de wind zakt weg (te lang getwijfeld). */
  applyWindDrop() {
    const m = CONFIG.math;
    const p = CONFIG.physics;
    const b = this.bird;
    b.speed = Math.max(p.baseSpeed * p.minSpeedFactor, b.speed * m.windDropFactor);
    b.boostTime = 0;
    b.turboTime = 0;
    b.vy += m.windDropSink;
  }

  /** Effect: onweersschok (Stormachtig Schiereiland, fout antwoord). */
  applyShock() {
    const st = CONFIG.storm;
    const b = this.bird;
    b.vy = Math.max(b.vy, 0) + st.shockSink;
    b.speed *= st.shockSpeedFactor;
    b.boostTime = 0;
    b.turboTime = 0;
    b.soot = st.sootTime;
    b.wobble = 0.6;
  }

  /** Effect: klein schuddertje bij een fout antwoord. */
  applyWrongWobble() {
    this.bird.wobble = 0.6;
    this.bird.vy += 60;
  }

  /**
   * Maakt een kolom van 3 ringen met antwoorden.
   * @param {Array<string|number>} labels  tekst op de ringen (boven, midden, onder)
   * @param {number} correctSlot           welke ring het goede antwoord heeft
   */
  spawnQuestionColumn(labels, correctSlot) {
    const rc = CONFIG.rings;
    const p = CONFIG.physics;
    const b = this.bird;
    this.columnId += 1;

    const spawnX = this.viewWidth + rc.radius * 1.5;
    // Bereken hoe langzaam de ringen moeten aandrijven zodat ze bij
    // basissnelheid na precies "questionWindow" seconden bij de vogel zijn.
    const fullSpeedDistance = rc.finalApproach + rc.blendZone * 0.5;
    const driftDistance = Math.max(50, spawnX - b.x - fullSpeedDistance);
    const driftTime = Math.max(0.5, CONFIG.math.questionWindow - fullSpeedDistance / p.baseSpeed);
    const drift = clamp(driftDistance / (p.baseSpeed * driftTime), 0.12, 1);

    const column = {
      id: this.columnId,
      x: spawnX,
      drift,
      age: 0,
      passed: false,
      correctSlot,
      chosenSlot: -1,
      laneEnterAge: 0,           // wanneer koos de vogel zijn (huidige) baan
      rings: rc.rows.map((row, slot) => ({
        slot,
        y: this.height * row,
        r: rc.radius,
        label: String(labels[slot]),
        state: 'idle',           // idle | correct | wrong | reveal | faded
        stateAge: 0
      }))
    };

    // Kandidaat-baan opnieuw "starten" voor deze kolom
    this.candidateLane = this.lane;
    this.candidateSince = 0;
    this.candidateDwell = CONFIG.math.laneDwell;

    this.columns.push(column);
    return column;
  }

  /** Verwijdert alle ringen (bijv. bij einde van een vlucht). */
  clearColumns() {
    this.columns = [];
  }

  /**
   * Eén stap van de simulatie.
   * @param {number} dt  tijd in seconden sinds het vorige frame
   * @returns {Array<object>} events
   */
  update(dt) {
    const events = [];
    const p = CONFIG.physics;
    const b = this.bird;
    const base = p.baseSpeed;
    this.time += dt;

    // ---------- Overgang duiken <-> zweven ----------
    if (this.wantDive && !b.diving) {
      b.diving = true;
      this.pressTime = 0;
      events.push({ type: 'diveStart' });
    } else if (!this.wantDive && b.diving) {
      b.diving = false;
      b.flapTime = 0.45;
      b.vy -= p.flapImpulse;
      // Korte tik = flinke vleugelslag omhoog (fladderen)
      const tap = this.pressTime < p.tapMaxDuration;
      if (tap) {
        b.vy = Math.min(b.vy, 0) - p.tapFlapImpulse;
        b.flapTime = 0.55;
      }
      events.push({ type: 'release', speedFactor: b.speed / base, tap });
    }
    if (b.diving) this.pressTime += dt;

    // ---------- Krachten ----------
    if (b.launchTime > 0) {
      // Vliegende start: de jetpack houdt de vogel netjes in het midden
      // terwijl de wereld voorbij raast. Daarna weer gewone snelheid.
      b.launchTime -= dt;
      const targetY = this.height * CONFIG.rings.rows[1];
      b.vy += ((targetY - b.y) * 14 - b.vy * 6) * dt;
      if (b.launchTime <= 0) {
        b.speed = Math.min(b.speed, base * 1.15);
        b.boostTime = 0;
      }
    } else if (b.diving) {
      b.vy += (p.gravity + p.diveForce) * dt;
      if (b.vy > 0) b.speed += p.diveGain * b.vy * dt;
      b.speed += p.diveAccel * dt;
      b.vy *= Math.max(0, 1 - p.diveDamping * dt);
    } else {
      const sf = b.speed / base;
      let lift = p.glideLift * Math.min(sf * sf, p.liftMaxFactor);
      const thinAir = clamp((b.y - p.ceilingY) / p.thinAirBand, 0, 1);
      lift *= thinAir;
      b.vy += (p.gravity - lift) * dt;

      if (b.vy < 0) {
        b.speed -= p.climbCost * (-b.vy) * dt;
      } else {
        b.speed += p.glideFallGain * b.vy * dt;
      }
      b.vy *= Math.max(0, 1 - p.glideDamping * dt);
    }

    if (b.boostTime > 0) {
      b.boostTime -= dt;
    } else {
      b.speed += (base - b.speed) * p.speedDrag * dt;
    }
    b.turboTime = Math.max(0, b.turboTime - dt);
    b.wobble = Math.max(0, b.wobble - dt);
    b.soot = Math.max(0, b.soot - dt);

    // Windvlaag (alleen in werelden met wind)
    if (this.gustForce !== 0) b.vy += this.gustForce * dt;

    b.speed = clamp(b.speed, base * p.minSpeedFactor, base * p.maxSpeedFactor);
    b.vy = clamp(b.vy, -p.maxRiseSpeed, p.maxFallSpeed);

    // ---------- Beweging ----------
    b.y += b.vy * dt;
    this.distance += b.speed * dt;

    if (b.y < p.hardCeilingY) {
      b.y = p.hardCeilingY;
      if (b.vy < 0) b.vy = 0;
    }

    // ---------- Grond ----------
    const floor = groundY(this.distance + b.x, this.height) - b.radius * 0.8;
    if (b.y > floor) {
      b.y = floor;
      const impact = b.vy;
      if (impact > 250) {
        events.push({ type: 'ground', strength: Math.min(1, impact / 1000), x: b.x, y: b.y + b.radius * 0.6 });
        b.vy = -impact * p.groundBounce;
      } else if (b.vy > 0) {
        b.vy = 0;
      }
      b.speed -= p.groundDrag * dt;
      b.onGround = true;
    } else {
      b.onGround = false;
    }

    // ---------- Animatiewaarden ----------
    const wingTarget = b.diving ? 0 : 1;
    b.wingOpen += (wingTarget - b.wingOpen) * Math.min(1, dt * (b.diving ? 14 : 9));
    b.flapTime = Math.max(0, b.flapTime - dt);
    b.flapPhase += dt * (b.flapTime > 0 ? 26 : 3);

    const targetAngle = clamp(Math.atan2(b.vy, b.speed), -0.85, 1.25);
    b.angle += (targetAngle - b.angle) * Math.min(1, dt * 8);

    // ---------- Baan en ringen ----------
    this.updateLane(dt);
    this.updateColumns(dt, events);

    return events;
  }

  /** Bepaalt op welke baan de vogel vliegt, met een korte "blijf-tijd". */
  updateLane(dt) {
    const rows = CONFIG.rings.rows;
    const b = this.bird;
    let nearest = 0;
    let bestDistance = Infinity;
    rows.forEach((row, index) => {
      const distance = Math.abs(b.y - this.height * row);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = index;
      }
    });

    const column = this.activeColumn;
    const age = column ? column.age : 0;

    if (nearest !== this.candidateLane) {
      this.candidateLane = nearest;
      this.candidateSince = age;
      this.candidateDwell = 0;
    } else {
      this.candidateDwell += dt;
    }

    if (this.candidateLane !== this.lane && this.candidateDwell >= CONFIG.math.laneDwell) {
      this.lane = this.candidateLane;
      if (column) column.laneEnterAge = this.candidateSince;
    }
  }

  updateColumns(dt, events) {
    const b = this.bird;
    const rc = CONFIG.rings;

    for (const column of this.columns) {
      const previousX = column.x;
      const distanceToBird = column.x - b.x;

      // Eerst rustig aandrijven, daarna op volle snelheid
      let factor = 1;
      if (distanceToBird > rc.finalApproach + rc.blendZone) {
        factor = column.drift;
      } else if (distanceToBird > rc.finalApproach) {
        const t = (distanceToBird - rc.finalApproach) / rc.blendZone;
        factor = 1 + (column.drift - 1) * t;
      }

      column.x -= b.speed * factor * dt;
      column.age += dt;
      for (const ring of column.rings) ring.stateAge += dt;

      // Langs de vogel gevlogen?
      if (!column.passed && previousX >= b.x && column.x < b.x) {
        column.passed = true;

        let chosen = -1;
        let closest = Infinity;
        for (const ring of column.rings) {
          const dy = Math.abs(b.y - ring.y);
          if (dy < ring.r * rc.hitTolerance && dy < closest) {
            closest = dy;
            chosen = ring.slot;
          }
        }
        column.chosenSlot = chosen;

        // Reactietijd = moment waarop de vogel koos voor de baan waar hij doorheen vloog
        let reactionTime = column.age;
        if (chosen === this.lane) {
          reactionTime = column.laneEnterAge;
        } else if (chosen === this.candidateLane) {
          reactionTime = this.candidateSince;
        }

        events.push({
          type: 'columnPassed',
          columnId: column.id,
          chosenSlot: chosen,
          correctSlot: column.correctSlot,
          reactionTime,
          x: b.x,
          y: chosen >= 0 ? column.rings[chosen].y : b.y
        });
      }
    }

    this.columns = this.columns.filter((column) => column.x > -rc.radius * 3);
  }

  /** Markeert ringen na een antwoord (voor de kleuren in de renderer). */
  markColumn(columnId, chosenSlot, correctSlot) {
    const column = this.columns.find((c) => c.id === columnId);
    if (!column) return;
    for (const ring of column.rings) {
      ring.stateAge = 0;
      if (ring.slot === chosenSlot) {
        ring.state = chosenSlot === correctSlot ? 'correct' : 'wrong';
      } else if (ring.slot === correctSlot) {
        ring.state = 'reveal';
      } else {
        ring.state = 'faded';
      }
    }
  }
}
