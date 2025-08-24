flatpickr('#eventDate', {
  enableTime: true,
  dateFormat: 'Y-m-d H:i',
  onChange: () => queueGtagEvent('select_date', { event_category: 'event', event_label: 'date_selected' })
});

async function createEvent() {
  const date = document.getElementById('eventDate').value;
  const title = document.getElementById('eventTitle').value;
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ date, title })
    });
    if (res.status === 401) {
      if (await refreshToken()) return createEvent();
    }
    document.getElementById('eventDate').value = '';
    document.getElementById('eventTitle').value = '';
    loadEvents();
    queueGtagEvent('create_event_success', { event_category: 'event', event_label: 'event_created' });
  });
}

async function loadEvents() {
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/event`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.status === 401) {
      if (await refreshToken()) return loadEvents();
    }
    const events = await res.json();
    document.getElementById('eventList').innerHTML = events.map(event => `
      <p style="color: ${event.type === 'birthday' ? 'red' : 'blue'}">${event.title} - ${event.date}</p>
    `).join('');
    queueGtagEvent('load_events', { event_category: 'event', event_label: 'events_loaded' });
  });
}

loadEvents();