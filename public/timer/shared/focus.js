/* shared/focus.js — Lock In Timer Focus Tools + AI Coach page */
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


const mount = $('#fcChatMount');
const subtitle = $('#themeQuote');
const taskRow = document.createElement('div');
taskRow.className = 'fc-task-row';
if (mount) mount.appendChild(taskRow);
else if (subtitle) subtitle.after(taskRow);

const fcSettings = loadJSON('fcChatSettings', {
  apiKey: '',
  model: 'auto',
  voiceLang: 'en-US'
});

function saveSettings() {
  saveJSON('fcChatSettings', fcSettings);
}

const questionEl = document.createElement('div');
questionEl.className = 'fc-question';
taskRow.appendChild(questionEl);

const settingsRow = document.createElement('div');
settingsRow.className = 'fc-settings-row';
settingsRow.innerHTML = '<button class="fc-settings-toggle" type="button" title="Chat settings">⚙️ Settings</button>';
taskRow.appendChild(settingsRow);

const settingsPanel = document.createElement('div');
settingsPanel.className = 'fc-settings-panel';
settingsPanel.innerHTML = '<div class="fc-settings-group">' +
  '<label for="fcApiKey">API Key</label>' +
  '<div class="fc-key-wrap">' +
    '<input type="password" id="fcApiKey" placeholder="OpenRouter or OpenAI API key" autocomplete="off" spellcheck="false">' +
    '<button class="fc-key-toggle" type="button">Show</button>' +
  '</div>' +
  '<div class="fc-key-warning">Stored locally in this browser. Never share your key.</div>' +
'</div>' +
'<div class="fc-settings-group">' +
  '<label for="fcModelSelect">Model / Source</label>' +
  '<select id="fcModelSelect" class="fc-model-select">' +
    '<option value="auto">Auto — best available source</option>' +
    '<option value="openrouter:google/gemini-2.5-flash-preview">OpenRouter — Gemini 2.5 Flash</option>' +
    '<option value="openrouter:openai/gpt-4o-mini">OpenRouter — GPT-4o Mini</option>' +
    '<option value="openrouter:anthropic/claude-3.5-haiku">OpenRouter — Claude 3.5 Haiku</option>' +
    '<option value="openrouter:meta-llama/llama-3.1-8b-instruct">OpenRouter — Llama 3.1 8B</option>' +
    '<option value="openai:gpt-4o-mini">OpenAI — GPT-4o Mini</option>' +
    '<option value="openai:gpt-4o">OpenAI — GPT-4o</option>' +
    '<option value="nano">Chrome — Gemini Nano</option>' +
    '<option value="pollinations">Pollinations.ai</option>' +
    '<option value="wikipedia">Wikipedia</option>' +
  '</select>' +
'</div>';
taskRow.appendChild(settingsPanel);

const errorBanner = document.createElement('div');
errorBanner.className = 'fc-error-banner';
taskRow.appendChild(errorBanner);

const chatHistory = document.createElement('div');
chatHistory.className = 'fc-chat-history';
taskRow.appendChild(chatHistory);

const chatToolbar = document.createElement('div');
chatToolbar.className = 'fc-chat-toolbar';
chatToolbar.innerHTML = '<button class="fc-stop-btn" type="button" title="Stop generating">⏹ Stop</button>' +
  '<button class="fc-export-json" type="button" title="Export chat as JSON">📥 JSON</button>' +
  '<button class="fc-export-txt" type="button" title="Export chat as text">📄 Text</button>' +
  '<button class="fc-clear-history" type="button" title="Clear chat history">🗑 Clear</button>';
taskRow.appendChild(chatToolbar);

const followUps = document.createElement('div');
followUps.className = 'fc-followups';
taskRow.appendChild(followUps);

const inputWrap = document.createElement('div');
inputWrap.className = 'fc-input-wrap';
const taskInput = document.createElement('input');
taskInput.type = 'text';
taskInput.id = 'fcTaskInput';
taskInput.placeholder = '';
taskInput.maxLength = 300;
taskInput.autocomplete = 'off';
taskInput.value = loadJSON('fcTaskName', '');
inputWrap.appendChild(taskInput);

const voiceBtn = document.createElement('button');
voiceBtn.className = 'fc-voice-btn';
voiceBtn.type = 'button';
voiceBtn.title = 'Speak your question';
voiceBtn.textContent = '🎙';
inputWrap.appendChild(voiceBtn);
taskRow.appendChild(inputWrap);

const apiKeyInput = $('#fcApiKey');
const modelSelect = $('#fcModelSelect');
const keyToggleBtn = settingsPanel.querySelector('.fc-key-toggle');
const settingsToggleBtn = settingsRow.querySelector('.fc-settings-toggle');
const stopBtn = chatToolbar.querySelector('.fc-stop-btn');
const exportJsonBtn = chatToolbar.querySelector('.fc-export-json');
const exportTxtBtn = chatToolbar.querySelector('.fc-export-txt');
const clearHistoryBtn = chatToolbar.querySelector('.fc-clear-history');

apiKeyInput.value = fcSettings.apiKey || '';
modelSelect.value = fcSettings.model || 'auto';

settingsToggleBtn.addEventListener('click', function () {
  settingsPanel.classList.toggle('open');
  settingsToggleBtn.textContent = settingsPanel.classList.contains('open') ? '⚙️ Hide' : '⚙️ Settings';
});

apiKeyInput.addEventListener('input', function () {
  fcSettings.apiKey = apiKeyInput.value.trim();
  saveSettings();
});

modelSelect.addEventListener('change', function () {
  fcSettings.model = modelSelect.value;
  saveSettings();
});

keyToggleBtn.addEventListener('click', function () {
  const isHidden = apiKeyInput.type === 'password';
  apiKeyInput.type = isHidden ? 'text' : 'password';
  keyToggleBtn.textContent = isHidden ? 'Hide' : 'Show';
});

let abortCtrl = null;
let isGenerating = false;
function setGenerating(gen) {
  isGenerating = gen;
  stopBtn.disabled = !gen;
}
setGenerating(false);

function stopGeneration() {
  if (abortCtrl) {
    abortCtrl.abort();
    abortCtrl = null;
  }
  hideTyping();
  finishStreaming();
  setGenerating(false);
}
stopBtn.addEventListener('click', stopGeneration);

function downloadFile(content, mimeType, fileName) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function exportChatJSON() {
  const data = {
    exportedAt: new Date().toISOString(),
    messages: getMemory()
  };
  downloadFile(JSON.stringify(data, null, 2), 'application/json', 'coastal-countdown-chat.json');
}

function exportChatTXT() {
  const m = getMemory();
  const lines = ['Coastal Countdown Chat Export', '=============================', ''];
  for (let i = 0; i < m.length; i++) {
    const item = m[i];
    const label = item.role === 'user' ? 'You' : 'AI';
    const time = item.ts ? new Date(item.ts).toLocaleString() : '';
    if (time) lines.push('[' + time + '] ' + label + ':');
    else lines.push(label + ':');
    lines.push(item.content || '');
    lines.push('');
  }
  downloadFile(lines.join('\n'), 'text/plain', 'coastal-countdown-chat.txt');
}

