const express = require('express');
const { run, get, all } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const events = await all(
      'SELECT * FROM events WHERE user_id = ? ORDER BY event_date',
      [req.userId]
    );
    res.json(events);
  } catch (err) {
    console.error('Get events error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, event_date, duration_minutes, reminder_minutes_before } = req.body;
    if (!title || !event_date) {
      return res.status(400).json({ error: 'Title and event_date are required' });
    }
    const duration = parseInt(duration_minutes, 10) || 60;
    const result = await run(
      'INSERT INTO events (user_id, title, event_date, duration_minutes, reminder_minutes_before) VALUES (?, ?, ?, ?, ?)',
      [req.userId, title, event_date, duration, reminder_minutes_before || 0]
    );
    const event = await get('SELECT * FROM events WHERE id = ?', [result.lastID]);
    res.status(201).json(event);
  } catch (err) {
    console.error('Create event error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, event_date, duration_minutes, reminder_minutes_before, notified } = req.body;
    const existing = await get('SELECT * FROM events WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.userId
    ]);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await run(
      'UPDATE events SET title = ?, event_date = ?, duration_minutes = ?, reminder_minutes_before = ?, notified = ? WHERE id = ?',
      [
        title !== undefined ? title : existing.title,
        event_date !== undefined ? event_date : existing.event_date,
        duration_minutes !== undefined ? (parseInt(duration_minutes, 10) || 60) : existing.duration_minutes,
        reminder_minutes_before !== undefined ? reminder_minutes_before : existing.reminder_minutes_before,
        notified !== undefined ? notified : existing.notified,
        req.params.id
      ]
    );
    const event = await get('SELECT * FROM events WHERE id = ?', [req.params.id]);
    res.json(event);
  } catch (err) {
    console.error('Update event error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await run('DELETE FROM events WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.userId
    ]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Delete event error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
