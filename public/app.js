const API_URL = '';

let currentUser = null;
let currentView = 'dashboard';
let calendarDate = new Date();
let timerInterval = null;
let timerRemaining = 0;
let timerRunning = false;
let timerSecondsWorked = 0;
let timerSessionId = null;
let timerPendingAward = null;
let notifyInterval = null;
let calendarViewMode = 'month';
let visualSelectedDate = new Date();
let visualShowReligious = localStorage.getItem('cal_show_religious') === 'true';
let visualPendingDate = null;
let visualCurrentAlarm = null;
let alarmAudioCtx = null;
let alarmOsc = null;
let alarmInterval = null;
let alarmCheckInterval = null;
let hideCompletedItems = localStorage.getItem('cal_hide_completed') === 'true';

let sleepSchedule = null;
let sleepAlarmInterval = null;
let sleepAlarmAudioCtx = null;
let sleepAlarmMasterGain = null;
let sleepAlarmOscillators = [];
let sleepAlarmTimeout = null;
let sleepAlarmTriggeredToday = null;
let sleepBedtimeTriggeredToday = null;
let sleepSnoozeUntil = null;
let sleepAudioUnlocked = false;
let sleepAlarmPlaying = false;
let sleepAlarmFileAudio = null;
let sleepSoundsManifest = null;
let currentTheme = localStorage.getItem('studymint_theme') || '';
const triggeredAlarms = new Set();

const KEY_OCCASIONS = 'cal_occasions';
const KEY_REMINDERS = 'cal_reminders';
const KEY_MOODS = 'cal_moods';
const KEY_SHOW_RELIGIOUS = 'cal_show_religious';

const SCHOOL_WORDS = ['homework', 'meeting', 'exam', 'class', 'test', 'project', 'assignment', 'study', 'studying', 'presentation', 'school', 'lecture', 'quiz', 'course', 'deadline'];
const FAMILY_WORDS = ['family', 'birthday', 'anniversary', 'mother', 'father', 'mom', 'dad', 'brother', 'sister', 'grandma', 'grandpa', 'love', 'commemoration', 'memorial', 'holiday', 'wedding', 'reunion'];
const WORK_WORDS = ['work', 'job', 'deadline', 'client', 'meeting', 'presentation', 'report', 'office', 'shift', 'interview', 'proposal', 'contract', 'project', 'task', 'deadline'];

const SHAPE_PATHS = {
  school: 'M54.3 12.5 L80.7 27.5 Q85 30 85 35 L85 65 Q85 70 80.7 72.5 L54.3 87.5 Q50 90 45.7 87.5 L19.3 72.5 Q15 70 15 65 L15 35 Q15 30 19.3 27.5 L45.7 12.5 Q50 10 54.3 12.5 Z',
  family: 'M50 88 C28 72 8 58 8 38 C8 24 18 14 32 14 C40 14 46 18 50 24 C54 18 60 14 68 14 C82 14 92 24 92 38 C92 58 72 72 50 88 Z',
  work: 'M60.6 35.4 Q95.7 35.2 67.1 55.6 Q78.2 88.8 50 68 Q21.8 88.8 32.9 55.6 Q4.4 35.2 39.4 35.4 Q50 2.0 60.6 35.4 Z'
};

function getLocalMap(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch { return {}; }
}

function setLocalMap(key, map) {
  localStorage.setItem(key, JSON.stringify(map));
}

function nthWeekday(year, month, n, weekday) {
  const first = new Date(year, month, 1).getDay();
  const day = 1 + (weekday - first + 7) % 7 + (n - 1) * 7;
  return day;
}

function lastWeekday(year, month, weekday) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const lastDow = new Date(year, month, lastDay).getDay();
  const day = lastDay - (lastDow - weekday + 7) % 7;
  return day;
}

function getEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: month, d: day };
}

function getHoliday(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const fixed = [
    { m: 0, d: 1, name: "New Year's Day" },
    { m: 3, d: 1, name: "April Fools' Day" },
    { m: 4, d: 5, name: "Cinco de Mayo" },
    { m: 5, d: 19, name: "Juneteenth" },
    { m: 6, d: 4, name: "Independence Day" },
    { m: 9, d: 31, name: "Halloween" },
    { m: 10, d: 11, name: "Veterans Day" },
    { m: 11, d: 31, name: "New Year's Eve" }
  ];
  const religious = [
    { m: 1, d: 14, name: "Valentine's Day" },
    { m: 2, d: 17, name: "St. Patrick's Day" },
    { m: 7, d: 15, name: "Assumption of Mary" },
    { m: 11, d: 24, name: "Christmas Eve" },
    { m: 11, d: 25, name: "Christmas Day" }
  ];
  for (const h of fixed) if (h.m === m && h.d === d) return h.name;
  if (visualShowReligious) {
    for (const h of religious) if (h.m === m && h.d === d) return h.name;
    const easter = getEaster(y);
    if (m === easter.m && d === easter.d) return "Easter Sunday";
  }
  if (m === 0 && d === nthWeekday(y, 0, 3, 1)) return "MLK Jr. Day";
  if (m === 1 && d === nthWeekday(y, 1, 3, 1)) return "Presidents' Day";
  if (m === 4 && d === lastWeekday(y, 4, 1)) return "Memorial Day";
  if (m === 8 && d === nthWeekday(y, 8, 1, 1)) return "Labor Day";
  if (m === 9 && d === nthWeekday(y, 9, 2, 1)) return "Indigenous Peoples' Day";
  if (m === 10 && d === nthWeekday(y, 10, 4, 4)) return "Thanksgiving";
  return '';
}

function getToken() {
  return localStorage.getItem('token');
}

async function api(path, options = {}) {
  const url = `${API_URL}/api${path}`;
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    showMessage(err.message, 'error');
    throw err;
  }
}

function showMessage(text, type = 'error') {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function renderAvatar(avatar, targetId = 'profileAvatar') {
  const el = document.getElementById(targetId);
  if (!el) return;
  if (!avatar) {
    el.textContent = '👤';
    el.style.backgroundImage = '';
    el.classList.remove('has-image');
    return;
  }
  if (avatar.startsWith('data:')) {
    el.textContent = '';
    el.style.backgroundImage = `url(${avatar})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.classList.add('has-image');
  } else {
    el.textContent = avatar;
    el.style.backgroundImage = '';
    el.classList.remove('has-image');
  }
}

function setUser(user, token) {
  currentUser = user;
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('username', user.username);
    localStorage.setItem('isAdmin', user.is_admin ? '1' : '0');
  }
  document.getElementById('dashUser').textContent = user.username;
  document.getElementById('profileName').textContent = user.username;
  renderAvatar(user.avatar, 'profileAvatar');
  document.getElementById('mainNav').classList.remove('hidden');
  updateAdminNav();
  requestNotificationPermission();
  startNotificationChecks();
  startAlarmChecks();
  startSleepAlarmLoop();
  loadSleep();
}

function updateAdminNav() {
  const isAdmin = currentUser && currentUser.is_admin;
  document.getElementById('adminNavLink').classList.toggle('hidden', !isAdmin);
}

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        showMessage('Notifications enabled', 'success');
      }
    });
  }
}

function startNotificationChecks() {
  if (notifyInterval) return;
  checkNotifications();
  notifyInterval = setInterval(checkNotifications, 60000);
}

function stopNotificationChecks() {
  if (notifyInterval) {
    clearInterval(notifyInterval);
    notifyInterval = null;
  }
}

function sendNotification(title, body) {
  if (!('Notification' in window)) return;
  if (document.visibilityState === 'visible') return;
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '📚' });
}

async function checkNotifications() {
  if (!getToken() || !currentUser) return;

  const now = new Date();
  const todayKey = `sleepNotify_${currentUser.id}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  try {
    // Sleep reminder
    const sleep = await api('/sleep');
    if (sleep && sleep.enabled) {
      const [bedHour, bedMin] = sleep.bedtime.split(':').map(Number);
      if (now.getHours() === bedHour && now.getMinutes() === bedMin) {
        const lastSleepNotify = localStorage.getItem(todayKey);
        if (lastSleepNotify !== '1') {
          sendNotification('Time for bed 😴', 'Your sleep schedule says it\'s bedtime now.');
          localStorage.setItem(todayKey, '1');
        }
      }
    }

    // Event reminders
    const events = await api('/events');
    for (const event of events) {
      if (event.notified || !event.reminder_minutes_before) continue;
      const eventTime = new Date(event.event_date);
      const reminderTime = new Date(eventTime.getTime() - event.reminder_minutes_before * 60000);
      if (now >= reminderTime) {
        sendNotification('Upcoming event 📅', event.title);
        await api(`/events/${event.id}`, {
          method: 'PUT',
          body: JSON.stringify({ notified: 1 })
        });
      }
    }
  } catch {}
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('isAdmin');
  currentUser = null;
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  timerRemaining = 0;
  stopNotificationChecks();
  stopSleepAlarm();
  document.getElementById('mainNav').classList.add('hidden');
  document.getElementById('profileMenu').classList.add('hidden');
  showView('auth');
}

function showView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach((v) => {
    v.classList.add('hidden');
  });
  document.querySelectorAll('.nav a').forEach((a) => a.classList.remove('active'));

  if (view === 'auth') {
    document.getElementById('authView').classList.remove('hidden');
    return;
  }

  const target = document.getElementById(`${view}View`);
  if (target) {
    target.classList.remove('hidden');
  }
  const navLink = document.querySelector(`.nav a[data-view="${view}"]`);
  if (navLink) navLink.classList.add('active');

  switch (view) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'planner':
      loadTasks();
      loadCalendar();
      break;
    case 'sleep':
      loadSleep();
      break;
    case 'notes':
      loadNotesView();
      break;
    case 'friends':
      loadFriends();
      break;
    case 'admin':
      loadAdmin();
      break;
    case 'settings':
      loadSettings();
      break;
  }
}

async function initAuth() {
  const token = getToken();
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      return;
    }
    const [balance, me] = await Promise.all([api('/study/balance'), api('/users/me')]);
    const username = me.username || localStorage.getItem('username') || 'Student';
    const isAdmin = me.is_admin === 1 || payload.isAdmin === 1 || payload.isAdmin === true || localStorage.getItem('isAdmin') === '1';
    currentUser = { id: payload.userId, username, currency: balance.balance, is_admin: isAdmin, avatar: me.avatar || null };
    document.getElementById('dashUser').textContent = username;
    document.getElementById('profileName').textContent = username;
    renderAvatar(me.avatar, 'profileAvatar');
    document.getElementById('mainNav').classList.remove('hidden');
    updateAdminNav();
    requestNotificationPermission();
    startNotificationChecks();
    startAlarmChecks();
    startSleepAlarmLoop();
    loadSleep();
    showView('dashboard');
  } catch {
    localStorage.removeItem('token');
  }
}

async function loadDashboard() {
  try {
    const [balance, tasks, sessions, streaks] = await Promise.all([
      api('/study/balance'),
      api('/tasks'),
      api('/study/sessions'),
      api('/study/streaks')
    ]);
    currentUser.currency = balance.balance;
    document.getElementById('dashBalance').textContent = `${balance.balance} 🐚`;
    document.getElementById('dashTasks').textContent = tasks.filter((t) => !t.completed).length;
    document.getElementById('dashSessions').textContent = sessions.length;
    document.getElementById('dashStreak').textContent = streaks.current_streak;
    renderStreakCalendar(streaks.study_days);
  } catch {
    // handled by api helper
  }
}

function renderStreakCalendar(studyDays) {
  const container = document.getElementById('streakCalendar');
  container.innerHTML = '';
  const studySet = new Set(studyDays);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPadding = firstDay.getDay();

  const header = document.createElement('div');
  header.className = 'streak-header';
  header.textContent = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'streak-grid';

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  dayNames.forEach((d) => {
    const label = document.createElement('div');
    label.className = 'streak-day-label';
    label.textContent = d;
    grid.appendChild(label);
  });

  for (let i = 0; i < startPadding; i++) {
    grid.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'streak-day';
    if (studySet.has(dateStr)) cell.classList.add('studied');
    if (dateStr === dateKey(today)) cell.classList.add('today');
    cell.textContent = day;
    grid.appendChild(cell);
  }

  container.appendChild(grid);
}

async function loadSettings() {
  try {
    const user = await api('/users/me');
    document.getElementById('settingsUsername').value = user.username;
    document.getElementById('settingsEmail').value = user.email;
    renderAvatar(user.avatar, 'avatarPreview');
    updateAvatarSelection(user.avatar);
    if (currentUser) currentUser.avatar = user.avatar || null;
  } catch {}
}

function applyTheme(theme) {
  currentTheme = theme;
  if (theme) {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
  localStorage.setItem('studymint_theme', theme);
}

function setupTheme() {
  const select = document.getElementById('themeSelect');
  if (!select) return;
  select.value = currentTheme;
  select.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });
}

const DEFAULT_AVATARS = ['🐱', '🐶', '🐿️', '🐰', '🐯', '🐻', '🦊', '🐼', '🦁', '🐸', '🐙', '🦋'];

function updateAvatarSelection(avatar) {
  document.querySelectorAll('#avatarGrid button').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.avatar === avatar);
  });
}

async function updateAvatar(avatar) {
  try {
    const user = await api('/users/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar })
    });
    if (currentUser) currentUser.avatar = user.avatar || null;
    renderAvatar(user.avatar, 'profileAvatar');
    renderAvatar(user.avatar, 'avatarPreview');
    updateAvatarSelection(user.avatar);
    showMessage('Avatar updated', 'success');
  } catch {}
}

function resizeImage(file, maxSize = 128, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleAvatarFile(file) {
  if (!file) return;
  if (!file.type.match(/image\/(png|jpeg|webp)/)) {
    showMessage('Please use a JPG, PNG, or WebP image', 'error');
    return;
  }
  if (file.size > 1024 * 1024) {
    showMessage('Image must be smaller than 1 MB', 'error');
    return;
  }
  try {
    const dataUrl = await resizeImage(file, 128, 0.85);
    await updateAvatar(dataUrl);
  } catch {
    showMessage('Failed to process image', 'error');
  }
}

function setupAvatar() {
  const grid = document.getElementById('avatarGrid');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    if (e.target.dataset.avatar) {
      updateAvatar(e.target.dataset.avatar);
    }
  });

  const fileInput = document.getElementById('avatarFileInput');
  const uploadBtn = document.getElementById('avatarUploadBtn');
  const uploadZone = document.getElementById('avatarUploadZone');
  const removeBtn = document.getElementById('avatarRemoveBtn');

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleAvatarFile(e.target.files[0]));

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleAvatarFile(file);
  });

  removeBtn.addEventListener('click', () => updateAvatar(null));
}

function setupSettings() {
  document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('settingsEmail').value.trim();
    const currentPassword = document.getElementById('settingsCurrentPass').value;
    try {
      await api('/users/me', {
        method: 'PUT',
        body: JSON.stringify({ email, currentPassword })
      });
      showMessage('Email updated', 'success');
      document.getElementById('settingsCurrentPass').value = '';
    } catch {}
  });

  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('passCurrent').value;
    const newPassword = document.getElementById('passNew').value;
    const confirm = document.getElementById('passConfirm').value;

    if (newPassword !== confirm) {
      showMessage('New passwords do not match', 'error');
      return;
    }

    try {
      await api('/users/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      showMessage('Password changed successfully', 'success');
      e.target.reset();
    } catch {}
  });

  document.getElementById('settingsLogout').addEventListener('click', logout);
}

function setupAuth() {
  const tabs = document.querySelectorAll('.auth-box .tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('loginForm').classList.toggle('hidden', tab.dataset.tab !== 'login');
      document.getElementById('registerForm').classList.toggle('hidden', tab.dataset.tab !== 'register');
    });
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setUser(data.user, data.token);
      showMessage('Logged in successfully', 'success');
      showView('dashboard');
      e.target.reset();
    } catch {
      // handled by api helper
    }
  });

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });
      setUser(data.user, data.token);
      showMessage('Account created', 'success');
      showView('dashboard');
      e.target.reset();
    } catch {
      // handled by api helper
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);
}

function setupNavigation() {
  document.querySelectorAll('[data-view]').forEach((el) => {
    if (el.tagName === 'A') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        showView(el.dataset.view);
      });
    } else if (el.tagName === 'BUTTON') {
      el.addEventListener('click', () => showView(el.dataset.view));
    }
  });
}

function setupProfile() {
  const btn = document.getElementById('profileBtn');
  const menu = document.getElementById('profileMenu');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.classList.add('hidden');
    }
  });
}