function clearChatHistory() {
  if (!confirm('Clear the entire chat history? This cannot be undone.')) return;
  clearMemory();
  while (chatHistory.firstChild) chatHistory.removeChild(chatHistory.firstChild);
  clearFollowUps();
  hideError();
}

exportJsonBtn.addEventListener('click', exportChatJSON);
exportTxtBtn.addEventListener('click', exportChatTXT);
clearHistoryBtn.addEventListener('click', clearChatHistory);

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
if (SpeechRecognitionCtor) {
  recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = fcSettings.voiceLang || 'en-US';
  recognition.onstart = function () {
    isListening = true;
    voiceBtn.classList.add('listening');
    voiceBtn.title = 'Listening... click to stop';
  };
  recognition.onend = function () {
    isListening = false;
    voiceBtn.classList.remove('listening');
    voiceBtn.title = 'Speak your question';
  };
  recognition.onerror = function () {
    isListening = false;
    voiceBtn.classList.remove('listening');
  };
  let finalTranscript = '';
  recognition.onresult = function (e) {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    taskInput.value = (finalTranscript + interim).trim();
  };
  voiceBtn.addEventListener('click', function () {
    if (isListening) {
      recognition.stop();
    } else {
      finalTranscript = '';
      try { recognition.start(); } catch (e) {}
    }
  });
} else {
  voiceBtn.style.display = 'none';
}

const focusQuestions = [
  "Ask me anything...",
  "Try: What is the Pomodoro technique?",
  "Try: Give me a focus tip",
  "Try: How can I stop procrastinating?",
  "Try: What should I do in a 5-minute break?",
  "Try: Help me plan my study session"
];
let questionIndex = Math.floor(Math.random() * focusQuestions.length);
function showQuestion() {
  if (!questionEl) return;
  questionEl.style.opacity = '0';
  setTimeout(function () {
    questionEl.textContent = focusQuestions[questionIndex];
    questionEl.style.opacity = '1';
    questionIndex = (questionIndex + 1) % focusQuestions.length;
  }, 250);
}
showQuestion();
setInterval(showQuestion, 30000);

const MEMORY_KEY = 'fcChatMemory';
const MAX_MEMORY = 10;

function getMemory() { return loadJSON(MEMORY_KEY, []); }
function addMemory(role, content) {
  const m = getMemory();
  m.push({ role: role, content: content, ts: Date.now() });
  while (m.length > MAX_MEMORY) m.shift();
  saveJSON(MEMORY_KEY, m);
}
function clearMemory() { saveJSON(MEMORY_KEY, []); }

function buildMemoryMessages(limit) {
  const m = getMemory();
  if (!m.length) return [];
  const start = Math.max(0, m.length - limit);
  const msgs = [];
  for (let i = start; i < m.length; i++) {
    const item = m[i];
    const role = item.role === 'user' ? 'user' : 'assistant';
    msgs.push({ role: role, content: String(item.content || '') });
  }
  return msgs;
}

function buildMemoryText(limit) {
  const m = getMemory();
  if (!m.length) return '';
  const start = Math.max(0, m.length - limit);
  const parts = [];
  for (let i = start; i < m.length - 1; i++) {
    const item = m[i];
    const label = item.role === 'user' ? 'User' : 'Coach';
    parts.push(label + ': ' + item.content);
  }
  return parts.join('\n');
}

function detectMode(q) {
  const lower = q.toLowerCase();
  if (/(short|brief|quick|one sentence|tl;dr|concise)/.test(lower)) return 'short';
  if (/(explain|detailed|detail|in depth|elaborate|long|thorough)/.test(lower)) return 'long';
  if (q.length <= 55) return 'short';
  return 'long';
}

