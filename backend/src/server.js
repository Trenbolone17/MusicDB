const config = require('./config');
const { createApp } = require('./app');

createApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
