const express = require('express');
const { run, get, all } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const tasks = await all(
      'SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date, created_at DESC',
      [req.userId]
    );
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, subject, due_date, details } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const result = await run(
      'INSERT INTO tasks (user_id, title, subject, due_date, details) VALUES (?, ?, ?, ?, ?)',
      [req.userId, title, subject || '', due_date || '', details || '']
    );
    const task = await get('SELECT * FROM tasks WHERE id = ?', [result.lastID]);
    res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, subject, due_date, details, completed } = req.body;
    const existing = await get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.userId
    ]);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await run(
      'UPDATE tasks SET title = ?, subject = ?, due_date = ?, details = ?, completed = ? WHERE id = ?',
      [
        title !== undefined ? title : existing.title,
        subject !== undefined ? subject : existing.subject,
        due_date !== undefined ? due_date : existing.due_date,
        details !== undefined ? details : existing.details,
        completed !== undefined ? completed : existing.completed,
        req.params.id
      ]
    );
    const task = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(task);
  } catch (err) {
    console.error('Update task error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.userId
    ]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