function truncateContext(str, maxLen) {
  str = str.replace(/\s+/g, ' ').trim();
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

function buildLocalContext() {
  const parts = [];
  const dailyGoal = $('#fcDailyGoal');
  if (dailyGoal && dailyGoal.value.trim()) {
    parts.push('Daily goal: ' + dailyGoal.value.trim());
  }
  const taskList = $('#fcTaskList');
  if (taskList) {
    const lis = taskList.querySelectorAll('.fc-task-item');
    const tasks = [];
    for (let i = 0; i < lis.length && tasks.length < 5; i++) {
      const span = lis[i].querySelector('span');
      const raw = span ? span.textContent : lis[i].textContent;
      const clean = raw.replace(/\s+/g, ' ').trim();
      if (clean) tasks.push(clean);
    }
    if (tasks.length) parts.push('Task list: ' + tasks.join('; '));
  }
  const notes = $('#fcFocusNotes');
  if (notes && notes.value.trim()) {
    parts.push('Focus notes: ' + truncateContext(notes.value.trim(), 300));
  }
  if (!parts.length) return '';
  return 'User context: ' + parts.join(' | ') + '.';
}

function buildSystemPrompt(mode) {
  const context = buildLocalContext();
  let prompt = 'You are a world-class productivity coach embedded in Coastal Countdown, a calming Pomodoro-style focus timer. You give practical, evidence-based advice on focus, time management, procrastination, energy, habits, and deep work. Be encouraging, concise, and action-oriented. ';
  if (context) {
    prompt += "Use the following user context when relevant, but do not let it override the user's explicit question: " + context + ' ';
  }
  if (mode === 'short') return prompt + 'Answer the user in 1-2 short sentences.';
  return prompt + 'Give a clear, helpful answer. If relevant, include 2-3 practical steps or bullet points.';
}

function buildTextPrompt(question, mode) {
  const parts = [buildSystemPrompt(mode)];
  const memory = buildMemoryText(3);
  if (memory) parts.push('Recent conversation:\n' + memory);
  parts.push('User: ' + question);
  parts.push('Coach:');
  return parts.join('\n\n');
}

function inferCategory(q) {
  q = q.toLowerCase();
  if (/pomodoro|tomato|25.*5|work.*break/.test(q)) return 'pomodoro';
  if (/procrastinat|resist|avoid|can't start|hard to begin|put off/.test(q)) return 'procrastination';
  if (/distract|phone|notification|social media|block|noisy|interrupt/.test(q)) return 'distraction';
  if (/break|rest|recharge|stretch|pause/.test(q)) return 'break';
  if (/plan|priorit|schedule|todo|task list|organize|eisenhower|matrix/.test(q)) return 'planning';
  if (/deep work|flow state|get in the zone|concentrat/.test(q)) return 'deep_work';
  if (/habit|routine|morning|evening|stack|consistency/.test(q)) return 'habits';
  if (/tired|energy|sleep|food|eat|exercise|nap|burnout/.test(q)) return 'energy';
  if (/anxious|overwhelm|stress|perfection|fear|worried/.test(q)) return 'anxiety';
  if (/motivat|discipline|willpower|quote|inspir/.test(q)) return 'motivation';
  if (/app|tool|software|website|extension|timer|shortcut|zen/.test(q)) return 'tools';
  if (/focus|concentrate|attention/.test(q)) return 'focus';
  if (/exam|test|study|revision|memorize|flashcard/.test(q)) return 'study';
  if (/write|essay|paper|draft|thesis|blog|article/.test(q)) return 'writing';
  if (/code|program|debug|developer|git|algorithm/.test(q)) return 'coding';
  if (/creat|idea|brainstorm|design|draw|music/.test(q)) return 'creativity';
  if (/read|book|literature|comprehension/.test(q)) return 'reading';
  if (/meet|email|slack|communication|colleague/.test(q)) return 'communication';
  return 'default';
}

const followUpsByCategory = {
  greeting: ['How can I focus today?', 'What is the Pomodoro technique?', 'Give me a productivity tip'],
  pomodoro: ['Why does Pomodoro work?', 'How long should breaks be?', 'Can I customize the timer?'],
  focus: ['How do I stop distractions?', 'What is deep work?', 'Give me a 2-minute focus exercise'],
  procrastination: ['What is the 2-minute rule?', 'How do I start a big task?', 'What if I feel resistance?'],
  distraction: ['How do I block phone distractions?', 'Is music good for focus?', 'Best study environment?'],
  break: ['What should I do in a 5-minute break?', 'How do I recharge quickly?', 'Break stretches for focus'],
  planning: ['How do I prioritize tasks?', 'What is time blocking?', 'Break a project into steps'],
  deep_work: ['How do I get into flow?', 'How long should deep work be?', 'Handle interruptions in flow'],
  motivation: ["I'm feeling unmotivated", 'Give me a motivational quote', 'How do I build discipline?'],
  habits: ['How long to build a habit?', 'What is habit stacking?', 'Evening routine for focus?'],
  energy: ['How to focus when tired?', 'Foods that improve focus', 'Power nap tips'],
  anxiety: ['I feel overwhelmed', 'How to beat perfectionism?', 'Mindfulness for focus?'],
  tools: ['Best apps for focus?', 'How to use the Pomodoro timer?', 'Keyboard shortcuts?'],
  study: ['Best study techniques?', 'How to memorize faster?', 'Exam day tips'],
  writing: ["How to beat writer's block?", 'How to outline an essay?', 'Editing tips'],
  coding: ['How to focus while coding?', 'Best Pomodoro for debugging?', 'Avoid coding burnout'],
  creativity: ['How to brainstorm better?', 'Creative block tips', 'Inspiration exercises'],
  reading: ['How to read faster?', 'How to take notes while reading?', 'Retain what you read'],
  communication: ['How to write clearer emails?', 'Meeting focus tips', 'Async communication'],
  default: ['Give me a focus tip', 'Help me plan my session', 'What is Pomodoro?']
};

function clearFollowUps() {
  while (followUps.firstChild) followUps.removeChild(followUps.firstChild);
}

function showFollowUps(category) {
  clearFollowUps();
  const list = followUpsByCategory[category] || followUpsByCategory.default;
  const used = {};
  let count = 0;
  for (let i = 0; i < list.length && count < 3; i++) {
    const text = list[i];
    if (used[text]) continue;
    used[text] = true;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'fc-followup-chip';
    chip.textContent = text;
    chip.addEventListener('click', function () {
      taskInput.value = text;
      handleQuestion();
    });
    followUps.appendChild(chip);
    count++;
  }
}

const presetAnswers = [
  { keys: ['hello','hi','hey','greetings'], short:'Hey! Ready to focus?', long:'Hello! I’m your productivity coach inside Coastal Countdown. Ask me anything about focus, Pomodoro, procrastination, planning, habits, or energy.', category:'greeting' },
  { keys: ['who are you','what are you','what can you do','what is this'], short:'I’m your built-in productivity coach.', long:'I’m the AI productivity coach built into Coastal Countdown, a Pomodoro-style focus timer. I can answer questions about focus, time management, procrastination, break ideas, habit building, energy, and more. I also remember our last few messages and can read your daily goal, tasks, and focus notes if you enter them.', category:'greeting' },
  { keys: ['help'], short:'Type a question and press Enter, or tap the mic to speak.', long:'Type any productivity question and press Enter, or click the microphone to speak. I’ll use my built-in answer library, an AI service, Chrome’s built-in AI if available, or Wikipedia for factual questions. I remember the last few messages for context and can read your Focus Tools data to give personalized advice.', category:'greeting' },
  { keys: ['what is pomodoro','pomodoro technique','explain pomodoro','how does pomodoro work'], short:'Pomodoro is 25 minutes of focused work followed by a 5-minute break.', long:'The Pomodoro Technique is a time-management method: work in focused sprints (classically 25 minutes), then take a short break (5 minutes). After four cycles, take a longer break (15–30 minutes). It beats procrastination by making work feel manageable and giving your brain regular recovery.', category:'pomodoro' },
  { keys: ['how do i use this','how to use timer','use coastal countdown'], short:'Set a time, press Start, and focus until the timer ends.', long:'Set your focus length with the inputs or turn on Pomodoro mode, press Start, and work until the timer finishes. Use the theme picker, music toggle, and Zen mode to shape your environment. Add tasks and notes in Focus Tools for personalized coaching.', category:'tools' },
  { keys: ['focus tip','how to focus','improve focus','concentrate better','stay focused'], short:'Remove one distraction before you start.', long:'Great focus starts with environment design: clear your desk, silence notifications, put your phone out of reach, and define the single next step you’ll work on. A specific goal + fewer distractions = much better focus.', category:'focus' },
  { keys: ['stop procrastinating','procrastination','avoid procrastinating','putting off','keep delaying'], short:'Make the first step so small it’s impossible to resist.', long:'Procrastination is usually emotional, not lazy. Shrink the task to a 2-minute first action, work for just 5 minutes, and lower the stakes. Starting creates momentum; the timer helps by making the commitment feel temporary.', category:'procrastination' },
  { keys: ['2 minute rule','two minute rule'], short:'If a task takes under two minutes, do it now.', long:'The Two-Minute Rule says: if something takes less than two minutes, do it immediately. For bigger tasks, do any 2-minute piece right now to overcome resistance. It’s a powerful way to start.', category:'procrastination' },
  { keys: ['5 minute rule','five minute rule'], short:'Commit to just 5 minutes; momentum usually keeps you going.', long:'The Five-Minute Rule: tell yourself you only need to work for five minutes. Once started, most people keep going because resistance fades. It’s especially useful for tasks that feel boring, hard, or scary.', category:'procrastination' },
  { keys: ['what should i do in a 5 minute break','break ideas','short break','5 minute break'], short:'Move, hydrate, look outside, or take slow breaths.', long:'For a 5-minute break, stand up, drink water, do a few stretches, look at something distant to rest your eyes, or take 5 slow breaths. Avoid scrolling social media—it pulls attention away instead of restoring it.', category:'break' },
  { keys: ['help me plan my study session','plan my day','plan my session','study plan'], short:'List 3 priorities and time-block the first one.', long:'Start by listing your top 3 priorities. Block time for the hardest one first, break it into 25–50 minute focus sprints, and schedule short breaks. Protect that first block like a meeting with yourself.', category:'planning' },
  { keys: ['prioritize tasks','what to do first','urgent important','eisenhower'], short:'Do urgent+important first, schedule important-not-urgent, delegate or drop the rest.', long:'Use the Eisenhower Matrix: sort tasks by urgent/important. Do urgent+important first, schedule important-but-not-urgent, delegate urgent-but-unimportant if possible, and eliminate what’s neither. This keeps busywork from eating your day.', category:'planning' },
  { keys: ['deep work','flow state','get in the zone'], short:'Block uninterrupted time, remove distractions, and define a clear goal.', long:'Deep work is distraction-free, high-value work. Schedule a 60–90 minute block, turn off notifications, close unrelated tabs, and write down exactly what “done” looks like. The first 10 minutes are usually the hardest—stay with it.', category:'deep_work' },
  { keys: ['distractions','phone distraction','social media','notifications','block websites'], short:'Put your phone in another room and use airplane mode.', long:'Top tactics: keep your phone out of sight, turn off notifications, use browser blockers during focus blocks, and write distracting thoughts on a “later list” so your brain can let go of them.', category:'distraction' },
  { keys: ['motivate me','i need motivation','feeling unmotivated','no motivation'], short:'Motivation often follows action, not the other way around.', long:'Commit to just 2 minutes of work. Action usually creates motivation faster than waiting to feel motivated. Also revisit your “why”: what will finishing this task make possible?', category:'motivation' },
  { keys: ['quote','inspirational quote','motivational quote'], short:'"Small steps every day."', long:'“Small steps every day.” Tiny consistent actions compound into big results. Start the timer and take one small step now.', category:'motivation' },
  { keys: ['habit','build habit','how long habit','habit stacking'], short:'Start with a 2-minute version and anchor it to an existing routine.', long:'Habits stick when they’re tiny and anchored. Use habit stacking: “After I [current habit], I will [new tiny behavior].” Repeat daily; consistency matters more than intensity.', category:'habits' },
  { keys: ['morning routine','evening routine','daily routine'], short:'Design routines that protect sleep and your most important work.', long:'A strong morning routine sets the tone; a strong evening routine protects sleep. Keep them simple: light movement, hydration, and a clear first task in the morning; a shutdown ritual and screen wind-down at night.', category:'habits' },
  { keys: ['focus when tired','low energy','how to focus when tired','fatigue'], short:'Do a 5-minute movement or nap, then work on low-cognitive tasks.', long:'When tired, first try a brisk 5-minute walk, a glass of water, or a 10–20 minute power nap. Then pick the easiest important task and work in short sprints. Save deep thinking for when your energy rebounds.', category:'energy' },
  { keys: ['food for focus','eat for focus','best food for focus'], short:'Protein, complex carbs, hydration, and omega-3s support focus.', long:'Stable blood sugar helps focus: prioritize protein, whole grains, leafy greens, berries, nuts, and plenty of water. Avoid heavy meals and sugar spikes right before deep work.', category:'energy' },
  { keys: ['sleep and focus','sleep productivity'], short:'Sleep is the foundation of focus—protect 7–9 hours.', long:'Sleep is the single biggest performance enhancer. Poor sleep hurts attention, memory, and willpower. Keep a consistent bedtime, dim lights an hour before bed, and avoid caffeine late in the day.', category:'energy' },
  { keys: ['exercise focus','workout productivity'], short:'Even 10 minutes of movement improves focus for hours.', long:'Movement boosts blood flow and neurotransmitters that aid focus. A short walk, stretch routine, or quick workout before a focus block can make a noticeable difference.', category:'energy' },
  { keys: ['power nap','napping'], short:'A 10–20 minute nap restores alertness without grogginess.', long:'A 10–20 minute power nap can restore alertness and memory. Set a timer, nap in a dim quiet place, and avoid napping late in the day so it doesn’t disrupt nighttime sleep.', category:'energy' },
  { keys: ['anxiety','overwhelmed','stressed','too much'], short:'Pick one tiny next step and set the timer for 5 minutes.', long:'Feeling overwhelmed is a sign your brain needs a smaller target. Write down everything, then choose one tiny next action and work for just 5 minutes. Progress calms anxiety.', category:'anxiety' },
  { keys: ['perfectionism','fear of failure','not good enough'], short:'Done is better than perfect. Start with a rough draft.', long:'Perfectionism often disguises fear. Lower the bar to “good enough for now,” use the timer to create a deadline, and remind yourself that you can improve once something exists.', category:'anxiety' },
  { keys: ['mindfulness','meditate','calm down'], short:'Take 5 slow breaths, feeling the inhale and exhale.', long:'A brief mindfulness pause—five slow breaths, a body scan, or a minute of quiet—can reset your nervous system and sharpen attention before a focus block.', category:'anxiety' },
  { keys: ['time blocking','calendar blocking','schedule my day'], short:'Assign every important task a specific time slot.', long:'Time blocking means putting tasks on your calendar as if they were meetings. It protects focus time and makes your day concrete, reducing decision fatigue and reactive busywork.', category:'planning' },
  { keys: ['study music','lofi','ambient music','music for focus'], short:'Instrumental, low-lyric music or ambient sound often helps.', long:'Many people focus better with instrumental music like lo-fi, classical, or ambient nature sounds. Lyrics can compete for verbal attention, so save vocal music for low-focus tasks. Try the built-in music toggle.', category:'distraction' },
  { keys: ['zen mode','fullscreen','keyboard shortcut','shortcuts'], short:'Zen mode hides clutter; fullscreen expands the timer.', long:'Zen mode minimizes distractions by hiding extra UI. Fullscreen gives the timer the whole screen. Click the 🧘 Zen and ⛶ Fullscreen buttons to try them.', category:'tools' },
  { keys: ['thank you','thanks','thx','ty'], short:'You’re welcome! Now lock in that focus.', long:'You’re welcome! I’m here whenever you need a nudge. Set the timer and make the next minute count.', category:'greeting' },
  { keys: ['goodbye','bye','see you'], short:'Goodbye—go make something great.', long:'Goodbye! Remember: small steps every day. Come back when you need a focus boost.', category:'greeting' },
  { keys: ['capture ideas','brain dump','later list'], short:'Write ideas down so your brain can let go.', long:'When a distracting idea appears, write it on a “later list.” Capturing it frees working memory and reduces anxiety.', category:'planning' },
  { keys: ['review my day','daily review','shutdown ritual'], short:'Write 3 wins and 1 priority for tomorrow.', long:'A shutdown ritual closes your workday: review what you completed, capture unfinished tasks, and pick your top priority for tomorrow. It helps your brain relax and start fresh the next day.', category:'planning' },
  { keys: ['decision fatigue','too many decisions','simplify'], short:'Automate or batch small decisions.', long:'Decision fatigue drains willpower. Reduce it by automating routines (same breakfast, preset outfits), batching similar tasks, and deciding your top 3 priorities the night before.', category:'planning' },
  { keys: ['single task','multitask','one thing'], short:'Single-tasking beats multitasking for quality work.', long:'Multitasking is actually rapid task-switching, which lowers quality and increases errors. Pick one task, set the timer, and give it your full attention. You’ll finish faster and better.', category:'focus' },
  { keys: [' Parkinson','work expands','time available'], short:'Set artificial deadlines to finish faster.', long:'Parkinson’s Law says work expands to fill the time available. Set a timer for less time than you think you need. The constraint forces focus and creativity.', category:'planning' },
  { keys: ['email productivity','inbox zero','check email'], short:'Check email at set times, not continuously.', long:'Batch email processing into 2-3 scheduled windows per day. Turn off notifications, and use the 2-minute rule for quick replies. This protects deep work from constant interruptions.', category:'communication' },
  { keys: ['meeting focus','long meeting','meeting tips'], short:'Set an agenda and a hard stop.', long:'For focused meetings, share an agenda beforehand, start on time, assign a note-taker, and set a hard stop. If you’re not needed, decline or leave early with permission.', category:'communication' },
  { keys: ['writer block','writer\'s block','stuck writing'], short:'Write a bad first draft to get started.', long:'Writer’s block often comes from perfectionism. Lower the bar: write a messy first sentence, outline bullet points, or set a 10-minute timer. You can edit later.', category:'writing' },
  { keys: ['essay structure','how to outline','outline essay'], short:'Thesis → reasons → evidence → conclusion.', long:'A strong essay outline: start with a clear thesis, list 2-4 supporting reasons, add evidence for each, and finish with a conclusion. Use Pomodoro sprints for drafting and separate sprints for editing.', category:'writing' },
  { keys: ['coding focus','programming focus','code productivity'], short:'Work on one function or bug at a time.', long:'Coding benefits from deep focus. Before you start, write down the exact bug, feature, or function. Close unrelated tabs, silence notifications, and use the timer to commit to a short, focused sprint.', category:'coding' },
  { keys: ['debug','debugging tip','find bug'], short:'Reproduce it, isolate it, then fix it.', long:'Effective debugging: reproduce the bug consistently, isolate the smallest code path that causes it, then change one thing at a time. Use the timer to stay focused instead of guessing randomly.', category:'coding' },
  { keys: ['learn faster','study technique','active recall'], short:'Test yourself instead of re-reading.', long:'Active recall is one of the most effective study techniques: close the book and explain the concept in your own words, or use flashcards. It strengthens memory far more than passively re-reading.', category:'study' },
  { keys: ['spaced repetition','remember long term','anki'], short:'Review at increasing intervals.', long:'Spaced repetition means reviewing material at growing intervals (1 day, 3 days, 1 week, etc.). It combats forgetting and builds long-term memory efficiently.', category:'study' },
  { keys: ['exam prep','exam study','test anxiety'], short:'Sleep, active recall, and timed practice.', long:'For exams: prioritize sleep, use active recall and practice questions, and simulate test conditions with timed Pomodoros. Anxiety drops when preparation feels concrete.', category:'study' },
  { keys: ['read faster','speed read','reading comprehension'], short:'Preview, question, then read actively.', long:'Read faster by first previewing headings and summaries, asking what you want to learn, and reading with a purpose. Take short notes to stay engaged and improve retention.', category:'reading' },
  { keys: ['take notes','note taking','best notes'], short:'Notes are for thinking, not transcribing.', long:'Good note-taking captures ideas in your own words, uses bullet points and connections, and includes questions. Review notes within a day to move them into long-term memory.', category:'study' },
  { keys: ['creative block','brainstorm','generate ideas'], short:'Set a timer and generate bad ideas first.', long:'Creativity loosens up when you remove pressure. Set a 5-minute timer and write as many ideas as possible, including terrible ones. Quantity unlocks quality.', category:'creativity' },
  { keys: ['environment','study space','focus environment'], short:'Clean, quiet, well-lit, phone-free.', long:'Your environment shapes your attention. Aim for a clean desk, good lighting, comfortable temperature, and your phone out of reach. Even small friction reductions help a lot.', category:'distraction' },
  { keys: ['hydration','water focus','drink water'], short:'Dehydration quietly hurts focus.', long:'Even mild dehydration can reduce concentration and energy. Keep water nearby and sip regularly during focus blocks.', category:'energy' },
  { keys: ['caffeine','coffee focus','too much coffee'], short:'Use caffeine early and in moderation.', long:'Caffeine can boost alertness, but too much causes jitters and crashes. Try small, spaced doses in the morning, avoid late-day caffeine, and pair it with water.', category:'energy' },
  { keys: ['blue light','screen tired','eye strain'], short:'Follow the 20-20-20 rule.', long:'Every 20 minutes, look at something 20 feet away for 20 seconds. This reduces eye strain and gives your brain a micro-break from the screen.', category:'energy' },
  { keys: ['sitting','stand up','desk posture'], short:'Stand or stretch every 25-30 minutes.', long:'Sitting too long reduces energy and focus. Alternate between sitting and standing, stretch your hips and shoulders, and take short walking breaks between Pomodoros.', category:'energy' },
  { keys: ['burnout','exhausted','chronic tired'], short:'Rest is part of productivity, not the enemy.', long:'Burnout means you’ve been running on empty. Recover by cutting back obligations, sleeping more, spending time in nature, and doing things that refill you. Sustainable productivity includes rest.', category:'energy' },
  { keys: ['imposter syndrome','not qualified','fake'], short:'Focus on evidence, not feelings.', long:'Imposter syndrome is the gap between your skills and your self-image. List your actual accomplishments, ask for feedback, and remember that growth comes from doing hard things.', category:'anxiety' },
  { keys: ['comparison','compare myself','everyone better'], short:'Compare yourself only to your past self.', long:'Comparing yourself to others is usually unfair because you see their highlight reel. Track your own progress, celebrate small wins, and run your own race.', category:'motivation' },
  { keys: ['goal setting','set goals','smart goals'], short:'Make goals specific, measurable, and time-bound.', long:'SMART goals are Specific, Measurable, Achievable, Relevant, and Time-bound. “Write for 25 minutes” is better than “write more.” Clear goals reduce ambiguity and procrastination.', category:'planning' },
  { keys: ['weekly review','week plan','sunday plan'], short:'Review wins, lessons, and top 3 priorities.', long:'A weekly review: list your wins, note what didn’t work, clear stale tasks, and choose your top 3 priorities for next week. It creates alignment and prevents drift.', category:'planning' },
  { keys: ['say no','boundaries','too many commitments'], short:'Saying no protects your yes.', long:'Every yes is a no to something else. Protect your focus by declining requests that don’t align with your priorities. Be polite but firm.', category:'planning' },
  { keys: ['collaboration','team focus','group work'], short:'Clarify roles and async communication.', long:'For team productivity, clarify who does what, use async updates to reduce meetings, and protect focused work blocks. Communicate deadlines clearly.', category:'communication' },
  { keys: ['deadline','under pressure','last minute'], short:'Break it into tiny steps and start immediately.', long:'Under pressure, your brain wants to avoid the task. Break the deadline into the smallest next action, set a short timer, and start. Momentum reduces panic.', category:'procrastination' },
  { keys: ['boring task','tedious','repetitive work'], short:'Pair it with a timer and a reward.', long:'Boring tasks feel easier with structure. Use a Pomodoro, play instrumental music, and promise yourself a small reward after. The timer creates a finish line.', category:'motivation' },
  { keys: ['hard task','difficult','complex'], short:'Spend 2 minutes outlining the first step.', long:'Hard tasks feel overwhelming because they’re vague. Spend 2 minutes writing down the exact first step and any resources you need. Clarity makes action easier.', category:'procrastination' },
  { keys: ['start','get started','begin'], short:'The first 2 minutes matter most.', long:'Starting is the hardest part. Make the entry point tiny, set a timer for 2 minutes, and tell yourself you can stop after. Most of the time, you’ll keep going.', category:'procrastination' },
  { keys: ['finish','complete','close task'], short:'Define done before you start.', long:'To finish tasks, define what “done” looks like before you begin. A clear finish line prevents endless tweaking and gives you a dopamine hit when you cross it.', category:'planning' },
  { keys: ['reward','treat','celebrate'], short:'Celebrate small wins to build momentum.', long:'Rewards reinforce habits. After a focused block, take a real break, move your body, or enjoy a small treat. Celebrating progress makes the habit stick.', category:'habits' },
  { keys: ['accountability','study buddy','work partner'], short:'Tell someone your goal and deadline.', long:'Accountability works because we care about commitments to others. Share your goal and deadline with a friend, colleague, or online group. A simple check-in boosts follow-through.', category:'motivation' },
  { keys: ['tracking','habit tracker','streak'], short:'Track consistency, not perfection.', long:'Habit trackers work because visible progress motivates you. Aim for “never miss twice” rather than perfect streaks. One missed day is a blip; two is a pattern.', category:'habits' },
  { keys: ['visualization','mental rehearsal','imagine success'], short:'Picture yourself completing the task.', long:'Mental rehearsal helps: close your eyes and imagine yourself working smoothly and finishing. It reduces anxiety and primes your brain for action.', category:'motivation' },
  { keys: ['breathing','box breathing','calm'], short:'Inhale 4, hold 4, exhale 4, hold 4.', long:'Box breathing: inhale for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat 4-5 cycles. It activates the parasympathetic nervous system and sharpens focus.', category:'anxiety' },
  { keys: ['nature','outside','walk'], short:'A 10-minute nature walk restores attention.', long:'Spending time in nature, even a short walk, restores directed attention and reduces mental fatigue. It’s one of the best breaks between focus blocks.', category:'energy' },
  { keys: ['noise','too loud','quiet'], short:'Use noise-canceling headphones or brown noise.', long:'If your environment is noisy, try noise-canceling headphones, brown/white noise, or instrumental music. Consistent background sound is less disruptive than intermittent voices.', category:'distraction' },
  { keys: ['lighting','bright','dim'], short:'Bright, cool light boosts alertness.', long:'Bright, cool-toned light signals wakefulness to your brain. Dim, warm light is better for wind-down. Match lighting to the type of work you’re doing.', category:'energy' },
  { keys: ['temperature','hot','cold'], short:'A slightly cool room aids focus.', long:'A room around 20-22°C (68-72°F) is often best for focus. Too warm makes you sleepy; too cold is distracting. Adjust layers to stay comfortable.', category:'energy' },
  { keys: ['clutter','messy desk','clean space'], short:'Clear your workspace before each session.', long:'Visual clutter competes for attention. Spend 60 seconds clearing your desk before a focus block. A clean space signals to your brain that it’s time to work.', category:'distraction' },
  { keys: ['gamify','make it fun','challenge'], short:'Turn work into a game with timers and points.', long:'Gamification helps: challenge yourself to finish before the timer, earn points for completed Pomodoros, or compete with a friend. Fun reduces resistance.', category:'motivation' },
  { keys: ['willpower','self control','discipline'], short:'Willpower is a muscle—rest and routines help.', long:'Willpower is limited and fatigue-sensitive. Rely on routines and environment design instead of brute force. When motivation is low, fall back on tiny habits.', category:'habits' },
  { keys: ['confidence','believe','self doubt'], short:'Confidence comes from kept promises to yourself.', long:'Build confidence by setting tiny goals and keeping them. Each small win proves you can follow through. Over time, that evidence outweighs self-doubt.', category:'motivation' },
  { keys: ['reflect','journal','think'], short:'Spend 5 minutes reflecting on what worked.', long:'A short reflection practice helps you learn from each day. Ask: What went well? What will I do differently? What is one thing I’m grateful for?', category:'habits' },
  { keys: ['curiosity','interested','bored'], short:'Find one interesting angle in the task.', long:'Boredom often comes from disconnection. Find one genuinely interesting question or challenge in the task. Curiosity pulls attention better than willpower.', category:'motivation' },
  { keys: ['patience','long term','delayed gratification'], short:'Focus on the process, not the outcome.', long:'Big goals take time. Focus on showing up today and improving by 1%. Patience plus consistency beats intensity every time.', category:'motivation' },
  { keys: ['failure','mistake','learn'], short:'Treat failures as data, not identity.', long:'Everyone fails. Productive people treat failures as feedback: what happened, what can I learn, what will I try next? This growth mindset keeps you moving.', category:'motivation' },
  { keys: ['feedback','criticism','review'], short:'Seek specific feedback early and often.', long:'Specific feedback accelerates growth better than vague praise. Ask for one thing you could improve, then act on it. Early feedback prevents wasted effort.', category:'communication' },
  { keys: ['networking','connect','relationships'], short:'Quality connections beat quantity.', long:'Build relationships by being helpful, reliable, and genuinely interested. A small network of strong connections is more valuable than hundreds of shallow ones.', category:'communication' },
  { keys: ['negotiation','ask','request'], short:'Know your goal and best alternative before asking.', long:'Good negotiation starts with clarity: what do you want, what can you give, and what is your walk-away option? Ask confidently and listen actively.', category:'communication' },
  { keys: ['presentation','speak','public speaking'], short:'Practice out loud and know your opening.', long:'For presentations, rehearse out loud at least once, know your first 30 seconds cold, and focus on serving the audience. Nerves usually fade after the first minute.', category:'communication' },
  { keys: ['leadership','lead team','manage'], short:'Clarify the goal, then remove obstacles.', long:'Good leadership means setting a clear direction, giving people autonomy, and removing blockers. Trust your team and protect their focus time.', category:'communication' },
  { keys: ['conflict','disagreement','argument'], short:'Focus on interests, not positions.', long:'In conflict, ask why the other person wants what they want. Often you can find a solution that satisfies both underlying interests without either side “losing.”', category:'communication' },
  { keys: ['boundaries work','after hours','work life balance'], short:'Protect your off-hours to sustain performance.', long:'Sustainable productivity requires boundaries. Define clear work hours, shut down devices at night, and protect rest. You’ll do better work when you return.', category:'energy' },
  { keys: ['vacation','rest','recharge'], short:'Rest is not a reward; it is part of the work.', long:'Regular rest prevents burnout and improves creativity. Schedule vacations and rest days in advance, and fully disconnect during them.', category:'energy' },
  { keys: ['meaning','purpose','why'], short:'Connect the task to a value you care about.', long:'When work feels meaningless, reconnect it to a value: learning, helping others, security, growth, or creativity. Purpose is a powerful focus booster.', category:'motivation' }
];

function findPresetAnswer(text, mode) {
  const clean = text.toLowerCase().trim().replace(/[?!.]+$/, '');
  for (let i = 0; i < presetAnswers.length; i++) {
    const p = presetAnswers[i];
    for (let k = 0; k < p.keys.length; k++) {
      if (clean.indexOf(p.keys[k]) !== -1) {
        const answerText = mode === 'short' ? (p.short || p.long) : (p.long || p.short);
        return { text: answerText, category: p.category };
      }
    }
  }
  return null;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInline(txt) {
  return txt
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}

function formatMessage(text) {
  if (!text) return '';
  let html = escapeHTML(text);
  html = formatInline(html);
  const paras = html.split(/\n\s*\n/);
  return paras.map(function (p) {
    p = p.trim();
    if (!p) return '';
    const lines = p.split('\n');
    const listItems = lines.filter(function (l) { return /^[-*]\s+/.test(l); });
    if (listItems.length === lines.length && listItems.length > 0) {
      return '<ul>' + listItems.map(function (li) { return '<li>' + li.replace(/^[-*]\s+/, '') + '</li>'; }).join('') + '</ul>';
    }
    return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

function scrollToBottom() {
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function createAvatar(sender) {
  const el = document.createElement('div');
  el.className = 'fc-avatar';
  el.textContent = sender === 'user' ? 'You' : 'AI';
  return el;
}

function addChatBubble(text, sender) {
  const msg = document.createElement('div');
  msg.className = 'fc-message ' + sender;

  const avatar = createAvatar(sender);
  const bubble = document.createElement('div');
  bubble.className = 'fc-chat-bubble ' + sender;
  bubble.innerHTML = formatMessage(text);

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatHistory.appendChild(msg);
  scrollToBottom();
  return bubble;
}

let typingEl = null;
function showTyping() {
  if (typingEl) return;
  const msg = document.createElement('div');
  msg.className = 'fc-message assistant';
  const avatar = createAvatar('assistant');
  const bubble = document.createElement('div');
  bubble.className = 'fc-chat-bubble assistant loading fc-typing';
  bubble.innerHTML = '<span></span><span></span><span></span>';
  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatHistory.appendChild(msg);
  typingEl = msg;
  scrollToBottom();
}

function hideTyping() {
  if (typingEl) {
    typingEl.remove();
    typingEl = null;
  }
}

let streamingBubble = null;
let streamingText = '';
function startStreamingBubble() {
  hideTyping();
  streamingText = '';
  const msg = document.createElement('div');
  msg.className = 'fc-message assistant';
  const avatar = createAvatar('assistant');
  const bubble = document.createElement('div');
  bubble.className = 'fc-chat-bubble assistant streaming';
  bubble.innerHTML = '';
  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatHistory.appendChild(msg);
  streamingBubble = bubble;
  scrollToBottom();
}

function appendStreamingText(chunk) {
  if (!streamingBubble) startStreamingBubble();
  streamingText += chunk;
  streamingBubble.innerHTML = formatMessage(streamingText);
  scrollToBottom();
}

function finishStreaming() {
  if (streamingBubble) {
    streamingBubble.classList.remove('streaming');
    const result = streamingText.trim();
    streamingBubble = null;
    streamingText = '';
    return result;
  }
  return '';
}

let retryCallback = null;
function showError(message, onRetry) {
  retryCallback = onRetry || null;
  errorBanner.innerHTML = '<span>' + escapeHTML(message) + '</span>' +
    (onRetry ? '<button type="button">Retry</button>' : '');
  errorBanner.classList.add('open');
}
function hideError() {
  errorBanner.classList.remove('open');
  retryCallback = null;
}
errorBanner.addEventListener('click', function (e) {
  if (e.target.tagName === 'BUTTON' && retryCallback) {
    hideError();
    retryCallback();
  }
});

(function renderMemory() {
  const m = getMemory();
  if (!m.length) return;
  const start = Math.max(0, m.length - 6);
  for (let i = start; i < m.length; i++) {
    addChatBubble(m[i].content, m[i].role);
  }
})();

async function fetchWithRetries(url, options, maxRetries) {
  maxRetries = maxRetries || 1;
  let lastErr;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      const clone = res.clone();
      const body = await clone.text().catch(function () { return ''; });
      if (res.status >= 400 && res.status < 500) {
        throw new Error('HTTP ' + res.status + ' — ' + body.slice(0, 160));
      }
      throw new Error('HTTP ' + res.status);
    } catch (e) {
      lastErr = e;
      if (i < maxRetries) {
        await new Promise(function (resolve) { setTimeout(resolve, 1000 * Math.pow(2, i)); });
      }
    }
  }
  throw lastErr;
}

async function readSSEStream(reader, onChunk) {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices && json.choices[0] && (json.choices[0].delta || json.choices[0].message);
        const content = delta && delta.content;
        if (content) onChunk(content);
      } catch (e) {}
    }
  }
}

async function askOpenRouter(question) {
  const key = fcSettings.apiKey;
  if (!key) return false;
  let model = fcSettings.model;
  if (model === 'auto') {
    model = 'openrouter:google/gemini-2.5-flash-preview';
  }
  if (!model.startsWith('openrouter:')) return false;
  model = model.replace('openrouter:', '');
  const mode = detectMode(question);
  const messages = [{ role: 'system', content: buildSystemPrompt(mode) }]
    .concat(buildMemoryMessages(4))
    .concat([{ role: 'user', content: question }]);
  abortCtrl = new AbortController();
  setGenerating(true);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: abortCtrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'HTTP-Referer': location.href,
        'X-Title': 'Coastal Countdown'
      },
      body: JSON.stringify({ model: model, messages: messages, stream: true })
    });
    if (!res.ok) return false;
    startStreamingBubble();
    await readSSEStream(res.body.getReader(), appendStreamingText);
    const answer = finishStreaming();
    if (!answer) return false;
    return answer;
  } catch (e) {
    if (e.name === 'AbortError') return 'aborted';
    return false;
  } finally {
    abortCtrl = null;
    setGenerating(false);
  }
}

