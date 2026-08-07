const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('../db');

const router = express.Router();
const JWT_SECRET = 'study-app-secret';

const DEFAULT_AVATARS = ['🐱', '🐶', '🐿️', '🐰', '🐯', '🐻', '🦊', '🐼', '🦁', '🐸', '🐙', '🦋'];

function randomDefaultAvatar() {
  return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const existing = await get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const anyUser = await get('SELECT id FROM users LIMIT 1');
    const isAdmin = anyUser ? 0 : 1;

    const passwordHash = await bcrypt.hash(password, 10);
    const avatar = randomDefaultAvatar();
    const result = await run(
      'INSERT INTO users (username, email, password_hash, is_admin, avatar) VALUES (?, ?, ?, ?, ?)',
      [username, email, passwordHash, isAdmin, avatar]
    );

    const userId = result.lastID;
    await run(
      "INSERT INTO sleep_schedules (user_id, bedtime, wake_time, enabled) VALUES (?, '22:00', '07:00', 1)",
      [userId]
    );

    const token = jwt.sign({ userId, isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { id: userId, username, email, currency: 0, is_admin: isAdmin, avatar }
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const field = username.includes('@') ? 'email' : 'username';
    const user = await get(`SELECT * FROM users WHERE ${field} = ?`, [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isAdmin = user.is_admin || 0;
    const token = jwt.sign({ userId: user.id, isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        currency: user.currency,
        is_admin: isAdmin,
        avatar: user.avatar || null
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
