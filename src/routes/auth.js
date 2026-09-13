const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const validate = require('../middleware/validate');
const { z } = require('zod');
const passport = require('../config/passport');
const router = express.Router();

const authSchemas = {
  register: z.object({
    body: z.object({
      username: z.string().min(3).max(30),
      password: z.string().min(6),
      role: z.enum(['user', 'admin']).optional(),
    }),
  }),
  login: z.object({
    body: z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }),
  }),
};

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    { id: user.id, role: user.role },
    secret,
    { expiresIn: '24h' }
  );
}

// POST /api/auth/register
router.post('/register', validate(authSchemas.register), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(400).json({ error: 'Username already taken' });

    // Never allow a public request to create an administrator account.
    const user = await User.create({ username, password, role: 'user' });
    res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', validate(authSchemas.login), async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error('[auth] login failed:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// GET /api/auth/google/callback
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    try {
      const token = signToken(req.user);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const target = new URL('/auth/callback', frontendUrl);
      target.searchParams.set('token', token);
      res.redirect(target.toString());
    } catch (err) {
      console.error('[auth] google callback failed:', err.message);
      res.status(500).json({ error: 'Authentication configuration error' });
    }
  }
);

module.exports = router;
