const express = require('express');
const { run, get } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let schedule = await get('SELECT * FROM sleep_schedules WHERE user_id = ?', [req.userId]);
    if (!schedule) {
      await run(
        "INSERT INTO sleep_schedules (user_id, bedtime, wake_time, enabled) VALUES (?, '22:00', '07:00', 1)",
        [req.userId]
      );
      schedule = await get('SELECT * FROM sleep_schedules WHERE user_id = ?', [req.userId]);
    }
    res.json(schedule);
  } catch (err) {
    console.error('Get sleep schedule error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const { bedtime, wake_time, enabled } = req.body;
    if (!bedtime || !wake_time) {
      return res.status(400).json({ error: 'bedtime and wake_time are required' });
    }

    const existing = await get('SELECT * FROM sleep_schedules WHERE user_id = ?', [req.userId]);
    if (existing) {
      await run(
        'UPDATE sleep_schedules SET bedtime = ?, wake_time = ?, enabled = ? WHERE user_id = ?',
        [bedtime, wake_time, enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled, req.userId]
      );
    } else {
      await run(
        'INSERT INTO sleep_schedules (user_id, bedtime, wake_time, enabled) VALUES (?, ?, ?, ?)',
        [req.userId, bedtime, wake_time, enabled !== undefined ? (enabled ? 1 : 0) : 1]
      );
    }

    const schedule = await get('SELECT * FROM sleep_schedules WHERE user_id = ?', [req.userId]);
    res.json(schedule);
  } catch (err) {
    console.error('Update sleep schedule error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
