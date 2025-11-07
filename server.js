require('dotenv').config();

const express = require('express');
const session = require('express-session');

const app = express();

// view engine
app.set('view engine', 'ejs');

// static files (public folder)
app.use(express.static('public'));

// body parsing for forms (minimal)
app.use(express.urlencoded({ extended: false }));

// simple session (koristit ću za prekidače i login kasnije)
const isProd = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET;

// Sigurnosne provjere
if (isProd && !SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production. Set it in Render environment variables.');
}
if (!isProd && !SESSION_SECRET) {
  console.warn('[WARN] SESSION_SECRET missing. Using weak fallback. Do NOT use in production.');
}

// Session middleware
app.use(session({
  secret: SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// ---- NEW: ensure toggles and user exist in session ----
app.use((req, res, next) => {
  if (!req.session.toggles) {
    // default: vulnerabilities enabled 
    req.session.toggles = { xss: true, bac: true };
  }
  if (!req.session.user) {
    // default guest user
    req.session.user = { username: null, role: 'guest' };
  }
  next();
});


// ------------------------------------------------------

// root ruta — prikazuje index.ejs iz views
app.get('/', (req, res) => {
  res.render('index', {
    user: req.session.user,
    toggles: req.session.toggles
  });
});



// POST handler za spremanje prekidača (checkbox)
app.post('/toggle', (req, res) => {
  // Checkbox šalje "on" kada je označen. Ako nije prisutan -> false.
  req.session.toggles.xss = !!req.body.xss;
  req.session.toggles.bac = !!req.body.bac;
  // nakon spremanja vratimo na home
  res.redirect('/');
});


// (kasnije ćemo dodati /login, /search, /user/accounts, /admin/accounts)
app.get('/login', (req, res) => {
  res.render('login', { user: req.session.user, error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  // simple demo credentials
  if (username === 'admin' && password === 'adminpwd') {
    req.session.user = { username: 'admin', role: 'admin' };
    return res.redirect('/');
  } else if (username === 'alice' && password === 'alicepwd') {
    req.session.user = { username: 'alice', role: 'user' };
    return res.redirect('/');
  }
  res.render('login', { user: req.session.user, error: 'Invalid credentials' });
});


app.get('/search', (req, res) => {
  const query = req.query.q;

  res.render('search', {
    user: req.session.user,
    xssEnabled: req.session.toggles.xss,
    query
  });
});

// Demo "baza" podataka (in-memory)
const accountsDB = {
  admin: [{ id: 1, name: 'Admin Account', balance: 10000 }],
  user: [{ id: 2, name: 'Alice', balance: 50 }, { id: 3, name: 'Bob', balance: 30 }]
};

// user accounts (sve dok je ruta dostupna za prikaz vlastitih user acc)
app.get('/user/accounts', (req, res) => {
  res.render('accounts', {
    user: req.session.user,
    accounts: accountsDB.user,
    which: 'user'
  });
});

// admin accounts (ovisi o toggles.bac)
app.get('/admin/accounts', (req, res) => {
  const bacEnabled = req.session.toggles && req.session.toggles.bac;

  if (bacEnabled) {
    // RANJIVO: bez provjere role -> svatko vidi admin račune
    return res.render('accounts', {
      user: req.session.user,
      accounts: accountsDB.admin,
      which: 'admin (vulnerable)'
    });
  }

  // SIGURNO: provjeri server-side role
  if (req.session.user && req.session.user.role === 'admin') {
    return res.render('accounts', {
      user: req.session.user,
      accounts: accountsDB.admin,
      which: 'admin (secure)'
    });
  }

  // ako nije admin i bac isključen -> 403
  return res.status(403).send(`
    <h2>403 Forbidden - You do not have access to this resource</h2>
    <p><a href="/">Back</a></p>
  `);
});


// POST logout - destroy session properly
app.post('/logout', (req, res) => {
  // destroy the session on the server
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
      // fallback: reset user and redirect
      req.session = null;
      return res.redirect('/');
    }
    // clear cookie on client
    res.clearCookie('connect.sid'); // default cookie name used by express-session
    return res.redirect('/');
  });
});

// OPTIONAL: convenience GET logout (less RESTful but handy during testing)
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    // ignore error, redirect anyway
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});


// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
