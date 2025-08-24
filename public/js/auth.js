const API_URL = 'https://family-web-backend.up.railway.app';

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('currentUser', data.email);
    localStorage.setItem('family_code', data.family_code);
    queueGtagEvent('login_success', { event_category: 'auth', event_label: 'login' });
    window.location.href = 'dashboard.html';
  });
}

async function logout() {
  localStorage.clear();
  queueGtagEvent('logout', { event_category: 'auth', event_label: 'logout' });
  window.location.href = 'index.html';
}

async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  try {
    const res = await fetch(`${API_URL}/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    localStorage.setItem('token', data.token);
    return true;
  } catch (err) {
    showToast('Sesi habis, silakan login ulang');
    window.location.href = 'index.html';
    return false;
  }
}