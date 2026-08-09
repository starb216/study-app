/* shared/atmosphere.js — Lock In Timer Atmosphere page */
(function () {
  'use strict';

const $ = (sel) => document.querySelector(sel);
const message = $('#message');
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function computeStreak(dates) {
  const unique = Array.from(new Set(dates)).sort();
  if (!unique.length) return 0;
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (unique[unique.length - 1] !== today && unique[unique.length - 1] !== yesterday) return 0;

  let streak = 1;
  for (let i = unique.length - 1; i > 0; i--) {
    const a = new Date(unique[i] + 'T00:00:00');
    const b = new Date(unique[i - 1] + 'T00:00:00');
    if ((a - b) / 86400000 === 1) streak++;
    else break;
  }
  return streak;
}


/* ===== Atmosphere panel ===== */
let audioCtx = null;
let activeSound = null;
let activeNodes = [];

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = AC ? new AC() : null;
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function createNoiseBuffer(duration) {
  const sr = audioCtx.sampleRate;
  const len = sr * duration;
  const buffer = audioCtx.createBuffer(1, len, sr);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function stopAllSound() {
  activeNodes.forEach(n => {
    try {
      if (n.stop) n.stop();
      if (n.disconnect) n.disconnect();
    } catch (e) {}
  });
  activeNodes = [];
  activeSound = null;
  updateSoundscapeUI();
}

function makeNoiseSource(buffer) {
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  activeNodes.push(src);
  return src;
}

function makeGain(initial) {
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(initial, audioCtx.currentTime);
  activeNodes.push(g);
  return g;
}

function makeFilter(type, freq, q) {
  const f = audioCtx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  if (q !== undefined) f.Q.value = q;
  activeNodes.push(f);
  return f;
}

function soundscapeVolume() {
  const slider = $('#soundscapeVolume');
  return slider ? parseFloat(slider.value) : 0.35;
}

function playRain() {
  const src = makeNoiseSource(createNoiseBuffer(2));
  const filter = makeFilter('lowpass', 800, 0.8);
  const gain = makeGain(soundscapeVolume() * 0.9);
  src.connect(filter).connect(gain).connect(audioCtx.destination);
  src.start();
}

function playWaves() {
  const src = makeNoiseSource(createNoiseBuffer(3));
  const filter = makeFilter('lowpass', 600, 0.6);
  const gain = makeGain(0);
  const lfo = audioCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.12;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = soundscapeVolume() * 0.8;
  activeNodes.push(lfo, lfoGain);
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  src.connect(filter).connect(gain).connect(audioCtx.destination);
  src.start();
  lfo.start();
}

function playForest() {
  const src = makeNoiseSource(createNoiseBuffer(2));
  const filter = makeFilter('bandpass', 1200, 0.5);
  const gain = makeGain(soundscapeVolume() * 0.7);
  src.connect(filter).connect(gain).connect(audioCtx.destination);
  src.start();
}

function playCafe() {
  const src = makeNoiseSource(createNoiseBuffer(2));
  const filter = makeFilter('bandpass', 400, 0.7);
  const gain = makeGain(soundscapeVolume() * 0.85);
  src.connect(filter).connect(gain).connect(audioCtx.destination);
  src.start();
}

const soundscapes = {
  rain: playRain,
  waves: playWaves,
  forest: playForest,
  cafe: playCafe
};

function toggleSoundscape(name) {
  ensureAudio();
  if (!audioCtx) return;
  if (activeSound === name) {
    stopAllSound();
    return;
  }
  stopAllSound();
  activeSound = name;
  updateSoundscapeUI();
  if (soundscapes[name]) soundscapes[name]();
}

function updateSoundscapeUI() {
  $$('.soundscape-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sound === activeSound);
  });
}

$$('.soundscape-btn').forEach(btn => {
  btn.addEventListener('click', () => toggleSoundscape(btn.dataset.sound));
});

const volSlider = $('#soundscapeVolume');
if (volSlider) {
  volSlider.addEventListener('input', () => {
    if (activeSound && audioCtx) {
      const current = activeSound;
      stopAllSound();
      activeSound = current;
      updateSoundscapeUI();
      if (soundscapes[current]) soundscapes[current]();
    }
  });
}

const breathingCircle = $('#breathingCircle');
const breathingLabel = $('#breathingLabel');
const breathingStart = $('#breathingStart');
const breathingStop = $('#breathingStop');
let breathingRunning = false;
let breathingRaf = null;
let breathingPhaseStart = 0;
let breathingPhase = 'inhale';

const PHASES = [
  { name: 'inhale', label: 'Breathe in…', duration: 4000, scaleFrom: 1, scaleTo: 1.45 },
  { name: 'hold', label: 'Hold…', duration: 7000, scaleFrom: 1.45, scaleTo: 1.45 },
  { name: 'exhale', label: 'Breathe out…', duration: 8000, scaleFrom: 1.45, scaleTo: 1 }
];

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function updateBreathing(now) {
  if (!breathingRunning) return;
  const elapsed = now - breathingPhaseStart;
  let current = PHASES.find(p => p.name === breathingPhase);
  let progress = Math.min(1, elapsed / current.duration);
  const remaining = Math.max(0, Math.ceil((current.duration - elapsed) / 1000));
  if (breathingCircle) breathingCircle.textContent = remaining;
  if (breathingLabel) breathingLabel.textContent = current.label;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) {
    const eased = easeInOutSine(progress);
    const scale = current.scaleFrom + (current.scaleTo - current.scaleFrom) * eased;
    if (breathingCircle) breathingCircle.style.transform = `scale(${scale})`;
  }
  if (progress >= 1) {
    const idx = PHASES.indexOf(current);
    breathingPhase = PHASES[(idx + 1) % PHASES.length].name;
    breathingPhaseStart = now;
  }
  breathingRaf = requestAnimationFrame(updateBreathing);
}

function startBreathing() {
  if (breathingRunning) return;
  breathingRunning = true;
  breathingPhase = 'inhale';
  breathingPhaseStart = performance.now();
  if (breathingCircle) breathingCircle.classList.remove('paused');
  breathingRaf = requestAnimationFrame(updateBreathing);
}

function stopBreathing() {
  breathingRunning = false;
  if (breathingRaf) cancelAnimationFrame(breathingRaf);
  breathingRaf = null;
  if (breathingCircle) {
    breathingCircle.classList.add('paused');
    breathingCircle.style.transform = 'scale(1)';
    breathingCircle.textContent = 'Breathe';
  }
  if (breathingLabel) breathingLabel.textContent = 'Press Start to begin 4-7-8 breathing';
}

if (breathingStart) breathingStart.addEventListener('click', startBreathing);
if (breathingStop) breathingStop.addEventListener('click', stopBreathing);

const darkSwitch = $('#darkModeSwitch');
let isDark = loadJSON('atmosphereDarkMode', false);

function toggleDarkMode() {
  isDark = !isDark;
  saveJSON('atmosphereDarkMode', isDark);
  if (typeof window.applyDarkMode === 'function') window.applyDarkMode(isDark);
}

if (darkSwitch) {
  darkSwitch.addEventListener('click', toggleDarkMode);
  darkSwitch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDarkMode();
    }
  });
}
if (typeof window.applyDarkMode === 'function') window.applyDarkMode(isDark);

