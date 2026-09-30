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

async function requireRole(allowed){
  const user = await requireAuth();
  if(!user) return null;
  const role = await loadCurrentRole();
  if(!role || !allowed.includes(role)){
    document.body.innerHTML = `<div class="container"><div class="card"><h1>Access Restricted</h1><p>Your account is signed in but is not authorized for this page.</p><p>Assigned role: <strong>${role||'none'}</strong></p><p><a href="index.html">Return Home</a></p></div></div>`;
    return null;
  }
  return role;
}

function roleLabel(){ return currentRole || 'unassigned'; }
