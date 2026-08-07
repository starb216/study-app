const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/events', require('./routes/events'));
app.use('/api/study', require('./routes/study'));
app.use('/api/sleep', require('./routes/sleep'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));

app.get('/*path', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function init() {
  try {
    await db.init();
    if (require.main === module) {
      app.listen(PORT, () => {
        console.log(`StudyMint server running on http://localhost:${PORT}`);
      });
    }
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
    if (require.main === module) process.exit(1);
    throw err;
  }
}

const initPromise = init();

module.exports = { app, initPromise };
