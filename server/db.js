const path = require('path');
const fs = require('fs');

const usePostgres = Boolean(process.env.POSTGRES_URL);

let db;
let run;
let get;
let all;

if (usePostgres) {
  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  db = pool;

  function convertPlaceholders(sql) {
    let n = 1;
    return sql.replace(/\?/g, () => `$${n++}`);
  }

  run = function (sql, params = []) {
    return new Promise(async (resolve, reject) => {
      try {
        let pgSql = convertPlaceholders(sql);
        if (/^\s*INSERT\s+/i.test(pgSql) && !/RETURNING/i.test(pgSql)) {
          pgSql += ' RETURNING id';
        }
        const result = await pool.query(pgSql, params);
        resolve({
          lastID: result.rows[0]?.id ? Number(result.rows[0].id) : 0,
          changes: result.rowCount || 0
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  get = function (sql, params = []) {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await pool.query(convertPlaceholders(sql), params);
        resolve(result.rows[0]);
      } catch (err) {
        reject(err);
      }
    });
  };

  all = function (sql, params = []) {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await pool.query(convertPlaceholders(sql), params);
        resolve(result.rows);
      } catch (err) {
        reject(err);
      }
    });
  };
} else {
  const { DatabaseSync } = require('node:sqlite');
  const dbDir = path.resolve(__dirname, '..');
  const dbPath = path.join(dbDir, 'studymint.db');
  const sqliteDb = new DatabaseSync(dbPath);
  db = sqliteDb;

  run = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = sqliteDb.prepare(sql);
        const result = stmt.run(...params);
        resolve({ lastID: Number(result.lastInsertRowid), changes: result.changes });
      } catch (err) {
        reject(err);
      }
    });
  };

  get = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = sqliteDb.prepare(sql);
        resolve(stmt.get(...params));
      } catch (err) {
        reject(err);
      }
    });
  };

  all = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = sqliteDb.prepare(sql);
        resolve(stmt.all(...params));
      } catch (err) {
        reject(err);
      }
    });
  };
}

const CREATE_USERS = usePostgres
  ? `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      currency INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      avatar TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  : `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      currency INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;

const CREATE_TASKS = usePostgres
  ? `CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      subject TEXT,
      due_date TEXT,
      details TEXT,
      completed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  : `CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      subject TEXT,
      due_date TEXT,
      details TEXT,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

const CREATE_EVENTS = usePostgres
  ? `CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      details TEXT,
      duration_minutes INTEGER DEFAULT 60,
      reminder_minutes_before INTEGER DEFAULT 0,
      notified INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  : `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      details TEXT,
      duration_minutes INTEGER DEFAULT 60,
      reminder_minutes_before INTEGER DEFAULT 0,
      notified INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

const CREATE_SESSIONS = usePostgres
  ? `CREATE TABLE IF NOT EXISTS study_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      currency_earned INTEGER NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  : `CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      currency_earned INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

const CREATE_SLEEP = usePostgres
  ? `CREATE TABLE IF NOT EXISTS sleep_schedules (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL,
      bedtime TEXT NOT NULL,
      wake_time TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  : `CREATE TABLE IF NOT EXISTS sleep_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      bedtime TEXT NOT NULL,
      wake_time TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

const CREATE_FRIENDS = usePostgres
  ? `CREATE TABLE IF NOT EXISTS friends (
      id SERIAL PRIMARY KEY,
      requester_id INTEGER NOT NULL,
      addressee_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(requester_id, addressee_id),
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  : `CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      addressee_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(requester_id, addressee_id),
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

const CREATE_NOTES = usePostgres
  ? `CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  : `CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

const CREATE_COURSES = usePostgres
  ? `CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )`
  : `CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )`;

const CREATE_COURSE_MATERIALS = usePostgres
  ? `CREATE TABLE IF NOT EXISTS course_materials (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      file_name TEXT,
      file_type TEXT,
      file_data TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  : `CREATE TABLE IF NOT EXISTS course_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      file_name TEXT,
      file_type TEXT,
      file_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

const CREATE_FLASHCARDS = usePostgres
  ? `CREATE TABLE IF NOT EXISTS flashcards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  : `CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

async function init() {
  await run(CREATE_USERS);

  try {
    await run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
  } catch (err) {
    const msg = err.message.toLowerCase();
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) throw err;
  }

  try {
    await run('ALTER TABLE users ADD COLUMN avatar TEXT');
  } catch (err) {
    const msg = err.message.toLowerCase();
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) throw err;
  }

  const admin = await get('SELECT id FROM users WHERE is_admin = 1 LIMIT 1');
  if (!admin) {
    await run('UPDATE users SET is_admin = 1 WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)');
  }

  await run(CREATE_TASKS);
  await run(CREATE_EVENTS);

  try {
    await run('ALTER TABLE tasks ADD COLUMN details TEXT');
  } catch (err) {
    const msg = err.message.toLowerCase();
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) throw err;
  }

  try {
    await run('ALTER TABLE events ADD COLUMN details TEXT');
  } catch (err) {
    const msg = err.message.toLowerCase();
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) throw err;
  }

  try {
    await run('ALTER TABLE events ADD COLUMN duration_minutes INTEGER DEFAULT 60');
  } catch (err) {
    const msg = err.message.toLowerCase();
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) throw err;
  }

  await run(CREATE_SESSIONS);
  await run(CREATE_SLEEP);
  await run(CREATE_FRIENDS);
  await run(CREATE_NOTES);
  await run(CREATE_COURSES);
  await run(CREATE_COURSE_MATERIALS);
  await run(CREATE_FLASHCARDS);
}

module.exports = { db, run, get, all, init };
