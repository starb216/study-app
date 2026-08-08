const express = require('express');
const { run, get, all } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const courses = await all(
      `SELECT c.id, c.name, c.description, c.created_at, u.username AS creator,
        (SELECT COUNT(*) FROM course_materials m WHERE m.course_id = c.id) AS material_count
       FROM courses c JOIN users u ON u.id = c.created_by
       ORDER BY c.name ASC`
    );
    res.json(courses);
  } catch (err) {
    console.error('Get courses error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const existing = await get('SELECT id FROM courses WHERE LOWER(name) = LOWER(?)', [trimmed]);
    if (existing) {
      return res.status(409).json({ error: 'A course with this name already exists' });
    }
    const result = await run(
      'INSERT INTO courses (name, description, created_by) VALUES (?, ?, ?)',
      [trimmed, description || null, req.userId]
    );
    const course = await get('SELECT * FROM courses WHERE id = ?', [result.lastID]);
    res.status(201).json(course);
  } catch (err) {
    console.error('Create course error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/materials', auth, async (req, res) => {
  try {
    const course = await get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const materials = await all(
      `SELECT id, course_id, user_id, username, title, content, file_name, file_type,
        (file_data IS NOT NULL) AS has_file, created_at
       FROM course_materials WHERE course_id = ? ORDER BY id DESC`,
      [req.params.id]
    );
    res.json(materials);
  } catch (err) {
    console.error('Get course materials error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/materials/:mid', auth, async (req, res) => {
  try {
    const material = await get('SELECT * FROM course_materials WHERE id = ?', [req.params.mid]);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    res.json(material);
  } catch (err) {
    console.error('Get material error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/materials', auth, async (req, res) => {
  try {
    const course = await get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const { title, content, file_name, file_type, file_data } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!content && !file_data) {
      return res.status(400).json({ error: 'Content or file is required' });
    }
    if (file_data && file_data.length > 3500000) {
      return res.status(413).json({ error: 'File too large (max ~2.5 MB)' });
    }
    const user = await get('SELECT username FROM users WHERE id = ?', [req.userId]);
    const result = await run(
      'INSERT INTO course_materials (course_id, user_id, username, title, content, file_name, file_type, file_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, req.userId, user.username, title, content || null, file_name || null, file_type || null, file_data || null]
    );
    const material = await get(
      'SELECT id, course_id, user_id, username, title, content, file_name, file_type, created_at FROM course_materials WHERE id = ?',
      [result.lastID]
    );
    res.status(201).json(material);
  } catch (err) {
    console.error('Upload material error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/materials/:mid', auth, async (req, res) => {
  try {
    const material = await get('SELECT * FROM course_materials WHERE id = ?', [req.params.mid]);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    if (material.user_id !== req.userId && !req.isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    await run('DELETE FROM course_materials WHERE id = ?', [req.params.mid]);
    res.json({ message: 'Material deleted' });
  } catch (err) {
    console.error('Delete material error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
