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
const refreshJob = require('./services/refreshJob');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({ origin: allowedOrigins }));
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/stocks', stockRoutes);
app.use('/api/stocks', competitorRoutes);
app.use('/api/comparisons', comparisonRoutes);
app.use('/api/stocks', exportRoutes);

// Test DB connection and start server
const startServer = async () => {
  // Health check endpoint (before static middleware)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  try {
    await sequelize.authenticate();
    console.log('Database connected...');
    // Use alter only in development; in production rely on migrations
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
    } else {
      await sequelize.sync();
    }
    console.log('Database synced.');

    if (process.env.DISABLE_REFRESH_JOB !== 'true') {
      refreshJob.start();
    }
  } catch (err) {
    console.error('Unable to connect to database:', err);
    console.warn('Starting server without database connectivity');
  }

  // Serve static client assets in production. On serverless platforms the
  // frontend is usually served by the platform itself; guard against a missing
  // build so requests never crash with a 500.
  // Note: Express 5 / path-to-regexp v8 no longer support `app.get('*')`,
  // so a plain middleware is used as the catch-all.
  if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
    const indexHtml = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      app.use(express.static(clientDistPath));
      app.use((req, res) => res.sendFile(indexHtml));
    } else {
      app.use((req, res) => {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ error: 'Not found' });
        }
        res.status(200).type('html').send(
          '<!doctype html><meta charset="utf-8"><title>Buffet API</title>' +
          '<h1>Buffet API läuft</h1><p>Frontend-Build (client/dist) ist nicht vorhanden. ' +
          'Führe <code>npm run build</code> im Projektstamm aus.</p>'
        );
      });
    }
  }

  // On Vercel/Lambda the platform imports this module and uses the exported
  // Express app as the handler — do not bind a port there.
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
};

startServer();

module.exports = app;
