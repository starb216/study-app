const { app, initPromise } = require('../server/server');

module.exports = async (req, res) => {
  await initPromise;
  return app(req, res);
};
