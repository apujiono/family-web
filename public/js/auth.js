// public/js/auth.js
const API_URL = 'https://family-web-backend.up.railway.app';

// Tunggu DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('loginButton');
  const loginForm = document.getElementById('loginForm');

  if (loginButton && loginForm) {
    // Enable tombol kalau input valid
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    [emailInput, passwordInput].forEach(input => {
      input.addEventListener('input', () => {
        loginButton.disabled = !(emailInput.value && passwordInput.value);
      });
    });

    // Event listener untuk form submit
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await login();
    });
  } else {
    console.error('Login button or form not found in DOM');
  }
});

// Fungsi login
async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  // Validasi input
  if (!email || !password) {
    showToast('Email dan password harus diisi', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Login gagal, cek email atau password');
    }

    // Simpan data ke localStorage
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('currentUser', data.email);
    localStorage.setItem('family_code', data.family_code);
    
    // Track event Google Analytics
    queueGtagEvent('login_success', { event_category: 'auth', event_label: 'login' });
    
    // Redirect ke dashboard
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error('Login error:', error.message);
    showToast(error.message, 'error');
  }
}

// Fungsi logout
async function logout() {
  try {
    // Opsional: Kirim request ke backend untuk invalidate token
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
  } catch (error) {
    console.error('Logout error:', error.message);
  }
  
  // Clear localStorage
  localStorage.clear();
  queueGtagEvent('logout', { event_category: 'auth', event_label: 'logout' });
  window.location.href = 'index.html';
}

// Fungsi refresh token
async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    showToast('Sesi habis, silakan login ulang', 'error');
    window.location.href = 'index.html';
    return false;
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Gagal refresh token');
    }
    
    localStorage.setItem('token', data.token);
    return true;
  } catch (error) {
    console.error('Refresh token error:', error.message);
    showToast('Sesi habis, silakan login ulang', 'error');
    window.location.href = 'index.html';
    return false;
  }
}

// Fungsi toast untuk feedback
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 20px;
    border-radius: 5px;
    color: white;
    background: ${type === 'error' ? '#e74c3c' : '#2ecc71'};
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s;
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 100);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Fungsi dummy queueGtagEvent (sesuaikan kalau pake gtag asli)
function queueGtagEvent(eventName, params) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  } else {
    console.log('Gtag event:', eventName, params);
  }
}