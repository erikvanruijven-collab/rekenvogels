// =====================================================================
// main.js — Gameloop, invoer, schermen en toestandsbeheer
// ---------------------------------------------------------------------
// Toestanden:  'start'    -> wereldkaart (of het vogel-keuzescherm, de
//                            eerste keer verplicht), demovlucht erachter
//              'playing'  -> een vlucht van 20 sommen in een wereld
//              'dive'     -> Gouden Duik-tussenspel (15 s)
//              'roundEnd' -> eindscherm met resultaten
// Invoer:      pointerdown / pointerup / pointermove (muis én touch),
//              spatiebalk en pijltjes op de Surface als extra testknoppen.
// =====================================================================

import {
  CONFIG,
  TUNING_PARAMS,
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
import { BIRDS, BIRD_ORDER, drawBirdPreview } from './birds.js';
import {
  loadProfile,
  saveProfile,
  sanitizeName,
  randomName,
  isWorldUnlocked,
  bestResult,
  recordWorldResult,
  unlockAllWorlds,
  resetGameProgress
} from './progress.js';
import { WORLDS, FIRST_WORLD, getWorld, nextWorld, tablesLabel } from './worlds/index.js';
import { GoldenDive } from './minigames/gouden-duik.js';

// ---------------------------------------------------------------------
// Opzetten
// ---------------------------------------------------------------------
loadTuning();

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const startOverlay = $('startOverlay');
const startFeathers = $('startFeathers');
const startGreeting = $('startGreeting');
const startBirdCanvas = $('startBirdCanvas');
const worldMap = $('worldMap');
const mapMessage = $('mapMessage');
const newGameButton = $('newGameBtn');
const confirmOverlay = $('confirmOverlay');
const roundOverlay = $('roundOverlay');
const againButton = $('againBtn');
const mapButton = $('mapBtn');
const birdButton = $('birdBtn');
const birdOverlay = $('birdOverlay');
const birdTitle = $('birdTitle');
const birdChoices = $('birdChoices');
const nameInput = $('nameInput');
const diceButton = $('diceBtn');
const birdCancelButton = $('birdCancel');
const birdDoneButton = $('birdDone');
const muteButton = $('muteBtn');
const tuneButton = $('tuneBtn');
const tunePanel = $('tunePanel');
const tuneSliders = $('tuneSliders');
const tuneValues = $('tuneValues');
const tuneResetButton = $('tuneReset');
const tuneCloseButton = $('tuneClose');
const unlockAllButton = $('unlockAllBtn');

let profile = loadProfile();
let currentWorld = getWorld(FIRST_WORLD);

const physics = new FlightPhysics();
const audio = new AudioEngine();
const renderer = new Renderer(canvas, currentWorld.colors);
const math = new MathEngine();
const goldenDive = new GoldenDive();

renderer.setBird(profile.birdId);

let currentEffects = null;   // wereld-effecten (bijv. storm) tijdens een vlucht

function stopEffects() {
  if (currentEffects && currentEffects.dispose) currentEffects.dispose();
  currentEffects = null;
  renderer.setEffects(null, 'normal');
  physics.gustForce = 0;
}

const game = {
  state: 'start',
  playTime: 0,
  lastFrame: performance.now(),
  question: null,          // de som die nu in de lucht hangt
  columnId: -1,            // bijbehorende ringkolom
  feedback: null,          // resultaat van het laatste antwoord (voor de banner)
  feedbackTime: 0,
  nextQuestionTimer: 0,
  roundEndShownAt: 0,
  pending: null            // resultaten van de vlucht, getoond na de Gouden Duik
};

// ---------------------------------------------------------------------
// Invoer-toestand
// ---------------------------------------------------------------------
const activePointers = new Set();
let spaceDown = false;
let arrowLeft = false;
let arrowRight = false;
let pointerX = null;       // vingerpositie in logische pixels (voor de Gouden Duik)

function isPressed() {
  return activePointers.size > 0 || spaceDown;
}

function toLogicalX(clientX) {
  return (clientX / window.innerWidth) * renderer.viewWidth;
}

// ---------------------------------------------------------------------
// Schermgrootte
// ---------------------------------------------------------------------
function handleResize() {
  const viewWidth = renderer.resize();
  physics.setViewWidth(viewWidth);
  goldenDive.setViewWidth(viewWidth);
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
// Startscherm met wereldkaart
// ---------------------------------------------------------------------
function enterStartState() {
  stopEffects();
  game.state = 'start';
  physics.reset();
  physics.setViewWidth(renderer.viewWidth);
  roundOverlay.classList.add('hidden');
  $('versionLabel').textContent = `versie ${CONFIG.version}`;
  if (profile.complete) {
    showStartScreen();
  } else {
    openBirdScreen(true);
  }
}

function showStartScreen() {
  startFeathers.textContent = String(math.totalFeathers);
  startGreeting.textContent = `Hoi ${profile.name}!`;
  mapMessage.innerHTML = '&nbsp;';
  buildWorldMap();
  birdOverlay.classList.add('hidden');
  roundOverlay.classList.add('hidden');
  startOverlay.classList.remove('hidden');
}

/** Drie sterren: verdiende sterren geel, de rest grijs. */
function fillStars(element, stars) {
  element.innerHTML = '';
  for (let i = 0; i < 3; i += 1) {
    const star = document.createElement('span');
    star.className = i < stars ? 'star on' : 'star off';
    star.textContent = '★';
    element.appendChild(star);
  }
}

function buildWorldMap() {
  worldMap.innerHTML = '';
  WORLDS.forEach((world, index) => {
    const unlocked = isWorldUnlocked(world.id);
    const best = bestResult(world.id);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'world-card';
    if (world.darkCard) card.classList.add('dark');
    if (!unlocked) card.classList.add('locked');
    card.style.background = `linear-gradient(${world.colors.sky[0]}, ${world.colors.sky[1]} 60%, ${world.colors.hillsFront})`;

    const parts = [
      ['world-number', `Wereld ${world.number}`],
      ['world-icon', world.icon],
      ['world-name', world.name],
      ['world-tables', `tafels ${tablesLabel(world)}`],
      ['world-stars', unlocked ? '' : '🔒']
    ];
    for (const [className, text] of parts) {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      if (className === 'world-stars' && unlocked) fillStars(span, best ? best.stars : 0);
      card.appendChild(span);
    }

    card.addEventListener('click', () => {
      audio.unlock();
      if (unlocked) {
        startGame(world);
      } else {
        const previous = WORLDS[index - 1];
        mapMessage.textContent = `🔒 Haal ${CONFIG.progression.unlockScore} van de 20 goed in ${previous.name} om deze wereld te openen!`;
        card.classList.remove('shake');
        void card.offsetWidth;   // animatie opnieuw starten
        card.classList.add('shake');
        audio.playWrong();
      }
    });
    worldMap.appendChild(card);
  });
}

// ---------------------------------------------------------------------
// Nieuw spel
// ---------------------------------------------------------------------
newGameButton.addEventListener('click', () => {
  confirmOverlay.classList.remove('hidden');
});
$('confirmNo').addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
});
$('confirmYes').addEventListener('click', () => {
  resetGameProgress();
  math.reloadProgress();
  currentWorld = getWorld(FIRST_WORLD);
  renderer.setWorld(currentWorld.colors);
  confirmOverlay.classList.add('hidden');
  showStartScreen();
  mapMessage.textContent = 'Nieuw spel! Begin in De Wolkenvallei.';
  audio.unlock();
  audio.playFanfare();
});