async function askOpenAI(question) {
  const key = fcSettings.apiKey;
  if (!key) return false;
  let model = fcSettings.model;
  if (model === 'auto') {
    model = 'openai:gpt-4o-mini';
  }
  if (!model.startsWith('openai:')) return false;
  model = model.replace('openai:', '');
  const mode = detectMode(question);
  const messages = [{ role: 'system', content: buildSystemPrompt(mode) }]
    .concat(buildMemoryMessages(4))
    .concat([{ role: 'user', content: question }]);
  abortCtrl = new AbortController();
  setGenerating(true);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: abortCtrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({ model: model, messages: messages, stream: true })
    });
    if (!res.ok) return false;
    startStreamingBubble();
    await readSSEStream(res.body.getReader(), appendStreamingText);
    const answer = finishStreaming();
    if (!answer) return false;
    return answer;
  } catch (e) {
    if (e.name === 'AbortError') return 'aborted';
    return false;
  } finally {
    abortCtrl = null;
    setGenerating(false);
  }
}

async function askGeminiNano(question) {
  try {
    const ai = window.ai || (window.chrome && window.chrome.ai);
    if (!ai || typeof ai.languageModel !== 'object' || typeof ai.languageModel.create !== 'function') return false;
    const mode = detectMode(question);
    const session = await ai.languageModel.create({
      systemPrompt: buildSystemPrompt(mode)
    });
    const answer = await session.prompt(buildTextPrompt(question, mode));
    const trimmed = answer.trim();
    if (!trimmed) return false;
    addChatBubble(trimmed, 'assistant');
    return trimmed;
  } catch (e) {
    return false;
  }
}