async function loadTasks() {
  try {
    const [tasks, events] = await Promise.all([api('/tasks'), api('/events')]);
    const list = document.getElementById('taskList');
    list.innerHTML = '';

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const items = [
      ...tasks.map((t) => ({
        type: 'task',
        id: t.id,
        title: t.title,
        detail: `${escapeHtml(t.subject || '')}${t.due_date ? ` · Due ${formatDate(t.due_date)}` : ''}`,
        sortDate: t.due_date ? new Date(t.due_date) : new Date(t.created_at),
        completed: t.completed,
        data: t
      })),
      ...events.map((e) => ({
        type: 'event',
        id: e.id,
        title: e.title,
        detail: `${formatDateTime(e.event_date)} · ${e.duration_minutes || 60} min`,
        sortDate: new Date(e.event_date),
        completed: false,
        data: e
      }))
    ].filter((item) => item.sortDate >= now || item.type === 'task')
      .sort((a, b) => a.sortDate - b.sortDate);

    if (items.length === 0) {
      list.innerHTML = '<li>No upcoming tasks or events.</li>';
      return;
    }

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = item.completed ? 'completed' : '';
      const icon = item.type === 'event' ? '📅' : '✅';
      li.innerHTML = `
        <div class="task-main">
          <strong>${icon} ${escapeHtml(item.title)}</strong>
          <small>${item.detail}</small>
        </div>
        <div class="actions">
          ${item.type === 'task' ? `
            <button class="btn-secondary toggle-task" data-id="${item.id}" data-completed="${item.completed ? 1 : 0}">
              ${item.completed ? 'Undo' : 'Done'}
            </button>
            <button class="btn-secondary edit-task" data-id="${item.id}">Edit</button>
          ` : `
            <button class="btn-secondary edit-event" data-id="${item.id}">Edit</button>
          `}
          <button class="btn-danger delete-${item.type}" data-id="${item.id}">Delete</button>
        </div>
      `;
      list.appendChild(li);
    });
  } catch {
    // handled by api helper
  }
}

