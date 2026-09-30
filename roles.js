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

function updateRoleIndicator(role){
  const bar = document.getElementById('authUserBar');
  if(!bar) return;
  let badge = document.getElementById('authRoleBadge');
  if(!badge){
    badge = document.createElement('span');
    badge.id = 'authRoleBadge';
    badge.className = 'role-badge';
    const label = bar.firstElementChild;
    if(label) label.appendChild(badge);
  }
  badge.textContent = ` | Role: ${String(role || 'unassigned').replace(/^./, c => c.toUpperCase())}`;
}

function applyRoleNavigation(role){
  const nav = document.querySelector('nav');
  const navItems = {
    admin: [
      ['index.html','Home'], ['scanner.html','Scanner'], ['display.html','Display'],
      ['admin.html','Admin'], ['students.html','Students & QR'], ['history.html','History']
    ],
    staff: [
      ['index.html','Home'], ['scanner.html','Scanner'], ['display.html','Display'], ['admin.html','Admin']
    ],
    scanner: [['scanner.html','Scanner']],
    display: [['display.html','Display']]
  };

  // Rebuild navigation from the authenticated role instead of merely hiding links.
  // This prevents privileged links from remaining visible if the original page markup changes.
  if(nav){
    const currentPage = location.pathname.split('/').pop() || 'index.html';
    nav.innerHTML = '';
    (navItems[role] || []).forEach(([href,label]) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      if(currentPage === href) a.className = 'active';
      nav.appendChild(a);
    });
  }

  updateRoleIndicator(role);

  const allowed = allowedPagesForRole(role);
  document.querySelectorAll('.home-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('?')[0].split('#')[0];
    if(!allowed.includes(href)) a.remove();
  });

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
