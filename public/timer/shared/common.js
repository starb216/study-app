/* shared/common.js — Lock In Timer shared state and helpers */
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

  function applyTheme(theme) {
    const body = document.body;
    if (!body) return;
    const isZen = body.classList.contains('zen');
    const isDark = body.classList.contains('dark-mode');
    const isCustomBg = body.classList.contains('custom-bg');
    body.className = theme + (isZen ? ' zen' : '') + (isDark ? ' dark-mode' : '') + (isCustomBg ? ' custom-bg' : '');

    const pageTitle = $('#pageTitle');
    const themeQuote = $('#themeQuote');
    if (pageTitle && themeNames[theme]) pageTitle.textContent = themeNames[theme];
    if (themeQuote && themeQuotes[theme]) themeQuote.textContent = themeQuotes[theme];

    $$('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
    saveJSON('lockInTimerTheme', theme);
    spawnParticles(theme);
  }

  function applyDarkMode(isDark) {
    const body = document.body;
    if (!body) return;
    body.classList.toggle('dark-mode', isDark);
    const darkSwitch = $('#darkModeSwitch');
    if (darkSwitch) darkSwitch.classList.toggle('on', isDark);
    saveJSON('atmosphereDarkMode', isDark);
  }

  function cssEscapeString(str) {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/;/g, '\\;')
      .replace(/\}/g, '\\}')
      .replace(/\n/g, '\\A ')
      .replace(/\r/g, '\\D ');
  }

  function applyCustomBackground(url) {
    const body = document.body;
    const customBgLayer = $('#customBgLayer');
    if (!url) {
      if (body) body.classList.remove('custom-bg');
      if (customBgLayer) customBgLayer.style.backgroundImage = '';
      saveJSON('coastalCustomBackground', '');
      return;
    }
    if (body) body.classList.add('custom-bg');
    if (customBgLayer) customBgLayer.style.backgroundImage = 'url("' + cssEscapeString(url) + '")';
    saveJSON('coastalCustomBackground', url);
  }

  function initShared() {
    const savedTheme = loadJSON('lockInTimerTheme', 'coastal');
    applyTheme(savedTheme);

    const savedDark = loadJSON('atmosphereDarkMode', false);
    applyDarkMode(savedDark);

    const savedCustomBg = loadJSON('coastalCustomBackground', '');
    if (savedCustomBg) applyCustomBackground(savedCustomBg);

    $$('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
    });
  }

  window.$ = $;
  window.$$ = $$;
  window.loadJSON = loadJSON;
  window.saveJSON = saveJSON;
  window.todayStr = todayStr;
  window.computeStreak = computeStreak;
  window.themeNames = themeNames;
  window.themeQuotes = themeQuotes;
  window.clearParticles = clearParticles;
  window.spawnParticles = spawnParticles;
  window.applyTheme = applyTheme;
  window.applyDarkMode = applyDarkMode;
  window.applyCustomBackground = applyCustomBackground;
  window.initShared = initShared;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShared);
  } else {
    initShared();
  }
})();
