let eventQueue = [];

async function retryFetch(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) {
        queueGtagEvent('api_failure', { event_category: 'error', event_label: err.message });
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

function queueGtagEvent(event, params) {
  eventQueue.push({ event, params });
  if (eventQueue.length >= 5) {
    flushGtagQueue();
  }
}

function flushGtagQueue() {
  eventQueue.forEach(({ event, params }) => gtag('event', event, params));
  eventQueue = [];
}

setInterval(flushGtagQueue, 1000);

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position: fixed; bottom: 20px; background: #00FFFF; color: #001F3F; padding: 10px;';
  document.body.appendChild(toast);
  speak(message);
  setTimeout(() => toast.remove(), 3000);
}

function speak(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = localStorage.getItem('language') || 'id-ID';
    window.speechSynthesis.speak(utterance);
    queueGtagEvent('voice_feedback', { event_category: 'ui', event_label: text });
  }
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
  queueGtagEvent('dark_mode_toggle', { event_category: 'ui', event_label: document.body.classList.contains('dark-mode') ? 'dark' : 'light' });
}

function toggleAccessibility() {
  document.body.classList.toggle('accessibility');
  localStorage.setItem('accessibility', document.body.classList.contains('accessibility'));
  queueGtagEvent('accessibility_toggle', { event_category: 'ui', event_label: 'accessibility_mode' });
}

function checkQuiz(answer) {
  if (answer === 'chat') {
    showToast('Benar! Chat untuk kirim pesan.');
    localStorage.setItem('quizCompleted', 'true');
    document.getElementById('onboardingQuiz').style.display = 'none';
    queueGtagEvent('quiz_completed', { event_category: 'ui', event_label: 'onboarding_quiz' });
  } else {
    showToast('Coba lagi!');
  }
}