const atmosphereToggle = $('#atmosphereToggle');
const atmospherePanel = $('#atmospherePanel');
let atmosphereOpen = loadJSON('atmospherePanelOpen', false);

function updateAtmospherePanel() {
  if (atmospherePanel) atmospherePanel.classList.toggle('open', atmosphereOpen);
  if (atmosphereToggle) atmosphereToggle.textContent = atmosphereOpen ? 'Close 🌙' : 'Open 🌙';
}

if (atmosphereToggle) {
  atmosphereToggle.addEventListener('click', () => {
    atmosphereOpen = !atmosphereOpen;
    saveJSON('atmospherePanelOpen', atmosphereOpen);
    updateAtmospherePanel();
  });
}
updateAtmospherePanel();

$$('.soundscape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    saveJSON('atmosphereLastSound', btn.dataset.sound);
  });
});


/* ===== Custom Background ===== */
const customBgUrlInput = $('#customBgUrl');
const customBgApply = $('#customBgApply');
const customBgClear = $('#customBgClear');
const customBgLayer = $('#customBgLayer');
const savedCustomBg = loadJSON('coastalCustomBackground', '');

if (savedCustomBg && typeof window.applyCustomBackground === 'function') window.applyCustomBackground(savedCustomBg);
if (customBgUrlInput) customBgUrlInput.value = savedCustomBg || '';

function validateAndApplyCustomBackground(url) {
  if (!url) {
    if (typeof window.applyCustomBackground === 'function') window.applyCustomBackground('');
    saveJSON('coastalCustomBackground', '');
    if (message) message.textContent = 'Custom background cleared';
    return;
  }
  try {
    const parsed = new URL(url, window.location.href);
    const allowedSchemes = ['http:', 'https:', 'file:', 'data:'];
    if (!allowedSchemes.includes(parsed.protocol)) {
      if (message) message.textContent = 'Only http, https, file, or data:image URLs are allowed.';
      return;
    }
    if (parsed.protocol === 'data:' && !parsed.pathname.startsWith('image/')) {
      if (message) message.textContent = 'Only data:image URLs are allowed.';
      return;
    }
  } catch (e) {
    if (message) message.textContent = 'That does not look like a valid URL.';
    return;
  }
  const img = new Image();
  img.onload = () => {
    saveJSON('coastalCustomBackground', url);
    if (typeof window.applyCustomBackground === 'function') window.applyCustomBackground(url);
    if (message) message.textContent = 'Custom background applied ✨';
  };
  img.onerror = () => {
    if (message) message.textContent = 'Could not load that image. Check the URL and try again.';
    if (typeof window.applyCustomBackground === 'function') window.applyCustomBackground('');
    saveJSON('coastalCustomBackground', '');
  };
  img.src = url;
}

if (customBgApply) {
  customBgApply.addEventListener('click', () => {
    const url = (customBgUrlInput.value || '').trim();
    validateAndApplyCustomBackground(url);
  });
}

if (customBgClear) {
  customBgClear.addEventListener('click', () => {
    saveJSON('coastalCustomBackground', '');
    if (customBgUrlInput) customBgUrlInput.value = '';
    if (typeof window.applyCustomBackground === 'function') window.applyCustomBackground('');
    if (message) message.textContent = 'Custom background cleared';
  });
}

if (customBgUrlInput) {
  customBgUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (customBgApply) customBgApply.click();
    }
  });
}

/* ===== Keyboard Shortcuts Help Panel ===== */
const shortcutsBtn = $('#shortcutsBtn');

})();
