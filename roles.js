let currentRole = null;
let currentProfile = null;

async function loadCurrentRole(){
  const user = await authReady;
  if(!user) return null;
  const snap = await db.collection('userProfiles').doc(user.uid).get();
  if(!snap.exists){
    currentRole = null; currentProfile = null;
    return null;
  }
  currentProfile = {id:snap.id,...snap.data()};
  currentRole = String(currentProfile.role||'').toLowerCase();
  return currentRole;
}

function allowedPagesForRole(role){
  const map = {
    admin: ['index.html','scanner.html','display.html','admin.html','students.html','history.html'],
    staff: ['index.html','scanner.html','display.html','admin.html'],
    scanner: ['scanner.html'],
    display: ['display.html']
  };
  return map[role] || [];
}

function applyRoleNavigation(role){
  const allowed = allowedPagesForRole(role);
  document.querySelectorAll('nav a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('?')[0].split('#')[0];
    if(!allowed.includes(href)) a.remove();
  });

  // Home-page action buttons use the same role filter.
  document.querySelectorAll('.home-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('?')[0].split('#')[0];
    if(!allowed.includes(href)) a.remove();
  });

  // A dedicated display device should not be offered an Admin back button.
  if(role === 'display'){
    document.querySelectorAll('a.display-back-btn').forEach(a => a.remove());
  }
}

async function requireRole(allowed){
  const user = await requireAuth();
  if(!user) return null;
  const role = await loadCurrentRole();
  if(!role || !allowed.includes(role)){
    document.body.innerHTML = `<div class="container"><div class="card"><h1>Access Restricted</h1><p>Your account is signed in but is not authorized for this page.</p><p>Assigned role: <strong>${role||'none'}</strong></p><p><a href="index.html">Return Home</a></p></div></div>`;
    return null;
  }
  applyRoleNavigation(role);
  return role;
}

async function initializeRoleHome(){
  const role = await requireRole(['admin','staff','scanner','display']);
  if(!role) return;
  if(role === 'scanner'){
    location.replace('scanner.html');
    return;
  }
  if(role === 'display'){
    location.replace('display.html');
    return;
  }
}

function roleLabel(){ return currentRole || 'unassigned'; }