function setupTasks() {
  // Tab switching between Add Task / Add Event forms
  document.querySelectorAll('.tasks-tabs .tab-btn').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tasks-tabs .tab-btn').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isTask = tab.dataset.tasksTab === 'addTask';
      document.getElementById('taskForm').classList.toggle('hidden', !isTask);
      document.getElementById('tasksEventForm').classList.toggle('hidden', isTask);
    });
  });

  // Task form
  const taskForm = document.getElementById('taskForm');
  const taskSubmit = document.getElementById('taskSubmit');
  const taskCancel = document.getElementById('taskCancel');

  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    const subject = document.getElementById('taskSubject').value.trim();
    const due_date = document.getElementById('taskDue').value;
    const details = document.getElementById('taskDetails').value;

    try {
      if (id) {
        await api(`/tasks/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, subject, due_date, details })
        });
      } else {
        await api('/tasks', {
          method: 'POST',
          body: JSON.stringify({ title, subject, due_date, details })
        });
      }
      resetTaskForm();
      loadTasks();
      showMessage(id ? 'Task updated' : 'Task added', 'success');
    } catch {
      // handled by api helper
    }
  });

  taskCancel.addEventListener('click', resetTaskForm);

  // Event form inside Tasks/Events view
  const eventForm = document.getElementById('tasksEventForm');
  const eventSubmit = document.getElementById('tasksEventSubmit');
  const eventCancel = document.getElementById('tasksEventCancel');

  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tasksEventId').value;
    const title = document.getElementById('tasksEventTitle').value.trim();
    const details = document.getElementById('tasksEventDetails').value;
    const event_date = document.getElementById('tasksEventDate').value;
    const duration_minutes = parseInt(document.getElementById('tasksEventDuration').value, 10) || 60;
    const reminder_minutes_before = parseInt(document.getElementById('tasksEventReminder').value, 10) || 0;

    try {
      if (id) {
        await api(`/events/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, event_date, details, duration_minutes, reminder_minutes_before })
        });
      } else {
        await api('/events', {
          method: 'POST',
          body: JSON.stringify({ title, event_date, details, duration_minutes, reminder_minutes_before })
        });
      }
      resetTasksEventForm();
      loadTasks();
      renderCalendar();
      showMessage(id ? 'Event updated' : 'Event added', 'success');
    } catch {}
  });

  eventCancel.addEventListener('click', resetTasksEventForm);

  // Combined list actions
  document.getElementById('taskList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains('delete-task')) {
      try {
        await api(`/tasks/${id}`, { method: 'DELETE' });
        loadTasks();
        showMessage('Task deleted', 'success');
      } catch {}
    } else if (btn.classList.contains('delete-event')) {
      try {
        await api(`/events/${id}`, { method: 'DELETE' });
        loadTasks();
        showMessage('Event deleted', 'success');
      } catch {}
    } else if (btn.classList.contains('toggle-task')) {
      const completed = btn.dataset.completed === '1' ? 0 : 1;
      try {
        await api(`/tasks/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ completed })
        });
        loadTasks();
      } catch {}
    } else if (btn.classList.contains('edit-task')) {
      try {
        const tasks = await api('/tasks');
        const task = tasks.find((t) => t.id == id);
        if (!task) return;
        // Switch to task tab
        document.querySelector('.tasks-tabs .tab-btn[data-tasks-tab="addTask"]').click();
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskSubject').value = task.subject || '';
        document.getElementById('taskDue').value = task.due_date || '';
        document.getElementById('taskDetails').value = task.details || '';
        taskSubmit.textContent = 'Update Task';
        taskCancel.classList.remove('hidden');
      } catch {}
    } else if (btn.classList.contains('edit-event')) {
      try {
        const events = await api('/events');
        const event = events.find((ev) => ev.id == id);
        if (!event) return;
        // Switch to event tab
        document.querySelector('.tasks-tabs .tab-btn[data-tasks-tab="addEvent"]').click();
        document.getElementById('tasksEventId').value = event.id;
        document.getElementById('tasksEventTitle').value = event.title;
        document.getElementById('tasksEventDetails').value = event.details || '';
        document.getElementById('tasksEventDate').value = toDatetimeLocal(event.event_date);
        document.getElementById('tasksEventDuration').value = event.duration_minutes || 60;
        document.getElementById('tasksEventReminder').value = event.reminder_minutes_before;
        eventSubmit.textContent = 'Update Event';
        eventCancel.classList.remove('hidden');
      } catch {}
    }
  });
}

function resetTaskForm() {
  document.getElementById('taskForm').reset();
  document.getElementById('taskId').value = '';
  document.getElementById('taskSubmit').textContent = 'Add Task';
  document.getElementById('taskCancel').classList.add('hidden');
}

function resetTasksEventForm() {
  document.getElementById('tasksEventForm').reset();
  document.getElementById('tasksEventId').value = '';
  document.getElementById('tasksEventSubmit').textContent = 'Add Event';
  document.getElementById('tasksEventCancel').classList.add('hidden');
}

function setupCalendar() {
  document.querySelectorAll('.view-btn[data-cal-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn[data-cal-view]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      calendarViewMode = btn.dataset.calView;
      renderCalendar();
    });
  });

  document.getElementById('prevMonth').addEventListener('click', () => {
    navigateCalendar(-1);
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    navigateCalendar(1);
  });

  document.getElementById('eventList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains('delete-event')) {
      try {
        await api(`/events/${id}`, { method: 'DELETE' });
        renderCalendar();
        showMessage('Event deleted', 'success');
      } catch {}
    } else if (btn.classList.contains('edit-event')) {
      try {
        const events = await api('/events');
        const event = events.find((ev) => ev.id == id);
        if (!event) return;
        // Switch to Add Event tab
        document.querySelector('.tasks-tabs .tab-btn[data-tasks-tab="addEvent"]').click();
        document.getElementById('tasksEventId').value = event.id;
        document.getElementById('tasksEventTitle').value = event.title;
        document.getElementById('tasksEventDate').value = toDatetimeLocal(event.event_date);
        document.getElementById('tasksEventDuration').value = event.duration_minutes || 60;
        document.getElementById('tasksEventReminder').value = event.reminder_minutes_before;
        document.getElementById('tasksEventSubmit').textContent = 'Update Event';
        document.getElementById('tasksEventCancel').classList.remove('hidden');
      } catch {}
    }
  });

  // Visual calendar local features
  document.getElementById('occasionsInput').addEventListener('input', () => {
    const map = getLocalMap(KEY_OCCASIONS);
    map[dateKey(visualSelectedDate)] = document.getElementById('occasionsInput').value;
    setLocalMap(KEY_OCCASIONS, map);
    renderCalendar();
  });

  document.getElementById('addReminder').addEventListener('click', () => {
    const reminderList = document.getElementById('reminderList');
    reminderList.appendChild(createReminderRow());
    reminderList.lastElementChild.querySelector('.reminder-input').focus();
  });

  document.getElementById('holidayToggle').addEventListener('click', () => {
    visualShowReligious = !visualShowReligious;
    localStorage.setItem(KEY_SHOW_RELIGIOUS, visualShowReligious);
    updateHolidayToggle();
    renderCalendar();
  });

  document.getElementById('hideCompleted').addEventListener('change', (e) => {
    hideCompletedItems = e.target.checked;
    localStorage.setItem('cal_hide_completed', hideCompletedItems);
    renderCalendar();
  });
  document.getElementById('hideCompleted').checked = hideCompletedItems;

  document.getElementById('moodReminder').addEventListener('click', () => openMoodPicker(visualSelectedDate));
  document.querySelectorAll('.mood-options button').forEach((btn) => {
    btn.addEventListener('click', () => closeMoodPicker(btn.dataset.mood));
  });
  document.getElementById('moodOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('moodOverlay')) closeMoodPicker(null);
  });
  document.getElementById('moodGoBack').addEventListener('click', () => closeMoodPicker(null));

  const instructionsOverlay = document.getElementById('instructionsOverlay');
  document.getElementById('learnMore').addEventListener('click', () => instructionsOverlay.classList.add('active'));
  document.getElementById('instructionsClose').addEventListener('click', () => instructionsOverlay.classList.remove('active'));
  instructionsOverlay.addEventListener('click', (e) => {
    if (e.target === instructionsOverlay) instructionsOverlay.classList.remove('active');
  });

  document.getElementById('closeAlarm').addEventListener('click', () => {
    stopAlarmSound();
    document.getElementById('alarmOverlay').classList.remove('active');
    if (visualCurrentAlarm && visualCurrentAlarm.isReminder) {
      const map = getLocalMap(KEY_REMINDERS);
      const list = map[visualCurrentAlarm.key] || [];
      const updated = list.filter((r) => r.text.trim() !== visualCurrentAlarm.text.trim());
      if (updated.length === 0) delete map[visualCurrentAlarm.key];
      else map[visualCurrentAlarm.key] = updated;
      setLocalMap(KEY_REMINDERS, map);
      loadReminders();
      renderCalendar();
    }
    visualCurrentAlarm = null;
  });

  updateHolidayToggle();
}

function replayCalendarHeaderAnimation() {
  const header = document.querySelector('.calendar-header');
  const grid = document.getElementById('calendarGrid');
  [header, grid].forEach((el) => {
    if (!el) return;
    el.classList.remove('cal-replay');
    void el.offsetWidth;
    el.classList.add('cal-replay');
  });
}

function navigateCalendar(direction) {
  if (calendarViewMode === 'month') {
    calendarDate.setMonth(calendarDate.getMonth() + direction);
  } else if (calendarViewMode === 'twoWeeks') {
    calendarDate.setDate(calendarDate.getDate() + direction * 14);
  } else if (calendarViewMode === 'week') {
    calendarDate.setDate(calendarDate.getDate() + direction * 7);
  } else if (calendarViewMode === 'day') {
    calendarDate.setDate(calendarDate.getDate() + direction);
  }
  renderCalendar();
  replayCalendarHeaderAnimation();
}

async function loadCalendar() {
  visualSelectedDate = new Date();
  await renderCalendar();
  updateVisualDisplay();
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

async function renderCalendar() {
  let events = [];
  let tasks = [];
  try {
    [events, tasks] = await Promise.all([api('/events'), api('/tasks')]);
  } catch {
    return;
  }

  document.getElementById('monthCalendar').classList.toggle('hidden', calendarViewMode !== 'month');
  document.getElementById('timeGridCalendar').classList.toggle('hidden', calendarViewMode === 'month');

  if (calendarViewMode === 'month') {
    renderMonthCalendar(events, tasks);
  } else if (calendarViewMode === 'twoWeeks') {
    renderTwoWeeksCalendar(events, tasks);
  } else if (calendarViewMode === 'week') {
    renderWeekCalendar(events, tasks);
  } else if (calendarViewMode === 'day') {
    renderDayCalendar(events, tasks);
  }

  renderUpcomingEvents(events);
}

function renderMonthCalendar(events, tasks) {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  document.getElementById('monthLabel').textContent = firstDay.toLocaleString('default', {
    month: 'long',
    year: 'numeric'
  });

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayNames.forEach((d) => {
    const div = document.createElement('div');
    div.className = 'day-label';
    div.textContent = d;
    grid.appendChild(div);
  });

  const prevLastDay = new Date(year, month, 0).getDate();
  for (let i = startPadding - 1; i >= 0; i--) {
    grid.appendChild(createVisualDayCell(year, month, prevLastDay - i, true, events, tasks));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    grid.appendChild(createVisualDayCell(year, month, day, false, events, tasks));
  }

  const remainingCells = (7 - ((startPadding + daysInMonth) % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    grid.appendChild(createVisualDayCell(year, month, i, true, events, tasks));
  }
}

function createVisualDayCell(year, month, day, other, events, tasks) {
  const cellDate = new Date(year, month, day);
  const today = new Date();
  const isToday = !other && day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = !other && day === visualSelectedDate.getDate() && month === visualSelectedDate.getMonth() && year === visualSelectedDate.getFullYear();
  const key = dateKey(cellDate);
  const occasions = getLocalMap(KEY_OCCASIONS);
  const moods = getLocalMap(KEY_MOODS);
  const rawText = (occasions[key] || '').trim();
  const occasionText = rawText.toLowerCase();
  const hasOccasion = !!occasionText;
  const isSchool = hasOccasion && SCHOOL_WORDS.some((w) => occasionText.includes(w));
  const isFamily = hasOccasion && FAMILY_WORDS.some((w) => occasionText.includes(w));
  const isWork = hasOccasion && WORK_WORDS.some((w) => occasionText.includes(w));
  const isPast = !other && cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const moodEmoji = moods[key] || '';
  const holidayName = !other ? getHoliday(cellDate) : '';

  const cell = document.createElement('div');
  const type = isSchool ? 'school' : isFamily ? 'family' : isWork ? 'work' : '';
  const now = new Date();
  const dayEvents = events.filter((e) => isSameDay(new Date(e.event_date), cellDate));
  const dayTasks = tasks.filter((t) => t.due_date === key);
  const hasIncompleteTasks = dayTasks.some((t) => !t.completed);
  cell.className = 'calendar-day' +
    (other ? ' other-month' : '') +
    (isToday ? ' today' : '') +
    (isSelected ? ' selected' : '') +
    (hasOccasion ? ' has-occasion' : '') +
    (isSchool ? ' school-day' : '') +
    (isFamily ? ' family-day' : '') +
    (isWork ? ' work-day' : '') +
    (isPast ? ' past-day' : '') +
    (isPast ? (hasIncompleteTasks ? ' incomplete-day' : ' finished-day') : '');

  const badge = moodEmoji ? `<span class="mood-badge">${moodEmoji}</span>` : '';
  const holiday = holidayName ? `<span class="holiday-label">${holidayName.replace(/</g, '&lt;')}</span>` : '';

  const chips = [];
  dayEvents.forEach((e) => {
    const end = new Date(new Date(e.event_date).getTime() + (e.duration_minutes || 60) * 60000);
    if (hideCompletedItems && end < now) return;
    chips.push({ type: 'event', cls: 'event', text: `${formatTime(new Date(e.event_date))} ${e.title}` });
  });
  dayTasks.forEach((t) => {
    if (hideCompletedItems && t.completed) return;
    chips.push({ type: 'task', id: t.id, cls: t.completed ? 'task completed' : 'task', text: t.title });
  });

  let chipsHtml = '';
  if (chips.length > 0) {
    const visible = chips.slice(0, 2);
    const more = chips.length > 2 ? `<div class="calendar-day-chip more">+${chips.length - 2}</div>` : '';
    chipsHtml = `<div class="calendar-day-chips">${visible.map((c) => {
      const dataAttr = c.type === 'task' ? ` data-id="${c.id}"` : '';
      return `<div class="calendar-day-chip ${c.cls}"${dataAttr}>${escapeHtml(c.text)}</div>`;
    }).join('')}${more}</div>`;
  }

  if (type && !other) {
    const uid = 'sp-' + Math.random().toString(36).slice(2, 9);
    const numY = isPast ? 62 : 54;
    cell.innerHTML = `
      <svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <defs><path id="${uid}" d="${SHAPE_PATHS[type]}" /></defs>
        <use href="#${uid}" class="shape-bg" />
        <text class="day-number-svg" x="50" y="${numY}" text-anchor="middle" dominant-baseline="middle">${day}</text>
      </svg>
      ${badge}
      ${holiday}
      ${chipsHtml}
    `;
  } else {
    cell.innerHTML = `${badge}${holiday}${chipsHtml}<span class="day-number">${day}</span>`;
  }

  if (!other) {
    cell.addEventListener('click', (e) => {
      const chip = e.target.closest('.calendar-day-chip.task');
      if (chip && chip.dataset.id) {
        e.stopPropagation();
        toggleTaskCompletion(chip.dataset.id);
        return;
      }
      visualSelectedDate = new Date(year, month, day);
      updateVisualDisplay();
      renderCalendar();
    });
  }

  return cell;
}

async function toggleTaskCompletion(taskId) {
  try {
    const tasks = await api('/tasks');
    const task = tasks.find((t) => t.id == taskId);
    if (!task) return;
    await api(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ completed: task.completed ? 0 : 1 })
    });
    renderCalendar();
    showMessage(task.completed ? 'Task marked incomplete' : 'Task completed', 'success');
  } catch {}
}

async function updateVisualDisplay() {
  document.getElementById('displayDate').textContent = visualSelectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('displayYear').textContent = visualSelectedDate.getFullYear();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sel = new Date(visualSelectedDate.getFullYear(), visualSelectedDate.getMonth(), visualSelectedDate.getDate());
  const isPast = sel < today;

  let hasIncompleteTasks = false;
  if (isPast) {
    try {
      const tasks = await api('/tasks');
      const key = dateKey(sel);
      hasIncompleteTasks = tasks.some((t) => t.due_date === key && !t.completed);
    } catch {}
  }

  const finishedLabel = document.getElementById('finishedLabel');
  finishedLabel.classList.toggle('show', isPast);
  finishedLabel.textContent = isPast && hasIncompleteTasks ? 'INCOMPLETE' : 'FINISHED';

  document.getElementById('occasionsInput').value = getLocalMap(KEY_OCCASIONS)[dateKey(visualSelectedDate)] || '';
  loadReminders();
  updateMoodReminder();
}

function updateMoodReminder() {
  const moodReminder = document.getElementById('moodReminder');
  const mood = getLocalMap(KEY_MOODS)[dateKey(visualSelectedDate)];
  if (mood) {
    moodReminder.innerHTML = `Mark your mood: <span style="font-size:14px">${mood}</span> (click the emoji to change)`;
  } else {
    moodReminder.innerHTML = `Mark your mood: <span style="font-size:14px">?</span> (click to set)`;
  }
}

function openMoodPicker(date) {
  visualPendingDate = date;
  document.getElementById('moodOverlay').classList.add('active');
}

function closeMoodPicker(mood) {
  document.getElementById('moodOverlay').classList.remove('active');
  if (!visualPendingDate) return;
  if (mood === undefined || mood === null) {
    visualPendingDate = null;
    return;
  }
  const map = getLocalMap(KEY_MOODS);
  const key = dateKey(visualPendingDate);
  if (mood && mood !== 'clear') {
    map[key] = mood;
  } else {
    delete map[key];
  }
  setLocalMap(KEY_MOODS, map);
  visualSelectedDate = visualPendingDate;
  visualPendingDate = null;
  updateVisualDisplay();
  renderCalendar();
}

function getRemindersForDate(date) {
  const stored = getLocalMap(KEY_REMINDERS)[dateKey(date)];
  return Array.isArray(stored) ? stored : [];
}

function saveReminders() {
  const reminderList = document.getElementById('reminderList');
  const rows = [...reminderList.querySelectorAll('.reminder-row')];
  const list = rows.map((row) => ({
    text: row.querySelector('.reminder-input').value,
    level: row.querySelector('.reminder-level').value,
    remark: row.querySelector('.remark-area')?.value || ''
  })).filter((r) => r.text.trim() !== '');
  const map = getLocalMap(KEY_REMINDERS);
  map[dateKey(visualSelectedDate)] = list;
  setLocalMap(KEY_REMINDERS, map);
}

function createReminderRow(text = '', level = 'medium', remark = '', compact = false) {
  const row = document.createElement('div');
  row.className = 'reminder-row' + (compact ? ' compact' : '');
  row.innerHTML = `
    <div class="reminder-compact">
      <span class="reminder-summary">${text.replace(/</g, '&lt;') || '<span style="color:#999">New reminder</span>'}<span class="remark-dot">${remark ? '📝' : ''}</span></span>
      <span class="reminder-badge ${level}">${level}</span>
    </div>
    <div class="reminder-edit">
      <div class="reminder-edit-header">
        <span class="reminder-edit-title">Edit reminder</span>
        <button class="close-edit" title="Close" type="button">✓</button>
      </div>
      <input type="text" class="reminder-input" placeholder="e.g. 9:00 go to eat" value="${text.replace(/"/g, '&quot;')}" />
      <div class="reminder-controls">
        <span class="emergency-label">Level of emergency</span>
        <select class="reminder-level">
          <option value="low" ${level === 'low' ? 'selected' : ''}>Low</option>
          <option value="medium" ${level === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="high" ${level === 'high' ? 'selected' : ''}>High</option>
        </select>
        <button class="memo-btn" title="Remarks" type="button">📝</button>
        <button class="remove-reminder" title="Remove" type="button">×</button>
      </div>
      <textarea class="remark-area" placeholder="Any remarks?">${remark.replace(/</g, '&lt;')}</textarea>
    </div>
  `;
  const input = row.querySelector('.reminder-input');
  const memoBtn = row.querySelector('.memo-btn');
  const remarkArea = row.querySelector('.remark-area');
  const compactView = row.querySelector('.reminder-compact');
  const closeBtn = row.querySelector('.close-edit');
  const reminderList = document.getElementById('reminderList');

  function expand() {
    row.classList.remove('compact');
    input.focus();
  }

  function collapse() {
    if (input.value.trim() === '') {
      row.remove();
    } else {
      row.classList.add('compact');
      row.querySelector('.reminder-summary').innerHTML = `${input.value.replace(/</g, '&lt;')}<span class="remark-dot">${remarkArea.value ? '📝' : ''}</span>`;
      const badge = row.querySelector('.reminder-badge');
      badge.textContent = row.querySelector('.reminder-level').value;
      badge.className = 'reminder-badge ' + row.querySelector('.reminder-level').value;
    }
    saveReminders();
    ensureEmptyReminderRow();
  }

  compactView.addEventListener('click', expand);
  closeBtn.addEventListener('click', collapse);

  input.addEventListener('input', () => {
    saveReminders();
    if (row === reminderList.lastElementChild && input.value.trim() !== '') {
      reminderList.appendChild(createReminderRow());
    }
  });
  row.querySelector('.reminder-level').addEventListener('change', saveReminders);
  remarkArea.addEventListener('input', saveReminders);
  memoBtn.addEventListener('click', () => {
    row.classList.toggle('show-remark');
    if (row.classList.contains('show-remark')) remarkArea.focus();
  });
  row.querySelector('.remove-reminder').addEventListener('click', () => {
    row.remove();
    if (reminderList.children.length === 0) reminderList.appendChild(createReminderRow());
    saveReminders();
    ensureEmptyReminderRow();
  });
  return row;
}

function loadReminders() {
  const reminderList = document.getElementById('reminderList');
  reminderList.innerHTML = '';
  const list = getRemindersForDate(visualSelectedDate);
  if (list.length === 0) {
    reminderList.appendChild(createReminderRow());
  } else {
    list.forEach((r) => reminderList.appendChild(createReminderRow(r.text, r.level, r.remark, true)));
  }
  ensureEmptyReminderRow();
}

function ensureEmptyReminderRow() {
  const reminderList = document.getElementById('reminderList');
  const last = reminderList.lastElementChild;
  if (!last || last.querySelector('.reminder-input')?.value.trim() !== '') {
    reminderList.appendChild(createReminderRow());
  }
}

function updateHolidayToggle() {
  document.getElementById('holidayToggle').textContent = `Religious holidays: ${visualShowReligious ? 'on' : 'off'}`;
}

function startAlarmChecks() {
  if (alarmCheckInterval) return;
  checkAlarms();
  alarmCheckInterval = setInterval(checkAlarms, 1000);
}

function parseAlarmTime(text) {
  const m = text.match(/(\d{1,2}):(\d{2})\s?([AaPp][Mm])?|\b(\d{1,2})\s?([AaPp][Mm])\b/);
  if (!m) return null;
  let h;
  let min = 0;
  let ampm;
  if (m[1]) {
    h = parseInt(m[1]);
    min = parseInt(m[2]);
    ampm = m[3];
  } else {
    h = parseInt(m[4]);
    ampm = m[5];
  }
  if (ampm) {
    const u = ampm.toUpperCase();
    if (u === 'PM' && h !== 12) h += 12;
    if (u === 'AM' && h === 12) h = 0;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function checkAlarms() {
  const now = new Date();
  const key = dateKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  function scanOccasions(text) {
    text.split('\n').forEach((line) => {
      const time = parseAlarmTime(line);
      if (time && time === currentTime) {
        const id = `${key}-occ-${time}-${line.trim()}`;
        if (!triggeredAlarms.has(id)) {
          triggeredAlarms.add(id);
          triggerAlarm(line.trim(), '', false, key);
        }
      }
    });
  }

  scanOccasions(getLocalMap(KEY_OCCASIONS)[key] || '');

  const reminders = getLocalMap(KEY_REMINDERS)[key] || [];
  reminders.forEach((r) => {
    const time = parseAlarmTime(r.text);
    if (time && time === currentTime) {
      const id = `${key}-rem-${time}-${r.text.trim()}`;
      if (!triggeredAlarms.has(id)) {
        triggeredAlarms.add(id);
        const level = r.level || 'medium';
        const label = level === 'high' ? 'URGENT' : level === 'low' ? 'Reminder' : 'REMINDER';
        triggerAlarm(`[${label}] ${r.text.trim()}`, r.remark, true, key, level);
      }
    }
  });
}

function playAlarmSound(level = 'medium') {
  try {
    const settings = {
      low: { gain: 0.5, tone1: 750, tone2: 950 },
      medium: { gain: 0.85, tone1: 950, tone2: 1250 },
      high: { gain: 0.99, tone1: 1200, tone2: 1600 }
    };
    const s = settings[level] || settings.medium;

    alarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const master = alarmAudioCtx.createGain();
    master.gain.setValueAtTime(s.gain, alarmAudioCtx.currentTime);
    master.connect(alarmAudioCtx.destination);

    const tone1 = s.tone1;
    const tone2 = s.tone2;
    const beepDuration = 0.08;
    const motifDuration = 0.62;
    const totalDuration = 4.0;

    function scheduleBeep(time, freq) {
      const osc = alarmAudioCtx.createOscillator();
      const env = alarmAudioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, time);
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(0.9, time + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, time + beepDuration);
      osc.connect(env);
      env.connect(master);
      osc.start(time);
      osc.stop(time + beepDuration + 0.02);
    }

    const startTime = alarmAudioCtx.currentTime;
    for (let t = 0; t < totalDuration; t += motifDuration) {
      const base = startTime + t;
      scheduleBeep(base, tone2);
      scheduleBeep(base + 0.10, tone1);
      scheduleBeep(base + 0.24, tone2);
      scheduleBeep(base + 0.34, tone1);
    }

    alarmInterval = setInterval(() => {
      const base = alarmAudioCtx.currentTime;
      for (let t = 0; t < totalDuration; t += motifDuration) {
        const now = base + t;
        scheduleBeep(now, tone2);
        scheduleBeep(now + 0.10, tone1);
        scheduleBeep(now + 0.24, tone2);
        scheduleBeep(now + 0.34, tone1);
      }
    }, totalDuration * 1000);
  } catch (err) { console.error('Audio error:', err); }
}

function stopAlarmSound() {
  if (alarmInterval) clearInterval(alarmInterval);
  if (alarmOsc) try { alarmOsc.stop(); } catch {}
  if (alarmAudioCtx) try { alarmAudioCtx.close(); } catch {}
  alarmInterval = null;
  alarmOsc = null;
  alarmAudioCtx = null;
}

function triggerAlarm(text, remark = '', isReminder = false, key = '', level = 'medium') {
  const alarmText = document.getElementById('alarmText');
  const alarmRemark = document.getElementById('alarmRemark');
  alarmText.textContent = text || 'Your reminder';
  alarmRemark.textContent = remark ? `Remarks: ${remark}` : '';
  alarmRemark.style.display = remark ? 'block' : 'none';
  visualCurrentAlarm = { text: text.replace(/^\[[^\]]+\]\s*/, ''), isReminder, key };
  document.getElementById('alarmOverlay').classList.add('active');
  playAlarmSound(level);
}

function renderTwoWeeksCalendar(events, tasks) {
  const start = new Date(calendarDate);
  start.setDate(start.getDate() - start.getDay());
  const days = [];
  for (let i = 0; i < 14; i++) {
    days.push(new Date(start));
    start.setDate(start.getDate() + 1);
  }

  document.getElementById('monthLabel').textContent = `${formatDate(days[0])} – ${formatDate(days[13])}`;
  renderTimeGrid(days, events, tasks, true);
}

function renderWeekCalendar(events, tasks) {
  const start = new Date(calendarDate);
  start.setDate(start.getDate() - start.getDay());
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(start));
    start.setDate(start.getDate() + 1);
  }

  document.getElementById('monthLabel').textContent = `${formatDate(days[0])} – ${formatDate(days[6])}`;
  renderTimeGrid(days, events, tasks, false);
}

function renderDayCalendar(events, tasks) {
  document.getElementById('monthLabel').textContent = formatDate(calendarDate);
  renderTimeGrid([new Date(calendarDate)], events, tasks, false);
}

function renderTimeGrid(days, events, tasks, compact) {
  const header = document.getElementById('timeGridHeader');
  const body = document.getElementById('timeGridBody');
  header.innerHTML = '';
  body.innerHTML = '';

  const dayWidth = compact ? '80px' : `${100 / days.length}%`;

  // Header row
  const corner = document.createElement('div');
  corner.className = 'timegrid-corner';
  header.appendChild(corner);

  days.forEach((day) => {
    const col = document.createElement('div');
    col.className = 'timegrid-day-header';
    col.style.width = dayWidth;
    const today = isSameDay(day, new Date()) ? ' today' : '';
    col.innerHTML = `
      <div class="day-name${today}">${day.toLocaleDateString('default', { weekday: 'short' })}</div>
      <div class="day-number${today}">${day.getDate()}</div>
    `;
    header.appendChild(col);
  });

  // All-day row for tasks
  const alldayRow = document.createElement('div');
  alldayRow.className = 'timegrid-allday-row';
  const alldayLabel = document.createElement('div');
  alldayLabel.className = 'timegrid-allday-label';
  alldayLabel.textContent = 'All day';
  alldayRow.appendChild(alldayLabel);

  days.forEach((day) => {
    const cell = document.createElement('div');
    cell.className = 'timegrid-allday-cell';
    cell.style.width = dayWidth;
    const dayTasks = tasks.filter((t) => t.due_date === dateKey(day));
    dayTasks.forEach((t) => {
      const chip = document.createElement('div');
      chip.className = `timegrid-task-chip${t.completed ? ' completed' : ''}`;
      chip.textContent = t.title;
      chip.title = `${t.title}${t.subject ? ' · ' + t.subject : ''}`;
      cell.appendChild(chip);
    });
    alldayRow.appendChild(cell);
  });
  body.appendChild(alldayRow);

  // Scrollable time grid
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'timegrid-scroll-wrap';

  const hoursCol = document.createElement('div');
  hoursCol.className = 'timegrid-hours';
  for (let h = 0; h < 24; h++) {
    const row = document.createElement('div');
    row.className = 'timegrid-hour-row';
    row.textContent = `${String(h).padStart(2, '0')}:00`;
    hoursCol.appendChild(row);
  }
  scrollWrap.appendChild(hoursCol);

  const daysWrap = document.createElement('div');
  daysWrap.className = 'timegrid-days-wrap';
  daysWrap.style.width = `calc(100% - 60px)`;

  days.forEach((day) => {
    const col = document.createElement('div');
    col.className = 'timegrid-day-col';
    col.style.width = dayWidth;
    if (isSameDay(day, new Date())) col.classList.add('today');

    for (let h = 0; h < 24; h++) {
      const row = document.createElement('div');
      row.className = 'timegrid-hour-row';
      col.appendChild(row);
    }

    const dayEvents = events.filter((e) => {
      const start = new Date(e.event_date);
      return isSameDay(start, day);
    });

    dayEvents.forEach((e) => {
      const start = new Date(e.event_date);
      const duration = parseInt(e.duration_minutes, 10) || 60;
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const top = (startMinutes / 60) * 60;
      const height = (duration / 60) * 60;

      const block = document.createElement('div');
      block.className = 'timegrid-event-block';
      block.style.top = `${top}px`;
      block.style.height = `${Math.max(height - 2, 18)}px`;
      block.innerHTML = `<strong>${escapeHtml(e.title)}</strong><small>${formatTime(start)} · ${duration}m</small>`;
      block.title = e.title;
      col.appendChild(block);
    });

    daysWrap.appendChild(col);
  });

  scrollWrap.appendChild(daysWrap);
  body.appendChild(scrollWrap);

  // Auto-scroll to 8 AM
  setTimeout(() => {
    scrollWrap.scrollTop = 8 * 60;
  }, 0);
}

function renderUpcomingEvents(events) {
  const list = document.getElementById('eventList');
  list.innerHTML = '';
  const upcoming = events
    .filter((e) => new Date(e.event_date) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

  if (upcoming.length === 0) {
    list.innerHTML = '<li>No upcoming events.</li>';
    return;
  }

  upcoming.forEach((event) => {
    const li = document.createElement('li');
    const hasDetails = event.details && event.details.trim().length > 0;
    const detailsId = `event-details-${event.id}`;
    li.innerHTML = `
      <div class="event-main">
        <strong>${escapeHtml(event.title)}</strong>
        <small>${formatDateTime(event.event_date)} · ${event.duration_minutes || 60} min · Remind ${event.reminder_minutes_before} min before</small>
        ${hasDetails ? `<button type="button" class="btn-text toggle-details" data-target="${detailsId}">Show details</button>` : ''}
        <div id="${detailsId}" class="event-details hidden">${escapeHtml(event.details).replace(/\n/g, '<br>')}</div>
      </div>
      <div class="actions">
        <button class="btn-secondary edit-event" data-id="${event.id}">Edit</button>
        <button class="btn-danger delete-event" data-id="${event.id}">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.toggle-details').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        target.classList.toggle('hidden');
        btn.textContent = target.classList.contains('hidden') ? 'Show details' : 'Hide details';
      }
    });
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function setupTimer() {
  const display = document.getElementById('timerDisplay');
  const input = document.getElementById('timerInput');
  const startBtn = document.getElementById('timerStart');
  const pauseBtn = document.getElementById('timerPause');
  const resetBtn = document.getElementById('timerReset');
  const result = document.getElementById('timerResult');
  const progress = document.getElementById('timerProgress');
  const timerPage = document.getElementById('timerPage');
  const timerDecor = document.getElementById('timerDecor');
  const themeSelector = document.getElementById('timerThemeSelector');

  const CIRCUMFERENCE = 2 * Math.PI * 110; // ~691
  let timerTotal = 0;
  let currentTimerTheme = localStorage.getItem('timerTheme') || 'forest';

  function setTimerTheme(theme) {
    currentTimerTheme = theme;
    document.body.classList.remove('timer-forest', 'timer-beach', 'timer-jungle', 'timer-bamboo', 'timer-mountain');
    document.body.classList.add(`timer-${theme}`);
    localStorage.setItem('timerTheme', theme);

    themeSelector.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    renderDecorations(theme);
  }

  function renderDecorations(theme) {
    timerDecor.innerHTML = '';
    const add = (cls, styles = {}) => {
      const el = document.createElement('div');
      el.className = cls;
      Object.assign(el.style, styles);
      timerDecor.appendChild(el);
    };

    if (theme === 'forest') {
      add('decor-sun');
      add('decor-cloud', { top: '12%', left: '8%' });
      add('decor-cloud', { top: '18%', right: '25%' });
      add('decor-ground-back');
      add('decor-path');
      add('decor-ground-front');
      add('decor-tree');
      add('decor-tree-back');
      for (let i = 0; i < 8; i++) {
        add('decor-grass', { left: `${8 + i * 11}%` });
      }
      add('decor-falling-leaf', { left: '20%' });
      add('decor-falling-leaf', { left: '70%', animationDelay: '-2s' });
      add('decor-bird', { top: '25%', left: '-5%' });
      add('decor-bird', { top: '30%', left: '-10%', animationDelay: '-5s' });
      add('decor-flower', { left: '18%' });
      add('decor-flower', { right: '22%' });
    } else if (theme === 'beach') {
      add('decor-sun');
      add('decor-cloud', { top: '10%', left: '6%' });
      add('decor-cloud', { top: '20%', right: '15%' });
      add('decor-wave-four');
      add('decor-wave');
      const wave2 = document.createElement('div'); wave2.className = 'decor-wave two'; timerDecor.appendChild(wave2);
      const wave3 = document.createElement('div'); wave3.className = 'decor-wave three'; timerDecor.appendChild(wave3);
      add('decor-sand');
      add('decor-palm');
      add('decor-seagull', { top: '16%', left: '-8%' });
      add('decor-seagull', { top: '22%', left: '-12%', animationDelay: '-6s' });
      add('decor-shell', { left: '14%' });
      add('decor-starfish', { right: '18%' });
    } else if (theme === 'jungle') {
      add('decor-mist');
      add('decor-vine', { left: '8%' });
      add('decor-vine', { right: '12%' });
      for (let i = 0; i < 5; i++) {
        add('decor-vine-leaf', { top: `${15 + i * 12}%`, left: '7%' });
        add('decor-vine-leaf', { top: `${12 + i * 12}%`, right: '11%' });
      }
      for (let i = 0; i < 6; i++) {
        add('decor-leaf', { top: `${20 + i * 12}%`, left: `${10 + i * 13}%`, transform: `rotate(${i * 25}deg)` });
      }
      add('decor-flower-exotic', { top: '18%', left: '20%' });
      add('decor-flower-exotic', { top: '28%', right: '18%' });
    } else if (theme === 'bamboo') {
      add('decor-mist');
      add('decor-ground');
      add('decor-bamboo', { left: '10%' });
      add('decor-bamboo', { left: '18%', height: '130px' });
      add('decor-bamboo', { right: '14%' });
      add('decor-bamboo', { right: '22%', height: '140px' });
      for (let i = 0; i < 8; i++) {
        add('decor-bamboo-leaf', { top: `${25 + (i % 3) * 18}%`, left: `${9 + (i % 2) * 9}%` });
        add('decor-bamboo-leaf', { top: `${22 + (i % 3) * 18}%`, right: `${13 + (i % 2) * 9}%` });
      }
    } else if (theme === 'mountain') {
      add('decor-sun');
      add('decor-cloud', { top: '10%', left: '10%' });
      add('decor-cloud', { top: '16%', right: '20%' });
      const mBack = document.createElement('div'); mBack.className = 'decor-mountain back'; timerDecor.appendChild(mBack);
      const mMid = document.createElement('div'); mMid.className = 'decor-mountain mid'; timerDecor.appendChild(mMid);
      const mFront = document.createElement('div'); mFront.className = 'decor-mountain front'; timerDecor.appendChild(mFront);
      add('decor-pine', { left: '12%' });
      add('decor-pine', { left: '22%' });
      add('decor-pine', { right: '16%' });
      for (let i = 0; i < 12; i++) {
        add('decor-falling-snow', { left: `${5 + i * 8}%`, animationDelay: `${-i * 0.8}s` });
      }
    }
  }

  themeSelector.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => setTimerTheme(btn.dataset.theme));
  });

  setTimerTheme(currentTimerTheme);

  function updateDisplay() {
    const m = Math.floor(timerRemaining / 60);
    const s = timerRemaining % 60;
    display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    if (timerTotal > 0 && progress) {
      const offset = CIRCUMFERENCE - (timerRemaining / timerTotal) * CIRCUMFERENCE;
      progress.style.strokeDashoffset = offset;
    } else if (progress) {
      progress.style.strokeDashoffset = 0;
    }
  }

  async function refundSession() {
    if (timerSessionId) {
      const sessionId = timerSessionId;
      timerSessionId = null;
      try {
        const data = await api(`/study/session/${sessionId}`, { method: 'DELETE' });
        return data;
      } catch {}
    }
    return null;
  }

  async function awardMinute() {
    const expectedSessionId = timerSessionId;
    try {
      if (expectedSessionId) {
        const data = await api(`/study/session/${expectedSessionId}`, { method: 'PUT' });
        if (timerRunning && timerSessionId === expectedSessionId) {
          result.textContent = `+${data.session.currency_earned} 🐚 earned this run (pause to lose it)`;
        }
        return data;
      } else {
        const data = await api('/study/session', {
          method: 'POST',
          body: JSON.stringify({ duration_minutes: 1 })
        });
        if (timerRunning && timerSessionId === expectedSessionId) {
          timerSessionId = data.session.id;
          result.textContent = `+${data.session.currency_earned} 🐚 earned this run (pause to lose it)`;
        }
        return data;
      }
    } catch (err) {
      throw err;
    }
  }

  function addMinuteToSession() {
    timerPendingAward = awardMinute()
      .catch(() => {})
      .finally(() => {
        timerPendingAward = null;
      });
  }

  function finish() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    startBtn.textContent = 'Start';
    pauseBtn.disabled = true;
    input.disabled = false;
    const minutes = Math.floor(timerSecondsWorked / 60);
    timerSecondsWorked = 0;
    if (minutes > 0) {
      result.textContent = `Session complete! +${minutes} 🐚 kept.`;
    } else {
      result.textContent = '';
    }
    if (currentView === 'dashboard') loadDashboard();
  }

  startBtn.addEventListener('click', async () => {
    if (timerRunning) return;
    if (timerPendingAward) {
      try { await timerPendingAward; } catch {}
    }
    if (startBtn.textContent === 'Start') {
      timerTotal = (parseInt(input.value, 10) || 1) * 60;
      timerRemaining = timerTotal;
      timerSecondsWorked = 0;
      timerSessionId = null;
    }
    timerRunning = true;
    input.disabled = true;
    startBtn.textContent = 'Running';
    pauseBtn.disabled = false;
    result.textContent = '';
    updateDisplay();
    timerInterval = setInterval(() => {
      timerRemaining--;
      timerSecondsWorked++;
      if (timerSecondsWorked % 60 === 0) {
        addMinuteToSession();
      }
      updateDisplay();
      if (timerRemaining <= 0) {
        finish();
      }
    }, 1000);
  });

  pauseBtn.addEventListener('click', async () => {
    if (!timerRunning) return;
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    startBtn.textContent = 'Resume';
    pauseBtn.disabled = true;
    const secondsWorked = timerSecondsWorked;
    timerSecondsWorked = 0;

    if (timerPendingAward) {
      try { await timerPendingAward; } catch {}
    }

    const refunded = await refundSession();
    if (refunded && secondsWorked >= 60) {
      const minutes = Math.floor(secondsWorked / 60);
      result.textContent = `Paused. ${minutes} 🐚 taken back.`;
    } else {
      result.textContent = 'Paused.';
    }
    if (currentView === 'dashboard') loadDashboard();
  });

  resetBtn.addEventListener('click', async () => {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    timerRemaining = 0;
    timerTotal = 0;
    timerSecondsWorked = 0;
    input.disabled = false;
    startBtn.textContent = 'Start';
    pauseBtn.disabled = true;

    if (timerPendingAward) {
      try { await timerPendingAward; } catch {}
    }

    await refundSession();
    timerSessionId = null;
    result.textContent = '';
    updateDisplay();
  });

  // Initial display
  timerTotal = (parseInt(input.value, 10) || 1) * 60;
  timerRemaining = timerTotal;
  updateDisplay();

  // Update timer display when input changes (only when not running/paused)
  input.addEventListener('input', () => {
    if (startBtn.textContent === 'Start') {
      timerTotal = (parseInt(input.value, 10) || 1) * 60;
      timerRemaining = timerTotal;
      updateDisplay();
    }
  });
}

function formatIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildSleepIcs(bedtime, wakeTime) {
  const now = new Date();
  const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const uidBase = Math.random().toString(36).slice(2) + '@studymint';

  const [bedHour, bedMin] = bedtime.split(':').map(Number);
  const [wakeHour, wakeMin] = wakeTime.split(':').map(Number);

  const bedStart = `${today}T${String(bedHour).padStart(2, '0')}${String(bedMin).padStart(2, '0')}00`;
  const wakeStart = `${today}T${String(wakeHour).padStart(2, '0')}${String(wakeMin).padStart(2, '0')}00`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Studymint//Sleep Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uidBase}-bedtime`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART;TZID=local:${bedStart}`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:🛏️ Bedtime',
    'DESCRIPTION:Time to wind down and sleep.',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Bedtime reminder',
    'TRIGGER:-PT0M',
    'END:VALARM',
    'END:VEVENT',
    'BEGIN:VEVENT',
    `UID:${uidBase}-wake`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART;TZID=local:${wakeStart}`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:⏰ Wake Up',
    'DESCRIPTION:Time to wake up!',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Wake up alarm',
    'TRIGGER:-PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n');
}

function downloadIcs(filename, content) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ensureSleepAudioContext() {
  if (!sleepAlarmAudioCtx) {
    sleepAlarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sleepAlarmMasterGain = sleepAlarmAudioCtx.createGain();
    sleepAlarmMasterGain.gain.setValueAtTime(1, sleepAlarmAudioCtx.currentTime);
    sleepAlarmMasterGain.connect(sleepAlarmAudioCtx.destination);
  }
  return sleepAlarmAudioCtx;
}

async function unlockSleepAudio() {
  const ctx = ensureSleepAudioContext();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      sleepAudioUnlocked = true;
    } catch (err) {
      console.warn('Could not unlock sleep audio context:', err);
    }
  } else {
    sleepAudioUnlocked = true;
  }
}

function timeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatHoursMinutes(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

function getNextSleepTime(timeStr) {
  const now = new Date();
  const [hours, minutes] = timeStr.split(':').map(Number);
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function getSleepDurationText(bedtime, wakeTime) {
  const [bedH, bedM] = bedtime.split(':').map(Number);
  const [wakeH, wakeM] = wakeTime.split(':').map(Number);
  let bedMinutes = bedH * 60 + bedM;
  let wakeMinutes = wakeH * 60 + wakeM;
  if (wakeMinutes <= bedMinutes) wakeMinutes += 24 * 60;
  const diff = wakeMinutes - bedMinutes;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h ${m}m`;
}

function getSleepQuality(bedtime, wakeTime) {
  const [bedH, bedM] = bedtime.split(':').map(Number);
  const [wakeH, wakeM] = wakeTime.split(':').map(Number);
  let bedMinutes = bedH * 60 + bedM;
  let wakeMinutes = wakeH * 60 + wakeM;
  if (wakeMinutes <= bedMinutes) wakeMinutes += 24 * 60;
  const hours = (wakeMinutes - bedMinutes) / 60;

  if (hours < 5) return { text: 'Too short', class: 'quality-bad' };
  if (hours < 7) return { text: 'A little short', class: 'quality-ok' };
  if (hours <= 9) return { text: 'Healthy', class: 'quality-good' };
  return { text: 'Long', class: 'quality-ok' };
}

function getSleepAdvice(mood) {
  const map = {
    tired: { hours: '8–9 hours', targetHours: 8.5, tip: 'You felt tired today. Aim for extra rest tonight so your body can recover.' },
    stressed: { hours: '7–8 hours', targetHours: 7.5, tip: 'Stress can make sleep harder. Try a short wind-down routine before bed.' },
    sick: { hours: '8–10 hours', targetHours: 9, tip: 'Your body heals while sleeping. Give yourself plenty of rest tonight.' },
    sad: { hours: '7–8 hours', targetHours: 7.5, tip: 'A steady sleep schedule can help your mood. Try to go to bed at the same time.' },
    good: { hours: '7–8 hours', targetHours: 7.5, tip: 'You felt good today. Keep up a healthy sleep routine.' },
    energized: { hours: '6–7 hours', targetHours: 6.5, tip: 'You had energy today, but still get enough rest to stay sharp tomorrow.' }
  };
  return map[mood] || { hours: '7–9 hours', targetHours: 8, tip: 'Most people do best with 7–9 hours of sleep.' };
}

