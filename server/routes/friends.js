const express = require('express');
const { run, get, all } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const friends = await all(
      `
      SELECT u.id, u.username, u.avatar, u.currency
      FROM friends f
      JOIN users u ON (u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END)
      WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
      ORDER BY u.username
      `,
      [req.userId, req.userId, req.userId]
    );
    res.json(friends);
  } catch (err) {
    console.error('Get friends error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/pending', auth, async (req, res) => {
  try {
    const pending = await all(
      `
      SELECT f.id, f.requester_id, u.username, u.avatar
      FROM friends f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
      `,
      [req.userId]
    );
    res.json(pending);
  } catch (err) {
    console.error('Get pending friends error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/request', auth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const addressee = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!addressee) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (addressee.id === req.userId) {
      return res.status(400).json({ error: 'Cannot friend yourself' });
    }

    const existing = await get(
      `
      SELECT * FROM friends
      WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
      AND status IN ('pending', 'accepted')
      `,
      [req.userId, addressee.id, addressee.id, req.userId]
    );
    if (existing) {
      return res.status(409).json({ error: 'Friend request already exists' });
    }

    const result = await run(
      'INSERT INTO friends (requester_id, addressee_id, status) VALUES (?, ?, ?)',
      [req.userId, addressee.id, 'pending']
    );
    res.status(201).json({ friendship_id: result.lastID, status: 'pending' });
  } catch (err) {
    console.error('Friend request error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/respond', auth, async (req, res) => {
  try {
    const { friendship_id, action } = req.body;
    if (!friendship_id || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'friendship_id and action (accept|decline) are required' });
    }

    const friendship = await get(
      'SELECT * FROM friends WHERE id = ? AND addressee_id = ? AND status = ?',
      [friendship_id, req.userId, 'pending']
    );
    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (action === 'accept') {
      await run('UPDATE friends SET status = ? WHERE id = ?', ['accepted', friendship_id]);
      res.json({ message: 'Friend request accepted', status: 'accepted' });
    } else {
      await run('DELETE FROM friends WHERE id = ?', [friendship_id]);
      res.json({ message: 'Friend request declined' });
    }
  } catch (err) {
    console.error('Respond friend error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
