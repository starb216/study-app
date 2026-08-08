const express = require('express');
const { run, get, all } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const notes = await all(
      'SELECT id, title, substr(content, 1, 120) AS snippet, created_at, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC',
      [req.userId]
    );
    res.json(notes);
  } catch (err) {
    console.error('Get notes error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/export', auth, async (req, res) => {
  try {
    const notes = await all(
      'SELECT id, title, content, created_at, updated_at FROM notes WHERE user_id = ? ORDER BY id ASC',
      [req.userId]
    );
    res.json(notes);
  } catch (err) {
    console.error('Export notes error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/import', auth, async (req, res) => {
  try {
    const { notes } = req.body;
    if (!Array.isArray(notes)) {
      return res.status(400).json({ error: 'notes must be an array' });
    }
    let imported = 0;
    for (const item of notes) {
      const title = String(item.title || '').slice(0, 120);
      const content = String(item.content || '');
      if (!title) continue;
      await run('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)', [req.userId, title, content]);
      imported++;
    }
    res.json({ imported });
  } catch (err) {
    console.error('Import notes error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const note = await get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (err) {
    console.error('Get note error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const result = await run(
      'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
      [req.userId, title, content || '']
    );
    const note = await get('SELECT * FROM notes WHERE id = ?', [result.lastID]);
    res.status(201).json(note);
  } catch (err) {
    console.error('Create note error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const existing = await get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }
    const { title, content } = req.body;
    await run(
      'UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title !== undefined ? title : existing.title, content !== undefined ? content : existing.content, req.params.id]
    );
    const note = await get('SELECT * FROM notes WHERE id = ?', [req.params.id]);
    res.json(note);
  } catch (err) {
    console.error('Update note error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }
    await run('DELETE FROM notes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error('Delete note error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
