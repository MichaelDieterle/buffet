const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
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
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/stocks', stockRoutes);
app.use('/api/stocks', competitorRoutes); // mounts /:symbol/competitors under /api/stocks
app.use('/api/comparisons', comparisonRoutes);
app.use('/api/stocks', exportRoutes); // mounts /:symbol/export.csv under /api/stocks

// Test DB connection and start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');
    // Optionally sync models (use alter in production)
    await sequelize.sync({ alter: true });
    console.log('Database synced.');

    // Start background refresh job if not disabled
    if (process.env.DISABLE_REFRESH_JOB !== 'true') {
      refreshJob.start();
    }
  } catch (err) {
    console.error('Unable to connect to database:', err);
    console.warn('Starting server without database connectivity');
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Serve static client assets in production
  if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(clientDistPath));
    // All unknown routes should serve index.html (client-side routing)
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();

module.exports = app;

