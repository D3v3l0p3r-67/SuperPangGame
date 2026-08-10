// Client-side gate only. This admin tool is a static page with no
// backend/database (see fsSave.js), so there is no way to check or store
// credentials securely -- anyone who can read this file's source can read
// the password. This exists to keep the admin tool out of casual view
// (e.g. someone poking at the site's other pages), not to protect it from
// anyone who actually looks. Don't deploy this folder somewhere the
// public can reach it expecting real protection. To change the login,
// just edit the two constants below.
const USERNAME = 'bos';
const PASSWORD = 'newpass';

const SESSION_KEY = 'balloonBusterAdmin.loggedIn';

export function checkLogin(user, pass) {
  return user === USERNAME && pass === PASSWORD;
}

export function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function setLoggedIn(value) {
  if (value) sessionStorage.setItem(SESSION_KEY, '1');
  else sessionStorage.removeItem(SESSION_KEY);
}
