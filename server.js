const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { sequelize } = require('./src/models');
const stockRoutes = require('./src/routes/stocks');
const competitorRoutes = require('./src/routes/competitors');
const comparisonRoutes = require('./src/routes/comparisons');
const exportRoutes = require('./src/routes/export');
const refreshJob = require('./src/services/refreshJob');

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
  try {
    // Adjust: set force: false in production
    await sequelize.authenticate();
    console.log('Database connection established.');
    // Uncomment next line if you want to sync models (creates tables if not exist)
    await sequelize.sync({ alter: true }); // use alter to adjust columns without dropping
    console.log('Database synced.');

    if (process.env.DISABLE_REFRESH_JOB !== 'true') {
      refreshJob.start();
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Unable to start server:', err);
    process.exit(1);
  }
};

startServer();
