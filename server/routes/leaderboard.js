const express = require('express');
const { all, get } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const MONTHLY_CTE = `
  WITH monthly AS (
    SELECT
      u.id,
      u.username,
      u.currency AS total,
      COALESCE(SUM(s.currency_earned), 0) AS points,
      COUNT(s.id) AS sessions,
      COALESCE(AVG(s.duration_minutes), 0) AS avgMinutes
    FROM users u
    LEFT JOIN study_sessions s ON s.user_id = u.id
      AND strftime('%Y-%m', s.ended_at) = strftime('%Y-%m', 'now', 'localtime')
    GROUP BY u.id
  )
`;

const STUDY_DAYS_SQL = `
  SELECT DISTINCT user_id, DATE(ended_at, 'localtime') AS day
  FROM study_sessions
  ORDER BY user_id, day DESC
`;

function computeStreak(days) {
  if (days.length === 0) return 0;
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    prev.setDate(prev.getDate() - 1);
    if (days[i] === formatDate(prev)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getStudyDaysMap() {
  const rows = await all(STUDY_DAYS_SQL);
  const map = {};
  rows.forEach((r) => {
    if (!map[r.user_id]) map[r.user_id] = [];
    map[r.user_id].push(r.day);
  });
  return map;
}

function enrichLeader(rows, daysMap, withRank = false) {
  return rows.map((u, index) => ({
    id: u.id,
    name: u.username,
    points: u.points,
    total: u.total,
    sessions: u.sessions,
    avgMinutes: Math.round(u.avgMinutes || 0),
    streak: computeStreak(daysMap[u.id] || []),
    ...(withRank ? { rank: index + 1 } : {})
  }));
}

async function getMonthlyLeaders(limit = 20) {
  const [leaders, daysMap] = await Promise.all([
    all(`${MONTHLY_CTE} SELECT * FROM monthly ORDER BY points DESC, username ASC LIMIT ?`, [limit]),
    getStudyDaysMap()
  ]);
  return enrichLeader(leaders, daysMap, true);
}

async function getFriendsLeaders(userId) {
  const [rows, daysMap] = await Promise.all([
    all(
      `${MONTHLY_CTE}
      SELECT * FROM monthly
      WHERE id = ? OR id IN (
        SELECT CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
        FROM friends f
        WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
      )
      ORDER BY points DESC, username ASC`,
      [userId, userId, userId, userId]
    ),
    getStudyDaysMap()
  ]);
  return enrichLeader(rows, daysMap);
}

// Global points leaderboard (rich monthly stats)
router.get('/', async (req, res) => {
  try {
    const leaders = await getMonthlyLeaders(20);
    res.json(leaders);
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Friends points leaderboard (rich monthly stats)
router.get('/friends', auth, async (req, res) => {
  try {
    const leaders = await getFriendsLeaders(req.userId);
    res.json(leaders);
  } catch (err) {
    console.error('Friends leaderboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Around me: 5 global ranks above, viewer, 4 below
router.get('/around', auth, async (req, res) => {
  try {
    const allLeaders = await getMonthlyLeaders(1000);
    const meIndex = allLeaders.findIndex((u) => u.id === req.userId);
    if (meIndex === -1) {
      return res.json([]);
    }
    const start = Math.max(0, meIndex - 5);
    const end = Math.min(allLeaders.length, meIndex + 5);
    res.json(allLeaders.slice(start, end));
  } catch (err) {
    console.error('Around me leaderboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Global streaks leaderboard (legacy table view)
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

// Friends streaks leaderboard (legacy table view)
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
