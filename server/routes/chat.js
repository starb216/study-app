const express = require('express');
const { run, get, all } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const category = String(req.query.category || 'General');
    const messages = await all(
      'SELECT id, user_id, username, category, text, created_at FROM chat_messages WHERE category = ? ORDER BY id ASC LIMIT 200',
      [category]
    );
    res.json(messages);
  } catch (err) {
    console.error('Get chat messages error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { category, text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const user = await get('SELECT username FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Display-name rules (enforced server-side):
    //   no displayAs          -> account username (default)
    //   displayAs 'Anonymous' -> anyone may post anonymously
    //   any other displayAs   -> admins only, non-empty, <= 30 chars
    let author = user.username;
    if (req.body.displayAs !== undefined && req.body.displayAs !== null) {
      const displayAs = String(req.body.displayAs).trim().replace(/\s+/g, ' ');
      if (displayAs === 'Anonymous') {
        author = 'Anonymous';
      } else if (displayAs && req.isAdmin && displayAs.length <= 30) {
        author = displayAs;
      } else {
        return res.status(400).json({ error: 'Invalid display name' });
      }
    }

    const result = await run(
      'INSERT INTO chat_messages (user_id, username, category, text) VALUES (?, ?, ?, ?)',
      [req.userId, author, String(category || 'General'), String(text).trim()]
    );

    const message = await get(
      'SELECT id, user_id, username, category, text, created_at FROM chat_messages WHERE id = ?',
      [result.lastID]
    );
    res.status(201).json(message);
  } catch (err) {
    console.error('Post chat message error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const message = await get('SELECT * FROM chat_messages WHERE id = ?', [req.params.id]);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.user_id !== req.userId && !req.isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }
    await run('DELETE FROM chat_messages WHERE id = ?', [req.params.id]);
    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Delete chat message error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