// ---------------------------------------------------------------------
// Vogel kiezen en naam geven (Stap 4a)
// ---------------------------------------------------------------------
let selectedBird = profile.birdId;
const choiceCanvases = {};

function buildBirdChoices() {
  birdChoices.innerHTML = '';
  for (const id of BIRD_ORDER) {
    const bird = BIRDS[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bird-choice';
    button.dataset.bird = id;

    const preview = document.createElement('canvas');
    preview.width = 320;
    preview.height = 234;
    preview.setAttribute('aria-hidden', 'true');

    const name = document.createElement('strong');
    name.textContent = bird.name;
    const description = document.createElement('small');
    description.textContent = bird.description;

    button.appendChild(preview);
    button.appendChild(name);
    button.appendChild(description);
    button.addEventListener('click', () => selectBird(id));
    birdChoices.appendChild(button);
    choiceCanvases[id] = preview;
  }
}

function selectBird(id) {
  selectedBird = id;
  renderer.setBird(id);   // de demovogel op de achtergrond verandert meteen mee
  for (const button of birdChoices.querySelectorAll('.bird-choice')) {
    button.classList.toggle('selected', button.dataset.bird === id);
  }
  audio.unlock();
  audio.playCorrect();
}

function openBirdScreen(firstTime) {
  selectedBird = profile.birdId;
  for (const button of birdChoices.querySelectorAll('.bird-choice')) {
    button.classList.toggle('selected', button.dataset.bird === selectedBird);
  }
  nameInput.value = profile.name;
  birdTitle.textContent = firstTime ? 'Kies jouw vogel!' : 'Jouw vogel';
  birdCancelButton.classList.toggle('hidden', firstTime);
  startOverlay.classList.add('hidden');
  birdOverlay.classList.remove('hidden');
  birdOverlay.classList.remove('typing');
}

function closeKeyboard() {
  nameInput.blur();
  birdOverlay.classList.remove('typing');
  window.scrollTo(0, 0);
}

function finishBirdScreen() {
  let name = sanitizeName(nameInput.value);
  if (!name) name = randomName();
  profile = { birdId: selectedBird, name, complete: true };
  saveProfile(profile);
  renderer.setBird(profile.birdId);
  closeKeyboard();
  audio.unlock();
  audio.playFanfare();
  showStartScreen();
}

function cancelBirdScreen() {
  renderer.setBird(profile.birdId);
  closeKeyboard();
  showStartScreen();
}

buildBirdChoices();

nameInput.addEventListener('focus', () => birdOverlay.classList.add('typing'));
nameInput.addEventListener('blur', () => {
  // Even wachten: een tik op "Klaar!" moet nog kunnen landen
  setTimeout(() => {
    birdOverlay.classList.remove('typing');
    window.scrollTo(0, 0);
  }, 150);
});
nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    closeKeyboard();
  }
});
diceButton.addEventListener('click', () => {
  nameInput.value = randomName(nameInput.value);
  audio.unlock();
  audio.playRingTick();
});
birdDoneButton.addEventListener('click', finishBirdScreen);
birdCancelButton.addEventListener('click', cancelBirdScreen);
birdButton.addEventListener('click', () => openBirdScreen(false));

