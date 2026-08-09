/* shared/timer.js — Lock In Timer page (timer + Pomodoro + music + shortcuts) */
const timerCircle = document.getElementById('timerCircle');
const timerDisplay = document.getElementById('timerDisplay');
const hoursInput = document.getElementById('hours');
const minutesInput = document.getElementById('minutes');
const secondsInput = document.getElementById('seconds');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const message = document.getElementById('message');
const presets = document.querySelectorAll('.preset');
const themeBtns = document.querySelectorAll('.theme-btn');
const pageTitle = document.getElementById('pageTitle');
const themeQuote = document.getElementById('themeQuote');
const phaseBadge = document.getElementById('phaseBadge');
const zenBtn = document.getElementById('zenBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

/* Focus Lock (game locking system) elements */
const focusLockPanel = document.getElementById('focusLockPanel');
const focusLockHeader = document.getElementById('focusLockHeader');
const focusLockEnabledCheckbox = document.getElementById('focusLockEnabled');
const focusLockBlockedSitesTextarea = document.getElementById('focusLockBlockedSites');
const focusLockOverlay = document.getElementById('focusLockOverlay');
const focusLockReason = document.getElementById('focusLockReason');
const focusLockResumeBtn = document.getElementById('focusLockResumeBtn');
const focusLockGiveUpBtn = document.getElementById('focusLockGiveUpBtn');

const themeNames = {
  coastal: 'Lock In Timer',
  forest: 'Forest Timer',
  beach: 'Beach Timer',
  jungle: 'Jungle Timer',
  bamboo: 'Bamboo Timer',
  mountain: 'Mountain Timer',
  sunset: 'Sunset Timer',
  'ocean-deep': 'Ocean Deep Timer',
  desert: 'Desert Timer',
  aurora: 'Aurora Timer',
  'city-night': 'City Night Timer',
  'cherry-blossom': 'Cherry Blossom Timer',
  lavender: 'Lavender Timer',
  autumn: 'Autumn Timer',
  winter: 'Winter Timer',
  tropical: 'Tropical Timer',
  space: 'Space Timer',
  'cotton-candy': 'Cotton Candy Timer',
  midnight: 'Midnight Timer',
  mint: 'Mint Timer',
  'rose-gold': 'Rose Gold Timer',
  storm: 'Storm Timer',
  'golden-hour': 'Golden Hour Timer',
  'foggy-lake': 'Foggy Lake Timer',
  neon: 'Neon Timer',
  pastel: 'Pastel Timer',
  library: 'Library Timer',
  greenhouse: 'Greenhouse Timer',
  loft: 'Loft Timer',
  cabin: 'Cabin Timer',
  garden: 'Garden Timer',
  rooftop: 'Rooftop Timer',
  bookstore: 'Bookstore Timer',
  vinyl: 'Vinyl Timer',
  'morning-kitchen': 'Morning Kitchen Timer',
  'sunny-meadow': 'Sunny Meadow Timer'
};

const themeQuotes = {
  coastal: 'Breathe in the sea breeze and lock in.',
  forest: 'Find calm among the trees and focus.',
  beach: 'Let the waves carry your distractions away.',
  jungle: 'Grow through what you focus on.',
  bamboo: 'Bend, but stay rooted in your goal.',
  mountain: 'Climb one minute at a time.',
  sunset: 'Wind down as the day fades.',
  'ocean-deep': 'Dive deep into your focus.',
  desert: 'Stay steady like the dunes.',
  aurora: 'Let your ideas light up the dark.',
  'city-night': 'Focus while the city glows.',
  'cherry-blossom': 'Bloom one moment at a time.',
  lavender: 'Breathe in calm, breathe out focus.',
  autumn: 'Let go of distractions like falling leaves.',
  winter: 'Find stillness in the cold.',
  tropical: 'Warm up to your goals.',
  space: 'Reach for something bigger.',
  'cotton-candy': 'Make focus feel light and sweet.',
  midnight: 'Own the quiet hours.',
  mint: 'Refresh your focus.',
  'rose-gold': 'Add a little shine to the grind.',
  storm: 'Focus through the noise.',
  'golden-hour': 'Make this moment count.',
  'foggy-lake': 'Slow down and see clearly.',
  neon: 'Light up your concentration.',
  pastel: 'Soft focus, steady progress.',
  library: 'Get lost in the pages of your work.',
  greenhouse: 'Grow slowly, steadily, beautifully.',
  loft: 'Find clarity in open spaces.',
  cabin: 'Warmth and focus, one minute at a time.',
  garden: 'Bloom where you are planted.',
  rooftop: 'Rise above the noise and focus.',
  bookstore: 'Every chapter starts with one page.',
  vinyl: 'Let the rhythm carry your focus.',
  'morning-kitchen': 'Start soft, finish strong.',
  'sunny-meadow': 'Bask in the light of small wins.'
};

let totalSeconds = 0;
let remainingSeconds = 0;
let interval = null;
let isRunning = false;
let endAt = 0;

/* Focus Lock state */
let focusLockActive = false;
let focusLockLeftPage = false;

function pad(n) {
  return n.toString().padStart(2, '0');
}

function formatTime(totalSecs) {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

  function fireConfetti() {
if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
const layer = document.createElement('div');
layer.className = 'confetti-layer';

/* Pull colors from the active theme palette where possible */
const colors = [
  'var(--terracotta)',
  'var(--terracotta-soft)',
  'var(--blue)',
  'var(--blue-soft)',
  'var(--mint)',
  'var(--butter)',
  '#ffffff'
];

for (let i = 0; i < 60; i++) {
  const piece = document.createElement('div');
  piece.className = 'confetti-piece';
  piece.style.left = Math.random() * 100 + '%';
  piece.style.background = colors[Math.floor(Math.random() * colors.length)];
  piece.style.width = (6 + Math.random() * 8) + 'px';
  piece.style.height = (6 + Math.random() * 8) + 'px';
  piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
  piece.style.animationDelay = (Math.random() * 0.6) + 's';
  piece.style.animationDuration = (2.2 + Math.random() * 1.2) + 's';
  layer.appendChild(piece);
}

document.body.appendChild(layer);
setTimeout(() => layer.remove(), 3600);
  }

function updateDisplay() {
  timerDisplay.textContent = formatTime(remainingSeconds);
  const progress = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;
  timerCircle.style.setProperty('--progress', `${progress}%`);
}

function getInputSeconds() {
  const h = Math.max(0, parseInt(hoursInput.value, 10) || 0);
  const m = Math.max(0, parseInt(minutesInput.value, 10) || 0);
  const s = Math.max(0, parseInt(secondsInput.value, 10) || 0);
  return h * 3600 + m * 60 + s;
}

function updatePhaseBadge() {
  if (!phaseBadge) return;
  if (!isRunning && remainingSeconds <= 0) {
    phaseBadge.classList.remove('visible', 'break');
    return;
  }
  const isBreak = pomodoro && pomodoro.enabled && pomodoro.mode === 'break';
  phaseBadge.textContent = isBreak ? 'Break time — recharge 🌿' : 'Focus time — you got this ✨';
  phaseBadge.classList.toggle('break', isBreak);
  phaseBadge.classList.add('visible');
}

function startTimer() {
  if (!isRunning) {
    if (remainingSeconds <= 0) {
      totalSeconds = getInputSeconds();
      remainingSeconds = totalSeconds;
    }
    if (remainingSeconds <= 0) {
      message.textContent = 'Please set a time first.';
      return;
    }
    endAt = Date.now() + remainingSeconds * 1000;
  }

  isRunning = true;
  enableFocusLock();
  message.textContent = pomodoro && pomodoro.enabled && pomodoro.mode === 'break'
    ? 'Break time — recharge 🌿'
    : 'Focusing... ✨';
  timerCircle.classList.add('running');
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  hoursInput.disabled = true;
  minutesInput.disabled = true;
  secondsInput.disabled = true;
  updatePhaseBadge();

  interval = setInterval(() => {
    const msLeft = endAt - Date.now();
    remainingSeconds = Math.max(0, Math.ceil(msLeft / 1000));
    updateDisplay();

    if (remainingSeconds <= 0) {
      clearInterval(interval);
      interval = null;
      isRunning = false;
      timerCircle.classList.remove('running');
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      hoursInput.disabled = false;
      minutesInput.disabled = false;
      secondsInput.disabled = false;
      message.textContent = 'Time is up! Great work 🎉';
      updatePhaseBadge();
      onTimerComplete();
    }
  }, 250);
}

function pauseTimerCore() {
  clearInterval(interval);
  interval = null;
  isRunning = false;
  timerCircle.classList.remove('running');
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  hoursInput.disabled = false;
  minutesInput.disabled = false;
  secondsInput.disabled = false;
  updatePhaseBadge();
}

function pauseTimer() {
  pauseTimerCore();
  disableFocusLock();
  message.textContent = 'Paused.';
}

function resetTimer() {
  clearInterval(interval);
  interval = null;
  isRunning = false;
  disableFocusLock();
  totalSeconds = 0;
  remainingSeconds = 0;
  endAt = 0;
  timerCircle.classList.remove('running');
  timerDisplay.textContent = '00:00:00';
  timerCircle.style.setProperty('--progress', '0%');
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  hoursInput.disabled = false;
  minutesInput.disabled = false;
  secondsInput.disabled = false;
  message.textContent = '';
  updatePhaseBadge();
}

function onTimerComplete() {
  disableFocusLock();
  fireConfetti();
}

/* =========================================================
   Focus Lock — game locking system
   ========================================================= */

function loadFocusLockSettings() {
  if (!focusLockEnabledCheckbox) return;
  const enabled = window.loadJSON ? window.loadJSON('focusLockEnabled', false) : false;
  const sites = window.loadJSON ? window.loadJSON('focusLockBlockedSites', '') : '';
  focusLockEnabledCheckbox.checked = !!enabled;
  if (focusLockBlockedSitesTextarea) focusLockBlockedSitesTextarea.value = sites || '';
}

function saveFocusLockSettings() {
  if (window.saveJSON) {
    window.saveJSON('focusLockEnabled', focusLockEnabledCheckbox ? !!focusLockEnabledCheckbox.checked : false);
    window.saveJSON('focusLockBlockedSites', focusLockBlockedSitesTextarea ? (focusLockBlockedSitesTextarea.value || '') : '');
  }
}

function getBlockedSites() {
  if (!focusLockBlockedSitesTextarea) return [];
  return focusLockBlockedSitesTextarea.value
    .split(/\n/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function isBlockedUrl(href) {
  try {
    const url = new URL(href, location.href);
    const host = url.hostname.toLowerCase();
    const blocked = getBlockedSites();
    return blocked.some(site => host === site || host.endsWith('.' + site) || site.includes(host));
  } catch (e) {
    return false;
  }
}

function focusLockBeforeUnload(e) {
  if (!focusLockActive || !isRunning) return;
  e.preventDefault();
  e.returnValue = '';
}

function focusLockVisibilityChange() {
  if (!focusLockActive) return;
  if (document.hidden && isRunning) {
    focusLockLeftPage = true;
    pauseTimerCore();
    if (message) message.textContent = 'Focus Lock: timer paused because you left the page.';
  } else if (!document.hidden && focusLockLeftPage) {
    showFocusLockOverlay('You left the page while the timer was running.');
  }
}

function focusLockAnchorClick(e) {
  if (!focusLockActive || !isRunning) return;
  const a = e.target.closest('a[href]');
  if (!a) return;
  if (isBlockedUrl(a.href)) {
    e.preventDefault();
    if (message) message.textContent = `Focus Lock: ${new URL(a.href).hostname} is blocked.`;
    return;
  }
  // Warn before leaving the timer page to another origin
  if (!a.href.startsWith(location.origin)) {
    e.preventDefault();
    showFocusLockOverlay('Leaving this page will break your focus session.');
  }
  // Same-page anchors are allowed by default
}

function showFocusLockOverlay(reason) {
  if (focusLockOverlay) {
    focusLockOverlay.classList.add('active');
    focusLockOverlay.setAttribute('aria-hidden', 'false');
  }
  if (focusLockReason) focusLockReason.textContent = reason || 'Focus Lock is on.';
}

function hideFocusLockOverlay() {
  if (focusLockOverlay) {
    focusLockOverlay.classList.remove('active');
    focusLockOverlay.setAttribute('aria-hidden', 'true');
  }
}

function enableFocusLock() {
  if (!focusLockEnabledCheckbox || !focusLockEnabledCheckbox.checked) return;
  focusLockActive = true;
  focusLockLeftPage = false;
  document.body.classList.add('focus-locked');
  window.addEventListener('beforeunload', focusLockBeforeUnload);
  document.addEventListener('visibilitychange', focusLockVisibilityChange);
  document.addEventListener('click', focusLockAnchorClick);
}

function disableFocusLock() {
  focusLockActive = false;
  focusLockLeftPage = false;
  document.body.classList.remove('focus-locked');
  window.removeEventListener('beforeunload', focusLockBeforeUnload);
  document.removeEventListener('visibilitychange', focusLockVisibilityChange);
  document.removeEventListener('click', focusLockAnchorClick);
  hideFocusLockOverlay();
}

function initFocusLock() {
  loadFocusLockSettings();
  if (focusLockHeader && focusLockPanel) {
    focusLockHeader.addEventListener('click', () => {
      focusLockPanel.classList.toggle('closed');
    });
    focusLockPanel.classList.add('closed');
  }
  if (focusLockEnabledCheckbox) {
    focusLockEnabledCheckbox.addEventListener('change', saveFocusLockSettings);
  }
  if (focusLockBlockedSitesTextarea) {
    focusLockBlockedSitesTextarea.addEventListener('input', saveFocusLockSettings);
  }
  if (focusLockResumeBtn) {
    focusLockResumeBtn.addEventListener('click', () => {
      focusLockLeftPage = false;
      hideFocusLockOverlay();
      startTimer();
    });
  }
  if (focusLockGiveUpBtn) {
    focusLockGiveUpBtn.addEventListener('click', () => {
      hideFocusLockOverlay();
      resetTimer();
      disableFocusLock();
    });
  }
}

presets.forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRunning) return;
    const mins = parseInt(btn.dataset.min, 10);
    hoursInput.value = 0;
    minutesInput.value = mins;
    secondsInput.value = 0;
    totalSeconds = mins * 60;
    remainingSeconds = totalSeconds;
    updateDisplay();
  });
});

