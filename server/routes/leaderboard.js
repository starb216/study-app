const express = require('express');
const { all, get } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Global points leaderboard
router.get('/', async (req, res) => {
  try {
    const leaders = await all(
      'SELECT id, username, currency FROM users ORDER BY currency DESC, username ASC LIMIT 20'
    );
    res.json(leaders);
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Friends points leaderboard
router.get('/friends', auth, async (req, res) => {
  try {
    const leaders = await all(
      `
      SELECT u.id, u.username, u.currency
      FROM users u
      WHERE u.id = ? OR u.id IN (
        SELECT CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
        FROM friends f
        WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
      )
      ORDER BY u.currency DESC, u.username ASC
      LIMIT 20
      `,
      [req.userId, req.userId, req.userId, req.userId]
    );
    res.json(leaders);
  } catch (err) {
    console.error('Friends leaderboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Global streaks leaderboard
router.get('/streaks', async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT
        u.id,
        u.username,
        COUNT(DISTINCT DATE(s.ended_at, 'localtime')) AS study_days
      FROM users u
      LEFT JOIN study_sessions s ON s.user_id = u.id
      GROUP BY u.id
      ORDER BY study_days DESC, u.username ASC
      LIMIT 20
      `
    );
    const leaders = rows.map((r) => ({ ...r, streak: r.study_days }));
    res.json(leaders);
  } catch (err) {
    console.error('Streaks leaderboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Friends streaks leaderboard
router.get('/friends/streaks', auth, async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT
        u.id,
        u.username,
        COUNT(DISTINCT DATE(s.ended_at, 'localtime')) AS study_days
      FROM users u
      LEFT JOIN study_sessions s ON s.user_id = u.id
      WHERE u.id = ? OR u.id IN (
        SELECT CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
        FROM friends f
        WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
      )
      GROUP BY u.id
      ORDER BY study_days DESC, u.username ASC
      LIMIT 20
      `,
      [req.userId, req.userId, req.userId, req.userId]
    );
    const leaders = rows.map((r) => ({ ...r, streak: r.study_days }));
    res.json(leaders);
  } catch (err) {
    console.error('Friends streaks leaderboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