async function askPollinations(question) {
  showTyping();
  try {
    const mode = detectMode(question);
    const prompt = buildTextPrompt(question, mode);
    const res = await fetchWithRetries('https://text.pollinations.ai/' + encodeURIComponent(prompt) + '?seed=' + Math.floor(Math.random() * 100000), {}, 1);
    if (!res.ok) return false;
    const answer = (await res.text()).trim();
    if (!answer) return false;
    addChatBubble(answer, 'assistant');
    return answer;
  } catch (e) {
    return false;
  } finally {
    hideTyping();
  }
}

async function askWikipedia(question) {
  const clean = question.toLowerCase().replace(/^(what is|who is|where is|when is|how to|why is|what are|who are|define|explain)\s+/i, '').replace(/[?!.]+$/, '').trim();
  if (!clean) return false;
  try {
    const searchRes = await fetchWithRetries('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(clean) + '&format=json&origin=*', {
      headers: { 'Api-User-Agent': 'CoastalCountdown/1.0' }
    }, 1);
    const searchData = await searchRes.json();
    const first = searchData.query && searchData.query.search && searchData.query.search[0];
    if (!first) return false;
    const summaryRes = await fetchWithRetries('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(first.title), {
      headers: { 'Api-User-Agent': 'CoastalCountdown/1.0' }
    }, 1);
    const summary = await summaryRes.json();
    const answer = summary.extract || summary.description;
    if (!answer) return false;
    addChatBubble(answer.trim(), 'assistant');
    return answer.trim();
  } catch (e) {
    return false;
  }
}