function clearParticles() {
  document.querySelectorAll('.particle, .butterfly').forEach(p => p.remove());
}

function spawnParticles(theme) {
  clearParticles();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const count = theme === 'jungle' ? 5 : 10;

  if (theme === 'jungle') {
    for (let i = 0; i < count; i++) {
      const b = document.createElement('div');
      b.className = 'butterfly';
      b.style.color = ['#ff8a65', '#ffd93d', '#a8e6cf', '#ff6b8a'][i % 4];
      b.style.left = Math.random() * 100 + '%';
      b.style.top = (20 + Math.random() * 60) + '%';
      b.style.animationDelay = (Math.random() * 5) + 's';
      b.style.animationDuration = (4 + Math.random() * 3) + 's';
      document.body.appendChild(b);
    }
  }

  /* Theme-specific particle effects for greenhouse + beyond */
  if (theme === 'greenhouse') {
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 2 + Math.random() * 4;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.background = ['rgba(200,255,200,0.7)', 'rgba(255,255,220,0.7)', 'rgba(180,255,180,0.6)'][i % 3];
      p.style.boxShadow = `0 0 ${4 + Math.random() * 6}px ${p.style.background}`;
      p.style.animationDelay = (Math.random() * 6) + 's';
      p.style.animationDuration = (6 + Math.random() * 6) + 's';
      document.body.appendChild(p);
    }
  }

  if (theme === 'loft') {
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 2 + Math.random() * 3;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.background = 'rgba(255,248,220,0.55)';
      p.style.boxShadow = `0 0 ${3 + Math.random() * 4}px ${p.style.background}`;
      p.style.animationDelay = (Math.random() * 8) + 's';
      p.style.animationDuration = (10 + Math.random() * 8) + 's';
      document.body.appendChild(p);
    }
  }

  if (theme === 'cabin') {
    for (let i = 0; i < 8; i++) {
      const e = document.createElement('div');
      e.className = 'particle';
      e.style.width = '5px';
      e.style.height = '5px';
      e.style.left = (10 + Math.random() * 25) + '%';
      e.style.bottom = (15 + Math.random() * 20) + '%';
      e.style.top = 'auto';
      e.style.background = 'rgba(255,140,60,0.85)';
      e.style.boxShadow = '0 0 8px rgba(255,120,40,0.8)';
      e.style.animation = `ember-rise ${4 + Math.random() * 3}s infinite ease-out`;
      e.style.animationDelay = (Math.random() * 4) + 's';
      document.body.appendChild(e);
    }
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('div');
      s.className = 'particle';
      const size = 3 + Math.random() * 3;
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = '-5%';
      s.style.background = 'rgba(255,255,255,0.85)';
      s.style.animation = `snow-fall ${7 + Math.random() * 6}s infinite linear`;
      s.style.animationDelay = (Math.random() * 6) + 's';
      document.body.appendChild(s);
    }
  }

  if (theme === 'garden') {
    for (let i = 0; i < 5; i++) {
      const b = document.createElement('div');
      b.className = 'butterfly';
      b.style.color = ['#ffd93d', '#ff9a9e', '#a8e6cf', '#ff6b8a', '#c7ceea'][i % 5];
      b.style.left = Math.random() * 100 + '%';
      b.style.top = (20 + Math.random() * 55) + '%';
      b.style.animation = `butterfly-flutter ${5 + Math.random() * 4}s infinite ease-in-out`;
      b.style.animationDelay = (Math.random() * 5) + 's';
      document.body.appendChild(b);
    }
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.width = '10px';
      p.style.height = '10px';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = '-5%';
      p.style.background = ['rgba(255,180,190,0.75)', 'rgba(255,220,150,0.7)', 'rgba(220,180,255,0.7)'][i % 3];
      p.style.borderRadius = '50% 0 50% 0';
      p.style.animation = `petal-fall ${7 + Math.random() * 5}s infinite linear`;
      p.style.animationDelay = (Math.random() * 6) + 's';
      document.body.appendChild(p);
    }
  }

  if (theme === 'rooftop') {
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 4 + Math.random() * 8;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + '%';
      p.style.bottom = (10 + Math.random() * 25) + '%';
      p.style.top = 'auto';
      p.style.background = ['rgba(255,220,150,0.5)', 'rgba(255,180,180,0.45)', 'rgba(180,220,255,0.45)'][i % 3];
      p.style.filter = 'blur(3px)';
      p.style.borderRadius = '50%';
      p.style.animation = `bokeh-pulse ${3 + Math.random() * 4}s infinite ease-in-out`;
      p.style.animationDelay = (Math.random() * 4) + 's';
      document.body.appendChild(p);
    }
  }

  if (theme === 'bookstore') {
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 2 + Math.random() * 3;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.background = 'rgba(255,248,220,0.55)';
      p.style.boxShadow = `0 0 ${3 + Math.random() * 4}px ${p.style.background}`;
      p.style.animationDelay = (Math.random() * 8) + 's';
      p.style.animationDuration = (10 + Math.random() * 8) + 's';
      document.body.appendChild(p);
    }
  }

  if (theme === 'vinyl') {
    for (let i = 0; i < 8; i++) {
      const n = document.createElement('div');
      n.className = 'particle';
      n.textContent = ['♪', '♫', '♬', '♩'][i % 4];
      n.style.width = 'auto';
      n.style.height = 'auto';
      n.style.left = (20 + Math.random() * 60) + '%';
      n.style.top = (10 + Math.random() * 40) + '%';
      n.style.background = 'transparent';
      n.style.color = 'rgba(80,70,65,0.65)';
      n.style.fontSize = (14 + Math.random() * 10) + 'px';
      n.style.lineHeight = '1';
      n.style.borderRadius = '0';
      n.style.animation = `note-float ${5 + Math.random() * 4}s infinite ease-in-out`;
      n.style.animationDelay = (Math.random() * 5) + 's';
      document.body.appendChild(n);
    }
  }

  if (theme === 'morning-kitchen') {
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('div');
      s.className = 'particle';
      s.style.width = (14 + Math.random() * 10) + 'px';
      s.style.height = (30 + Math.random() * 20) + 'px';
      s.style.left = (18 + Math.random() * 16) + '%';
      s.style.bottom = (22 + Math.random() * 8) + '%';
      s.style.top = 'auto';
      s.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 100%)';
      s.style.borderRadius = '50%';
      s.style.filter = 'blur(5px)';
      s.style.animation = `steam-rise ${3 + Math.random() * 2}s infinite ease-out`;
      s.style.animationDelay = (Math.random() * 3) + 's';
      document.body.appendChild(s);
    }
  }

  if (theme === 'sunny-meadow') {
    for (let i = 0; i < 5; i++) {
      const b = document.createElement('div');
      b.className = 'butterfly';
      b.style.color = ['#ffd93d', '#ff9a9e', '#a8e6cf', '#ffb347', '#c7ceea'][i % 5];
      b.style.left = Math.random() * 100 + '%';
      b.style.top = (15 + Math.random() * 50) + '%';
      b.style.animation = `butterfly-flutter ${5 + Math.random() * 4}s infinite ease-in-out`;
      b.style.animationDelay = (Math.random() * 5) + 's';
      document.body.appendChild(b);
    }
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 2 + Math.random() * 4;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.background = ['rgba(255,255,180,0.75)', 'rgba(255,220,150,0.7)', 'rgba(200,255,180,0.6)'][i % 3];
      p.style.boxShadow = `0 0 ${4 + Math.random() * 5}px ${p.style.background}`;
      p.style.animationDelay = (Math.random() * 6) + 's';
      p.style.animationDuration = (6 + Math.random() * 6) + 's';
      document.body.appendChild(p);
    }
  }

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = 3 + Math.random() * 5;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.animationDelay = (Math.random() * 6) + 's';
    p.style.animationDuration = (5 + Math.random() * 5) + 's';

    const colors = {
      coastal: ['rgba(255,255,255,0.8)', 'rgba(255,230,180,0.7)', 'rgba(200,240,255,0.6)'],
      forest: ['rgba(255,250,205,0.85)', 'rgba(180,255,180,0.6)', 'rgba(255,255,255,0.5)'],
      beach: ['rgba(255,255,255,0.8)', 'rgba(255,230,150,0.7)', 'rgba(200,250,255,0.6)'],
      jungle: ['rgba(255,255,255,0.5)', 'rgba(180,255,200,0.4)', 'rgba(255,200,150,0.4)'],
      bamboo: ['rgba(255,255,255,0.7)', 'rgba(200,230,180,0.5)', 'rgba(255,250,220,0.5)'],
      mountain: ['rgba(255,255,255,0.85)', 'rgba(200,240,255,0.6)', 'rgba(255,255,255,0.4)'],
      sunset: ['rgba(255,230,200,0.8)', 'rgba(255,180,180,0.7)', 'rgba(200,150,220,0.6)'],
      'ocean-deep': ['rgba(200,240,255,0.8)', 'rgba(144,224,239,0.7)', 'rgba(0,180,216,0.5)'],
      desert: ['rgba(255,250,220,0.8)', 'rgba(233,196,106,0.7)', 'rgba(244,162,97,0.6)'],
      aurora: ['rgba(180,255,200,0.7)', 'rgba(192,132,252,0.6)', 'rgba(112,224,0,0.5)'],
      'city-night': ['rgba(255,255,255,0.7)', 'rgba(76,201,240,0.6)', 'rgba(247,37,133,0.5)'],
      'cherry-blossom': ['rgba(255,240,243,0.85)', 'rgba(255,204,213,0.75)', 'rgba(255,143,163,0.6)'],
      lavender: ['rgba(243,232,255,0.85)', 'rgba(224,170,255,0.75)', 'rgba(199,125,255,0.6)'],
      autumn: ['rgba(255,243,230,0.85)', 'rgba(255,186,8,0.7)', 'rgba(232,93,4,0.6)'],
      winter: ['rgba(240,249,255,0.9)', 'rgba(144,224,239,0.7)', 'rgba(202,240,248,0.6)'],
      tropical: ['rgba(255,251,230,0.8)', 'rgba(255,190,11,0.7)', 'rgba(255,0,110,0.5)'],
      space: ['rgba(248,247,255,0.8)', 'rgba(224,216,255,0.7)', 'rgba(199,125,255,0.6)'],
      'cotton-candy': ['rgba(255,245,248,0.85)', 'rgba(255,153,200,0.7)', 'rgba(160,216,239,0.6)'],
      midnight: ['rgba(241,245,249,0.8)', 'rgba(76,149,239,0.6)', 'rgba(67,97,238,0.5)'],
      mint: ['rgba(240,253,250,0.9)', 'rgba(153,246,228,0.75)', 'rgba(94,234,212,0.6)'],
      'rose-gold': ['rgba(255,245,245,0.85)', 'rgba(233,196,106,0.7)', 'rgba(199,125,255,0.5)'],
      storm: ['rgba(241,245,249,0.8)', 'rgba(148,163,184,0.7)', 'rgba(71,85,105,0.6)'],
      'golden-hour': ['rgba(255,251,235,0.85)', 'rgba(251,191,36,0.75)', 'rgba(245,158,11,0.6)'],
      'foggy-lake': ['rgba(248,250,252,0.9)', 'rgba(203,213,225,0.8)', 'rgba(148,163,184,0.7)'],
      neon: ['rgba(248,249,250,0.8)', 'rgba(0,245,255,0.6)', 'rgba(255,0,110,0.5)'],
      pastel: ['rgba(255,250,247,0.9)', 'rgba(255,200,221,0.75)', 'rgba(189,224,254,0.7)'],
      library: ['rgba(248,245,240,0.85)', 'rgba(232,224,213,0.75)', 'rgba(139,94,60,0.5)'],
      greenhouse: ['rgba(245,249,244,0.85)', 'rgba(224,236,224,0.75)', 'rgba(127,163,127,0.6)'],
      loft: ['rgba(245,243,239,0.85)', 'rgba(224,221,214,0.75)', 'rgba(122,107,90,0.55)'],
      cabin: ['rgba(247,243,237,0.85)', 'rgba(230,221,208,0.75)', 'rgba(139,90,60,0.55)'],
      garden: ['rgba(249,251,246,0.85)', 'rgba(232,240,224,0.75)', 'rgba(154,191,118,0.6)'],
      rooftop: ['rgba(250,246,238,0.85)', 'rgba(242,234,221,0.75)', 'rgba(201,125,96,0.55)'],
      bookstore: ['rgba(248,245,240,0.85)', 'rgba(232,224,213,0.75)', 'rgba(139,94,60,0.5)'],
      vinyl: ['rgba(245,243,239,0.85)', 'rgba(224,221,214,0.75)', 'rgba(107,76,61,0.5)'],
      'morning-kitchen': ['rgba(255,251,246,0.85)', 'rgba(242,232,220,0.75)', 'rgba(201,125,96,0.55)'],
      'sunny-meadow': ['rgba(251,249,240,0.85)', 'rgba(240,234,212,0.75)', 'rgba(199,184,106,0.6)']
    };
    const themeColors = colors[theme] || colors.coastal;
    p.style.background = themeColors[i % themeColors.length];
    p.style.boxShadow = `0 0 ${4 + Math.random() * 6}px ${p.style.background}`;
    document.body.appendChild(p);
  }
}