function formatTimeShort(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return '--';
  const [h, m] = timeStr.split(':').map(Number);
  const suffix = h >= 12 ? 'p' : 'a';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')}${suffix}`;
}

function getMoodEmoji(mood) {
  const map = {
    tired: '😴',
    stressed: '😫',
    sick: '🤒',
    sad: '😔',
    good: '😊',
    energized: '⚡'
  };
  return map[mood] || '—';
}

function getSleepTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getSleepWeekDate(dayIndex) {
  const now = new Date();
  const currentDay = now.getDay();
  const mondayOffset = (currentDay === 0 ? -6 : 1) - currentDay;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + dayIndex);
  return d;
}

function getSleepPastWeekEntries() {
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const entries = [];
  for (let i = 0; i < 7; i++) {
    const d = getSleepWeekDate(i);
    const key = dateKey(d);
    const saved = localStorage.getItem(`sleepCheckIn_${key}`);
    let entry = null;
    if (saved) {
      try {
        entry = JSON.parse(saved);
      } catch {
        entry = null;
      }
    }
    entries.push({
      label: dayLabels[i],
      dateKey: key,
      mood: entry ? entry.mood : null,
      bedtime: entry ? minutesToTime(timeToMinutes(entry.wakeTime) - Math.round((entry.advice?.targetHours || 8) * 60)) : null,
      wakeTime: entry ? entry.wakeTime : null,
      hours: entry && entry.advice ? entry.advice.targetHours : null
    });
  }
  return entries;
}

function renderSleepChart() {
  const container = document.getElementById('sleepChart');
  if (!container) return;

  const entries = getSleepPastWeekEntries();
  const hasData = entries.some((e) => e.mood);

  if (!hasData) {
    container.innerHTML = `<p class="chart-empty">No check-ins yet. Fill in how you felt today to see your chart.</p>`;
    return;
  }

  const maxHours = Math.max(...entries.map((e) => e.hours || 0), 10);
  const moodColors = {
    tired: '#60a5fa',
    stressed: '#fb923c',
    sick: '#f87171',
    sad: '#a78bfa',
    good: '#4ade80',
    energized: '#facc15'
  };

  const barsHtml = entries
    .map((e) => {
      const height = e.hours ? Math.round((e.hours / maxHours) * 100) : 4;
      const color = moodColors[e.mood] || '#d1d5db';
      const title = e.mood
        ? `${e.label}: ${e.mood} — ${e.hours} hours (${e.bedtime || '--:--'} to ${e.wakeTime || '--:--'})`
        : `${e.label}: no check-in`;
      const emoji = getMoodEmoji(e.mood);
      const bed = formatTimeShort(e.bedtime);
      const wake = formatTimeShort(e.wakeTime);
      return `
        <div class="chart-column" title="${title}">
          <div class="chart-bar-wrapper">
            <div class="chart-bar" style="height:${height}%; background:${color};"></div>
          </div>
          <div class="chart-day-info">
            <span class="chart-label">${e.label}</span>
            <span class="chart-mood">${emoji}</span>
            <span class="chart-time bed">🌙 ${bed}</span>
            <span class="chart-time wake">⏰ ${wake}</span>
            <span class="chart-hours">${e.hours || '--'}h</span>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="chart-bars">${barsHtml}</div>
    <div class="chart-legend">
      <span><span class="legend-dot" style="background:${moodColors.tired}"></span> Tired</span>
      <span><span class="legend-dot" style="background:${moodColors.stressed}"></span> Stressed</span>
      <span><span class="legend-dot" style="background:${moodColors.sick}"></span> Sick</span>
      <span><span class="legend-dot" style="background:${moodColors.sad}"></span> Sad</span>
      <span><span class="legend-dot" style="background:${moodColors.good}"></span> Good</span>
      <span><span class="legend-dot" style="background:${moodColors.energized}"></span> Energized</span>
    </div>
  `;
}

function syncDurationSlider() {
  const bedtimeInput = document.getElementById('sleepBedtime');
  const wakeInput = document.getElementById('sleepWake');
  const slider = document.getElementById('sleepDurationSlider');
  const valueEl = document.getElementById('durationValue');
  if (!bedtimeInput || !wakeInput || !slider || !valueEl) return;

  const bedMinutes = timeToMinutes(bedtimeInput.value) || 0;
  const wakeMinutes = timeToMinutes(wakeInput.value) || 0;
  let duration = wakeMinutes - bedMinutes;
  if (duration <= 0) duration += 24 * 60;
  slider.value = Math.max(240, Math.min(720, duration));
  valueEl.textContent = formatHoursMinutes(duration);
}

function updateToggleUI(enabled) {
  const toggleTextEl = document.getElementById('toggleText');
  const toggleIconEl = document.getElementById('toggleIcon');
  if (toggleTextEl) toggleTextEl.textContent = enabled ? 'ON' : 'OFF';
  if (toggleIconEl) toggleIconEl.textContent = enabled ? '🔔' : '🔕';
}

function updateSleepAlarmDisplay() {
  const countdownLabelEl = document.getElementById('sleepCountdownLabel');
  const nextWakeEl = document.getElementById('sleepNextWake');
  const durationEl = document.getElementById('sleepDuration');
  const nextBedtimeEl = document.getElementById('sleepNextBedtime');
  const alarmStatusEl = document.getElementById('alarmStatus');
  const sleepQualityEl = document.getElementById('sleepQuality');

  const now = new Date();

  if (!sleepSchedule) {
    if (nextWakeEl) nextWakeEl.textContent = '--:--';
    if (countdownLabelEl) countdownLabelEl.textContent = 'Set your wake time below';
    if (nextBedtimeEl) nextBedtimeEl.textContent = '--:--';
    if (durationEl) durationEl.textContent = '--';
    if (alarmStatusEl) alarmStatusEl.textContent = '--';
    if (sleepQualityEl) {
      sleepQualityEl.textContent = 'No schedule yet';
      sleepQualityEl.className = 'sleep-quality-pill';
    }
    return;
  }

  const enabled = Boolean(sleepSchedule.enabled);

  if (sleepSchedule.wake_time) {
    const wakeTarget = sleepSnoozeUntil || getNextSleepTime(sleepSchedule.wake_time);
    const wakeDiff = Math.max(0, Math.floor((wakeTarget - now) / 1000));
    if (nextWakeEl) nextWakeEl.textContent = wakeTarget.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (countdownLabelEl) {
      countdownLabelEl.textContent = enabled ? `Alarm in ${formatDuration(wakeDiff)}` : 'Alarm is turned off';
    }
  } else {
    if (nextWakeEl) nextWakeEl.textContent = '--:--';
    if (countdownLabelEl) countdownLabelEl.textContent = 'Set your wake time below';
  }

  if (sleepSchedule.bedtime) {
    const bedTarget = getNextSleepTime(sleepSchedule.bedtime);
    if (nextBedtimeEl) nextBedtimeEl.textContent = bedTarget.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (durationEl && sleepSchedule.bedtime && sleepSchedule.wake_time) {
    durationEl.textContent = getSleepDurationText(sleepSchedule.bedtime, sleepSchedule.wake_time);
  }

  if (sleepQualityEl && sleepSchedule.bedtime && sleepSchedule.wake_time) {
    const quality = getSleepQuality(sleepSchedule.bedtime, sleepSchedule.wake_time);
    sleepQualityEl.textContent = quality.text;
    sleepQualityEl.className = 'sleep-quality-pill ' + quality.class;
  }

  if (alarmStatusEl) {
    alarmStatusEl.textContent = enabled ? 'ON' : 'OFF';
    alarmStatusEl.className = 'side-value ' + (enabled ? 'status-on' : 'status-off');
  }
  const alarmStatusIconEl = document.getElementById('alarmStatusIcon');
  if (alarmStatusIconEl) {
    alarmStatusIconEl.textContent = enabled ? '🔔' : '🔕';
  }
}

function checkSleepAlarm() {
  if (!sleepSchedule || !sleepSchedule.enabled) return;

  const now = new Date();
  const todayKey = getSleepTodayKey();

  if (sleepSnoozeUntil && now >= sleepSnoozeUntil) {
    triggerSleepAlarm();
    return;
  }

  if (sleepSchedule.wake_time && sleepAlarmTriggeredToday !== todayKey) {
    const [wakeH, wakeM] = sleepSchedule.wake_time.split(':').map(Number);
    if (now.getHours() === wakeH && now.getMinutes() === wakeM) {
      sleepAlarmTriggeredToday = todayKey;
      triggerSleepAlarm();
      return;
    }
  }

  if (sleepSchedule.bedtime && sleepBedtimeTriggeredToday !== todayKey) {
    const [bedH, bedM] = sleepSchedule.bedtime.split(':').map(Number);
    if (now.getHours() === bedH && now.getMinutes() === bedM) {
      sleepBedtimeTriggeredToday = todayKey;
      triggerBedtimeReminder();
    }
  }
}

function triggerSleepAlarm() {
  sleepAlarmPlaying = true;
  const overlay = document.getElementById('wakeAlarmOverlay');
  const timeEl = document.getElementById('wakeAlarmTime');
  overlay.classList.remove('hidden');
  timeEl.textContent = `It's ${new Date().toLocaleTimeString()} — time to wake up!`;
  sleepSnoozeUntil = null;
  if (sleepAlarmMasterGain) {
    sleepAlarmMasterGain.gain.setValueAtTime(1, sleepAlarmAudioCtx.currentTime);
  }
  playSleepAlarmSound();
}

function triggerBedtimeReminder() {
  const overlay = document.getElementById('bedtimeOverlay');
  if (overlay) overlay.classList.remove('hidden');
  playBedtimeSound();
}

async function playSleepAlarmSound() {
  if (!sleepAlarmPlaying || document.getElementById('wakeAlarmOverlay').classList.contains('hidden')) return;
  const style = localStorage.getItem('sleepAlarmStyle') || 'loud';
  const duration = style === 'gentle' ? 1.2 : style === 'rising' ? 2.0 : 0.8;

  try {
    const ctx = ensureSleepAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (!sleepAlarmPlaying || document.getElementById('wakeAlarmOverlay').classList.contains('hidden')) return;

    if (style.startsWith('file:')) {
      const filePath = style.replace('file:', '/sounds/');
      sleepAlarmFileAudio = new Audio(filePath);
      sleepAlarmFileAudio.loop = true;
      sleepAlarmFileAudio.volume = 1;
      sleepAlarmFileAudio.play().catch((err) => console.error('Audio file play error:', err));
      return;
    }

    sleepAlarmOscillators = [];
    let loopOsc = null;

    if (style === 'gentle') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(sleepAlarmMasterGain || ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
      sleepAlarmOscillators.push(osc);
      loopOsc = osc;
    } else if (style === 'digital') {
      const t = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t + i * 0.12);
        gain.gain.setValueAtTime(0.001, t + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.1, t + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.08);
        osc.connect(gain);
        gain.connect(sleepAlarmMasterGain || ctx.destination);
        osc.start(t + i * 0.12);
        osc.stop(t + i * 0.12 + 0.1);
        sleepAlarmOscillators.push(osc);
      }
    } else if (style === 'rising') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      const now = ctx.currentTime;
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + duration);
      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.exponentialRampToValueAtTime(1760, now + duration);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + duration * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(sleepAlarmMasterGain || ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
      sleepAlarmOscillators.push(osc1, osc2);
      loopOsc = osc1;
    } else if (style === 'bell') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'sine';
      const now = ctx.currentTime;
      osc1.frequency.setValueAtTime(523.25, now);
      osc2.frequency.setValueAtTime(1046.5, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(sleepAlarmMasterGain || ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
      sleepAlarmOscillators.push(osc1, osc2);
      loopOsc = osc1;
    } else if (style === 'buzzer') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const now = ctx.currentTime;
      for (let i = 0; i < 8; i++) {
        osc.frequency.setValueAtTime(440, now + i * 0.1);
        osc.frequency.setValueAtTime(880, now + i * 0.1 + 0.05);
      }
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(sleepAlarmMasterGain || ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
      sleepAlarmOscillators.push(osc);
      loopOsc = osc;
    } else if (style === 'retro') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25];
      const step = duration / notes.length;
      notes.forEach((freq, i) => {
        osc.frequency.setValueAtTime(freq, now + i * step);
      });
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(sleepAlarmMasterGain || ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
      sleepAlarmOscillators.push(osc);
      loopOsc = osc;
    } else if (style === 'chime') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      notes.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
        sleepAlarmOscillators.push(osc);
      });
      gain.connect(sleepAlarmMasterGain || ctx.destination);
      loopOsc = sleepAlarmOscillators[0];
    } else {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      const now = ctx.currentTime;
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(1318.5, now + 0.15);
      osc1.frequency.setValueAtTime(880, now + 0.3);
      osc1.frequency.setValueAtTime(1318.5, now + 0.45);
      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(1318.5, now + 0.15);
      osc2.frequency.setValueAtTime(880, now + 0.3);
      osc2.frequency.setValueAtTime(1318.5, now + 0.45);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.5, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(sleepAlarmMasterGain || ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
      sleepAlarmOscillators.push(osc1, osc2);
      loopOsc = osc1;
    }

    if (loopOsc) {
      loopOsc.onended = () => {
        if (sleepAlarmPlaying && !document.getElementById('wakeAlarmOverlay').classList.contains('hidden')) {
          sleepAlarmTimeout = setTimeout(playSleepAlarmSound, 250);
        }
      };
    }
  } catch (err) {
    console.error('Audio alarm error:', err);
  }
}