/** Fladderende vogeltjes op de schermen (alleen als ze zichtbaar zijn). */
function drawPreviews(seconds) {
  if (!birdOverlay.classList.contains('hidden')) {
    for (const id of BIRD_ORDER) {
      drawBirdPreview(choiceCanvases[id], id, seconds + BIRD_ORDER.indexOf(id) * 0.7);
    }
  }
  if (!startOverlay.classList.contains('hidden')) {
    drawBirdPreview(startBirdCanvas, profile.birdId, seconds);
  }
}

// ---------------------------------------------------------------------
// Een vlucht starten en afronden
// ---------------------------------------------------------------------
function startGame(world = currentWorld) {
  currentWorld = world;
  renderer.setWorld(world.colors);
  audio.unlock();
  tryFullscreenLandscape();
  physics.reset();
  physics.setViewWidth(renderer.viewWidth);
  math.startRound(world.tables);
  stopEffects();
  if (world.createEffects) {
    currentEffects = world.createEffects({ physics, renderer, audio });
  }
  renderer.setEffects(currentEffects, world.ringStyle || 'normal');
  game.question = null;
  game.columnId = -1;
  game.feedback = null;
  game.feedbackTime = 0;
  game.nextQuestionTimer = CONFIG.math.firstQuestionDelay + 0.6;
  game.playTime = 0;
  game.pending = null;
  game.state = 'playing';
  activePointers.clear();
  startOverlay.classList.add('hidden');
  roundOverlay.classList.add('hidden');
}

function formatSeconds(value) {
  return `${value.toFixed(1).replace('.', ',')} s`;
}

/** Na de 20e som: resultaten opslaan en door naar de Gouden Duik. */
function endFlight() {
  const summary = math.finishRound();
  const result = recordWorldResult(currentWorld.id, summary);
  game.pending = { summary, result };
  stopEffects();
  game.question = null;
  physics.clearColumns();
  activePointers.clear();
  pointerX = null;

  game.state = 'dive';
  goldenDive.start(renderer.viewWidth);
  audio.setDiveWind(true);
  audio.playFanfare();
}

/** Na de Gouden Duik: eindscherm tonen. */
function finishDive(bonus) {
  math.addFeathers(bonus);
  audio.setDiveWind(false);
  physics.reset();
  physics.setViewWidth(renderer.viewWidth);
  showRoundOverlay(game.pending.summary, game.pending.result, bonus);
}

