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
    }),
  }),
  login: z.object({
    body: z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }),
  }),
};

// POST /api/auth/register
router.post('/register', validate(authSchemas.register), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(400).json({ error: 'Username already taken' });

    const user = await User.create({ username, password });
    res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', validate(authSchemas.login), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// GET /api/auth/google/callback
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const user = req.user;
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Redirect back to frontend with token in query param
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
);

module.exports = router;