function stopSleepAlarmSound() {
  sleepAlarmPlaying = false;
  sleepSnoozeUntil = null;
  if (sleepAlarmTimeout) {
    clearTimeout(sleepAlarmTimeout);
    sleepAlarmTimeout = null;
  }
  if (sleepAlarmMasterGain) {
    try {
      sleepAlarmMasterGain.gain.cancelScheduledValues(sleepAlarmAudioCtx.currentTime);
      sleepAlarmMasterGain.gain.setValueAtTime(0, sleepAlarmAudioCtx.currentTime);
    } catch {
      // ignore
    }
  }
  try {
    sleepAlarmOscillators.forEach((osc) => {
      try {
        osc.onended = null;
        osc.stop();
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
  sleepAlarmOscillators = [];

  if (sleepAlarmFileAudio) {
    try {
      sleepAlarmFileAudio.pause();
      sleepAlarmFileAudio.currentTime = 0;
      sleepAlarmFileAudio.loop = false;
      sleepAlarmFileAudio.src = '';
    } catch {
      // ignore
    }
    sleepAlarmFileAudio = null;
  }

  if (sleepAlarmAudioCtx && sleepAlarmAudioCtx.state !== 'closed') {
    sleepAlarmAudioCtx.close().catch(() => {});
  }
  sleepAlarmAudioCtx = null;
  sleepAlarmMasterGain = null;
}

function startSleepAlarmLoop() {
  if (sleepAlarmInterval) clearInterval(sleepAlarmInterval);
  updateSleepAlarmDisplay();
  sleepAlarmInterval = setInterval(() => {
    updateSleepAlarmDisplay();
    checkSleepAlarm();
  }, 1000);
}

function stopSleepAlarm() {
  if (sleepAlarmInterval) {
    clearInterval(sleepAlarmInterval);
    sleepAlarmInterval = null;
  }
  stopSleepAlarmSound();
}

async function loadSleep() {
  try {
    sleepSchedule = await api('/sleep');
    document.getElementById('sleepBedtime').value = sleepSchedule.bedtime;
    document.getElementById('sleepWake').value = sleepSchedule.wake_time;
    document.getElementById('sleepEnabled').checked = Boolean(sleepSchedule.enabled);
    updateToggleUI(Boolean(sleepSchedule.enabled));
    syncDurationSlider();
    updateSleepAlarmDisplay();
  } catch {}
  renderSleepChart();
}

async function loadSleepSoundsManifest() {
  try {
    const res = await fetch('/sounds/sounds.json');
    sleepSoundsManifest = await res.json();
    populateSleepSoundPicker();
  } catch (err) {
    console.error('Failed to load sounds manifest:', err);
  }
}

function populateSleepSoundPicker() {
  const alarmSoundSelect = document.getElementById('alarmSoundSelect');
  if (!alarmSoundSelect || !sleepSoundsManifest) return;
  alarmSoundSelect.innerHTML = '';
  const saved = localStorage.getItem('sleepAlarmStyle') || 'loud';
  sleepSoundsManifest.categories.forEach((category) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category.name;
    category.sounds.forEach((sound) => {
      const option = document.createElement('option');
      option.value = sound.id;
      option.textContent = sound.label;
      if (sound.id === saved) option.selected = true;
      optgroup.appendChild(option);
    });
    alarmSoundSelect.appendChild(optgroup);
  });
}

let sleepPreviewAudio = null;

async function playSleepSoundPreview(style) {
  try {
    if (sleepPreviewAudio) {
      sleepPreviewAudio.pause();
      sleepPreviewAudio.currentTime = 0;
      sleepPreviewAudio = null;
    }

    if (style.startsWith('file:')) {
      const filePath = style.replace('file:', '/sounds/');
      sleepPreviewAudio = new Audio(filePath);
      sleepPreviewAudio.volume = 0.7;
      sleepPreviewAudio.play().catch((err) => console.error('Preview audio error:', err));
      setTimeout(() => {
        if (sleepPreviewAudio) {
          sleepPreviewAudio.pause();
          sleepPreviewAudio.currentTime = 0;
          sleepPreviewAudio = null;
        }
      }, 3000);
      return;
    }

    const ctx = ensureSleepAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (style === 'gentle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    } else if (style === 'digital') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    } else if (style === 'rising') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    } else if (style === 'bell') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    } else if (style === 'buzzer') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.05);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    } else if (style === 'retro') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    } else if (style === 'chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    }
    osc.connect(gain);
    gain.connect(sleepAlarmMasterGain || ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (err) {
    console.error('Sound preview error:', err);
  }
}

async function playBedtimeSound() {
  try {
    const ctx = ensureSleepAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(392, ctx.currentTime);
    osc.frequency.setValueAtTime(493.88, ctx.currentTime + 0.25);
    osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(sleepAlarmMasterGain || ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch (err) {
    console.error('Bedtime sound error:', err);
  }
}

function setupSleep() {
  const bedtimeInput = document.getElementById('sleepBedtime');
  const wakeInput = document.getElementById('sleepWake');
  const enabledInput = document.getElementById('sleepEnabled');
  const durationSlider = document.getElementById('sleepDurationSlider');

  function addMinutes(timeStr, minutes) {
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date(2000, 0, 1, h, m + minutes);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function setBedtimeFromDuration() {
    const wakeMinutes = timeToMinutes(wakeInput.value) || 0;
    const duration = parseInt(durationSlider.value, 10) || 480;
    bedtimeInput.value = minutesToTime(wakeMinutes - duration);
    syncDurationSlider();
  }

  document.querySelectorAll('.wheel-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      const minutes = parseInt(btn.dataset.min, 10);
      target.value = addMinutes(target.value || '00:00', minutes);
      target.dispatchEvent(new Event('change'));
    });
  });

  wakeInput.addEventListener('change', () => {
    setBedtimeFromDuration();
  });

  bedtimeInput.addEventListener('change', () => {
    syncDurationSlider();
  });

  durationSlider.addEventListener('input', () => {
    setBedtimeFromDuration();
  });

  document.querySelectorAll('[data-preset-wake]').forEach((btn) => {
    btn.addEventListener('click', () => {
      wakeInput.value = btn.dataset.presetWake;
      wakeInput.dispatchEvent(new Event('change'));
    });
  });

  document.querySelectorAll('[data-preset-duration]').forEach((btn) => {
    btn.addEventListener('click', () => {
      durationSlider.value = btn.dataset.presetDuration;
      durationSlider.dispatchEvent(new Event('input'));
    });
  });

  if (enabledInput) {
    enabledInput.addEventListener('change', () => {
      updateToggleUI(enabledInput.checked);
    });
  }

  const alarmSoundSelect = document.getElementById('alarmSoundSelect');
  const previewSoundBtn = document.getElementById('previewSoundBtn');

  if (alarmSoundSelect) {
    alarmSoundSelect.addEventListener('change', () => {
      localStorage.setItem('sleepAlarmStyle', alarmSoundSelect.value);
      playSleepSoundPreview(alarmSoundSelect.value);
    });
  }

  if (previewSoundBtn) {
    previewSoundBtn.addEventListener('click', () => {
      const style = alarmSoundSelect ? alarmSoundSelect.value : localStorage.getItem('sleepAlarmStyle') || 'loud';
      playSleepSoundPreview(style);
    });
  }

  loadSleepSoundsManifest();

  const moodBtns = document.querySelectorAll('#sleepView .mood-btn');
  const checkInNotes = document.getElementById('checkInNotes');
  const checkInBtn = document.getElementById('checkInBtn');
  const checkInAdvice = document.getElementById('checkInAdvice');
  const checkInWakeTime = '07:00';
  let selectedMood = null;

  function setMood(mood) {
    selectedMood = mood;
    moodBtns.forEach((b) => b.classList.toggle('active', b.dataset.mood === mood));
  }

  function renderCheckInAdvice(mood, note, advice) {
    if (!checkInAdvice) return;
    checkInAdvice.classList.remove('hidden');
    checkInAdvice.innerHTML = `
      <strong>Suggested sleep: ${advice.hours}</strong>
      <p>${advice.tip}</p>
      <p>Wake-up is set to <strong>${checkInWakeTime}</strong> and bedtime is set to match. Press <strong>Save</strong> when you're happy with the times.</p>
      ${note ? `<small>Your note: ${escapeHtml(note)}</small>` : ''}
    `;
  }

  function saveCheckIn(mood, note, advice) {
    const entry = { mood, note, advice, wakeTime: checkInWakeTime, date: getSleepTodayKey() };
    localStorage.setItem(`sleepCheckIn_${getSleepTodayKey()}`, JSON.stringify(entry));
  }

  function loadCheckIn() {
    const saved = localStorage.getItem(`sleepCheckIn_${getSleepTodayKey()}`);
    if (!saved) return;
    try {
      const entry = JSON.parse(saved);
      if (entry.mood) setMood(entry.mood);
      if (checkInNotes && entry.note) checkInNotes.value = entry.note;
      if (entry.advice) renderCheckInAdvice(entry.mood, entry.note, entry.advice);
    } catch {
      // ignore corrupted entry
    }
  }

  moodBtns.forEach((btn) => {
    btn.addEventListener('click', () => setMood(btn.dataset.mood));
  });

  if (checkInBtn) {
    checkInBtn.addEventListener('click', () => {
      if (!selectedMood) {
        showMessage('Please pick a mood first', 'error');
        return;
      }
      const note = checkInNotes ? checkInNotes.value.trim() : '';
      const advice = getSleepAdvice(selectedMood);

      const wakeMinutes = timeToMinutes(checkInWakeTime);
      wakeInput.value = minutesToTime(wakeMinutes);
      const sleepMinutes = Math.round(advice.targetHours * 60);
      bedtimeInput.value = minutesToTime(wakeMinutes - sleepMinutes);
      syncDurationSlider();

      renderCheckInAdvice(selectedMood, note, advice);
      saveCheckIn(selectedMood, note, advice);
      renderSleepChart();
    });
  }

  loadCheckIn();

  function updateLastSaved() {
    const el = document.getElementById('lastSaved');
    if (!el) return;
    const now = new Date();
    el.textContent = `Saved ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  document.getElementById('sleepForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const bedtime = bedtimeInput.value;
    const wake_time = wakeInput.value;
    const enabled = enabledInput.checked;
    try {
      sleepSchedule = await api('/sleep', {
        method: 'PUT',
        body: JSON.stringify({ bedtime, wake_time, enabled })
      });
      sleepAlarmTriggeredToday = null;
      sleepBedtimeTriggeredToday = null;
      sleepSnoozeUntil = null;
      updateSleepAlarmDisplay();
      updateLastSaved();
      showMessage('Sleep schedule saved', 'success');
    } catch {}
  });

  document.getElementById('downloadSleepIcs').addEventListener('click', () => {
    const bedtime = document.getElementById('sleepBedtime').value;
    const wake_time = document.getElementById('sleepWake').value;
    if (!bedtime || !wake_time) {
      showMessage('Set a bedtime and wake time first', 'error');
      return;
    }
    const ics = buildSleepIcs(bedtime, wake_time);
    downloadIcs('sleep-schedule.ics', ics);
    showMessage('Calendar file downloaded — import it in your calendar app', 'success');
  });

  document.getElementById('wakeAlarmStop').addEventListener('click', async () => {
    stopSleepAlarmSound();
    document.getElementById('wakeAlarmOverlay').classList.add('hidden');
    if (sleepSchedule) {
      try {
        const bedtime = sleepSchedule.bedtime;
        const wake_time = sleepSchedule.wake_time;
        sleepSchedule = await api('/sleep', {
          method: 'PUT',
          body: JSON.stringify({ bedtime, wake_time, enabled: false })
        });
        document.getElementById('sleepEnabled').checked = false;
        updateToggleUI(false);
        updateSleepAlarmDisplay();
        showMessage('Alarm turned off. Enable it again to use it tomorrow.', 'success');
      } catch {}
    }
  });

  document.getElementById('wakeAlarmSnooze').addEventListener('click', () => {
    stopSleepAlarmSound();
    document.getElementById('wakeAlarmOverlay').classList.add('hidden');
    sleepSnoozeUntil = new Date(Date.now() + 5 * 60 * 1000);
    updateSleepAlarmDisplay();
  });

  const bedtimeOk = document.getElementById('bedtimeOk');
  if (bedtimeOk) {
    bedtimeOk.addEventListener('click', () => {
      document.getElementById('bedtimeOverlay').classList.add('hidden');
    });
  }
}

function avatarHtml(avatar, size = '1.5rem') {
  if (!avatar) return `<span class="friend-avatar" style="width:${size};height:${size};">👤</span>`;
  if (avatar.startsWith('data:')) {
    return `<span class="friend-avatar has-image" style="width:${size};height:${size};background-image:url(${avatar});"></span>`;
  }
  return `<span class="friend-avatar" style="width:${size};height:${size};">${avatar}</span>`;
}

async function loadFriends() {
  try {
    const [friends, pending] = await Promise.all([api('/friends'), api('/friends/pending')]);

    const friendList = document.getElementById('friendList');
    friendList.innerHTML = '';
    if (friends.length === 0) {
      friendList.innerHTML = '<li>No friends yet.</li>';
    } else {
      friends.forEach((f) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.6rem;">
            ${avatarHtml(f.avatar, '2rem')}
            <div><strong>${escapeHtml(f.username)}</strong> <small>· ${f.currency} 🐚</small></div>
          </div>
        `;
        friendList.appendChild(li);
      });
    }

    const pendingList = document.getElementById('pendingList');
    pendingList.innerHTML = '';
    if (pending.length === 0) {
      pendingList.innerHTML = '<li>No pending requests.</li>';
    } else {
      pending.forEach((p) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.6rem;">
            ${avatarHtml(p.avatar, '2rem')}
            <div><strong>${escapeHtml(p.username)}</strong> <small>wants to be friends</small></div>
          </div>
          <div class="actions">
            <button class="btn-primary respond-request" data-id="${p.id}" data-action="accept">Accept</button>
            <button class="btn-secondary respond-request" data-id="${p.id}" data-action="decline">Decline</button>
          </div>
        `;
        pendingList.appendChild(li);
      });
    }
  } catch {}
}

function setupFriends() {
  // Inner tabs between Friends and Leaderboard
  document.querySelectorAll('[data-friends-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-friends-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isLeaderboard = tab.dataset.friendsTab === 'leaderboard';
      document.getElementById('friendsSub').classList.toggle('hidden', isLeaderboard);
      document.getElementById('leaderboardSub').classList.toggle('hidden', !isLeaderboard);
      if (isLeaderboard) {
        loadLeaderboard();
      } else {
        loadFriends();
      }
    });
  });

  document.getElementById('friendForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('friendUsername').value.trim();
    try {
      await api('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ username })
      });
      e.target.reset();
      showMessage('Friend request sent', 'success');
    } catch {}
  });

  document.getElementById('pendingList').addEventListener('click', async (e) => {
    const btn = e.target.closest('.respond-request');
    if (!btn) return;
    try {
      await api('/friends/respond', {
        method: 'POST',
        body: JSON.stringify({
          friendship_id: btn.dataset.id,
          action: btn.dataset.action
        })
      });
      loadFriends();
    } catch {}
  });
}

// ---------- New leaderboard ----------

async function loadLeaderboard() {
  try {
    const [globalTop, friends, around] = await Promise.all([
      api('/leaderboard'),
      api('/leaderboard/friends'),
      api('/leaderboard/around')
    ]);
    const meId = currentUser ? currentUser.id : null;
    [globalTop, friends, around].forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((u) => { u.me = u.id === meId; });
    });
    renderLeaderboard(globalTop, friends, around);
  } catch {}
}

function renderLeaderboard(globalTop, friends, around) {
  const now = new Date();
  document.getElementById('lbMonthPill').textContent =
    `${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })} · Monthly`;

  // Podium: global top 3 (display order: 2nd, 1st, 3rd)
  const podiumOrder = [globalTop[1], globalTop[0], globalTop[2]].filter(Boolean);
  const MEDALS = ['🥇', '🥈', '🥉'];
  document.getElementById('lbPodium').innerHTML = podiumOrder.map((f, i) => {
    const place = globalTop.indexOf(f);
    const delay = 0.2 + i * 0.15;
    return `
      <div class="lb-podium-card ${place === 0 ? 'first' : ''}" style="animation-delay: ${delay}s">
        <span class="lb-medal">${MEDALS[place]}</span>
        <div class="lb-avatar" ${lbAvatarStyle(f.avatar)}>${lbAvatarContent(f.avatar, f.name)}</div>
        <div class="lb-name">${escapeHtml(f.name)}</div>
        <div class="lb-score"><span class="lb-count" data-target="${f.points}">0</span> <span class="lb-pts">🌙</span></div>
        <div class="lb-sub">${f.sessions} sessions · ${f.avgMinutes} min avg · 🔥 ${f.streak}d<br>${f.total.toLocaleString()} 🌙 all-time</div>
      </div>`;
  }).join('');
  lbBindPodiumSparkle();

  // Friends board
  renderLbFriends(friends);

  // Around You board
  const aroundRanked = [...around].sort((a, b) => a.rank - b.rank);
  const aroundMax = lbScore(aroundRanked[0]) || 1;
  aroundRanked.forEach((f) => {
    const move = lbLiveTrend(f.name, f.rank, 'global', f.trend);
    f._trend = move ? move.delta : 0;
    f._boosted = !!(move && move.boosted);
    f._ultra = !!(move && move.ultra);
  });
  document.getElementById('lbRowsAround').innerHTML = aroundRanked.map((f, i) =>
    lbRowHtml(f, i, `#${f.rank}`, f.rank <= 3, aroundMax, 0.55 + i * 0.07)
  ).join('');

  const meGlobal = aroundRanked.find((f) => f.me);
  if (meGlobal) {
    document.getElementById('lbGlobalSummary').innerHTML =
      `Your global rank: <b>#${meGlobal.rank}</b> · the 5 above and 4 below you`;
  }

  // Header subtitle
  const headerSub = document.getElementById('lbHeaderSub');
  if (meGlobal && meGlobal.rank === 1) {
    headerSub.textContent = "👑 You're the #1 studier on the entire site — everyone else is chasing you.";
  } else if (meGlobal && meGlobal.rank === 2) {
    headerSub.textContent = "You're #2 on the entire site — one good session from the crown.";
  } else {
    headerSub.textContent = "See where you stand — and who's climbing up behind you.";
  }

  lbPaintBars(document.getElementById('lbRowsAround'));
  lbRunCountUps(document);
  lbBindNameTips(document.getElementById('lbRowsAround'));

  // Sync board heights after layout settles
  requestAnimationFrame(() => {
    lbSyncBoardHeights();
    window.addEventListener('resize', lbSyncBoardHeights);
  });
}

function renderLbFriends(list) {
  const friendsRanked = [...list].sort((a, b) => lbScore(b) - lbScore(a));
  const friendMax = lbScore(friendsRanked[0]) || 1;
  friendsRanked.forEach((f, i) => {
    const move = lbLiveTrend(f.name, i + 1, 'friends', f.trend);
    f._trend = move ? move.delta : 0;
    f._boosted = !!(move && move.boosted);
    f._ultra = !!(move && move.ultra);
  });
  const rows = document.getElementById('lbRows');
  rows.scrollTop = 0;
  rows.innerHTML = friendsRanked.map((f, i) =>
    lbRowHtml(f, i, `#${i + 1}`, i < 3, friendMax, 0.5 + i * 0.07)
  ).join('');

  const meFriendIndex = friendsRanked.findIndex((f) => f.me);
  const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || 'th');
  if (meFriendIndex !== -1) {
    document.getElementById('lbFriendSummary').textContent = meFriendIndex === 0
      ? `You're 1st out of your ${friendsRanked.length} friends — keep it up!`
      : `You're ${ord(meFriendIndex + 1)} out of your ${friendsRanked.length} friends — ${friendsRanked[0].name} is in the lead.`;
  }

  lbPaintBars(rows);
  lbRunCountUps(rows);
  lbBindNameTips(rows);
}

function lbScore(f) {
  return f ? f.points : 0;
}

function lbAvatarContent(avatar, name) {
  if (!avatar) {
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }
  if (avatar.startsWith('data:')) {
    return '';
  }
  return avatar;
}

function lbAvatarStyle(avatar) {
  if (avatar && avatar.startsWith('data:')) {
    return `style="background-image:url(${avatar});background-size:cover;background-position:center;"`;
  }
  return '';
}

function lbCompact(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
}

function lbTrendHtml(t, boosted, ultra) {
  if (!t) return '';
  if (t > 0) {
    return `<span class="lb-trend lb-up${ultra ? ' lb-ultra' : boosted ? ' lb-glow' : ''}">${ultra ? '🚀' : ''}▲${t}</span>`;
  }
  return `<span class="lb-trend lb-down">▼${Math.abs(t)}</span>`;
}

function lbRowHtml(f, i, rankLabel, rankTop, barMax, delay) {
  return `
    <div class="lb-row ${f.me ? 'lb-me' : ''} ${f._ultra ? 'lb-ultra' : ''}" style="animation-delay: ${delay}s">
      <div class="lb-bar" data-width="${(lbScore(f) / barMax) * 100}"></div>
      <span class="lb-rank ${rankTop ? 'lb-top' : ''}">${rankLabel}</span>
      <span class="lb-player">
        <span class="lb-avatar lb-small" ${lbAvatarStyle(f.avatar)}>${lbAvatarContent(f.avatar, f.name)}</span>
        <span class="lb-pname">${escapeHtml(f.name)}</span>${lbTrendHtml(f._trend, f._boosted, f._ultra)}${f.me ? '<span class="lb-you-tag">You</span>' : ''}
      </span>
      <span class="lb-num">${f.sessions} <span class="lb-unit">mo</span></span>
      <span class="lb-num">${f.avgMinutes} <span class="lb-unit">min</span></span>
      <span class="lb-num lb-streak">🔥 ${f.streak}d</span>
      <span class="lb-num lb-pts-cell lb-pts-col"><span class="lb-count" data-target="${lbScore(f)}">0</span> <span class="lb-unit">🌙</span><span class="lb-alltime">${lbCompact(f.total)} all-time</span></span>
    </div>`;
}

const LB_DAY_MS = 86400000;
const LB_TWO_H_MS = 7200000;
const LB_TWO_D_MS = 2 * LB_DAY_MS;

function lbLsGet(k) {
  try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
}

function lbLiveTrend(name, currentRank, context, seedTrend) {
  const key = `lb-trend:${context}:${name}`;
  const now = Date.now();
  const state = lbLsGet(key) || { rank: null, moves: [] };
  state.moves = state.moves.filter((m) => now - m.at < LB_TWO_D_MS);

  if (state.rank === null) {
    if (seedTrend) state.moves.push({ delta: seedTrend, at: now });
  } else if (state.rank !== currentRank) {
    const delta = state.rank - currentRank;
    state.moves.push({ delta, at: now });
  }

  state.rank = currentRank;
  try { localStorage.setItem(key, JSON.stringify(state)); } catch {}

  const active = state.moves[state.moves.length - 1];
  if (!active) return null;
  const boosted = active.delta >= 2;
  const ultra = active.delta > 0 && state.moves
    .filter((m) => m.delta > 0 && now - m.at < LB_TWO_H_MS)
    .reduce((s, m) => s + m.delta, 0) >= 10;
  return now - active.at < (boosted || ultra ? LB_TWO_D_MS : LB_DAY_MS)
    ? { ...active, boosted, ultra } : null;
}

function lbPaintBars(scope = document) {
  setTimeout(() => {
    scope.querySelectorAll('.lb-row .lb-bar').forEach((b) => {
      b.style.width = b.dataset.width + '%';
    });
  }, 700);
}

function lbRunCountUps(scope = document) {
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  scope.querySelectorAll('.lb-count').forEach((el) => {
    const target = +el.dataset.target;
    const duration = 1200;
    const start = performance.now() + 450;
    (function tick(now) {
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      el.textContent = Math.round(easeOut(t) * target).toLocaleString();
      if (t < 1) requestAnimationFrame(tick);
    })(performance.now());
  });
}

function lbSyncBoardHeights() {
  const rows = document.getElementById('lbRows');
  const rowsAround = document.getElementById('lbRowsAround');
  if (rows && rowsAround) {
    rows.style.maxHeight = rowsAround.scrollHeight + 'px';
  }
}

function lbBindPodiumSparkle() {
  const firstCard = document.querySelector('.lb-podium-card.first');
  if (!firstCard) return;
  const GLYPHS = ['✦', '✧', '★', '✨'];
  const medal = firstCard.querySelector('.lb-medal');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pulseTimer;
  const particles = new Set();
  let rafId = null;

  function tick(now) {
    const GRAVITY = 950;
    const AIR_DRAG = 0.35;
    for (const p of particles) {
      const t = (now - p.born) / 1000;
      const dt = Math.min((now - p.last) / 1000, 0.05);
      p.last = now;
      p.vy += GRAVITY * dt;
      p.vx *= Math.max(1 - AIR_DRAG * dt, 0);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const life = t / p.lifespan;
      if (life >= 1) {
        p.el.remove();
        particles.delete(p);
        continue;
      }
      const opacity = life < 0.08 ? life / 0.08 : life > 0.55 ? 1 - (life - 0.55) / 0.45 : 1;
      const scale = p.scale * (1 - life * 0.35);
      p.el.style.opacity = opacity;
      p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${scale})`;
    }
    rafId = particles.size ? requestAnimationFrame(tick) : null;
  }

  firstCard.addEventListener('click', () => {
    firstCard.classList.add('lb-pulse');
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => firstCard.classList.remove('lb-pulse'), 600);
    if (medal) {
      medal.style.animation = 'none';
      void medal.offsetWidth;
      medal.style.animation = 'lbMedalPop 0.6s cubic-bezier(0.22, 1, 0.36, 1) both';
    }
    if (reducedMotion) return;
    const rect = firstCard.getBoundingClientRect();
    for (let i = 0; i < 22; i++) {
      const el = document.createElement('span');
      el.className = 'lb-sparkle';
      el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      el.style.fontSize = (10 + Math.random() * 10) + 'px';
      document.body.appendChild(el);
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 260;
      particles.add({
        el,
        x: rect.left + rect.width * (0.15 + Math.random() * 0.7),
        y: rect.top + rect.height * (0.15 + Math.random() * 0.7),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 220,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 540,
        scale: 0.8 + Math.random() * 0.5,
        born: performance.now(),
        last: performance.now(),
        lifespan: 1.6 + Math.random() * 0.9
      });
    }
    if (rafId === null) rafId = requestAnimationFrame(tick);
  });
}

function lbBindNameTips(scope = document) {
  const nameTip = document.getElementById('lbNameTip') || (() => {
    const el = document.createElement('div');
    el.id = 'lbNameTip';
    el.className = 'lb-name-tip';
    document.body.appendChild(el);
    return el;
  })();
  let tipFor = null;

  const show = (el) => {
    if (el.scrollWidth <= el.clientWidth) return;
    nameTip.textContent = el.textContent;
    const r = el.getBoundingClientRect();
    nameTip.style.left = Math.min(r.left, innerWidth - 16) + 'px';
    nameTip.style.top = (r.top - 8) + 'px';
    nameTip.classList.add('lb-show');
    tipFor = el;
  };
  const hide = () => { nameTip.classList.remove('lb-show'); tipFor = null; };

  scope.querySelectorAll('.lb-player .lb-pname').forEach((el) => {
    el.addEventListener('mouseenter', () => show(el));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      tipFor === el ? hide() : show(el);
    });
  });
}

function setupLeaderboard() {
  // The leaderboard is rendered fresh each time the view loads.
  // Sparkle binding happens inside renderLeaderboard after the podium is built.
}

let adminTab = 'users';

async function loadAdmin() {
  if (!currentUser || !currentUser.is_admin) {
    showMessage('Admin access required', 'error');
    showView('dashboard');
    return;
  }
  await renderAdminTab();
}

async function renderAdminTab() {
  document.querySelectorAll('.admin-section').forEach((s) => s.classList.add('hidden'));
  document.getElementById(`admin${capitalize(adminTab)}`).classList.remove('hidden');

  try {
    if (adminTab === 'users') {
      const users = await api('/admin/users');
      const tbody = document.getElementById('adminUsersBody');
      tbody.innerHTML = '';
      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10">No users found.</td></tr>';
        return;
      }
      users.forEach((u) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${u.id}</td>
          <td>${escapeHtml(u.username)}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${u.currency}</td>
          <td>${u.task_count}</td>
          <td>${u.session_count}</td>
          <td>${u.total_study_minutes}</td>
          <td>${u.is_admin ? 'Yes' : 'No'}</td>
          <td>${formatDate(u.created_at)}</td>
          <td class="actions">
            <button class="btn-secondary admin-toggle-admin" data-id="${u.id}" data-admin="${u.is_admin ? 1 : 0}">
              ${u.is_admin ? 'Demote' : 'Promote'}
            </button>
            <button class="btn-danger admin-delete-user" data-id="${u.id}">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else if (adminTab === 'tasks') {
      const tasks = await api('/admin/tasks');
      renderAdminList('adminTaskList', tasks, 'task', ['title', 'username', 'due_date']);
    } else if (adminTab === 'events') {
      const events = await api('/admin/events');
      renderAdminList('adminEventList', events, 'event', ['title', 'username', 'event_date']);
    } else if (adminTab === 'sessions') {
      const sessions = await api('/admin/sessions');
      renderAdminList('adminSessionList', sessions, 'session', ['duration_minutes', 'username', 'currency_earned']);
    } else if (adminTab === 'friends') {
      const friends = await api('/admin/friends');
      const list = document.getElementById('adminFriendList');
      list.innerHTML = '';
      if (friends.length === 0) {
        list.innerHTML = '<li>No friendships found.</li>';
        return;
      }
      friends.forEach((f) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div class="event-main">
            <strong>${escapeHtml(f.requester)} → ${escapeHtml(f.addressee)}</strong>
            <small>Status: ${f.status} · ${formatDateTime(f.created_at)}</small>
          </div>
        `;
        list.appendChild(li);
      });
    }
  } catch {}
}