function showRoundOverlay(summary, result, bonus) {
  game.state = 'roundEnd';
  game.roundEndShownAt = performance.now();
  activePointers.clear();

  const ratio = summary.asked > 0 ? summary.correct / summary.asked : 0;
  let title = `Goed gevlogen, ${profile.name}!`;
  if (ratio === 1) title = `Foutloos, ${profile.name}! Wauw!`;
  else if (ratio >= 0.85) title = `Super gevlogen, ${profile.name}!`;
  else if (ratio < 0.5) title = `Knap volgehouden, ${profile.name}!`;

  $('roundTitle').textContent = title;
  fillStars($('roundStars'), result.stars);
  $('roundScore').textContent = `${summary.correct} van de ${summary.asked} goed`;
  $('statTurbo').textContent = String(summary.turbo);
  $('statTime').textContent = summary.averageTime === null ? '–' : formatSeconds(summary.averageTime);
  $('statStreak').textContent = String(summary.bestStreak);
  $('statFeathers').textContent = `+${summary.feathers + bonus}`;

  const unlockLine = $('roundUnlock');
  const next = nextWorld(currentWorld.id);
  if (result.unlockedWorld) {
    unlockLine.textContent = `🔓 Nieuwe wereld open: ${result.unlockedWorld.icon} ${result.unlockedWorld.name}!`;
    unlockLine.classList.remove('hidden', 'hint');
    audio.playUnlock();
  } else if (next && !isWorldUnlocked(next.id)) {
    unlockLine.textContent = `Haal ${CONFIG.progression.unlockScore} goed om ${next.name} te openen.`;
    unlockLine.classList.remove('hidden');
    unlockLine.classList.add('hint');
  } else {
    unlockLine.classList.add('hidden');
  }

  const practice = $('roundPractice');
  if (summary.practice.length > 0) {
    practice.textContent = `Nog even oefenen: ${summary.practice.slice(0, 6).join('   ·   ')}`;
    practice.classList.remove('hidden');
  } else {
    practice.classList.add('hidden');
  }

  roundOverlay.classList.remove('hidden');
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

const PRAISE = ['Goed zo', 'Top', 'Netjes', 'Klopt', 'Lekker bezig'];

/** Lof, soms met de naam van de vogel erin ("Goed zo, Pluim!"). */
function praise() {
  const word = PRAISE[Math.floor(Math.random() * PRAISE.length)];
  return Math.random() < 0.4 ? `${word}, ${profile.name}!` : `${word}!`;
}

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
    message = Math.random() < 0.5 ? `Turbo-thermiek, ${profile.name}!` : 'Turbo-thermiek!';
  } else if (result.correct) {
    renderer.sparkle(event.x, event.y);
    renderer.floatText(`+${result.feathers}`, bird.x, bird.y - 50, '#ffffff', 34);
    audio.playCorrect();
    message = praise();
    if (result.slow) {
      physics.applyWindDrop();
      audio.playWindDrop();
      renderer.floatText('de wind zakt weg…', bird.x + 40, bird.y + 50, '#e8eef7', 24);
      message = 'Goed! Maar je twijfelde lang…';
    }
  } else {
    // Werelden kunnen een eigen "fout"-effect hebben (bijv. onweersschok)
    const handled = currentEffects && currentEffects.onWrongAnswer
      ? currentEffects.onWrongAnswer(event)
      : false;
    if (!handled) {
      physics.applyWrongWobble();
      renderer.puff(event.x, event.y);
      audio.playWrong();
    }
    if (handled && result.answered) {
      message = 'Au, onweer! Deze komt zo terug.';
    } else {
      message = result.answered ? 'Bijna! Deze komt zo terug.' : 'Kies een ring! Deze komt zo terug.';
    }
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
    endFlight();
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
  if (game.state !== 'playing' && game.state !== 'dive') return;
  activePointers.add(event.pointerId);
  pointerX = toLogicalX(event.clientX);
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    // sommige browsers ondersteunen capture niet voor elk type
  }
});

window.addEventListener('pointermove', (event) => {
  if (activePointers.has(event.pointerId)) {
    pointerX = toLogicalX(event.clientX);
  }
});

function releasePointer(event) {
  activePointers.delete(event.pointerId);
  if (activePointers.size === 0) pointerX = null;
}

window.addEventListener('pointerup', releasePointer);
window.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);

againButton.addEventListener('click', () => {
  // Kleine wachttijd, zodat een tik die nog "doorloopt" niet meteen opnieuw start
  if (performance.now() - game.roundEndShownAt < 900) return;
  startGame(currentWorld);
});
mapButton.addEventListener('click', () => {
  if (performance.now() - game.roundEndShownAt < 900) return;
  enterStartState();
});

