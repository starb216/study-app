const express = require('express');
const { run, get, all } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/session', auth, async (req, res) => {
  try {
    const { duration_minutes } = req.body;
    const minutes = parseInt(duration_minutes, 10);
    if (!minutes || minutes <= 0) {
      return res.status(400).json({ error: 'Valid duration_minutes is required' });
    }

    const currencyEarned = minutes;
    const now = new Date().toISOString();
    const sessionResult = await run(
      'INSERT INTO study_sessions (user_id, duration_minutes, currency_earned, started_at, ended_at) VALUES (?, ?, ?, ?, ?)',
      [req.userId, minutes, currencyEarned, now, now]
    );

    await run(
      'UPDATE users SET currency = currency + ? WHERE id = ?',
      [currencyEarned, req.userId]
    );

    const user = await get('SELECT currency FROM users WHERE id = ?', [req.userId]);
    const session = await get('SELECT * FROM study_sessions WHERE id = ?', [sessionResult.lastID]);

    res.status(201).json({
      session,
      balance: user.currency
    });
  } catch (err) {
    console.error('Study session error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/session/:id', auth, async (req, res) => {
  try {
    const session = await get(
      'SELECT * FROM study_sessions WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const now = new Date().toISOString();
    await run(
      'UPDATE study_sessions SET duration_minutes = duration_minutes + 1, currency_earned = currency_earned + 1, ended_at = ? WHERE id = ?',
      [now, session.id]
    );
    await run(
      'UPDATE users SET currency = currency + 1 WHERE id = ?',
      [req.userId]
    );

    const updated = await get('SELECT * FROM study_sessions WHERE id = ?', [session.id]);
    const user = await get('SELECT currency FROM users WHERE id = ?', [req.userId]);
    res.json({ session: updated, balance: user.currency });
  } catch (err) {
    console.error('Update session error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/session/:id', auth, async (req, res) => {
  try {
    const session = await get(
      'SELECT * FROM study_sessions WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await run(
      'UPDATE users SET currency = currency - ? WHERE id = ?',
      [session.currency_earned, req.userId]
    );
    await run('DELETE FROM study_sessions WHERE id = ?', [session.id]);

    const user = await get('SELECT currency FROM users WHERE id = ?', [req.userId]);
    res.json({ balance: user.currency });
  } catch (err) {
    console.error('Delete session error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/sessions', auth, async (req, res) => {
  try {
    const sessions = await all(
      'SELECT * FROM study_sessions WHERE user_id = ? ORDER BY ended_at DESC',
      [req.userId]
    );
    res.json(sessions);
  } catch (err) {
    console.error('Get sessions error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/balance', auth, async (req, res) => {
  try {
    const user = await get('SELECT currency FROM users WHERE id = ?', [req.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ balance: user.currency });
  } catch (err) {
    console.error('Get balance error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/streaks', auth, async (req, res) => {
  try {
    const sessions = await all(
      "SELECT DISTINCT DATE(ended_at, 'localtime') AS day FROM study_sessions WHERE user_id = ? ORDER BY day DESC",
      [req.userId]
    );
    const days = sessions.map((s) => s.day);
    const { currentStreak, longestStreak } = computeStreaks(days);
    res.json({ current_streak: currentStreak, longest_streak: longestStreak, study_days: days });
  } catch (err) {
    console.error('Get streaks error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

function computeStreaks(days) {
  if (days.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(yesterday);

  let currentStreak = 0;
  if (days[0] === todayStr || days[0] === yesterdayStr) {
    currentStreak = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      prev.setDate(prev.getDate() - 1);
      if (days[i] === formatDate(prev)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    prev.setDate(prev.getDate() - 1);
    if (days[i] === formatDate(prev)) {
      run++;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 1;
    }
  }

  return { currentStreak, longestStreak };
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = router;
