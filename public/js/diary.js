async function saveDiary() {
  const text = document.getElementById('diaryText').value;
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/diary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ text })
    });
    if (res.status === 401) {
      if (await refreshToken()) return saveDiary();
    }
    document.getElementById('diaryText').value = '';
    loadDiaries();
    queueGtagEvent('save_diary_success', { event_category: 'diary', event_label: 'diary_saved' });
  });
}

async function suggestDiary() {
  const prompt = 'Berikan saran singkat untuk entri diary keluarga (maks 20 kata).';
  queueGtagEvent('diary_suggestion', { event_category: 'diary', event_label: 'ai_suggestion' });
  await retryFetch(async () => {
    const res = await fetch('https://api.x.ai/grok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    document.getElementById('diaryText').value = data.response;
    queueGtagEvent('diary_suggestion_success', { event_category: 'diary', event_label: 'suggestion_applied' });
  });
}

async function loadDiaries() {
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/diary`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.status === 401) {
      if (await refreshToken()) return loadDiaries();
    }
    const diaries = await res.json();
    document.getElementById('diaryList').innerHTML = diaries.map(diary => `<p>${diary.author}: ${diary.text}</p>`).join('');
    queueGtagEvent('load_diaries', { event_category: 'diary', event_label: 'diaries_loaded' });
  });
}

loadDiaries();