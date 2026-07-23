const { Sequelize } = require('sequelize');
require('dotenv').config();

let config = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
    ...(process.env.DB_DIALECT === 'sqlite' ? { storage: process.env.SQLITE_STORAGE || ':memory:' } : {}),
  },
  test: {
    username: process.env.DB_USER_TEST,
    password: process.env.DB_PASS_TEST,
    database: process.env.DB_NAME_TEST,
    host: process.env.DB_HOST_TEST,
    port: process.env.DB_PORT_TEST ? parseInt(process.env.DB_PORT_TEST) : undefined,
    dialect: process.env.DB_DIALECT_TEST || 'postgres',
    logging: false,
  },
  production: {
    username: process.env.DB_USER_PROD,
    password: process.env.DB_PASS_PROD,
    database: process.env.DB_NAME_PROD,
    host: process.env.DB_HOST_PROD,
    port: process.env.DB_PORT_PROD ? parseInt(process.env.DB_PORT_PROD) : undefined,
    dialect: process.env.DB_DIALECT_PROD || 'postgres',
    logging: false,
  }
};

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  const env = process.env.NODE_ENV || 'development';
  const dbConfig = {
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    host: url.hostname,
    port: parseInt(url.port, 10),
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  };
  if (config[env]) {
    config[env] = dbConfig;
  } else {
    config.development = dbConfig;
    config.test = dbConfig;
    config.production = dbConfig;
  }
}

module.exports = config;