// Toetsenbord (handig bij testen op de Surface)
window.addEventListener('keydown', (event) => {
  if (event.target === nameInput) return;               // spaties in de naam mogen gewoon
  if (event.code === 'ArrowLeft') arrowLeft = true;
  if (event.code === 'ArrowRight') arrowRight = true;
  if (event.code !== 'Space') return;
  if (!birdOverlay.classList.contains('hidden')) return;
  if (!confirmOverlay.classList.contains('hidden')) return;
  event.preventDefault();
  if (game.state === 'start') {
    startGame(currentWorld);
    return;
  }
  if (game.state === 'roundEnd') {
    if (performance.now() - game.roundEndShownAt > 900) startGame(currentWorld);
    return;
  }
  spaceDown = true;
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') spaceDown = false;
  if (event.code === 'ArrowLeft') arrowLeft = false;
  if (event.code === 'ArrowRight') arrowRight = false;
});

// Alles loslaten als de app de focus verliest
function releaseAll() {
  activePointers.clear();
  spaceDown = false;
  arrowLeft = false;
  arrowRight = false;
  pointerX = null;
}
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => {
  releaseAll();
  game.lastFrame = performance.now();
});

// Geen scrollen, zoomen, contextmenu of dubbeltik-zoom
document.addEventListener('touchmove', (event) => {
  const scrollable = event.target.closest && event.target.closest('#tunePanel, #birdOverlay, .map-card');
  if (!scrollable) event.preventDefault();
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
unlockAllButton.addEventListener('click', () => {
  unlockAllWorlds();
  if (game.state === 'start') buildWorldMap();
  unlockAllButton.textContent = '🔓 Alle werelden zijn open';
});
tunePanel.addEventListener('pointerdown', (event) => event.stopPropagation());

buildTuningPanel();

// ---------------------------------------------------------------------
// Events vertalen naar beeld en geluid
// ---------------------------------------------------------------------
function handleEvents(events) {
  for (const event of events) {
    switch (event.type) {
      case 'columnPassed':
        handleAnswer(event);
        break;
      case 'release':
        audio.playFlap(event.speedFactor + (event.tap ? 0.6 : 0));
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

function handleDiveEvents(events) {
  for (const event of events) {
    switch (event.type) {
      case 'diveStart':
        audio.playTurbo();
        break;
      case 'catch':
        audio.playCatch(event.combo, event.gold);
        if (event.gold) renderer.addShake(4);
        break;
      case 'diveEnd':
        audio.setDiveWind(false);
        audio.playFanfare();
        break;
      case 'finished':
        finishDive(event.bonus);
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

  drawPreviews(now / 1000);

  // ---------- Gouden Duik ----------
  if (game.state === 'dive') {
    handleDiveEvents(goldenDive.update(dt, {
      targetX: isPressed() ? pointerX : null,
      left: arrowLeft,
      right: arrowRight
    }));
    if (game.state === 'dive') {
      renderer.updateShake(dt);
      renderer.renderCustom((ctx) => goldenDive.draw(ctx, profile.birdId));
      return;
    }
  }

  // ---------- Vliegen ----------
  if (game.state === 'playing') {
    game.playTime += dt;
    physics.setDiving(isPressed());
    if (currentEffects) currentEffects.update(dt);
    handleEvents(physics.update(dt));
    updateQuestions(dt);
    if (game.state === 'playing') {
      audio.updateWind(physics.bird.diving, physics.speedFactor);
    }
  } else if (game.state !== 'dive') {
    // Demovlucht achter de schermen: duiken boven het midden, zweven eronder
    const bird = physics.bird;
    physics.setDiving(bird.y < physics.height * 0.38 && bird.vy < 150);
    physics.update(dt);
    audio.silenceWind();
  }

  const playing = game.state === 'playing';
  const t = game.playTime;
  renderer.update(dt, physics);
  renderer.render(physics, {
    visible: playing,
    feathers: math.totalFeathers,
    questionNumber: math.round ? math.round.asked : 0,
    roundLength: CONFIG.math.roundLength,
    question: playing ? questionForHud() : null,
    worldTitle: `Wereld ${currentWorld.number} · ${currentWorld.name}`,
    worldTitleAlpha: playing ? Math.max(0, Math.min(1, 2.6 - t)) : 0,
    hintText: t < 4.5 ? currentWorld.intro : 'Tik kort = omhoog fladderen  ·  Houd vast = duiken',
    hintAlpha: playing ? Math.max(0, Math.min(1, 9 - t)) : 0
  });
}

enterStartState();
requestAnimationFrame(frame);
