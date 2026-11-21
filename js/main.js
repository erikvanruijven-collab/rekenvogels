// =====================================================================
// main.js — Gameloop, invoer, tuning-paneel en toestandsbeheer
// ---------------------------------------------------------------------
// Toestanden:  'start'    -> demovlucht op de achtergrond, startscherm
//              'playing'  -> een vlucht van 20 sommen
//              'roundEnd' -> eindscherm met resultaten
// Invoer:      pointerdown / pointerup (muis én touch), spatiebalk op
//              de Surface als extra testknop.
// =====================================================================

import {
  CONFIG,
  TUNING_PARAMS,
  WORLD_PRESETS,
  ACTIVE_WORLD,
  loadTuning,
  saveTuning,
  resetTuning,
  tuningAsText,
  getTuningValue,
  setTuningValue
} from './config.js';
import { FlightPhysics } from './physics.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './renderer.js';
import { MathEngine } from './math.js';

// ---------------------------------------------------------------------
// Opzetten
// ---------------------------------------------------------------------
loadTuning();

const canvas = document.getElementById('game');
const startOverlay = document.getElementById('startOverlay');
const startFeathers = document.getElementById('startFeathers');
const roundOverlay = document.getElementById('roundOverlay');
const againButton = document.getElementById('againBtn');
const muteButton = document.getElementById('muteBtn');
const tuneButton = document.getElementById('tuneBtn');
const tunePanel = document.getElementById('tunePanel');
const tuneSliders = document.getElementById('tuneSliders');
const tuneValues = document.getElementById('tuneValues');
const tuneResetButton = document.getElementById('tuneReset');
const tuneCloseButton = document.getElementById('tuneClose');

const world = WORLD_PRESETS[ACTIVE_WORLD];
const physics = new FlightPhysics();
const audio = new AudioEngine();
const renderer = new Renderer(canvas, world);
const math = new MathEngine();

const game = {
  state: 'start',
  playTime: 0,
  lastFrame: performance.now(),
  question: null,          // de som die nu in de lucht hangt
  columnId: -1,            // bijbehorende ringkolom
  feedback: null,          // resultaat van het laatste antwoord (voor de banner)
  feedbackTime: 0,
  nextQuestionTimer: 0,
  roundEndShownAt: 0
};

const activePointers = new Set();
let spaceDown = false;

function isPressed() {
  return activePointers.size > 0 || spaceDown;
}

// ---------------------------------------------------------------------
// Schermgrootte
// ---------------------------------------------------------------------
function handleResize() {
  const viewWidth = renderer.resize();
  physics.setViewWidth(viewWidth);
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => setTimeout(handleResize, 250));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', handleResize);
}
handleResize();

// ---------------------------------------------------------------------
// Volledig scherm + landscape (werkt op Android Chrome; iPad negeert
// het slot netjes, daar helpt de draai-melding in de CSS)
// ---------------------------------------------------------------------
function tryFullscreenLandscape() {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  const alreadyFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
  if (request && !alreadyFullscreen) {
    try {
      const result = request.call(root, { navigationUI: 'hide' });
      if (result && typeof result.then === 'function') {
        result.then(() => lockLandscape()).catch(() => {});
      }
    } catch (error) {
      // Niet ondersteund — geen probleem
    }
  } else {
    lockLandscape();
  }
}

function lockLandscape() {
  if (screen.orientation && typeof screen.orientation.lock === 'function') {
    screen.orientation.lock('landscape').catch(() => {});
  }
}

// ---------------------------------------------------------------------
// Toestanden
// ---------------------------------------------------------------------
function enterStartState() {
  game.state = 'start';
  physics.reset();
  physics.setViewWidth(renderer.viewWidth);
  startFeathers.textContent = String(math.totalFeathers);
  document.getElementById('versionLabel').textContent = `versie ${CONFIG.version}`;
  startOverlay.classList.remove('hidden');
  roundOverlay.classList.add('hidden');
}

function startGame() {
  audio.unlock();
  tryFullscreenLandscape();
  physics.reset();
  physics.setViewWidth(renderer.viewWidth);
  math.startRound(world.tables);
  game.question = null;
  game.columnId = -1;
  game.feedback = null;
  game.feedbackTime = 0;
  game.nextQuestionTimer = CONFIG.math.firstQuestionDelay;
  game.playTime = 0;
  game.state = 'playing';
  startOverlay.classList.add('hidden');
  roundOverlay.classList.add('hidden');
}

function formatSeconds(value) {
  return `${value.toFixed(1).replace('.', ',')} s`;
}

