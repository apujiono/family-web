const API_URL = 'https://family-web-production.up.railway.app/api/auth';

document.addEventListener('DOMContentLoaded', () => {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    const loginButton = document.getElementById('loginButton');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    [emailInput, passwordInput].forEach(input => {
      input.addEventListener('input', () => {
        loginButton.disabled = !(emailInput.value.trim() && passwordInput.value);
      });
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Login button clicked');
      await login();
    });
  }

  // Register form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    const registerButton = document.getElementById('registerButton');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const familyCodeInput = document.getElementById('family_code');
    
    [emailInput, passwordInput].forEach(input => {
      input.addEventListener('input', () => {
        registerButton.disabled = !(emailInput.value.trim() && passwordInput.value);
      });
    });

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Register button clicked');
      await register();
    });
  }
});

async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  console.log('Attempting login with:', { email });
  if (!email || !password) {
    showToast('Email dan password harus diisi', 'error');
    return;
  }

  try {
    console.log('Fetching:', `${API_URL}/login`);
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    console.log('Response status:', res.status);
    const data = await res.json();
    
    if (!res.ok) {
      console.log('Response error:', data);
      throw new Error(data.error || 'Login gagal, cek email atau password');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('currentUser', data.email);
    localStorage.setItem('family_code', data.family_code);
    
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error('Login fetch error:', error.message);
    showToast(error.message, 'error');
  }
}

async function register() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const family_code = document.getElementById('family_code').value.trim();
  
  console.log('Attempting register with:', { email });
  if (!email || !password) {
    showToast('Email dan password harus diisi', 'error');
    return;
  }

  try {
    console.log('Fetching:', `${API_URL}/register`);
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, family_code })
    });
    
    console.log('Response status:', res.status);
    const data = await res.json();
    
    if (!res.ok) {
      console.log('Response error:', data);
      throw new Error(data.error || 'Pendaftaran gagal');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('currentUser', data.email);
    localStorage.setItem('family_code', data.family_code);
    
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error('Register fetch error:', error.message);
    showToast(error.message, 'error');
  }
}

async function logout() {
  try {
    console.log('Fetching:', `${API_URL}/logout`);
    await fetch(`${API_URL}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
  } catch (error) {
    console.error('Logout error:', error.message);
  }
  
  localStorage.clear();
  window.location.href = 'index.html';
}

async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    showToast('Sesi habis, silakan login ulang', 'error');
    window.location.href = 'index.html';
    return false;
  }

  try {
    console.log('Fetching:', `${API_URL}/refresh-token`);
    const res = await fetch(`${API_URL}/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      console.log('Refresh token error:', data);
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