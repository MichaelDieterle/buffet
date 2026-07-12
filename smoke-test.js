try {
  require('./src/services/yahooService');
  require('./src/services/refreshJob');
  require('./src/routes/stocks');
  require('./src/routes/export');
  require('./src/routes/competitors');
  require('./src/routes/comparisons');
  require('./src/models');
  console.log('all modules load ok');
} catch (e) {
  console.error('load error:', e.message);
  console.error(e.stack);
  process.exit(1);
}