async function askAI(question) {
  hideError();
  const mode = detectMode(question);
  const preset = findPresetAnswer(question, mode);
  if (preset) {
    setTimeout(function () {
      addChatBubble(preset.text, 'assistant');
      addMemory('assistant', preset.text);
      showFollowUps(preset.category || inferCategory(question));
    }, 300);
    return;
  }

  const model = fcSettings.model || 'auto';
  let sources = [];
  if (model.startsWith('openrouter:')) sources = [askOpenRouter];
  else if (model.startsWith('openai:')) sources = [askOpenAI];
  else if (model === 'nano') sources = [askGeminiNano];
  else if (model === 'pollinations') sources = [askPollinations];
  else if (model === 'wikipedia') sources = [askWikipedia];
  else {
    sources = [];
    if (fcSettings.apiKey) sources.push(askOpenRouter, askOpenAI);
    sources.push(askGeminiNano, askPollinations, askWikipedia);
  }

  for (let i = 0; i < sources.length; i++) {
    try {
      const answer = await sources[i](question);
      if (answer === 'aborted') {
        showFollowUps('default');
        return;
      }
      if (answer) {
        addMemory('assistant', answer);
        showFollowUps(inferCategory(question));
        return;
      }
    } catch (e) {}
  }

  const err = "I couldn't reach any answer source right now. Check your internet connection, API key, or try again.";
  showError(err, function () { askAI(question); });
  showFollowUps('default');
}