function endRound() {
  const summary = math.finishRound();
  game.state = 'roundEnd';
  game.question = null;
  game.roundEndShownAt = performance.now();
  activePointers.clear();
  physics.clearColumns();

  const ratio = summary.asked > 0 ? summary.correct / summary.asked : 0;
  let title = 'Goed gevlogen!';
  if (ratio === 1) title = 'Foutloos! Wauw!';
  else if (ratio >= 0.85) title = 'Super gevlogen!';
  else if (ratio < 0.5) title = 'Knap volgehouden!';

  document.getElementById('roundTitle').textContent = title;
  document.getElementById('roundScore').textContent = `${summary.correct} van de ${summary.asked} goed`;
  document.getElementById('statTurbo').textContent = String(summary.turbo);
  document.getElementById('statTime').textContent = summary.averageTime === null ? '–' : formatSeconds(summary.averageTime);
  document.getElementById('statStreak').textContent = String(summary.bestStreak);
  document.getElementById('statFeathers').textContent = `+${summary.feathers}`;

  const practice = document.getElementById('roundPractice');
  if (summary.practice.length > 0) {
    practice.textContent = `Nog even oefenen: ${summary.practice.slice(0, 6).join('   ·   ')}`;
    practice.classList.remove('hidden');
  } else {
    practice.classList.add('hidden');
  }

  roundOverlay.classList.remove('hidden');
  audio.silenceWind();
  audio.playFanfare();
}

// ---------------------------------------------------------------------
// Rekensommen
// ---------------------------------------------------------------------
function askNextQuestion() {
  const question = math.nextQuestion(physics.lane);
  const column = physics.spawnQuestionColumn(question.options, question.correctSlot);
  game.question = question;
  game.columnId = column.id;
  audio.playQuestion();
}

const PRAISE = ['Goed zo!', 'Top!', 'Netjes!', 'Klopt!', 'Lekker bezig!'];

function handleAnswer(event) {
  const question = game.question;
  if (!question || event.columnId !== game.columnId) return;

  const result = math.submitAnswer(question, event.chosenSlot, event.reactionTime);
  physics.markColumn(event.columnId, event.chosenSlot, event.correctSlot);
  const bird = physics.bird;

  let message = '';
  if (result.correct && result.fast) {
    physics.applyTurbo();
    renderer.burst(event.x, event.y);
    renderer.addShake(8);
    renderer.floatText(`+${result.feathers}`, bird.x, bird.y - 55, '#ffd23f', 42);
    audio.playTurbo();
    message = 'Turbo-thermiek!';
  } else if (result.correct) {
    renderer.sparkle(event.x, event.y);
    renderer.floatText(`+${result.feathers}`, bird.x, bird.y - 50, '#ffffff', 34);
    audio.playCorrect();
    message = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    if (result.slow) {
      physics.applyWindDrop();
      audio.playWindDrop();
      renderer.floatText('de wind zakt weg…', bird.x + 40, bird.y + 50, '#e8eef7', 24);
      message = 'Goed! Maar je twijfelde lang…';
    }
  } else {
    physics.applyWrongWobble();
    renderer.puff(event.x, event.y);
    audio.playWrong();
    message = result.answered ? 'Bijna! Deze komt zo terug.' : 'Kies een ring! Deze komt zo terug.';
  }

  game.feedback = {
    state: 'answered',
    text: question.text,
    answer: question.answer,
    correct: result.correct,
    fast: result.fast,
    message
  };
  game.feedbackTime = CONFIG.math.feedbackDuration;
  game.question = null;
  game.nextQuestionTimer = CONFIG.math.gapAfterAnswer;
}

function updateQuestions(dt) {
  if (game.feedbackTime > 0) {
    game.feedbackTime -= dt;
    if (game.feedbackTime <= 0) game.feedback = null;
  }

  if (game.question) return;

  game.nextQuestionTimer -= dt;
  if (game.nextQuestionTimer > 0 || physics.hasActiveColumn) return;

  if (math.roundFinished) {
    endRound();
  } else {
    askNextQuestion();
  }
}

/** Gegevens voor de som-banner bovenin. */
function questionForHud() {
  if (game.question) {
    const column = physics.columns.find((c) => c.id === game.columnId);
    return {
      state: 'asking',
      text: game.question.text,
      age: column ? column.age : 0
    };
  }
  return game.feedback;
}

// ---------------------------------------------------------------------
// Invoer: pointer (muis + touch)
// ---------------------------------------------------------------------
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  audio.unlock();
  if (game.state !== 'playing') return;
  activePointers.add(event.pointerId);
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    // sommige browsers ondersteunen capture niet voor elk type
  }
});

function releasePointer(event) {
  activePointers.delete(event.pointerId);
}

window.addEventListener('pointerup', releasePointer);
window.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);

startOverlay.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  startGame();
});

againButton.addEventListener('click', () => {
  // Kleine wachttijd, zodat een tik die nog "doorloopt" niet meteen opnieuw start
  if (performance.now() - game.roundEndShownAt < 900) return;
  startGame();
});

// Toetsenbord (handig bij testen op de Surface)
window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space') return;
  event.preventDefault();
  if (game.state === 'start') {
    startGame();
    return;
  }
  if (game.state === 'roundEnd') {
    if (performance.now() - game.roundEndShownAt > 900) startGame();
    return;
  }
  spaceDown = true;
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') spaceDown = false;
});

