const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const validate = require('../src/middleware/validate');
const errorHandler = require('../src/middleware/errorHandler');
const schemas = require('../src/middleware/schemas');

function createTestApp(routes) {
  const app = express();
  app.use(express.json());
  routes(app);
  app.use(errorHandler);
  return app;
}

test('Validation middleware', async (t) => {
  await t.test('rejects invalid stock payloads', async () => {
    const app = createTestApp((app) => {
      app.post('/test', validate({ body: schemas.createStock }), (req, res) => res.status(200).json({ success: true }));
    });
    const res = await request(app).post('/test').send({ symbol: '' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation failed');
    assert.ok(Array.isArray(res.body.details));
  });

  await t.test('accepts valid stock payloads', async () => {
    const app = createTestApp((app) => {
      app.post('/test', validate({ body: schemas.createStock }), (req, res) => res.status(200).json({ success: true }));
    });
    const res = await request(app).post('/test').send({ symbol: 'AAPL', name: 'Apple' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});
