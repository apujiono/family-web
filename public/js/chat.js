const socket = io(API_URL, {
  auth: { token: localStorage.getItem('token') },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

async function loadChats() {
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/chat`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.status === 401) {
      if (await refreshToken()) return loadChats();
    }
    const chats = await res.json();
    document.getElementById('chatList').innerHTML = chats.map(chat => `<p>${chat.sender}: ${chat.message}</p>`).join('');
    queueGtagEvent('load_chats', { event_category: 'chat', event_label: 'chat_loaded' });
  });
}

async function sendMessage() {
  const message = document.getElementById('chatInput').value;
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ message })
    });
    if (res.status === 401) {
      if (await refreshToken()) return sendMessage();
    }
    document.getElementById('chatInput').value = '';
    queueGtagEvent('send_message_success', { event_category: 'chat', event_label: 'message_sent' });
  });
}

socket.on('chat_message', (chat) => {
  document.getElementById('chatList').innerHTML += `<p>${chat.sender}: ${chat.message}</p>`;
});

socket.on('reconnect', () => {
  queueGtagEvent('socket_reconnect', { event_category: 'stability', event_label: 'websocket_reconnected' });
  loadChats();
});

loadChats();