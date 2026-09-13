const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');
const dotenv = require('dotenv');
const stockRoutes = require('./routes/stocks');
const comparisonRoutes = require('./routes/comparisons');
const competitorRoutes = require('./routes/competitors');
const exportRoutes = require('./routes/export');
const analyticsRoutes = require('./routes/analytics');
const portfolioRoutes = require('./routes/portfolios');
const { mcpRouter } = require('./mcp/http');
const refreshJob = require('./services/refreshJob');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({ origin: allowedOrigins }));
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

let dbInitPromise = null;
let lastDbInitAttempt = 0;
const DB_INIT_COOLDOWN_MS = 30000;

function initDb() {
  if (dbInitPromise) return dbInitPromise;
  if (Date.now() - lastDbInitAttempt < DB_INIT_COOLDOWN_MS) return Promise.resolve(false);
  lastDbInitAttempt = Date.now();
  dbInitPromise = (async () => {
    await sequelize.authenticate();
    console.log('Database connected...');
    if (process.env.NODE_ENV !== 'production') await sequelize.sync({ alter: true });
    else await sequelize.sync();
    console.log('Database synced.');
    if (process.env.DISABLE_REFRESH_JOB !== 'true') refreshJob.start();
    return true;
  })().catch((err) => {
    console.error('Unable to connect to database:', err.message);
    dbInitPromise = null;
    return false;
  });
  return dbInitPromise;
}

app.use('/api', async (req, res, next) => {
  await initDb();
  next();
});

app.use('/api/portfolios', portfolioRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/stocks', competitorRoutes);
app.use('/api/comparisons', comparisonRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/stocks', exportRoutes);
app.use('/mcp', mcpRouter());

const startServer = async () => {
  app.get('/api/health', async (req, res) => {
    try {
      await sequelize.authenticate();
      res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
      res.status(503).json({ status: 'error', database: 'disconnected', message: err.message });
    }
  });

  await initDb();

  if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
    const indexHtml = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      app.use(express.static(clientDistPath));
      app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
        next();
      });
      app.use((req, res) => res.sendFile(indexHtml));
    } else {
      app.use((req, res) => {
        if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
        res.status(200).type('html').send('<!doctype html><meta charset="utf-8"><title>Buffet API</title><h1>Buffet API läuft</h1><p>Frontend-Build (client/dist) ist nicht vorhanden. Führe <code>npm run build</code> im Projektstamm aus.</p>');
      });
    }
  }

  if (!process.env.VERCEL) app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

app.use(errorHandler);
startServer();
module.exports = app;