function handleQuestion() {
  const text = taskInput.value.trim();
  if (!text) return;
  hideError();
  addChatBubble(text, 'user');
  addMemory('user', text);
  clearFollowUps();
  taskInput.value = '';
  askAI(text);
}

taskInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleQuestion();
  }
});

const timerCircle = $('#timerCircle');
const quoteEl = document.createElement('div');
quoteEl.className = 'fc-quote';
if (timerCircle) timerCircle.after(quoteEl);
else if (mount && taskRow) mount.insertBefore(quoteEl, taskRow);

const quotes = [
  "Small steps every day.",
  "Focus is the new multitasking.",
  "One minute at a time.",
  "Done is better than perfect.",
  "Stay rooted, bend with the breeze.",
  "Your future self will thank you.",
  "Distraction is the enemy of depth.",
  "Breathe in, focus out.",
  "Progress, not perfection.",
  "Lock in and let the noise fade.",
  "Consistency compounds.",
  "Make this minute count."
];
let quoteIndex = Math.floor(Math.random() * quotes.length);
function showQuote() {
  if (!quoteEl) return;
  quoteEl.style.opacity = '0';
  setTimeout(() => {
    quoteEl.textContent = '“' + quotes[quoteIndex] + '”';
    quoteEl.style.opacity = '1';
    quoteIndex = (quoteIndex + 1) % quotes.length;
  }, 250);
}
showQuote();
setInterval(showQuote, 30000);