function renderAdminList(listId, items, type, fields) {
  const list = document.getElementById(listId);
  list.innerHTML = '';
  if (items.length === 0) {
    list.innerHTML = '<li>No items found.</li>';
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    const main = fields
      .map((f) => {
        if (f === 'due_date') return item.due_date ? `Due ${formatDate(item.due_date)}` : '';
        if (f === 'event_date') return formatDateTime(item.event_date);
        if (f === 'duration_minutes') return `${item.duration_minutes} min`;
        if (f === 'currency_earned') return `+${item.currency_earned} 🐚`;
        if (f === 'username') return `by ${escapeHtml(item.username)}`;
        return escapeHtml(item[f] || '');
      })
      .filter(Boolean)
      .join(' · ');
    li.innerHTML = `
      <div class="event-main">
        <strong>${escapeHtml(item.title || `${type} #${item.id}`)}</strong>
        <small>${main}</small>
      </div>
      <div class="actions">
        <button class="btn-danger admin-delete-${type}" data-id="${item.id}">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function setupAdmin() {
  document.querySelectorAll('.admin-tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      adminTab = btn.dataset.adminTab;
      renderAdminTab();
    });
  });

  document.getElementById('adminUsersBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('admin-toggle-admin')) {
      try {
        await api(`/admin/users/${id}/admin`, { method: 'PUT' });
        renderAdminTab();
        showMessage('User role updated', 'success');
      } catch {}
    } else if (btn.classList.contains('admin-delete-user')) {
      if (!confirm('Delete this user and all their data?')) return;
      try {
        await api(`/admin/users/${id}`, { method: 'DELETE' });
        renderAdminTab();
        showMessage('User deleted', 'success');
      } catch {}
    }
  });

  ['tasks', 'events', 'sessions'].forEach((type) => {
    document.getElementById(`admin${capitalize(type)}`).addEventListener('click', async (e) => {
      const btn = e.target.closest(`.admin-delete-${type.slice(0, -1)}`);
      if (!btn) return;
      if (!confirm('Delete this item?')) return;
      try {
        await api(`/admin/${type}/${btn.dataset.id}`, { method: 'DELETE' });
        renderAdminTab();
        showMessage('Item deleted', 'success');
      } catch {}
    });
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString();
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString();
}

function toDatetimeLocal(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatNumber(n) {
  return String(n).padStart(2, '0');
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${formatNumber(m)}:${formatNumber(s)}`;
  return `${formatNumber(m)}:${formatNumber(s)}`;
}

/* ---------- Notes ---------- */

let openNoteId = null;
let currentNoteTitle = '';
let lastReviewContent = '';
let pendingNoteAttachment = null; // { name, type, data }
let noteAttachmentRemoved = false;

async function loadNotesView() {
  await loadNotes();
  loadFlashcards();
}

async function loadNotes() {
  try {
    const notes = await api('/notes');
    const list = document.getElementById('notesList');
    list.innerHTML = '';

    if (notes.length === 0) {
      list.innerHTML = '<p>No notes yet.</p>';
      return;
    }

    notes.forEach((note) => {
      const div = document.createElement('div');
      div.className = `note-item${note.id === openNoteId ? ' active' : ''}`;
      const attachmentIcon = note.has_file ? ' 📎' : '';
      div.innerHTML = `
        <strong>${escapeHtml(note.title)}${attachmentIcon}</strong>
        <small>${escapeHtml(note.snippet || '')}</small>
      `;
      div.addEventListener('click', () => openNote(note.id));
      list.appendChild(div);
    });
  } catch {
    // handled by api helper
  }
}

async function openNote(id) {
  try {
    const note = await api(`/notes/${id}`);
    openNoteId = note.id;
    currentNoteTitle = note.title;
    document.getElementById('noteTitleInput').value = note.title;
    document.getElementById('noteContentInput').value = note.content || '';
    pendingNoteAttachment = note.file_data
      ? { name: note.file_name, type: note.file_type, data: note.file_data }
      : null;
    noteAttachmentRemoved = false;
    renderNoteAttachment();
    hideAiResult();
    loadNotes();
  } catch {
    // handled by api helper
  }
}

function renderNoteAttachment() {
  const box = document.getElementById('noteAttachment');
  const name = document.getElementById('noteAttachmentName');
  const download = document.getElementById('noteAttachmentDownload');
  if (!pendingNoteAttachment) {
    box.classList.add('hidden');
    name.textContent = '';
    download.href = '';
    download.download = '';
    return;
  }
  name.textContent = pendingNoteAttachment.name || 'attachment';
  box.classList.remove('hidden');
  try {
    const byteString = atob(pendingNoteAttachment.data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: pendingNoteAttachment.type || 'application/octet-stream' });
    download.href = URL.createObjectURL(blob);
    download.download = pendingNoteAttachment.name || 'download';
  } catch {
    download.href = '#';
    download.download = '';
  }
}

function clearNoteAttachment() {
  pendingNoteAttachment = null;
  noteAttachmentRemoved = true;
  renderNoteAttachment();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processNoteFile(file) {
  if (!file) return;
  if (file.size > 2.5 * 1024 * 1024) {
    showMessage('File too large (max 2.5 MB)', 'error');
    return;
  }
  const allowed = ['text/plain', 'text/markdown', 'application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
  const ext = file.name.split('.').pop().toLowerCase();
  const allowedExts = ['txt', 'md', 'pdf', 'png', 'jpg', 'jpeg', 'webp'];
  if (!allowedExts.includes(ext)) {
    showMessage('Unsupported file type. Use txt, md, pdf, png, jpg, or webp.', 'error');
    return;
  }

  try {
    const base64 = await readFileAsBase64(file);
    pendingNoteAttachment = { name: file.name, type: file.type || 'application/octet-stream', data: base64 };
    noteAttachmentRemoved = false;

    // For text files, also fill the note content so it's editable/searchable
    if (ext === 'txt' || ext === 'md') {
      const textReader = new FileReader();
      textReader.onload = () => {
        const textarea = document.getElementById('noteContentInput');
        if (!textarea.value.trim()) {
          textarea.value = textReader.result;
        }
      };
      textReader.readAsText(file);
    }

    renderNoteAttachment();
  } catch {
    showMessage('Failed to read file', 'error');
  }
}

function setupNotes() {
  // Inner tabs between Notes and Courses
  document.querySelectorAll('[data-notes-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-notes-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isCourses = tab.dataset.notesTab === 'courses';
      document.getElementById('notesSub').classList.toggle('hidden', isCourses);
      document.getElementById('coursesSub').classList.toggle('hidden', !isCourses);
      if (isCourses) {
        loadCoursesView();
      } else {
        loadNotesView();
      }
    });
  });

  document.getElementById('newNoteBtn').addEventListener('click', () => {
    openNoteId = null;
    currentNoteTitle = '';
    noteAttachmentRemoved = false;
    document.getElementById('noteTitleInput').value = '';
    document.getElementById('noteContentInput').value = '';
    clearNoteAttachment();
    hideAiResult();
    loadNotes();
    document.getElementById('noteTitleInput').focus();
  });

  document.getElementById('saveNoteBtn').addEventListener('click', async () => {
    const title = document.getElementById('noteTitleInput').value.trim();
    const content = document.getElementById('noteContentInput').value;
    if (!title) {
      showMessage('Title is required', 'error');
      return;
    }
    const body = { title, content };
    if (pendingNoteAttachment) {
      body.file_name = pendingNoteAttachment.name;
      body.file_type = pendingNoteAttachment.type;
      body.file_data = pendingNoteAttachment.data;
    } else if (noteAttachmentRemoved) {
      body.file_name = null;
      body.file_type = null;
      body.file_data = null;
    }
    try {
      if (openNoteId) {
        await api(`/notes/${openNoteId}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });
      } else {
        const note = await api('/notes', {
          method: 'POST',
          body: JSON.stringify(body)
        });
        openNoteId = note.id;
      }
      noteAttachmentRemoved = false;
      currentNoteTitle = title;
      showMessage('Note saved', 'success');
      loadNotes();
    } catch {
      // handled by api helper
    }
  });

  document.getElementById('deleteNoteBtn').addEventListener('click', async () => {
    if (!openNoteId) {
      showMessage('Open a note first', 'error');
      return;
    }
    if (!confirm('Delete this note?')) return;
    try {
      await api(`/notes/${openNoteId}`, { method: 'DELETE' });
      openNoteId = null;
      currentNoteTitle = '';
      document.getElementById('noteTitleInput').value = '';
      document.getElementById('noteContentInput').value = '';
      hideAiResult();
      showMessage('Note deleted', 'success');
      loadNotes();
    } catch {
      // handled by api helper
    }
  });

  document.getElementById('exportNotesBtn').addEventListener('click', async () => {
    try {
      const notes = await api('/notes/export');
      const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notes-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // handled by api helper
    }
  });

  const importNotesFile = document.getElementById('importNotesFile');
  document.getElementById('importNotesBtn').addEventListener('click', () => {
    importNotesFile.click();
  });
  importNotesFile.addEventListener('change', () => {
    const file = importNotesFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      importNotesFile.value = '';
      let notes;
      try {
        const parsed = JSON.parse(reader.result);
        const raw = Array.isArray(parsed) ? parsed : parsed.notes;
        if (!Array.isArray(raw)) throw new Error('Invalid notes file');
        notes = raw.map((n) => ({ title: String(n.title ?? ''), content: String(n.content ?? '') }));
      } catch {
        showMessage('Invalid notes file', 'error');
        return;
      }
      try {
        const result = await api('/notes/import', {
          method: 'POST',
          body: JSON.stringify({ notes })
        });
        showMessage(`Imported ${result.imported} notes`, 'success');
        loadNotes();
      } catch {
        // handled by api helper
      }
    };
    reader.readAsText(file);
  });

  // Drag-and-drop file upload in notes section
  const noteDropZone = document.getElementById('noteDropZone');
  const noteDropFileInput = document.getElementById('noteDropFileInput');
  if (noteDropZone && noteDropFileInput) {
    noteDropZone.addEventListener('click', () => noteDropFileInput.click());
    noteDropFileInput.addEventListener('change', () => {
      processNoteFile(noteDropFileInput.files[0]);
      noteDropFileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach((event) => {
      noteDropZone.addEventListener(event, (e) => {
        e.preventDefault();
        e.stopPropagation();
        noteDropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((event) => {
      noteDropZone.addEventListener(event, (e) => {
        e.preventDefault();
        e.stopPropagation();
        noteDropZone.classList.remove('drag-over');
      });
    });

    noteDropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      processNoteFile(file);
    });
  }

  document.getElementById('noteAttachmentRemove').addEventListener('click', () => {
    clearNoteAttachment();
  });

  setupAiTools();
  setupFlashcards();
}

/* ---------- AI study tools ---------- */

function hideAiResult() {
  document.getElementById('aiResult').classList.add('hidden');
  document.getElementById('aiSaveNoteBtn').classList.add('hidden');
  document.getElementById('aiStatus').textContent = '';
}

async function generateFromNote(type) {
  if (!openNoteId) {
    showMessage('Open a note first', 'error');
    return null;
  }
  const buttons = ['aiReviewBtn', 'aiQuizBtn', 'aiFlashcardsBtn'].map((id) => document.getElementById(id));
  const status = document.getElementById('aiStatus');
  buttons.forEach((btn) => { btn.disabled = true; });
  status.textContent = 'Generating…';
  try {
    const data = await api('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ type, noteIds: [openNoteId] })
    });
    status.textContent = '';
    return data;
  } catch (err) {
    status.textContent = err.message;
    return null;
  } finally {
    buttons.forEach((btn) => { btn.disabled = false; });
  }
}

function setupAiTools() {
  document.getElementById('aiReviewBtn').addEventListener('click', async () => {
    const data = await generateFromNote('review');
    if (!data) return;
    lastReviewContent = data.content;
    const result = document.getElementById('aiResult');
    result.textContent = data.content;
    result.classList.remove('hidden');
    document.getElementById('aiSaveNoteBtn').classList.remove('hidden');
  });

  document.getElementById('aiSaveNoteBtn').addEventListener('click', async () => {
    if (!lastReviewContent) return;
    try {
      await api('/notes', {
        method: 'POST',
        body: JSON.stringify({ title: `Review: ${currentNoteTitle}`, content: lastReviewContent })
      });
      showMessage('Review saved as note', 'success');
      loadNotes();
    } catch {
      // handled by api helper
    }
  });

  document.getElementById('aiQuizBtn').addEventListener('click', async () => {
    const data = await generateFromNote('quiz');
    if (!data) return;
    renderQuiz(data.quiz.questions);
  });

  document.getElementById('quizSubmitBtn').addEventListener('click', () => {
    const blocks = document.querySelectorAll('#quizQuestions .quiz-question');
    let correct = 0;
    blocks.forEach((block) => {
      const answer = Number(block.dataset.answer);
      const checked = block.querySelector('input:checked');
      if (checked && Number(checked.value) === answer) correct++;
      const correctInput = block.querySelector(`input[value="${answer}"]`);
      if (correctInput) correctInput.closest('label').classList.add('quiz-correct');
    });
    document.getElementById('quizScore').textContent = `${correct} / ${blocks.length} correct`;
  });

  document.getElementById('quizCloseBtn').addEventListener('click', () => {
    document.getElementById('quizModal').classList.add('hidden');
    document.getElementById('quizQuestions').innerHTML = '';
    document.getElementById('quizScore').textContent = '';
  });

  document.getElementById('aiFlashcardsBtn').addEventListener('click', async () => {
    const data = await generateFromNote('flashcards');
    if (!data) return;
    try {
      const result = await api('/flashcards/bulk', {
        method: 'POST',
        body: JSON.stringify({ cards: data.cards })
      });
      showMessage(`Added ${result.added} flashcards`, 'success');
      loadFlashcards();
    } catch {
      // handled by api helper
    }
  });
}

function renderQuiz(questions) {
  const container = document.getElementById('quizQuestions');
  container.innerHTML = '';
  document.getElementById('quizScore').textContent = '';
  questions.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'quiz-question';
    div.dataset.answer = q.answer;
    const options = q.options.map((option, oi) => `
      <label>
        <input type="radio" name="quiz-q-${i}" value="${oi}">
        ${escapeHtml(option)}
      </label>
    `).join('');
    div.innerHTML = `<p><strong>${i + 1}. ${escapeHtml(q.question)}</strong></p>${options}`;
    container.appendChild(div);
  });
  document.getElementById('quizModal').classList.remove('hidden');
}

