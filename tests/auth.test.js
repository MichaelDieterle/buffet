const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/server');
const { User } = require('../src/models');

// Mock User model
jest.mock('../src/models', () => {
  const actual = jest.requireActual('../src/models');
  return {
    ...actual,
    User: {
      findOne: jest.fn(),
      create: jest.fn(),
      findByPk: jest.fn(),
    },
    sequelize: {
      sync: jest.fn().mockResolvedValue(true),
      authenticate: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(true),
    },
  };
});

test('Auth API', async (t) => {
  await t.test('should register a new user', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      id: 1,
      username: 'testuser',
      role: 'user',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'password123',
      });
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.username, 'testuser');
  });
});
