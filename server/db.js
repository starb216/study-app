const { Pool } = require('@neondatabase/serverless');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const POSTGRES_URL = process.env.POSTGRES_URL;
const usePostgres = !!POSTGRES_URL;

let pool = null;
let sqliteDb = null;

if (usePostgres) {
  pool = new Pool({ connectionString: POSTGRES_URL });
} else {
  sqliteDb = new DatabaseSync(path.join(__dirname, '..', 'study_app.db'));
}

function convertPlaceholders(sql) {
  if (usePostgres) {
    let n = 1;
    return sql.replace(/\?/g, () => `$${n++}`);
  }
  return sql;
}

function preparePostgresInsert(sql) {
  if (usePostgres && /^\s*INSERT\s+/i.test(sql) && !/RETURNING/i.test(sql)) {
    return `${sql} RETURNING id`;
  }
  return sql;
}

function run(sql, params = []) {
  return new Promise(async (resolve, reject) => {
    try {
      if (usePostgres) {
        const pgSql = preparePostgresInsert(convertPlaceholders(sql));
        const result = await pool.query(pgSql, params);
        resolve({
          lastID: result.rows[0]?.id ? Number(result.rows[0].id) : 0,
          changes: result.rowCount || 0
        });
      } else {
        const stmt = sqliteDb.prepare(convertPlaceholders(sql));
        const info = stmt.run(...params);
        resolve({ lastID: info.lastInsertRowid || 0, changes: info.changes || 0 });
      }
    } catch (err) {
      reject(err);
    }
  });
}

function get(sql, params = []) {
  return new Promise(async (resolve, reject) => {
    try {
      if (usePostgres) {
        const result = await pool.query(convertPlaceholders(sql), params);
        resolve(result.rows[0]);
      } else {
        const stmt = sqliteDb.prepare(convertPlaceholders(sql));
        resolve(stmt.get(...params));
      }
    } catch (err) {
      reject(err);
    }
  });
}

function all(sql, params = []) {
  return new Promise(async (resolve, reject) => {
    try {
      if (usePostgres) {
        const result = await pool.query(convertPlaceholders(sql), params);
        resolve(result.rows);
      } else {
        const stmt = sqliteDb.prepare(convertPlaceholders(sql));
        resolve(stmt.all(...params));
      }
    } catch (err) {
      reject(err);
    }
  });
}

async function init() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      currency INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      avatar TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: add is_admin column if it doesn't exist (existing databases)
  try {
    await run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) throw err;
  }

  // Migration: add avatar column if it doesn't exist
  try {
    await run('ALTER TABLE users ADD COLUMN avatar TEXT');
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) throw err;
  }

  // Ensure at least one admin exists (oldest user becomes admin if none)
  const admin = await get('SELECT id FROM users WHERE is_admin = 1 LIMIT 1');
  if (!admin) {
    await run('UPDATE users SET is_admin = 1 WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)');
  }

  await run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      subject TEXT,
      due_date TEXT,
      completed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 60,
      reminder_minutes_before INTEGER DEFAULT 0,
      notified INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migration: add duration_minutes column if it doesn't exist
  try {
    await run('ALTER TABLE events ADD COLUMN duration_minutes INTEGER DEFAULT 60');
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) throw err;
  }

  await run(`
    CREATE TABLE IF NOT EXISTS study_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      currency_earned INTEGER NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sleep_schedules (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL,
      bedtime TEXT NOT NULL,
      wake_time TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS friends (
      id SERIAL PRIMARY KEY,
      requester_id INTEGER NOT NULL,
      addressee_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(requester_id, addressee_id),
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

module.exports = { db: pool, run, get, all, init };
