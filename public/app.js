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

function setUser(user, token) {
  currentUser = user;
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('username', user.username);
    localStorage.setItem('isAdmin', user.is_admin ? '1' : '0');
  }
  document.getElementById('dashUser').textContent = user.username;
  document.getElementById('profileName').textContent = user.username;
  document.getElementById('mainNav').classList.remove('hidden');
  updateAdminNav();
  requestNotificationPermission();
  startNotificationChecks();
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
  document.getElementById('mainNav').classList.add('hidden');
  document.getElementById('profileMenu').classList.add('hidden');
  showView('auth');
}

function showView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.querySelectorAll('.nav a').forEach((a) => a.classList.remove('active'));

  if (view === 'auth') {
    document.getElementById('authView').classList.remove('hidden');
    return;
  }

  const target = document.getElementById(`${view}View`);
  if (target) target.classList.remove('hidden');
  const navLink = document.querySelector(`.nav a[data-view="${view}"]`);
  if (navLink) navLink.classList.add('active');

  switch (view) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'tasks':
      loadTasks();
      break;
    case 'calendar':
      loadCalendar();
      break;
    case 'sleep':
      loadSleep();
      break;
    case 'friends':
      loadFriends();
      break;
    case 'leaderboard':
      loadLeaderboard();
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
    const balance = await api('/study/balance');
    const username = localStorage.getItem('username') || 'Student';
    const isAdmin = payload.isAdmin === 1 || payload.isAdmin === true || localStorage.getItem('isAdmin') === '1';
    currentUser = { id: payload.userId, username, currency: balance.balance, is_admin: isAdmin };
    document.getElementById('dashUser').textContent = username;
    document.getElementById('profileName').textContent = username;
    document.getElementById('mainNav').classList.remove('hidden');
    updateAdminNav();
    requestNotificationPermission();
    startNotificationChecks();
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
  } catch {}
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

    try {
      if (id) {
        await api(`/tasks/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, subject, due_date })
        });
      } else {
        await api('/tasks', {
          method: 'POST',
          body: JSON.stringify({ title, subject, due_date })
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
    const event_date = document.getElementById('tasksEventDate').value;
    const duration_minutes = parseInt(document.getElementById('tasksEventDuration').value, 10) || 60;
    const reminder_minutes_before = parseInt(document.getElementById('tasksEventReminder').value, 10) || 0;

    try {
      if (id) {
        await api(`/events/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, event_date, duration_minutes, reminder_minutes_before })
        });
      } else {
        await api('/events', {
          method: 'POST',
          body: JSON.stringify({ title, event_date, duration_minutes, reminder_minutes_before })
        });
      }
      resetTasksEventForm();
      loadTasks();
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

  document.getElementById('eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('eventId').value;
    const title = document.getElementById('eventTitle').value.trim();
    const event_date = document.getElementById('eventDate').value;
    const duration_minutes = parseInt(document.getElementById('eventDuration').value, 10) || 60;
    const reminder_minutes_before = parseInt(document.getElementById('eventReminder').value, 10) || 0;

    try {
      if (id) {
        await api(`/events/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, event_date, duration_minutes, reminder_minutes_before })
        });
      } else {
        await api('/events', {
          method: 'POST',
          body: JSON.stringify({ title, event_date, duration_minutes, reminder_minutes_before })
        });
      }
      resetEventForm();
      renderCalendar();
      showMessage(id ? 'Event updated' : 'Event added', 'success');
    } catch {}
  });

  document.getElementById('eventCancel').addEventListener('click', resetEventForm);

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
        document.getElementById('eventId').value = event.id;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDate').value = toDatetimeLocal(event.event_date);
        document.getElementById('eventDuration').value = event.duration_minutes || 60;
        document.getElementById('eventReminder').value = event.reminder_minutes_before;
        document.getElementById('eventSubmit').textContent = 'Update Event';
        document.getElementById('eventCancel').classList.remove('hidden');
      } catch {}
    }
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
}

async function loadCalendar() {
  await renderCalendar();
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
    const div = document.createElement('div');
    div.className = 'calendar-cell other-month';
    div.textContent = prevLastDay - i;
    grid.appendChild(div);
  }

  const today = new Date();

  // Group items by date
  const itemsByDate = {};
  events.forEach((e) => {
    const key = e.event_date.slice(0, 10);
    if (!itemsByDate[key]) itemsByDate[key] = [];
    itemsByDate[key].push({ type: 'event', title: e.title, time: formatTime(new Date(e.event_date)) });
  });
  tasks.forEach((t) => {
    if (!t.due_date) return;
    if (!itemsByDate[t.due_date]) itemsByDate[t.due_date] = [];
    itemsByDate[t.due_date].push({ type: 'task', title: t.title, completed: t.completed });
  });

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const div = document.createElement('div');
    div.className = 'calendar-cell';
    if (dateStr === dateKey(today)) div.classList.add('today');

    const items = itemsByDate[dateStr] || [];
    const itemsHtml = items.slice(0, 3).map((item) => {
      const cls = item.type === 'event' ? 'month-item event' : `month-item task${item.completed ? ' completed' : ''}`;
      const label = item.type === 'event' ? `${item.time} ${item.title}` : item.title;
      return `<div class="${cls}">${escapeHtml(label)}</div>`;
    }).join('');
    const more = items.length > 3 ? `<div class="month-item more">+${items.length - 3} more</div>` : '';

    div.innerHTML = `<span class="cell-date">${day}</span>${itemsHtml}${more}`;
    grid.appendChild(div);
  }

  const remainingCells = (7 - ((startPadding + daysInMonth) % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    const div = document.createElement('div');
    div.className = 'calendar-cell other-month';
    div.textContent = i;
    grid.appendChild(div);
  }
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
    li.innerHTML = `
      <div class="event-main">
        <strong>${escapeHtml(event.title)}</strong>
        <small>${formatDateTime(event.event_date)} · ${event.duration_minutes || 60} min · Remind ${event.reminder_minutes_before} min before</small>
      </div>
      <div class="actions">
        <button class="btn-secondary edit-event" data-id="${event.id}">Edit</button>
        <button class="btn-danger delete-event" data-id="${event.id}">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function resetEventForm() {
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
  document.getElementById('eventSubmit').textContent = 'Add Event';
  document.getElementById('eventCancel').classList.add('hidden');
}

function setupTimer() {
  const display = document.getElementById('timerDisplay');
  const input = document.getElementById('timerInput');
  const startBtn = document.getElementById('timerStart');
  const pauseBtn = document.getElementById('timerPause');
  const resetBtn = document.getElementById('timerReset');
  const result = document.getElementById('timerResult');

  function updateDisplay() {
    const m = Math.floor(timerRemaining / 60);
    const s = timerRemaining % 60;
    display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
    if (timerRemaining <= 0) {
      timerRemaining = (parseInt(input.value, 10) || 1) * 60;
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
}

async function loadSleep() {
  try {
    const schedule = await api('/sleep');
    document.getElementById('sleepBedtime').value = schedule.bedtime;
    document.getElementById('sleepWake').value = schedule.wake_time;
    document.getElementById('sleepEnabled').checked = Boolean(schedule.enabled);
  } catch {}
}

function setupSleep() {
  document.getElementById('sleepForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const bedtime = document.getElementById('sleepBedtime').value;
    const wake_time = document.getElementById('sleepWake').value;
    const enabled = document.getElementById('sleepEnabled').checked;
    try {
      await api('/sleep', {
        method: 'PUT',
        body: JSON.stringify({ bedtime, wake_time, enabled })
      });
      showMessage('Sleep schedule saved', 'success');
    } catch {}
  });
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
        li.innerHTML = `<div><strong>${escapeHtml(f.username)}</strong> <small>· ${f.currency} 🐚</small></div>`;
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
          <div><strong>${escapeHtml(p.username)}</strong> <small>wants to be friends</small></div>
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

let leaderboardMetric = 'points';
let leaderboardScope = 'global';

async function loadLeaderboard() {
  await renderLeaderboard();
}

async function renderLeaderboard() {
  let path = '/leaderboard';
  if (leaderboardMetric === 'streaks' && leaderboardScope === 'friends') path = '/leaderboard/friends/streaks';
  else if (leaderboardMetric === 'streaks') path = '/leaderboard/streaks';
  else if (leaderboardScope === 'friends') path = '/leaderboard/friends';

  try {
    const leaders = await api(path);
    const tbody = document.getElementById('leaderboardBody');
    const valueHeader = document.getElementById('leaderboardValueHeader');
    tbody.innerHTML = '';

    const isStreaks = leaderboardMetric === 'streaks';
    valueHeader.textContent = isStreaks ? 'Streak Days' : 'Shells';

    if (leaders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">No data yet.</td></tr>';
      return;
    }

    leaders.forEach((u, i) => {
      const tr = document.createElement('tr');
      const value = isStreaks ? `${u.streak || 0} 🔥` : `${u.currency} 🐚`;
      tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(u.username)}</td><td>${value}</td>`;
      tbody.appendChild(tr);
    });
  } catch {}
}

function setupLeaderboard() {
  document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      leaderboardMetric = btn.dataset.lbMetric;
      leaderboardScope = btn.dataset.lbScope;
      renderLeaderboard();
    });
  });
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

document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
  setupNavigation();
  setupProfile();
  setupSettings();
  setupTasks();
  setupCalendar();
  setupTimer();
  setupSleep();
  setupFriends();
  setupAdmin();
  setupLeaderboard();

  if (getToken()) {
    initAuth().then(() => {
      if (!currentUser && !getToken()) showView('auth');
    });
  } else {
    showView('auth');
  }
});
