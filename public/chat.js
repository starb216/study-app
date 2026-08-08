/* ============================================================
   CHAT PANEL (#chatView)
   Server-backed chat: messages are stored in the StudyMint
   database via /api/chat so other users can see them.
   Moderation data (custom subjects, reports, prohibited users,
   mention read-state) is still stored locally per browser.
   ============================================================ */
(function () {
  const chatView = document.getElementById('chatView');
  if (!chatView) return;

  const categoryList = chatView.querySelector('.category-list');
  const chatBox = document.getElementById('chatBox');
  const chatInput = document.getElementById('chatInput');
  const authorInput = document.getElementById('authorInput');
  const authorSelect = document.getElementById('authorSelect');
  const sendBtn = document.getElementById('sendBtn');
  const selectedDisplay = document.getElementById('selectedDisplay');

  // Admin gating: chat admin features follow the Studymint app's own admin
  // flag (currentUser from app.js — a top-level `let`, readable cross-script).
  function isChatAdmin() {
    try {
      if (typeof currentUser !== 'undefined' && currentUser && currentUser.is_admin) return true;
    } catch (e) {
      // app.js globals unavailable (e.g. chat markup used standalone) — fall through
    }
    return localStorage.getItem('isAdmin') === '1';
  }

  window.updateChatAdminAccess = function () {
    const btn = document.getElementById('adminBtn');
    if (btn) btn.classList.toggle('hidden', !isChatAdmin());
    syncAuthorInput();
  };

  /* ---------- Server chat API ---------- */

  function getToken() {
    return localStorage.getItem('token');
  }

  async function chatApi(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers
    };
    const res = await fetch(`/api${path}`, { ...options, headers });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    return data;
  }

  const messagesCache = {};

  function extractMentions(text) {
    const matches = String(text || '').match(/@([\w\s-]+)/g) || [];
    return matches.map(m => m.slice(1).trim()).filter(Boolean);
  }

  function normalizeMessage(m) {
    return {
      id: m.id,
      user_id: m.user_id,
      username: m.username,
      author: m.username,
      category: m.category,
      text: m.text,
      timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
      mentions: extractMentions(m.text)
    };
  }

  function getMessages(category) {
    return messagesCache[category] || [];
  }

  async function loadChat(category, { silent = false } = {}) {
    try {
      const rows = await chatApi(`/chat?category=${encodeURIComponent(category)}`);
      messagesCache[category] = rows.map(normalizeMessage);
    } catch (err) {
      if (!silent) console.warn('Chat load failed:', err.message);
    }
    renderMessages(category);
    setCategorySeen(category);
    updateMentionDots();
  }

  async function saveMessage(text, category, displayAs) {
    const body = { category, text };
    if (displayAs) body.displayAs = displayAs;
    const message = await chatApi('/chat', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const normalized = normalizeMessage(message);
    if (!messagesCache[category]) messagesCache[category] = [];
    messagesCache[category].push(normalized);
    return normalized;
  }

  function renderMessages(category) {
    chatBox.innerHTML = '';
    const messages = getMessages(category);
    if (messages.length === 0) {
      chatBox.innerHTML = `<div class="empty-state">No messages in ${category.replace(/</g, '&lt;')} yet. Start the conversation!</div>`;
    } else {
      messages.forEach((m) => chatBox.appendChild(renderMessage(m)));
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function renderMessage(message) {
    const author = (message.author || 'Anonymous').replace(/</g, '&lt;');
    const prohibited = isUserProhibited(message.author || 'Anonymous');
    const isOwn = typeof currentUser !== 'undefined' && currentUser && currentUser.id === message.user_id;
    const msg = document.createElement('div');
    msg.className = 'message' + (isOwn ? ' own' : '');
    msg.dataset.id = message.id;
    msg.dataset.userId = message.user_id;
    msg.innerHTML = `
      <div class="message-header">
        <span class="message-author${prohibited ? ' prohibited' : ''}" data-author="${author}">${author}</span>
        <span class="message-category">${message.category.replace(/</g, '&lt;')}</span>
      </div>
      <div class="message-text">${message.text.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</div>
    `;
    return msg;
  }

  function setActiveCategory(el) {
    chatView.querySelectorAll('.category').forEach(c => c.classList.remove('active'));
    chatView.querySelectorAll('.subcategory').forEach(s => s.classList.remove('active'));
    chatView.querySelectorAll('.nested-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    selectedCategory = el.dataset.category;
    selectedDisplay.textContent = selectedCategory;
    loadChat(selectedCategory);
  }

  const PENDING_SUBJECTS_KEY = 'studyChat_pendingSubjects_v1';
  const PENDING_DELETIONS_KEY = 'studyChat_pendingDeletions_v1';
  const PENDING_REPORTS_KEY = 'studyChat_pendingReports_v1';
  const CUSTOM_SUBJECTS_KEY = 'studyChat_customSubjects_v1';
  const PROHIBITED_USERS_KEY = 'studyChat_prohibitedUsers_v1';
  const MENTIONS_SEEN_KEY = 'studyChat_mentionsSeen_v1';
  const BUILTIN_CATEGORIES = ['General','Study tip','Study experience','Math','Science','Computer science','English','Mandarin Chinese','Spanish','French','Arabic','Portuguese','History','Oral History','Ancient History','Modern History'];
  let selectedCategory = 'General';

  function getProhibitedUsers() {
    try { return JSON.parse(localStorage.getItem(PROHIBITED_USERS_KEY)) || []; }
    catch { return []; }
  }

  function saveProhibitedUsers(list) {
    localStorage.setItem(PROHIBITED_USERS_KEY, JSON.stringify(list));
  }

  function isUserProhibited(name) {
    if (!name) return false;
    return getProhibitedUsers().some(u => u.toLowerCase() === name.trim().toLowerCase());
  }

  function prohibitUser(name) {
    const list = getProhibitedUsers();
    const trimmed = name.trim();
    if (!trimmed || isUserProhibited(trimmed)) return;
    list.push(trimmed);
    saveProhibitedUsers(list);
  }

  function unprohibitUser(name) {
    const list = getProhibitedUsers().filter(u => u.toLowerCase() !== name.trim().toLowerCase());
    saveProhibitedUsers(list);
  }

  categoryList.addEventListener('click', (e) => {
    const nested = e.target.closest('.nested-item');
    if (nested) {
      e.stopPropagation();
      setActiveCategory(nested);
      return;
    }
    const sub = e.target.closest('.subcategory');
    if (sub) {
      e.stopPropagation();
      if (sub.classList.contains('expandable')) {
        sub.classList.toggle('expanded');
        return;
      }
      setActiveCategory(sub);
      return;
    }
    const cat = e.target.closest('.category');
    if (cat) setActiveCategory(cat);
  });

  // Hover subcategory menus for expandable categories (Math, Science)
  const expandableCategories = chatView.querySelectorAll('.category.expandable');

  expandableCategories.forEach(cat => {
    const menu = cat.querySelector('.subcategory-menu');
    if (!menu) return;

    let isOverCat = false;
    let isOverMenu = false;

    function positionMenu() {
      const rect = cat.getBoundingClientRect();
      menu.style.left = `${rect.right}px`;
      menu.style.top = `${rect.top}px`;
    }

    function updateMenu() {
      if (isOverCat || isOverMenu) {
        positionMenu();
        menu.style.display = 'block';
      } else {
        menu.style.display = 'none';
      }
    }

    cat.addEventListener('mouseenter', () => {
      isOverCat = true;
      updateMenu();
    });

    cat.addEventListener('mouseleave', () => {
      isOverCat = false;
      updateMenu();
    });

    menu.addEventListener('mouseenter', () => {
      isOverMenu = true;
      updateMenu();
    });

    menu.addEventListener('mouseleave', () => {
      isOverMenu = false;
      updateMenu();
    });
  });

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    const author = getCurrentUserName();
    if (isUserProhibited(author)) {
      alert('Your account is prohibited from sending messages.');
      return;
    }
    if (!getToken()) {
      alert('Please log in to send messages.');
      return;
    }
    // Non-admins post as their account username (omit displayAs) or explicitly
    // as Anonymous; admins may type any display name. The server re-enforces
    // these rules, this just keeps the client honest.
    let displayAs;
    if (isChatAdmin()) {
      const typed = authorInput.value.trim();
      if (typed) displayAs = typed;
    } else if (authorSelect.value === 'Anonymous') {
      displayAs = 'Anonymous';
    }
    sendBtn.disabled = true;
    try {
      await saveMessage(text, selectedCategory, displayAs);
      await loadChat(selectedCategory, { silent: true });
      const lastMsg = chatBox.querySelector('.message:last-child');
      if (lastMsg) lastMsg.classList.add('new-message');
      updateMentionDots();
      chatInput.value = '';
      chatInput.focus();
    } catch (err) {
      alert(err.message);
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  authorInput.addEventListener('input', updateMentionDots);

  // Custom subjects (admin approved)
  function getCustomSubjects() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(CUSTOM_SUBJECTS_KEY)) || []; }
    catch { list = []; }
    const cleaned = list.filter(name =>
      !BUILTIN_CATEGORIES.some(c => c.toLowerCase() === String(name).trim().toLowerCase())
    );
    if (cleaned.length !== list.length) {
      localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  }

  function renderCustomSubjects() {
    chatView.querySelectorAll('.category.custom').forEach(el => el.remove());
    const addBtn = document.getElementById('addSubjectBtn');
    getCustomSubjects().forEach(name => {
      const div = document.createElement('div');
      div.className = 'category custom';
      div.dataset.category = name;
      div.innerHTML = `<span class="category-text">${name.replace(/</g, '&lt;')}</span>`;
      categoryList.insertBefore(div, addBtn);
    });
    attachDeleteButtons();
    attachReportButtons();
    attachMentionDots();
  }

  function attachDeleteButtons() {
    chatView.querySelectorAll('.category').forEach(cat => {
      if (cat.querySelector('.category-delete')) return;
      const btn = document.createElement('button');
      btn.className = 'category-delete';
      btn.type = 'button';
      btn.innerHTML = '×';
      btn.title = 'Request deletion';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        requestCategoryDeletion(cat.dataset.category);
      });
      cat.appendChild(btn);
    });
  }

  function getPendingDeletions() {
    try { return JSON.parse(localStorage.getItem(PENDING_DELETIONS_KEY)) || []; }
    catch { return []; }
  }

  function removePendingDeletion(name) {
    const pending = getPendingDeletions().filter(d => d.toLowerCase() !== name.toLowerCase());
    localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(pending));
  }

  function requestCategoryDeletion(name) {
    const pending = getPendingDeletions();
    if (pending.some(d => d.toLowerCase() === name.toLowerCase())) {
      alert('Deletion already requested.');
      return;
    }
    pending.push(name);
    localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(pending));
    alert(`Deletion of "${name}" requested. Waiting for admin approval.`);
  }

  function attachReportButtons() {
    chatView.querySelectorAll('.category').forEach(cat => {
      if (cat.querySelector('.category-report')) return;
      const btn = document.createElement('button');
      btn.className = 'category-report';
      btn.type = 'button';
      btn.innerHTML = '!';
      btn.title = 'Report subject';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openReportModal(cat.dataset.category);
      });
      cat.appendChild(btn);
    });
  }

  function attachMentionDots() {
    chatView.querySelectorAll('.category').forEach(cat => {
      if (cat.querySelector('.mention-dot')) return;
      const dot = document.createElement('span');
      dot.className = 'mention-dot';
      cat.insertBefore(dot, cat.firstChild.nextSibling || cat.firstChild);
    });
  }

  function getMentionsSeen() {
    try { return JSON.parse(localStorage.getItem(MENTIONS_SEEN_KEY)) || {}; }
    catch { return {}; }
  }

  function setCategorySeen(category, timestamp = Date.now()) {
    const seen = getMentionsSeen();
    seen[category] = timestamp;
    localStorage.setItem(MENTIONS_SEEN_KEY, JSON.stringify(seen));
  }

  function getCurrentUserName() {
    try {
      if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) return currentUser.username;
    } catch (e) { /* ignore */ }
    return (authorInput.value || 'Anonymous').trim();
  }

  function hasUnreadMentions(category) {
    const currentName = getCurrentUserName();
    if (!currentName || currentName === 'Anonymous') return false;
    const seen = getMentionsSeen();
    const lastSeen = seen[category] || 0;
    const messages = getMessages(category);
    return messages.some(m => {
      const mentions = m.mentions || extractMentions(m.text);
      return mentions.some(name => name.toLowerCase() === currentName.toLowerCase()) && m.timestamp > lastSeen;
    });
  }

  function updateMentionDots() {
    chatView.querySelectorAll('.category').forEach(cat => {
      const category = cat.dataset.category;
      if (hasUnreadMentions(category)) cat.classList.add('has-mention');
      else cat.classList.remove('has-mention');
    });
  }

  const reportModal = document.getElementById('reportModal');
  const reportSubjectName = document.getElementById('reportSubjectName');
  const reportReasonInput = document.getElementById('reportReasonInput');
  let reportingCategory = null;

  function openReportModal(category) {
    reportingCategory = category;
    reportSubjectName.textContent = `Reporting: ${category}`;
    reportReasonInput.value = '';
    reportModal.classList.add('active');
    reportReasonInput.focus();
  }

  function closeReportModal() {
    reportingCategory = null;
    reportModal.classList.remove('active');
  }

  function getPendingReports() {
    try { return JSON.parse(localStorage.getItem(PENDING_REPORTS_KEY)) || []; }
    catch { return []; }
  }

  function removePendingReport(id) {
    const reports = getPendingReports().filter(r => r.id !== id);
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(reports));
  }

  function submitReport() {
    if (!reportingCategory) return;
    const reason = reportReasonInput.value.trim();
    if (!reason) {
      alert('Please enter a reason for the report.');
      return;
    }
    const reports = getPendingReports();
    reports.push({
      id: Date.now().toString(),
      category: reportingCategory,
      reason,
      timestamp: Date.now()
    });
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(reports));
    alert(`Report for "${reportingCategory}" sent to admin.`);
    closeReportModal();
  }

  document.getElementById('cancelReportBtn').addEventListener('click', closeReportModal);
  document.getElementById('submitReportBtn').addEventListener('click', submitReport);
  reportReasonInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitReport();
    }
    if (e.key === 'Escape') closeReportModal();
  });
  reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) closeReportModal();
  });

  // Report user modal
  const reportUserModal = document.getElementById('reportUserModal');
  const reportUserName = document.getElementById('reportUserName');
  const reportUserReasonInput = document.getElementById('reportUserReasonInput');
  let reportingUser = null;

  function openReportUserModal(user) {
    reportingUser = user;
    reportUserName.textContent = `Reporting user: ${user}`;
    reportUserReasonInput.value = '';
    reportUserModal.classList.add('active');
    reportUserReasonInput.focus();
  }

  function closeReportUserModal() {
    reportingUser = null;
    reportUserModal.classList.remove('active');
  }

  function submitReportUser() {
    if (!reportingUser) return;
    const reason = reportUserReasonInput.value.trim();
    if (!reason) {
      alert('Please enter a reason for the report.');
      return;
    }
    const reports = getPendingReports();
    reports.push({
      id: Date.now().toString(),
      type: 'user',
      user: reportingUser,
      category: reportingUser,
      reason,
      timestamp: Date.now()
    });
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(reports));
    alert(`Report for user "${reportingUser}" sent to admin.`);
    closeReportUserModal();
  }

  document.getElementById('cancelReportUserBtn').addEventListener('click', closeReportUserModal);
  document.getElementById('submitReportUserBtn').addEventListener('click', submitReportUser);
  reportUserReasonInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitReportUser();
    }
    if (e.key === 'Escape') closeReportUserModal();
  });
  reportUserModal.addEventListener('click', (e) => {
    if (e.target === reportUserModal) closeReportUserModal();
  });

  // Add subject request (requires admin approval)
  const subjectModal = document.getElementById('subjectModal');
  const subjectRequestInput = document.getElementById('subjectRequestInput');

  function openSubjectModal() {
    subjectModal.classList.add('active');
    subjectRequestInput.value = '';
    subjectRequestInput.focus();
  }

  function closeSubjectModal() {
    subjectModal.classList.remove('active');
  }

  function getPendingSubjects() {
    try { return JSON.parse(localStorage.getItem(PENDING_SUBJECTS_KEY)) || []; }
    catch { return []; }
  }

  function removePendingSubject(name) {
    const pending = getPendingSubjects().filter(p => p.toLowerCase() !== name.toLowerCase());
    localStorage.setItem(PENDING_SUBJECTS_KEY, JSON.stringify(pending));
  }

  function savePendingSubject(name) {
    const pending = getPendingSubjects();
    const custom = getCustomSubjects();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (BUILTIN_CATEGORIES.some(c => c.toLowerCase() === trimmed.toLowerCase()) || custom.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      alert('This subject already exists.');
      return;
    }
    if (pending.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      alert('This subject has already been requested.');
      return;
    }
    pending.push(trimmed);
    localStorage.setItem(PENDING_SUBJECTS_KEY, JSON.stringify(pending));
    alert(`"${trimmed}" has been requested. It will appear after admin approval.`);
    closeSubjectModal();
  }

  document.getElementById('addSubjectBtn').addEventListener('click', openSubjectModal);
  document.getElementById('cancelSubjectBtn').addEventListener('click', closeSubjectModal);
  document.getElementById('submitSubjectBtn').addEventListener('click', () => {
    savePendingSubject(subjectRequestInput.value);
  });
  subjectRequestInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') savePendingSubject(subjectRequestInput.value);
    if (e.key === 'Escape') closeSubjectModal();
  });
  subjectModal.addEventListener('click', (e) => {
    if (e.target === subjectModal) closeSubjectModal();
  });

  // Admin review
  const adminModal = document.getElementById('adminModal');
  const pendingList = document.getElementById('chatPendingList');
  const pendingDeletionList = document.getElementById('pendingDeletionList');
  const reportList = document.getElementById('reportList');

  function openAdminModal() {
    adminModal.classList.add('active');
    renderPendingList();
    renderPendingDeletionList();
    renderReportList();
    renderProhibitedList();
  }

  function closeAdminModal() {
    adminModal.classList.remove('active');
  }

  function renderPendingList() {
    const pending = getPendingSubjects();
    if (pending.length === 0) {
      pendingList.innerHTML = '<li class="pending-empty">No pending requests.</li>';
      return;
    }
    pendingList.innerHTML = pending.map(name => `
      <li class="pending-item">
        <span class="pending-name">${name.replace(/</g, '&lt;')}</span>
        <div class="pending-actions">
          <button class="approve-btn" data-name="${name.replace(/"/g, '&quot;')}">Approve</button>
          <button class="reject-btn" data-name="${name.replace(/"/g, '&quot;')}">Reject</button>
        </div>
      </li>
    `).join('');
  }

  pendingList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const name = btn.dataset.name;
    if (btn.classList.contains('approve-btn')) {
      const custom = getCustomSubjects();
      if (!custom.some(c => c.toLowerCase() === name.toLowerCase())) custom.push(name);
      localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(custom));
      removePendingSubject(name);
      renderCustomSubjects();
      renderPendingList();
    } else if (btn.classList.contains('reject-btn')) {
      removePendingSubject(name);
      renderPendingList();
    }
  });

  function renderPendingDeletionList() {
    const pending = getPendingDeletions();
    if (pending.length === 0) {
      pendingDeletionList.innerHTML = '<li class="pending-empty">No pending deletions.</li>';
      return;
    }
    pendingDeletionList.innerHTML = pending.map(name => `
      <li class="pending-item">
        <span class="pending-name">${name.replace(/</g, '&lt;')}</span>
        <div class="pending-actions">
          <button class="approve-delete-btn" data-name="${name.replace(/"/g, '&quot;')}">Approve</button>
          <button class="reject-delete-btn" data-name="${name.replace(/"/g, '&quot;')}">Reject</button>
        </div>
      </li>
    `).join('');
  }

  pendingDeletionList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const name = btn.dataset.name;
    if (btn.classList.contains('approve-delete-btn')) {
      if (BUILTIN_CATEGORIES.some(c => c.toLowerCase() === name.toLowerCase())) {
        alert('Built-in categories cannot be deleted.');
        removePendingDeletion(name);
        renderPendingDeletionList();
        return;
      }
      const custom = getCustomSubjects().filter(c => c.toLowerCase() !== name.toLowerCase());
      localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(custom));
      removePendingDeletion(name);
      renderCustomSubjects();
      if (selectedCategory.toLowerCase() === name.toLowerCase()) {
        selectedCategory = 'General';
        chatView.querySelectorAll('.category').forEach(c => c.classList.remove('active'));
        chatView.querySelector('.category[data-category="General"]').classList.add('active');
        selectedDisplay.textContent = 'General';
        loadChat('General');
      }
      renderPendingDeletionList();
    } else if (btn.classList.contains('reject-delete-btn')) {
      removePendingDeletion(name);
      renderPendingDeletionList();
    }
  });

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  function renderReportList() {
    const reports = getPendingReports();
    if (reports.length === 0) {
      reportList.innerHTML = '<li class="pending-empty">No reports.</li>';
      return;
    }
    reportList.innerHTML = reports.map(r => {
      const targetLabel = r.type === 'user'
        ? `User: ${(r.user || r.category || '').replace(/</g, '&lt;')}`
        : `Subject: ${(r.category || '').replace(/</g, '&lt;')}`;
      return `
      <li class="pending-item">
        <div>
          <div class="pending-name">${targetLabel}</div>
          <div style="font-size:12px;color:#555;margin-top:4px;">${formatTime(r.timestamp)}</div>
          <div style="font-size:13px;margin-top:6px;line-height:1.4;">${(r.reason || '').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</div>
        </div>
        <div class="pending-actions">
          <button class="resolve-report-btn" data-id="${r.id}">Resolve</button>
        </div>
      </li>
    `}).join('');
  }

  reportList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('resolve-report-btn')) {
      removePendingReport(btn.dataset.id);
      renderReportList();
    }
  });

  const prohibitedList = document.getElementById('prohibitedList');
  const prohibitUserInput = document.getElementById('prohibitUserInput');
  const prohibitUserBtn = document.getElementById('prohibitUserBtn');

  function renderProhibitedList() {
    const users = getProhibitedUsers();
    if (users.length === 0) {
      prohibitedList.innerHTML = '<li class="pending-empty">No prohibited users.</li>';
      return;
    }
    prohibitedList.innerHTML = users.map(name => `
      <li class="pending-item">
        <span class="pending-name">${name.replace(/</g, '&lt;')}</span>
        <div class="pending-actions">
          <button class="unprohibit-btn" data-name="${name.replace(/"/g, '&quot;')}">Un-prohibit</button>
        </div>
      </li>
    `).join('');
  }

  prohibitedList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !btn.classList.contains('unprohibit-btn')) return;
    unprohibitUser(btn.dataset.name);
    renderProhibitedList();
    loadChat(selectedCategory);
  });

  prohibitUserBtn.addEventListener('click', () => {
    const name = prohibitUserInput.value.trim();
    if (!name) return;
    if (isUserProhibited(name)) {
      alert(`"${name}" is already prohibited.`);
      return;
    }
    prohibitUser(name);
    prohibitUserInput.value = '';
    renderProhibitedList();
    loadChat(selectedCategory);
  });

  prohibitUserInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') prohibitUserBtn.click();
  });

  document.getElementById('adminBtn').addEventListener('click', () => {
    if (!isChatAdmin()) return;
    openAdminModal();
  });
  document.getElementById('closeAdminBtn').addEventListener('click', closeAdminModal);
  adminModal.addEventListener('click', (e) => {
    if (e.target === adminModal) closeAdminModal();
  });

  // User popup: click a username to report or (admin) prohibit
  let userPopup = null;

  function showUserPopup(user, x, y) {
    if (userPopup) userPopup.remove();
    userPopup = document.createElement('div');
    userPopup.className = 'user-popup';

    const reportBtn = document.createElement('button');
    reportBtn.textContent = 'Report user';
    reportBtn.addEventListener('click', () => {
      openReportUserModal(user);
      userPopup.remove();
      userPopup = null;
    });
    userPopup.appendChild(reportBtn);

    if (isChatAdmin()) {
      const prohibited = isUserProhibited(user);
      const prohibitBtn = document.createElement('button');
      prohibitBtn.className = prohibited ? 'unprohibit-btn' : 'prohibit-btn';
      prohibitBtn.textContent = prohibited ? 'Un-prohibit user' : 'Prohibit user';
      prohibitBtn.addEventListener('click', () => {
        if (prohibited) unprohibitUser(user);
        else prohibitUser(user);
        userPopup.remove();
        userPopup = null;
        loadChat(selectedCategory);
        renderProhibitedList();
      });
      userPopup.appendChild(prohibitBtn);
    }

    userPopup.style.left = `${x}px`;
    userPopup.style.top = `${y}px`;
    chatView.appendChild(userPopup);
  }

  document.addEventListener('click', (e) => {
    if (userPopup && !userPopup.contains(e.target)) {
      userPopup.remove();
      userPopup = null;
    }
  });

  chatBox.addEventListener('click', (e) => {
    const authorEl = e.target.closest('.message-author');
    if (!authorEl) return;
    e.stopPropagation();
    showUserPopup(authorEl.dataset.author, e.clientX, e.clientY);
  });

  // Quote / delete feature: double-click a message
  let quotePopup = null;

  function showQuotePopup(text, x, y, messageId, author, messageUserId) {
    if (quotePopup) quotePopup.remove();
    quotePopup = document.createElement('div');
    quotePopup.className = 'quote-popup';

    const quoteBtn = document.createElement('button');
    quoteBtn.textContent = 'Quote';
    quoteBtn.addEventListener('click', () => {
      const current = chatInput.value;
      const mention = author ? `@${author}\n` : '';
      const quote = `> ${text.replace(/\n/g, '\n> ')}\n`;
      chatInput.value = current + (current ? '\n' : '') + mention + quote;
      chatInput.focus();
      quotePopup.remove();
      quotePopup = null;
    });

    const reportBtn = document.createElement('button');
    reportBtn.textContent = 'Report user';
    reportBtn.addEventListener('click', () => {
      openReportUserModal(author);
      quotePopup.remove();
      quotePopup = null;
    });

    quotePopup.appendChild(quoteBtn);
    quotePopup.appendChild(reportBtn);

    const canDelete = isChatAdmin() || (typeof currentUser !== 'undefined' && currentUser && String(currentUser.id) === String(messageUserId));
    if (canDelete && messageId) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-quote';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete this message?')) {
          quotePopup.remove();
          quotePopup = null;
          return;
        }
        try {
          await chatApi(`/chat/${messageId}`, { method: 'DELETE' });
          await loadChat(selectedCategory, { silent: true });
        } catch (err) {
          alert(err.message);
        }
        quotePopup.remove();
        quotePopup = null;
      });
      quotePopup.appendChild(deleteBtn);
    }

    quotePopup.style.left = `${x}px`;
    quotePopup.style.top = `${y}px`;
    chatView.appendChild(quotePopup);
  }

  document.addEventListener('click', (e) => {
    if (quotePopup && !quotePopup.contains(e.target)) {
      quotePopup.remove();
      quotePopup = null;
    }
  });

  chatBox.addEventListener('dblclick', (e) => {
    const msg = e.target.closest('.message');
    if (!msg) return;
    const selected = window.getSelection().toString().trim();
    const text = selected || msg.querySelector('.message-text').textContent;
    const author = msg.querySelector('.message-author')?.textContent || 'Anonymous';
    if (!text) return;
    showQuotePopup(text, e.clientX, e.clientY, msg.dataset.id, author, msg.dataset.userId);
  });

  // Show the right author control for the role: admins keep the free-text
  // input (prefilled with their username); everyone else gets a fixed choice
  // between their account username and "Anonymous".
  function syncAuthorInput() {
    const name = getCurrentUserName();
    if (isChatAdmin()) {
      authorInput.classList.remove('hidden');
      authorSelect.classList.add('hidden');
      if (name && name !== 'Anonymous' && authorInput.value !== name) {
        authorInput.value = name;
      }
    } else {
      authorInput.classList.add('hidden');
      authorSelect.classList.remove('hidden');
      if (name && name !== 'Anonymous' && authorSelect.options[0].value !== name) {
        authorSelect.options[0].value = name;
        authorSelect.options[0].textContent = name;
      }
    }
  }

  // Poll for new messages so other users' messages appear
  setInterval(() => {
    if (!chatView.classList.contains('hidden')) {
      syncAuthorInput();
      loadChat(selectedCategory, { silent: true });
    }
  }, 3000);

  // Initial render
  syncAuthorInput();
  renderCustomSubjects();
  attachDeleteButtons();
  attachReportButtons();
  attachMentionDots();
  updateMentionDots();
  updateChatAdminAccess();
  loadChat(selectedCategory);
})();
