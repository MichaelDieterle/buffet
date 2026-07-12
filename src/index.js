const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
// Trim DATABASE_URL to avoid whitespace/newline issues
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.trim();
}
console.log('DB URL present?', !!process.env.DATABASE_URL);

const { sequelize } = require('./models');
const stockRoutes = require('./routes/stocks');
const competitorRoutes = require('./routes/competitors');
const comparisonRoutes = require('./routes/comparisons');
const exportRoutes = require('./routes/export');
const refreshJob = require('./services/refreshJob');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/stocks', stockRoutes);
app.use('/api/stocks', competitorRoutes); // nested under stocks? we defined /:symbol/competitors
app.use('/api/comparisons', comparisonRoutes);
app.use('/api/stocks', exportRoutes); // nested under /:symbol/export.csv

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Stock Tracking API is running' });
});

// Sync DB and start server
const startServer = async () => {
  let dbConnected = false;
  try {
    // Adjust: set force: false in production
    await sequelize.authenticate();
    console.log('Database connection established.');
    // Uncomment next line if you want to sync models (creates tables if not exist)
    await sequelize.sync({ alter: true }); // use alter to adjust columns without dropping
    console.log('Database synced.');
    dbConnected = true;

    if (process.env.DISABLE_REFRESH_JOB !== 'true') {
      refreshJob.start();
    }
  } catch (err) {
    console.error('Unable to connect to database:', err);
    console.warn('Starting server without database connectivity');
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
