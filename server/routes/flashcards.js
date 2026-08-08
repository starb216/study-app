const express = require('express');
const { run, get, all } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const cards = await all('SELECT * FROM flashcards WHERE user_id = ? ORDER BY id ASC', [req.userId]);
    res.json(cards);
  } catch (err) {
    console.error('Get flashcards error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { front, back } = req.body;
    if (!front || !back) {
      return res.status(400).json({ error: 'front and back are required' });
    }
    const result = await run(
      'INSERT INTO flashcards (user_id, front, back) VALUES (?, ?, ?)',
      [req.userId, front, back]
    );
    const card = await get('SELECT * FROM flashcards WHERE id = ?', [result.lastID]);
    res.status(201).json(card);
  } catch (err) {
    console.error('Create flashcard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/bulk', auth, async (req, res) => {
  try {
    const { cards } = req.body;
    if (!Array.isArray(cards)) {
      return res.status(400).json({ error: 'cards must be an array' });
    }
    let added = 0;
    for (const item of cards) {
      const front = String(item.front || '');
      const back = String(item.back || '');
      if (!front || !back) continue;
      await run('INSERT INTO flashcards (user_id, front, back) VALUES (?, ?, ?)', [req.userId, front, back]);
      added++;
    }
    res.json({ added });
  } catch (err) {
    console.error('Bulk add flashcards error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await get('SELECT * FROM flashcards WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Flashcard not found' });
    }
    await run('DELETE FROM flashcards WHERE id = ?', [req.params.id]);
    res.json({ message: 'Flashcard deleted' });
  } catch (err) {
    console.error('Delete flashcard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/', auth, async (req, res) => {
  try {
    await run('DELETE FROM flashcards WHERE user_id = ?', [req.userId]);
    res.json({ message: 'Flashcards cleared' });
  } catch (err) {
    console.error('Clear flashcards error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
