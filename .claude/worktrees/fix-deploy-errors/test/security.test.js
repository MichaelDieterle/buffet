const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../src/models');
const validate = require('../src/middleware/validate');
const { authenticate, isAdmin } = require('../src/middleware/auth');
const errorHandler = require('../src/middleware/errorHandler');
const schemas = require('../src/middleware/schemas');

// Mock the User model to avoid DB connection in unit tests

// I'll manually mock the User model's methods
const mockUser = {
  id: 1,
  username: 'testuser',
  role: 'user',
};
const mockAdmin = {
  id: 2,
  username: 'adminuser',
  role: 'admin',
};

// Use a temporary app for testing middleware
function createTestApp(routes) {
  const app = express();
  app.use(express.json());
  routes(app);
  app.use(errorHandler);
  return app;
}

test('Validation middleware', async (t) => {
  await t.test('should return 400 for invalid body', async () => {
    const app = createTestApp((app) => {
      app.post('/test', validate({ body: schemas.createStock }), (req, res) => res.status(200).json({ success: true }));
    });

    const res = await request(app).post('/test').send({ symbol: '' }); // symbol is required
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation failed');
    assert.ok(Array.isArray(res.body.details));
  });

  await t.test('should return 200 for valid body', async () => {
    const app = createTestApp((app) => {
      app.post('/test', validate({ body: schemas.createStock }), (req, res) => res.status(200).json({ success: true }));
    });

    const res = await request(app).post('/test').send({ symbol: 'AAPL', name: 'Apple' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});

test('Authentication middleware', async (t) => {
  const SECRET = process.env.JWT_SECRET || 'super-secret-key';

  // Mock User.findByPk
  const originalFindByPk = User.findByPk;

  await t.test('should return 401 if no token provided', async () => {
    const app = createTestApp((app) => {
      app.get('/test', authenticate, (req, res) => res.status(200).json({ success: true }));
    });

    const res = await request(app).get('/test');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'No token provided');
  });

  await t.test('should return 401 for invalid token', async () => {
    const app = createTestApp((app) => {
      app.get('/test', authenticate, (req, res) => res.status(200).json({ success: true }));
    });

    const res = await request(app).get('/test').set('Authorization', 'Bearer invalid-token');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid or expired token');
  });

  await t.test('should return 200 for valid token', async () => {
    User.findByPk = async (id) => (id === 1 ? mockUser : null);

    const token = jwt.sign({ id: 1, role: 'user' }, SECRET);
    const app = createTestApp((app) => {
      app.get('/test', authenticate, (req, res) => res.status(200).json({ success: true }));
    });

    const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    User.findByPk = originalFindByPk;
  });
});

test('Role-based access (isAdmin)', async (t) => {
  const SECRET = process.env.JWT_SECRET || 'super-secret-key';
  const originalFindByPk = User.findByPk;

  await t.test('should return 403 for non-admin user', async () => {
    User.findByPk = async (id) => (id === 1 ? mockUser : null);
    const token = jwt.sign({ id: 1, role: 'user' }, SECRET);

    const app = createTestApp((app) => {
      app.get('/test', authenticate, isAdmin, (req, res) => res.status(200).json({ success: true }));
    });

    const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Forbidden: Admin access required');

    User.findByPk = originalFindByPk;
  });

  await t.test('should return 200 for admin user', async () => {
    User.findByPk = async (id) => (id === 2 ? mockAdmin : null);
    const token = jwt.sign({ id: 2, role: 'admin' }, SECRET);

    const app = createTestApp((app) => {
      app.get('/test', authenticate, isAdmin, (req, res) => res.status(200).json({ success: true }));
    });

    const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    User.findByPk = originalFindByPk;
  });
});
