const { Sequelize } = require('sequelize');
require('dotenv').config();

const config = {
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

module.exports = config;