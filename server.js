
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const app = express();
// simple session, za prekidače i login
const isProd = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET;


app.set('view engine', 'ejs');


app.use(express.static('public'));


app.use(express.urlencoded({ extended: false }));

// cookie-parser za signed cookies ( isti secret)
app.use(cookieParser(SESSION_SECRET || 'dev-secret-change-me'));



// Sigurnosne provjere
if (isProd && !SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production. Set it in Render environment variables.');
}
if (!isProd && !SESSION_SECRET) {
  console.warn('[WARN] SESSION_SECRET missing. Using weak fallback. Do NOT use in production.');
}

// session middleware
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

app.use((req, res, next) => {
  // 1) Pokušaj učitati prekidače iz signed cookie-ja
  let togglesFromCookie = null;
  try {
    if (req.signedCookies && req.signedCookies.toggles) {
      togglesFromCookie = JSON.parse(req.signedCookies.toggles);
    }
  } catch (e) {
    // ako je cookie oštećen, ignoriramo
    togglesFromCookie = null;
  }

  // 2) Ako u sessionu nema prekidača -  uzmi iz cookieja ili postavi default
  if (!req.session.toggles) {
    req.session.toggles = togglesFromCookie || { xss: true, bac: true };
  }

  // 3) Ako nema user-a u sessionu - guest
  if (!req.session.user) {
    req.session.user = { username: null, role: 'guest' };
  }

  next();
});




// root ruta index.ejs iz views
app.get('/', (req, res) => {
  res.render('index', {
    user: req.session.user,
    toggles: req.session.toggles
  });
});



// POST handler za spremanje prekidača (checkbox)
app.post('/toggle', (req, res) => {
  const newToggles = {
    xss: !!req.body.xss,
    bac: !!req.body.bac
  };

  // spremi u session
  req.session.toggles = newToggles;

  // spremi i u signed cookie (30 dana)
  res.cookie('toggles', JSON.stringify(newToggles), {
    httpOnly: true,           // nije dostupno JS-u u pregledniku 
    signed: true,             // potpisan cookie
    sameSite: 'lax',
    secure: isProd,           // na Renderu je HTTPS true
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30 dana
  });

  res.redirect('/');
});


app.get('/login', (req, res) => {
  res.render('login', { user: req.session.user, error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  // jednostavno za demo
  if (username === 'admin' && password === 'adminpwd') {
    req.session.user = { username: 'admin', role: 'admin' };
    return res.redirect('/');
  } else if (username === 'alice' && password === 'alicepwd') {
    req.session.user = { username: 'alice', role: 'user' };
    return res.redirect('/');
  }
  res.render('login', { user: req.session.user, error: 'Invalid credentials' });
});



// Demo baza podataka (in-memory)
const accountsDB = {
  admin: [{ id: 1, name: 'Admin Account', balance: 10000 }],
  user: [{ id: 2, name: 'Alice', balance: 50 }, { id: 3, name: 'Bob', balance: 30 }]
};

// in-memory poruke za pohranjeni XSS demo
const messages = []; // svaki element: { id: number, text: string, author: string }
let nextMessageId = 1;


// user accounts
app.get('/user/accounts', (req, res) => {
  res.render('accounts', {
    user: req.session.user,
    accounts: accountsDB.user,
    which: 'user'
  });
});

// admin accounts (ovisi o prekidačima)
app.get('/admin/accounts', (req, res) => {
  const bacEnabled = req.session.toggles && req.session.toggles.bac;

  if (bacEnabled) {
    // RANJIVO: bez provjere uloge -> svatko vidi admin račune
    return res.render('accounts', {
      user: req.session.user,
      accounts: accountsDB.admin,
      which: 'admin (vulnerable)'
    });
  }

  // SIGURNO: provjeri uloge
  if (req.session.user && req.session.user.role === 'admin') {
    return res.render('accounts', {
      user: req.session.user,
      accounts: accountsDB.admin,
      which: 'admin (secure)'
    });
  }

  // ako nije admin i prekidač isključen -> 403
  return res.status(403).send(`
    <h2>403 Forbidden - You do not have access to this resource</h2>
    <p><a href="/">Back</a></p>
  `);
});


// POST logout - uništi session pravilno
app.post('/logout', (req, res) => {
  // na serveru
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
      // fallback: reset user and redirect
      req.session = null;
      return res.redirect('/');
    }
    // očisti cookie na klijentu
    res.clearCookie('connect.sid'); // default cookie name used by express-session
    return res.redirect('/');
  });
});


app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    // ignoriaj error, redirect anyway
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});


// POST: submit message  from messages page
app.post('/messages', (req, res) => {
  const text = req.body.message || '';
  const author = (req.session.user && req.session.user.username) || 'guest';

  // jednist pohranjivanje — no sanitization (namjerno ranjivo kad je xss toggle upaljen)
  messages.push({ id: nextMessageId++, text, author });

  res.redirect('/messages');
});

// GET: vidi pohranjene poruke
app.get('/messages', (req, res) => {
  res.render('messages', {
    user: req.session.user,
    toggles: req.session.toggles,
    messages
  });
});


// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
