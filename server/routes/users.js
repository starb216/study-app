const express = require('express');
const bcrypt = require('bcryptjs');
const { run, get } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/me', auth, async (req, res) => {
  try {
    const user = await get('SELECT id, username, email, currency, is_admin, created_at FROM users WHERE id = ?', [
      req.userId
    ]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get me error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/me', auth, async (req, res) => {
  try {
    const { email, currentPassword } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const existing = await get('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.userId]);
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    await run('UPDATE users SET email = ? WHERE id = ?', [email, req.userId]);
    const updated = await get('SELECT id, username, email, currency, is_admin, created_at FROM users WHERE id = ?', [
      req.userId
    ]);
    res.json(updated);
  } catch (err) {
    console.error('Update email error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.userId]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
