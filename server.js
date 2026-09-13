const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

const config = require('./config');
const User = require('./models/User');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Konek MongoDB
mongoose.connect(config.MONGO_URI)
  .then(() => console.log('MongoDB Terhubung'))
  .catch(err => console.error('MongoDB Error:', err));

// Express Session
app.use(session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: config.MONGO_URI })
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Helper function pembuat API Key acak
function generateApiKey() {
  return 'CYAN-' + crypto.randomBytes(12).toString('hex').toUpperCase();
}

// --- PASSPORT STRATEGIES ---

// 1. Local Strategy
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const user = await User.findOne({ username });
    if (!user) return done(null, false, { message: 'Username tidak ditemukan' });
    if (!user.password) return done(null, false, { message: 'Silakan login menggunakan OAuth (Google/GitHub)' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return done(null, false, { message: 'Password salah' });

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// 2. Google Strategy
passport.use(new GoogleStrategy({
  clientID: config.GOOGLE_CLIENT_ID,
  clientSecret: config.GOOGLE_CLIENT_SECRET,
  callbackURL: `${config.BASE_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ providerId: profile.id, authProvider: 'google' });
    if (!user) {
      user = await User.create({
        username: profile.displayName.replace(/\s+/g, '_').toLowerCase() + '_' + Math.floor(1000 + Math.random() * 9000),
        email: profile.emails ? profile.emails[0].value : null,
        authProvider: 'google',
        providerId: profile.id,
        apiKey: generateApiKey()
      });
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// 3. GitHub Strategy
passport.use(new GitHubStrategy({
  clientID: config.GITHUB_CLIENT_ID,
  clientSecret: config.GITHUB_CLIENT_SECRET,
  callbackURL: `${config.BASE_URL}/auth/github/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ providerId: profile.id, authProvider: 'github' });
    if (!user) {
      user = await User.create({
        username: profile.username || 'gh_' + Math.floor(1000 + Math.random() * 9000),
        email: profile.emails ? profile.emails[0].value : null,
        authProvider: 'github',
        providerId: profile.id,
        apiKey: generateApiKey()
      });
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// --- ROUTING AUTH ---

// Register Local
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ status: false, message: 'Username sudah digunakan' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      password: hashedPassword,
      authProvider: 'local',
      apiKey: generateApiKey()
    });

    req.login(newUser, (err) => {
      if (err) return res.status(500).json({ status: false, message: 'Gagal Auto-login' });
      return res.json({ status: true, message: 'Registrasi Berhasil' });
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

// Login Local
app.post('/auth/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!user) return res.status(400).json({ status: false, message: info.message });
    req.login(user, (err) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      return res.json({ status: true, message: 'Login Berhasil' });
    });
  })(req, res, next);
});

// Auth OAuth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { successRedirect: '/profile.html', failureRedirect: '/home.html' }));

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback', passport.authenticate('github', { successRedirect: '/profile.html', failureRedirect: '/home.html' }));

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/home.html');
  });
});

// User Profile Data API
app.get('/api/user/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ status: false, message: 'Belum login' });
  res.json({ status: true, user: req.user });
});

// Upgrade Plan User
app.post('/api/user/upgrade', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ status: false, message: 'Belum login' });
  const { plan } = req.body; // 'premium' / 'vip'

  if (!['premium', 'vip'].includes(plan)) {
    return res.status(400).json({ status: false, message: 'Plan tidak valid' });
  }

  const user = await User.findById(req.user.id);
  user.plan = plan;
  user.limit = plan === 'vip' ? 999999 : 5000;
  await user.save();

  res.json({ status: true, message: `Sukses upgrade ke plan ${plan.toUpperCase()}`, user });
});

// --- API ROUTES ---
app.use('/api/download/tiktok', require('./routes/api/download/tiktok'));

// Default HTML Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));

if (process.env.NODE_ENV !== 'production') {
  app.listen(config.PORT, () => {
    console.log(`Server lokal berjalan pada http://localhost:${config.PORT}`);
  });
}

module.exports = app;
