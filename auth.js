let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });
let currentUser = null;

function authRedirectTarget() {
  const page = location.pathname.split('/').pop() || 'index.html';
  return encodeURIComponent(page + location.search + location.hash);
}

function requireAuth() {
  return authReady.then(user => {
    if (!user) {
      location.replace('login.html?next=' + authRedirectTarget());
      return null;
    }
    return user;
  });
}

function renderUserBar(user) {
  if (!user || document.getElementById('authUserBar')) return;
  const bar = document.createElement('div');
  bar.id = 'authUserBar';
  bar.className = 'auth-userbar';
  const label = document.createElement('div');
  label.innerHTML = `Signed in as <strong>${user.email || 'staff user'}</strong>`;
  const button = document.createElement('button');
  button.className = 'secondary small';
  button.textContent = 'Sign Out';
  button.onclick = async () => { await firebase.auth().signOut(); location.replace('login.html'); };
  bar.append(label, button);
  const nav = document.querySelector('nav');
  if (nav && nav.nextSibling) nav.parentNode.insertBefore(bar, nav.nextSibling); else document.body.prepend(bar);
}

firebase.auth().onAuthStateChanged(user => {
  currentUser = user || null;
  if (user) renderUserBar(user);
  authReadyResolve(currentUser);
});