/* ---------- Flashcards ---------- */

const flashcardState = { cards: [], idx: 0, flipped: false };

async function loadFlashcards() {
  try {
    flashcardState.cards = await api('/flashcards');
    if (flashcardState.idx >= flashcardState.cards.length) flashcardState.idx = 0;
    flashcardState.flipped = false;
    renderFlashcard();
  } catch {
    // handled by api helper
  }
}

function renderFlashcard() {
  const { cards, idx, flipped } = flashcardState;
  const card = cards[idx];
  document.getElementById('flashcardFront').textContent = card ? card.front : 'No cards yet';
  document.getElementById('flashcardBack').textContent = card ? card.back : '';
  document.getElementById('cardCounter').textContent = cards.length ? `${idx + 1} / ${cards.length}` : '0 / 0';
  document.getElementById('flashcard').classList.toggle('flipped', flipped);
}

function stepFlashcard(delta) {
  const count = flashcardState.cards.length;
  if (!count) return;
  flashcardState.idx = (flashcardState.idx + delta + count) % count;
  flashcardState.flipped = false;
  renderFlashcard();
}

function setupFlashcards() {
  const flip = () => {
    flashcardState.flipped = !flashcardState.flipped;
    document.getElementById('flashcard').classList.toggle('flipped', flashcardState.flipped);
  };
  document.getElementById('flipCardBtn').addEventListener('click', flip);
  document.getElementById('flashcard').addEventListener('click', flip);

  document.getElementById('prevCardBtn').addEventListener('click', () => stepFlashcard(-1));
  document.getElementById('nextCardBtn').addEventListener('click', () => stepFlashcard(1));

  document.getElementById('shuffleCardsBtn').addEventListener('click', () => {
    const { cards } = flashcardState;
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    flashcardState.idx = 0;
    flashcardState.flipped = false;
    renderFlashcard();
  });

  document.getElementById('deleteCardBtn').addEventListener('click', async () => {
    const card = flashcardState.cards[flashcardState.idx];
    if (!card) return;
    try {
      await api(`/flashcards/${card.id}`, { method: 'DELETE' });
      loadFlashcards();
    } catch {
      // handled by api helper
    }
  });

  document.getElementById('clearCardsBtn').addEventListener('click', async () => {
    if (!flashcardState.cards.length) return;
    if (!confirm('Delete all flashcards?')) return;
    try {
      await api('/flashcards', { method: 'DELETE' });
      loadFlashcards();
    } catch {
      // handled by api helper
    }
  });
}

/* ---------- Courses ---------- */

let openCourseId = null;
let coursesCache = [];

async function loadCoursesView() {
  openCourseId = null;
  document.getElementById('courseDetail').classList.add('hidden');
  document.getElementById('coursesList').classList.remove('hidden');
  try {
    coursesCache = await api('/courses');
    const list = document.getElementById('coursesList');
    list.innerHTML = '';

    if (coursesCache.length === 0) {
      list.innerHTML = '<p>No courses yet.</p>';
      return;
    }

    coursesCache.forEach((course) => {
      const div = document.createElement('div');
      div.className = 'course-card';
      div.innerHTML = `
        <strong>${escapeHtml(course.name)}</strong>
        <p>${escapeHtml(course.description || '')}</p>
        <small>${course.material_count} materials · by ${escapeHtml(course.creator)}</small>
      `;
      div.addEventListener('click', () => openCourse(course.id));
      list.appendChild(div);
    });
  } catch {
    // handled by api helper
  }
}

function openCourse(id) {
  openCourseId = id;
  const course = coursesCache.find((c) => c.id === id);
  document.getElementById('courseDetailName').textContent = course ? course.name : '';
  document.getElementById('courseDetailDesc').textContent = course ? (course.description || '') : '';
  document.getElementById('coursesList').classList.add('hidden');
  document.getElementById('courseDetail').classList.remove('hidden');
  loadMaterials();
}

async function loadMaterials() {
  if (!openCourseId) return;
  try {
    const materials = await api(`/courses/${openCourseId}/materials`);
    const list = document.getElementById('materialsList');
    list.innerHTML = '';

    if (materials.length === 0) {
      list.innerHTML = '<p>No materials yet.</p>';
      return;
    }

    materials.forEach((material) => {
      const canDelete = currentUser && (material.user_id === currentUser.id || currentUser.is_admin);
      const div = document.createElement('div');
      div.className = 'material-item';
      div.innerHTML = `
        <div class="material-main">
          <strong>${escapeHtml(material.title)}</strong>
          <small>by ${escapeHtml(material.username)} · ${formatDate(material.created_at)}</small>
        </div>
        <div class="actions">
          <button class="btn-secondary view-material">View / Download</button>
          ${canDelete ? '<button class="btn-danger delete-material">Delete</button>' : ''}
        </div>
      `;
      div.querySelector('.view-material').addEventListener('click', () => viewMaterial(material.id));
      const deleteBtn = div.querySelector('.delete-material');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (!confirm('Delete this material?')) return;
          try {
            await api(`/courses/materials/${material.id}`, { method: 'DELETE' });
            loadMaterials();
          } catch {
            // handled by api helper
          }
        });
      }
      list.appendChild(div);
    });
  } catch {
    // handled by api helper
  }
}

async function viewMaterial(id) {
  try {
    const material = await api(`/courses/materials/${id}`);
    if (material.file_data) {
      const a = document.createElement('a');
      a.href = `data:${material.file_type};base64,${material.file_data}`;
      a.download = material.file_name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const blob = new Blob([material.content || ''], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  } catch {
    // handled by api helper
  }
}

function setupCourses() {
  document.getElementById('createCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('courseNameInput').value.trim();
    const description = document.getElementById('courseDescInput').value.trim();
    if (!name) {
      showMessage('Course name is required', 'error');
      return;
    }
    try {
      await api('/courses', {
        method: 'POST',
        body: JSON.stringify({ name, description })
      });
      document.getElementById('courseNameInput').value = '';
      document.getElementById('courseDescInput').value = '';
      showMessage('Course created', 'success');
      loadCoursesView();
    } catch {
      // handled by api helper (duplicate name toasts too)
    }
  });

  document.getElementById('courseBackBtn').addEventListener('click', () => {
    loadCoursesView();
  });

  document.getElementById('uploadMaterialBtn').addEventListener('click', () => {
    if (!openCourseId) {
      showMessage('Open a course first', 'error');
      return;
    }
    const title = document.getElementById('materialTitleInput').value.trim();
    const text = document.getElementById('materialTextInput').value.trim();
    const fileInput = document.getElementById('materialFileInput');
    const file = fileInput.files[0];
    if (!title) {
      showMessage('Title is required', 'error');
      return;
    }
    if (file) {
      if (file.size > 2.5 * 1024 * 1024) {
        showMessage('File too large (max 2.5 MB)', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result).split('base64,')[1] || '';
        uploadMaterial({
          title,
          content: text || undefined,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_data: base64
        });
      };
      reader.readAsDataURL(file);
    } else {
      if (!text) {
        showMessage('Paste text or choose a file', 'error');
        return;
      }
      uploadMaterial({ title, content: text });
    }
  });
}

async function uploadMaterial(payload) {
  try {
    await api(`/courses/${openCourseId}/materials`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    document.getElementById('materialTitleInput').value = '';
    document.getElementById('materialTextInput').value = '';
    document.getElementById('materialFileInput').value = '';
    showMessage('Material uploaded', 'success');
    loadMaterials();
  } catch {
    // handled by api helper
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  setupAuth();
  setupNavigation();
  setupProfile();
  setupSettings();
  setupTheme();
  setupAvatar();
  setupTasks();
  setupCalendar();
  setupTimer();
  setupSleep();
  setupNotes();
  setupCourses();
  setupFriends();
  setupAdmin();
  setupLeaderboard();

  // Unlock the Web Audio context on the first user interaction so alarms can play later.
  const unlockOnce = () => unlockSleepAudio();
  document.addEventListener('click', unlockOnce, { once: true });
  document.addEventListener('touchstart', unlockOnce, { once: true });
  document.addEventListener('keydown', unlockOnce, { once: true });

  if (getToken()) {
    initAuth().then(() => {
      if (!currentUser && !getToken()) showView('auth');
    });
  } else {
    showView('auth');
  }
});