// Alles loslaten als de app de focus verliest
window.addEventListener('blur', () => {
  activePointers.clear();
  spaceDown = false;
});
document.addEventListener('visibilitychange', () => {
  activePointers.clear();
  spaceDown = false;
  game.lastFrame = performance.now();
});

// Geen scrollen, zoomen, contextmenu of dubbeltik-zoom
document.addEventListener('touchmove', (event) => {
  if (!event.target.closest || !event.target.closest('#tunePanel')) event.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (event) => event.preventDefault());
document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('dblclick', (event) => event.preventDefault());

// ---------------------------------------------------------------------
// Knoppen: geluid en tuning
// ---------------------------------------------------------------------
function updateMuteButton() {
  muteButton.textContent = audio.muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-label', audio.muted ? 'Geluid aanzetten' : 'Geluid uitzetten');
}

muteButton.addEventListener('pointerdown', (event) => event.stopPropagation());
muteButton.addEventListener('click', () => {
  audio.unlock();
  audio.toggleMute();
  updateMuteButton();
});
updateMuteButton();

const sliderElements = {};

function buildTuningPanel() {
  tuneSliders.innerHTML = '';
  for (const param of TUNING_PARAMS) {
    const row = document.createElement('label');
    row.className = 'tune-row';

    const top = document.createElement('div');
    top.className = 'tune-row-top';

    const name = document.createElement('span');
    name.textContent = param.label;

    const value = document.createElement('span');
    value.className = 'tune-value';

    top.appendChild(name);
    top.appendChild(value);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(param.min);
    slider.max = String(param.max);
    slider.step = String(param.step);

    slider.addEventListener('input', () => {
      setTuningValue(param, Number(slider.value));
      value.textContent = String(getTuningValue(param));
      saveTuning();
      updateTuningText();
    });

    row.appendChild(top);
    row.appendChild(slider);
    tuneSliders.appendChild(row);
    sliderElements[param.key] = { slider, value };
  }
  syncSlidersFromConfig();
}

function syncSlidersFromConfig() {
  for (const param of TUNING_PARAMS) {
    const element = sliderElements[param.key];
    if (!element) continue;
    element.slider.value = String(getTuningValue(param));
    element.value.textContent = String(getTuningValue(param));
  }
  updateTuningText();
}

function updateTuningText() {
  tuneValues.textContent = tuningAsText();
}

function setPanelOpen(open) {
  tunePanel.classList.toggle('hidden', !open);
  tuneButton.classList.toggle('active', open);
  activePointers.clear();
}

tuneButton.addEventListener('pointerdown', (event) => event.stopPropagation());
tuneButton.addEventListener('click', () => {
  setPanelOpen(tunePanel.classList.contains('hidden'));
});
tuneCloseButton.addEventListener('click', () => setPanelOpen(false));
tuneResetButton.addEventListener('click', () => {
  resetTuning();
  syncSlidersFromConfig();
});
tunePanel.addEventListener('pointerdown', (event) => event.stopPropagation());

buildTuningPanel();

// ---------------------------------------------------------------------
// Events uit de physics vertalen naar beeld en geluid
// ---------------------------------------------------------------------
function handleEvents(events) {
  for (const event of events) {
    switch (event.type) {
      case 'columnPassed':
        handleAnswer(event);
        break;
      case 'release':
        audio.playFlap(event.speedFactor);
        break;
      case 'ground':
        renderer.dust(event.x, event.y, event.strength);
        renderer.addShake(3 + event.strength * 6);
        audio.playThud(event.strength);
        break;
      default:
        break;
    }
  }
}

// ---------------------------------------------------------------------
// Gameloop (delta-time, maximaal 50 ms per stap)
// ---------------------------------------------------------------------
function frame(now) {
  requestAnimationFrame(frame);

  let dt = (now - game.lastFrame) / 1000;
  game.lastFrame = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) return;

  if (game.state === 'playing') {
    game.playTime += dt;
    physics.setDiving(isPressed());
    handleEvents(physics.update(dt));
    updateQuestions(dt);
    audio.updateWind(physics.bird.diving, physics.speedFactor);
  } else {
    // Demovlucht achter start- en eindscherm: duiken boven het midden, zweven eronder
    const bird = physics.bird;
    physics.setDiving(bird.y < physics.height * 0.38 && bird.vy < 150);
    physics.update(dt);
    audio.silenceWind();
  }

  renderer.update(dt, physics);
  renderer.render(physics, {
    visible: game.state === 'playing',
    feathers: math.totalFeathers,
    questionNumber: math.round ? math.round.asked : 0,
    roundLength: CONFIG.math.roundLength,
    question: game.state === 'playing' ? questionForHud() : null,
    hintAlpha: game.state === 'playing' ? Math.max(0, Math.min(1, 7 - game.playTime)) : 0
  });
}

enterStartState();
requestAnimationFrame(frame);