zenBtn.addEventListener('click', () => {
  document.body.classList.toggle('zen');
  zenBtn.textContent = document.body.classList.contains('zen') ? 'Exit Zen' : '🧘 Zen';
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});



document.addEventListener('DOMContentLoaded', () => {
  if (typeof totalSeconds !== 'undefined') {
    totalSeconds = getInputSeconds();
    remainingSeconds = totalSeconds;
    updateDisplay();
  }
  initFocusLock();
});

(function () {
  'use strict';

const $ = (sel) => document.querySelector(sel);
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


const featureBar = $('#fcFeatureBar') || document.createElement('div');
featureBar.className = 'fc-feature-bar';
featureBar.innerHTML = `
  <button class="fc-toggle" id="fcPomodoroBtn" type="button" title="Open Pomodoro settings">🍅 Pomodoro</button>
  <button class="fc-toggle" id="fcLofiBtn" type="button" title="Play calming study music">🎵 Music: OFF</button>
  <select class="fc-music-select" id="fcMusicStyle" title="Music style">
    <option value="lofi">Lofi Study</option>
    <option value="cafe">Cafe Jazz</option>
    <option value="ambient">Ambient</option>
  </select>
  <input class="fc-music-slider" id="fcLofiVolume" type="range" min="0" max="1" step="0.05" value="0.4" title="Music volume">
`;
if (!featureBar.parentNode) {
  const buttons = $('.buttons');
  if (buttons) buttons.after(featureBar);
}

const pomodoroPanel = document.createElement('div');
pomodoroPanel.className = 'fc-pomodoro-panel';
pomodoroPanel.id = 'fcPomodoroPanel';
pomodoroPanel.innerHTML = `
  <div class="fc-pomodoro-card">
    <h3>🍅 Pomodoro Settings</h3>
    <p>Turn Pomodoro on, set your focus and break lengths, then press Start on the timer.</p>
    <div class="fc-pomodoro-inputs">
      <div class="fc-pomodoro-group">
        <label>Focus length (minutes)</label>
        <input type="number" id="fcPomodoroWork" min="1" max="180" value="25">
      </div>
      <div class="fc-pomodoro-group">
        <label>Break length (minutes, max 30)</label>
        <input type="number" id="fcPomodoroBreak" min="1" max="30" value="5">
      </div>
      <div class="fc-pomodoro-group" style="flex-direction: row; align-items: center; justify-content: center; gap: 10px;">
        <label style="margin: 0;">Pomodoro mode</label>
        <button class="fc-toggle" id="fcPomodoroToggle" type="button">OFF</button>
      </div>
    </div>
    <div class="fc-pomodoro-error" id="fcPomodoroError"></div>
    <div class="fc-pomodoro-actions">
      <button class="fc-pomodoro-save" id="fcPomodoroSave" type="button">Save</button>
      <button class="fc-pomodoro-cancel" id="fcPomodoroCancel" type="button">Cancel</button>
    </div>
  </div>
`;
document.body.appendChild(pomodoroPanel);

const pomodoroBtn = $('#fcPomodoroBtn');
const lofiBtn = $('#fcLofiBtn');
const lofiVolume = $('#fcLofiVolume');
const musicStyleSelect = $('#fcMusicStyle');


const pomodoroDefaults = { enabled: false, mode: 'work', workMinutes: 25, breakMinutes: 5 };
const pomodoro = loadJSON('fcPomodoro', pomodoroDefaults);
window.pomodoro = pomodoro;
let autoCycleTimeout = null;

const pomodoroWorkInput = $('#fcPomodoroWork');
const pomodoroBreakInput = $('#fcPomodoroBreak');
const pomodoroSaveBtn = $('#fcPomodoroSave');
const pomodoroCancelBtn = $('#fcPomodoroCancel');
const pomodoroError = $('#fcPomodoroError');
const pomodoroToggle = $('#fcPomodoroToggle');
let pomodoroModeOn = pomodoro.enabled;

function updatePomodoroUI() {
  if (!pomodoroBtn) return;
  if (pomodoro.enabled) {
    pomodoroBtn.textContent = '🍅 Pomodoro: ' + pomodoro.workMinutes + '/' + pomodoro.breakMinutes;
    pomodoroBtn.classList.add('active');
  } else {
    pomodoroBtn.textContent = '🍅 Pomodoro';
    pomodoroBtn.classList.remove('active');
  }
}
updatePomodoroUI();

if (pomodoro.enabled && !isRunning) {
  setPomodoroInputs(pomodoro.mode === 'break' ? pomodoro.breakMinutes : pomodoro.workMinutes);
  if (typeof updateDisplay === 'function') updateDisplay();
}

function updatePomodoroToggleUI() {
  if (!pomodoroToggle) return;
  pomodoroToggle.textContent = pomodoroModeOn ? 'ON' : 'OFF';
  pomodoroToggle.classList.toggle('active', pomodoroModeOn);
}

function openPomodoroPanel() {
  pomodoroModeOn = pomodoro.enabled;
  if (pomodoroWorkInput) pomodoroWorkInput.value = pomodoro.workMinutes;
  if (pomodoroBreakInput) pomodoroBreakInput.value = pomodoro.breakMinutes;
  if (pomodoroError) pomodoroError.textContent = '';
  updatePomodoroToggleUI();
  pomodoroPanel.classList.add('open');
}

function closePomodoroPanel() {
  pomodoroPanel.classList.remove('open');
}

function setPomodoroInputs(minutes) {
  if (hoursInput) hoursInput.value = 0;
  if (minutesInput) minutesInput.value = minutes;
  if (secondsInput) secondsInput.value = 0;
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function startNextPomodoroPhase(minutes, messageText) {
  if (autoCycleTimeout) clearTimeout(autoCycleTimeout);
  autoCycleTimeout = setTimeout(() => {
    autoCycleTimeout = null;
    setPomodoroInputs(minutes);
    if (totalSeconds !== undefined) totalSeconds = minutes * 60;
    if (remainingSeconds !== undefined) remainingSeconds = minutes * 60;
    if (typeof updateDisplay === 'function') updateDisplay();
    if (message) message.textContent = messageText;
    if (typeof startTimer === 'function') startTimer();
  }, prefersReducedMotion() ? 0 : 450);
}

function savePomodoroSettings() {
  const work = parseInt(pomodoroWorkInput.value, 10);
  const breakMin = parseInt(pomodoroBreakInput.value, 10);

  if (!Number.isFinite(work) || work < 1 || work > 180) {
    pomodoroError.textContent = 'Focus length must be 1–180 minutes.';
    return;
  }
  if (!Number.isFinite(breakMin) || breakMin < 1 || breakMin > 30) {
    pomodoroError.textContent = 'Break length must be 1–30 minutes.';
    return;
  }

  pomodoro.workMinutes = work;
  pomodoro.breakMinutes = breakMin;
  pomodoro.enabled = pomodoroModeOn;
  pomodoro.mode = 'work';
  saveJSON('fcPomodoro', pomodoro);
  updatePomodoroUI();
  closePomodoroPanel();

  if (pomodoro.enabled && !isRunning && remainingSeconds <= 0) {
    setPomodoroInputs(pomodoro.workMinutes);
    if (typeof updateDisplay === 'function') updateDisplay();
  }
}

if (pomodoroBtn) {
  pomodoroBtn.addEventListener('click', () => {
    if (pomodoro.enabled) {
      pomodoro.enabled = false;
      pomodoro.mode = 'work';
      if (autoCycleTimeout) { clearTimeout(autoCycleTimeout); autoCycleTimeout = null; }
      saveJSON('fcPomodoro', pomodoro);
      lofi.setMood('chill');
      updatePomodoroUI();
    } else {
      openPomodoroPanel();
    }
  });
}

if (pomodoroSaveBtn) pomodoroSaveBtn.addEventListener('click', savePomodoroSettings);
if (pomodoroCancelBtn) pomodoroCancelBtn.addEventListener('click', closePomodoroPanel);
if (pomodoroToggle) {
  pomodoroToggle.addEventListener('click', () => {
    pomodoroModeOn = !pomodoroModeOn;
    updatePomodoroToggleUI();
  });
}
pomodoroPanel.addEventListener('click', (e) => {
  if (e.target === pomodoroPanel) closePomodoroPanel();
});

const originalStartTimer = (typeof startTimer === 'function') ? startTimer : null;
const originalPauseTimer = (typeof pauseTimer === 'function') ? pauseTimer : null;
const originalResetTimer = (typeof resetTimer === 'function') ? resetTimer : null;

if (originalStartTimer) {
  startTimer = function () {
    if (autoCycleTimeout) { clearTimeout(autoCycleTimeout); autoCycleTimeout = null; }
    if (pomodoro.enabled && !isRunning) {
      if (pomodoro.mode === 'work') {
        setPomodoroInputs(pomodoro.workMinutes);
        lofi.setMood('chill');
      }
      saveJSON('fcPomodoro', pomodoro);
      if (typeof updateDisplay === 'function') updateDisplay();
    }
    const result = originalStartTimer.apply(this, arguments);
    return result;
  };
}

if (originalPauseTimer) {
  pauseTimer = function () {
    if (autoCycleTimeout) { clearTimeout(autoCycleTimeout); autoCycleTimeout = null; }
    return originalPauseTimer.apply(this, arguments);
  };
}

if (originalResetTimer) {
  resetTimer = function () {
    if (autoCycleTimeout) { clearTimeout(autoCycleTimeout); autoCycleTimeout = null; }
    pomodoro.mode = 'work';
    saveJSON('fcPomodoro', pomodoro);
    lofi.setMood('chill');
    return originalResetTimer.apply(this, arguments);
  };
}

const _origOnTimerComplete = (typeof onTimerComplete === 'function') ? onTimerComplete : null;
onTimerComplete = function () {
  if (pomodoro.enabled) {
    if (pomodoro.mode === 'work') {
      pomodoro.mode = 'break';
      saveJSON('fcPomodoro', pomodoro);
      buzzFiveTimes();
      fireConfetti();
      lofi.setMood('happy');
      setPomodoroInputs(pomodoro.breakMinutes);
      if (totalSeconds !== undefined) totalSeconds = pomodoro.breakMinutes * 60;
      if (remainingSeconds !== undefined) remainingSeconds = pomodoro.breakMinutes * 60;
      if (typeof updateDisplay === 'function') updateDisplay();
      if (message) message.textContent = 'Focus done — enjoy your ' + pomodoro.breakMinutes + '-minute break 🌿';
      updatePhaseBadge();
      startBtn.disabled = true;
      pauseBtn.disabled = true;
      hoursInput.disabled = true;
      minutesInput.disabled = true;
      secondsInput.disabled = true;
      if (autoCycleTimeout) clearTimeout(autoCycleTimeout);
      autoCycleTimeout = setTimeout(() => {
        startNextPomodoroPhase(pomodoro.breakMinutes, 'Break time — recharge 🌿');
      }, prefersReducedMotion() ? 0 : 1100);
    } else {
      pomodoro.mode = 'work';
      saveJSON('fcPomodoro', pomodoro);
      lofi.setMood('chill');
      clearInterval(interval);
      interval = null;
      isRunning = false;
      timerCircle.classList.remove('running');
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      hoursInput.disabled = false;
      minutesInput.disabled = false;
      secondsInput.disabled = false;
      message.textContent = 'Pomodoro complete. Take a bow 🎉';
      updatePhaseBadge();
      fireConfetti();
    }
  } else if (_origOnTimerComplete) {
    _origOnTimerComplete();
    lofi.setMood('chill');
  }
};

class LofiMusic {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.isPlaying = false;
    this.nextNoteTime = 0;
    this.tempo = 72;
    this.lookahead = 0.1;
    this.scheduleAheadTime = 0.3;
    this.timerID = null;
    this.bar = 0;
    this.beat = 0;
    this.sixteenth = 0;
    this.volume = 0.4;
    this.mood = 'chill';
    this.style = 'lofi';
    this.styles = {
      lofi: {
        tempos: { chill: 72, happy: 108 },
        chords: {
          chill: [
            { root: 60, type: 'maj7', name: 'Cmaj7' },
            { root: 57, type: 'min7', name: 'Am7' },
            { root: 62, type: 'min7', name: 'Dm7' },
            { root: 55, type: 'dom7', name: 'G7' }
          ],
          happy: [
            { root: 60, type: 'maj', name: 'C' },
            { root: 67, type: 'maj', name: 'G' },
            { root: 69, type: 'min', name: 'Am' },
            { root: 65, type: 'maj', name: 'F' }
          ]
        }
      },
      cafe: {
        tempos: { chill: 80, happy: 100 },
        chords: {
          chill: [
            { root: 60, type: 'maj7', name: 'Cmaj7' },
            { root: 62, type: 'min7', name: 'Dm7' },
            { root: 65, type: 'maj7', name: 'Fmaj7' },
            { root: 59, type: 'dom7', name: 'G7' }
          ],
          happy: [
            { root: 60, type: 'maj7', name: 'Cmaj7' },
            { root: 65, type: 'maj7', name: 'Fmaj7' },
            { root: 67, type: 'dom7', name: 'G7' },
            { root: 60, type: 'maj7', name: 'Cmaj7' }
          ]
        }
      },
      ambient: {
        tempos: { chill: 55, happy: 72 },
        chords: {
          chill: [
            { root: 60, type: 'maj9', name: 'Cmaj9' },
            { root: 57, type: 'min9', name: 'Am9' },
            { root: 62, type: 'min9', name: 'Dm9' },
            { root: 55, type: 'maj9', name: 'Gmaj9' }
          ],
          happy: [
            { root: 60, type: 'maj9', name: 'Cmaj9' },
            { root: 65, type: 'maj9', name: 'Fmaj9' },
            { root: 67, type: 'maj9', name: 'Gmaj9' },
            { root: 60, type: 'maj9', name: 'Cmaj9' }
          ]
        }
      }
    };
    this.chordProgression = this.styles.lofi.chords.chill;
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.startTime = this.ctx.currentTime + 0.1;
    this.nextNoteTime = this.startTime;
  }

  setVolume(v) {
    this.volume = parseFloat(v);
    if (this.master) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
    }
  }

  setMood(mood) {
    if (!this.styles[this.style]?.chords[mood]) return;
    this.mood = mood;
    this.chordProgression = this.styles[this.style].chords[mood];
  }

  setStyle(style) {
    if (!this.styles[style]) return;
    this.style = style;
    this.chordProgression = this.styles[style].chords[this.mood];
  }

  playRhodes(midi, time, duration, velocity = 0.5) {
    const freq = this.midiToFreq(midi);
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc3.type = 'sine';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 2;
    osc3.frequency.value = freq * 0.5;

    osc2.detune.value = 6;
    osc3.detune.value = -5;

    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(velocity * 0.25, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(velocity * 0.15, time + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.05);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc1.start(time);
    osc2.start(time);
    osc3.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
    osc3.stop(time + duration);
  }

  playBass(midi, time, duration, velocity = 0.6) {
    const freq = this.midiToFreq(midi);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 0.5;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(velocity * 0.35, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(velocity * 0.2, time + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.02);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc.start(time);
    osc.stop(time + duration);
  }

  playKick(time, velocity = 0.8) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    gain.gain.setValueAtTime(velocity * 0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  playSnare(time, velocity = 0.5) {
    const noise = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1200;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(velocity * 0.3, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    const tone = this.ctx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.value = 250;
    const toneGain = this.ctx.createGain();
    toneGain.gain.setValueAtTime(velocity * 0.08, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.master);
    tone.connect(toneGain);
    toneGain.connect(this.master);

    noise.start(time);
    noise.stop(time + 0.2);
    tone.start(time);
    tone.stop(time + 0.1);
  }

  playHiHat(time, velocity = 0.25, open = false) {
    const noise = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = this.ctx.createGain();
    const duration = open ? 0.18 : 0.05;
    gain.gain.setValueAtTime(velocity * 0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    noise.start(time);
    noise.stop(time + duration);
  }

  playBrush(time, velocity = 0.2) {
    const noise = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(velocity * 0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    noise.start(time);
    noise.stop(time + 0.15);
  }

  playPad(midi, time, duration, velocity = 0.3) {
    const freq = this.midiToFreq(midi);
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 1.5;
    osc2.detune.value = 8;

    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(velocity * 0.2, time + 0.8);
    gain.gain.setValueAtTime(velocity * 0.2, time + duration - 1);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }

  playVinylCrackle() {
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.08;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.8;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start();
    this.vinyl = { source: noise, gain };
  }

  stopVinylCrackle() {
    if (this.vinyl) {
      try { this.vinyl.source.stop(); } catch (e) {}
      this.vinyl = null;
    }
  }

  chordNotes(root, type) {
    const intervals = {
      maj: [0, 4, 7],
      min: [0, 3, 7],
      maj7: [0, 4, 7, 11],
      min7: [0, 3, 7, 10],
      dom7: [0, 4, 7, 10],
      maj9: [0, 4, 7, 11, 14],
      min9: [0, 3, 7, 10, 14]
    };
    return (intervals[type] || intervals.maj7).map(i => root + i);
  }

  scheduleStep() {
    const styleData = this.styles[this.style];
    const tempo = styleData.tempos[this.mood];
    const secondsPerBeat = 60 / tempo;
    const secondsPerSixteenth = secondsPerBeat / 4;
    const time = this.nextNoteTime;
    const isHappy = this.mood === 'happy';
    const isAmbient = this.style === 'ambient';

    const chordIndex = Math.floor(this.bar / (isHappy ? 1 : 2)) % this.chordProgression.length;
    const chord = this.chordProgression[chordIndex];
    const chordDuration = isHappy ? secondsPerBeat * 2 : secondsPerBeat * 4 * 2;

    if (this.beat === 0 && this.sixteenth === 0) {
      const notes = this.chordNotes(chord.root, chord.type);
      const vel = isHappy ? 0.55 : 0.4;
      if (isAmbient) {
        notes.forEach((midi, i) => {
          this.playPad(midi, time, chordDuration - 0.1, vel - i * 0.02);
        });
      } else {
        notes.forEach((midi, i) => {
          this.playRhodes(midi, time, chordDuration - 0.1, vel - i * 0.02);
        });
      }
      if (!isAmbient) {
        this.playBass(chord.root - 24, time, chordDuration - 0.1, isHappy ? 0.65 : 0.5);
      }
    }

    if (!isAmbient) {
      if (this.style === 'cafe') {
        if (this.beat === 0 && this.sixteenth === 0) this.playKick(time, 0.6);
        if (this.beat === 2 && this.sixteenth === 0) this.playSnare(time, 0.35);
        const brushPattern = isHappy ? [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0] : [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
        if (brushPattern[this.sixteenth + this.beat * 4]) {
          this.playBrush(time, isHappy ? 0.22 : 0.16);
        }
      } else {
        if (isHappy) {
          if (this.beat === 0 && this.sixteenth === 0) this.playKick(time, 0.85);
          if (this.beat === 1 && this.sixteenth === 0) this.playSnare(time, 0.55);
          if (this.beat === 2 && this.sixteenth === 0) this.playKick(time, 0.7);
          if (this.beat === 3 && this.sixteenth === 0) this.playSnare(time, 0.55);
          const happyHiHat = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
          if (happyHiHat[this.sixteenth + this.beat * 4]) {
            this.playHiHat(time, 0.18, this.sixteenth === 3);
          }
        } else {
          if (this.beat === 0 && this.sixteenth === 0) this.playKick(time, 0.7);
          if (this.beat === 2 && this.sixteenth === 0) this.playKick(time, 0.5);
          if (this.beat === 2 && this.sixteenth === 0) this.playSnare(time, 0.4);
          const hiHatPattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1];
          if (hiHatPattern[this.sixteenth + this.beat * 4]) {
            this.playHiHat(time, 0.2, this.sixteenth === 3 && this.beat === 3);
          }
        }
      }
    }

    this.nextNoteTime += secondsPerSixteenth;
    this.sixteenth++;
    if (this.sixteenth >= 4) {
      this.sixteenth = 0;
      this.beat++;
      if (this.beat >= 4) {
        this.beat = 0;
        this.bar++;
      }
    }
  }

  scheduler() {
    this.timerID = null;
    if (!this.isPlaying) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleStep();
    }
    this.timerID = setTimeout(() => this.scheduler(), this.lookahead * 1000);
  }

  start() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.playVinylCrackle();
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
    this.stopVinylCrackle();
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }
}

const lofi = new LofiMusic();

function buzzFiveTimes() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const buzzTimes = [0, 0.55, 1.1, 1.65, 2.2];

    buzzTimes.forEach((offset) => {
      const t = now + offset;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(180, t);
      osc1.frequency.exponentialRampToValueAtTime(150, t + 0.35);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(360, t);
      osc2.frequency.exponentialRampToValueAtTime(300, t + 0.35);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.45);
      osc2.stop(t + 0.45);
    });

    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate([200, 150, 200, 150, 200]);
    }
  } catch (e) {}
}

const musicSettings = loadJSON('fcMusicSettings', { style: 'lofi', volume: 0.4 });

function updateLofiUI() {
  if (!lofiBtn) return;
  lofiBtn.textContent = lofi.isPlaying ? '🎵 Music: ON' : '🎵 Music: OFF';
  lofiBtn.classList.toggle('active', lofi.isPlaying);
}

function saveMusicSettings() {
  saveJSON('fcMusicSettings', { style: lofi.style, volume: lofi.volume });
}

if (lofiBtn) {
  lofiBtn.addEventListener('click', () => {
    if (lofi.isPlaying) {
      lofi.stop();
    } else {
      lofi.start();
    }
    updateLofiUI();
  });
}

if (lofiVolume) {
  lofiVolume.value = musicSettings.volume;
  lofi.setVolume(musicSettings.volume);
  lofiVolume.addEventListener('input', () => {
    lofi.setVolume(lofiVolume.value);
    saveMusicSettings();
  });
}

if (musicStyleSelect) {
  musicStyleSelect.value = musicSettings.style;
  lofi.setStyle(musicSettings.style);
  musicStyleSelect.addEventListener('change', () => {
    const wasPlaying = lofi.isPlaying;
    const currentMood = lofi.mood;
    lofi.setStyle(musicStyleSelect.value);
    lofi.setMood(currentMood);
    saveMusicSettings();
    if (wasPlaying) {
      lofi.stop();
      lofi.start();
    }
  });
}

document.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

  if (e.code === 'Space' && !isTyping) {
    e.preventDefault();
    if (typeof isRunning !== 'undefined' && isRunning) {
      if (!pauseBtn || !pauseBtn.disabled) {
        if (typeof pauseTimer === 'function') pauseTimer();
      }
    } else {
      if (!startBtn || !startBtn.disabled) {
        if (typeof startTimer === 'function') startTimer();
      }
    }
    return;
  }

  if ((e.key === 'r' || e.key === 'R') && !isTyping) {
    e.preventDefault();
    if (typeof resetTimer === 'function') resetTimer();
    return;
  }

  if (e.key === '?' && !isTyping) {
    e.preventDefault();
    if (shortcutsPanel && shortcutsPanel.classList.contains('open')) {
      closeShortcutsPanel();
    } else {
      openShortcutsPanel();
    }
    return;
  }
  if (e.key === 'Escape' && document.body.classList.contains('zen')) {
    e.preventDefault();
    document.body.classList.remove('zen');
    const zenBtn = $('#zenBtn');
    if (zenBtn) zenBtn.textContent = '🧘 Zen';
  }
});

