const express = require('express');
const { run, get, all } = require('../db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// All admin routes require auth + admin
router.use(auth, admin);

// Get all users with aggregated stats
router.get('/users', async (req, res) => {
  try {
    const users = await all(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.currency,
        u.is_admin,
        u.created_at,
        (SELECT COUNT(*) FROM tasks WHERE user_id = u.id) AS task_count,
        (SELECT COUNT(*) FROM study_sessions WHERE user_id = u.id) AS session_count,
        (SELECT COALESCE(SUM(duration_minutes), 0) FROM study_sessions WHERE user_id = u.id) AS total_study_minutes
      FROM users u
      ORDER BY u.id
    `);
    res.json(users);
  } catch (err) {
    console.error('Admin users error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all tasks across users
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await all(`
      SELECT t.*, u.username
      FROM tasks t
      JOIN users u ON u.id = t.user_id
      ORDER BY t.created_at DESC
    `);
    res.json(tasks);
  } catch (err) {
    console.error('Admin tasks error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all events across users
router.get('/events', async (req, res) => {
  try {
    const events = await all(`
      SELECT e.*, u.username
      FROM events e
      JOIN users u ON u.id = e.user_id
      ORDER BY e.event_date
    `);
    res.json(events);
  } catch (err) {
    console.error('Admin events error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all study sessions across users
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await all(`
      SELECT s.*, u.username
      FROM study_sessions s
      JOIN users u ON u.id = s.user_id
      ORDER BY s.ended_at DESC
    `);
    res.json(sessions);
  } catch (err) {
    console.error('Admin sessions error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all friendships
router.get('/friends', async (req, res) => {
  try {
    const friendships = await all(`
      SELECT f.*, r.username AS requester, a.username AS addressee
      FROM friends f
      JOIN users r ON r.id = f.requester_id
      JOIN users a ON a.id = f.addressee_id
      ORDER BY f.created_at DESC
    `);
    res.json(friendships);
  } catch (err) {
    console.error('Admin friends error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle a user's admin status
router.put('/users/:id/admin', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot change your own admin status' });
    }

    const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newStatus = user.is_admin ? 0 : 1;
    await run('UPDATE users SET is_admin = ? WHERE id = ?', [newStatus, userId]);
    res.json({ message: `User ${newStatus ? 'promoted' : 'demoted'}`, is_admin: newStatus });
  } catch (err) {
    console.error('Admin toggle error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete any user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    const result = await run('DELETE FROM users WHERE id = ?', [userId]);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Admin delete user error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete any task
router.delete('/tasks/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Admin delete task error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete any event
router.delete('/events/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM events WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Admin delete event error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete any session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const session = await get('SELECT * FROM study_sessions WHERE id = ?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    await run('DELETE FROM study_sessions WHERE id = ?', [req.params.id]);
    await run('UPDATE users SET currency = MAX(0, currency - ?) WHERE id = ?', [
      session.currency_earned,
      session.user_id
    ]);
    res.json({ message: 'Session deleted and currency adjusted' });
  } catch (err) {
    console.error('Admin delete session error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
