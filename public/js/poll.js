async function createPoll() {
  const question = document.getElementById('pollQuestion').value;
  const options = document.getElementById('pollOptions').value.split(',');
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ question, options })
    });
    if (res.status === 401) {
      if (await refreshToken()) return createPoll();
    }
    document.getElementById('pollQuestion').value = '';
    document.getElementById('pollOptions').value = '';
    loadPolls();
    queueGtagEvent('create_poll_success', { event_category: 'poll', event_label: 'poll_created' });
  });
}

async function loadPolls() {
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/poll`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.status === 401) {
      if (await refreshToken()) return loadPolls();
    }
    const polls = await res.json();
    document.getElementById('pollList').innerHTML = polls.map(poll => `
      <p>${poll.question}</p>
      <select onchange="votePoll('${poll._id}', this.value)">
        ${poll.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
      </select>
    `).join('');
    queueGtagEvent('load_polls', { event_category: 'poll', event_label: 'polls_loaded' });
  });
}

async function votePoll(pollId, option) {
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/poll/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ pollId, option })
    });
    if (res.status === 401) {
      if (await refreshToken()) return votePoll(pollId, option);
    }
    loadPolls();
    queueGtagEvent('vote_poll_success', { event_category: 'poll', event_label: 'poll_voted' });
  });
}

loadPolls();