const jwt = require('jsonwebtoken');
const { get } = require('../db');
const JWT_SECRET = 'study-app-secret';

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    // Verify current admin status from DB so role changes take effect immediately
    const user = await get('SELECT is_admin FROM users WHERE id = ?', [decoded.userId]);
    req.isAdmin = user && user.is_admin === 1;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