startBtn.addEventListener('click', () => { if (typeof startTimer === 'function') startTimer(); });
pauseBtn.addEventListener('click', () => { if (typeof pauseTimer === 'function') pauseTimer(); });
resetBtn.addEventListener('click', () => { if (typeof resetTimer === 'function') resetTimer(); });

const shortcutsPanel = $('#shortcutsPanel');
const shortcutsClose = $('#shortcutsClose');

function openShortcutsPanel() {
  if (shortcutsPanel) shortcutsPanel.classList.add('open');
}
function closeShortcutsPanel() {
  if (shortcutsPanel) shortcutsPanel.classList.remove('open');
}

if (shortcutsBtn) {
  shortcutsBtn.addEventListener('click', () => {
    if (shortcutsPanel && shortcutsPanel.classList.contains('open')) {
      closeShortcutsPanel();
    } else {
      openShortcutsPanel();
    }
  });
}
if (shortcutsClose) shortcutsClose.addEventListener('click', closeShortcutsPanel);
if (shortcutsPanel) {
  shortcutsPanel.addEventListener('click', (e) => {
    if (e.target === shortcutsPanel) closeShortcutsPanel();
  });
}

(function initPolishEntrances() {
  const targets = [
    { sel: '#timerCircle', delay: 'delay-1', restoreAnimation: true },
    { sel: '.buttons', delay: 'delay-2' },
    { sel: '#fcProductivityPanel', delay: 'delay-3' },
    { sel: '.atmosphere-section', delay: 'delay-4' }
  ];
  targets.forEach(({ sel, delay, restoreAnimation }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.classList.add('polish-entrance', delay);
    if (restoreAnimation) {
      setTimeout(() => {
        el.classList.remove('polish-entrance', delay);
      }, 850);
    }
  });
})();

})();
