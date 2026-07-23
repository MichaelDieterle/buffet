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

  // Serve static client assets in production
  if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(clientDistPath));
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
