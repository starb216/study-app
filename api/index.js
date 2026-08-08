module.exports = async (req, res) => {
  // Lightweight health/diagnostic check — runs before touching the DB layer
  if (req.url && req.url.startsWith('/api/health')) {
    return res.status(200).json({
      ok: true,
      hasPostgresUrl: Boolean(process.env.POSTGRES_URL),
      postgresUrlScheme: (process.env.POSTGRES_URL || '').split(':')[0] || null,
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      node: process.version
    });
  }

  try {
    const { app, initPromise } = require('../server/server');
    await initPromise;
    return app(req, res);
  } catch (err) {
    console.error('Server init failed:', err);
    res.status(500).json({
      error: 'Server init failed',
      message: err.message,
      hasPostgresUrl: Boolean(process.env.POSTGRES_URL)
    });
  }
};