/* ===== Focus Tools panel (productivity) ===== */
const prodPanel = $('#fcProductivityPanel');
const prodHeader = $('#fcProductivityHeader');
const prodOpen = loadJSON('fcProductivityOpen', true);
if (prodPanel && prodHeader) {
  if (!prodOpen) prodPanel.classList.add('collapsed');
  prodHeader.addEventListener('click', () => {
    prodPanel.classList.toggle('collapsed');
    saveJSON('fcProductivityOpen', !prodPanel.classList.contains('collapsed'));
  });
}

const dailyGoalInput = $('#fcDailyGoal');
const dailyGoal = loadJSON('fcDailyGoal', { text: '', date: '' });
const today = todayStr();
if (dailyGoalInput) {
  if (dailyGoal.date !== today) {
    dailyGoal.text = '';
    dailyGoal.date = today;
    saveJSON('fcDailyGoal', dailyGoal);
  }
  dailyGoalInput.value = dailyGoal.text || '';
  dailyGoalInput.addEventListener('input', () => {
    dailyGoal.text = dailyGoalInput.value.trim();
    dailyGoal.date = todayStr();
    saveJSON('fcDailyGoal', dailyGoal);
  });
}

const notesInput = $('#fcFocusNotes');
const savedNotes = loadJSON('fcFocusNotes', '');
if (notesInput) {
  notesInput.value = savedNotes;
  notesInput.addEventListener('input', () => saveJSON('fcFocusNotes', notesInput.value));
}

const taskInputProd = $('#fcProdTaskInput');
const addTaskBtn = $('#fcAddTaskBtn');
const taskList = $('#fcTaskList');
let tasks = loadJSON('fcTasks', []);

function saveTasks() { saveJSON('fcTasks', tasks); }

function renderTasks() {
  if (!taskList) return;
  taskList.innerHTML = '';
  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'fc-task-item' + (task.done ? ' done' : '');
    li.innerHTML = '<input type="checkbox" ' + (task.done ? 'checked' : '') + '><span></span><button type="button">Delete</button>';
    const checkbox = li.querySelector('input');
    const span = li.querySelector('span');
    const deleteBtn = li.querySelector('button');
    span.textContent = task.text;
    checkbox.addEventListener('change', () => {
      task.done = checkbox.checked;
      saveTasks();
      renderTasks();
    });
    deleteBtn.addEventListener('click', () => {
      tasks = tasks.filter(t => t.id !== task.id);
      saveTasks();
      renderTasks();
    });
    taskList.appendChild(li);
  });
}

function addTask() {
  const text = (taskInputProd.value || '').trim();
  if (!text) return;
  tasks.push({ id: Date.now(), text, done: false });
  taskInputProd.value = '';
  saveTasks();
  renderTasks();
}

if (addTaskBtn) addTaskBtn.addEventListener('click', addTask);
if (taskInputProd) taskInputProd.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });
renderTasks();

})();
