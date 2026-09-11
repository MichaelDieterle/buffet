const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find or create user based on googleId
        let user = await User.findOne({ where: { googleId: profile.id } });

        if (!user) {
          // Create new user
          // We use the google profile email as username
          user = await User.create({
            username: profile.emails[0].value,
            googleId: profile.id,
            role: 'user'
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));
} else {
  console.warn('[Passport] Google OAuth credentials missing. Google login will be disabled.');
}

module.exports = passport;
