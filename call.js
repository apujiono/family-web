// URL backend (ganti dengan URL Railway Anda setelah deploy)
const API_URL = 'family-web-production.up.railway.app';

// Inisialisasi Socket.io untuk signaling
const socket = io(API_URL, {
  auth: { token: localStorage.getItem('token') },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

// Variabel global untuk WebRTC
let peerConnections = {};
let localStream;
let callId;

// Konfigurasi WebRTC dengan OpenRelay TURN server (gratis)
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject', secure: true }
  ]
};

// Mulai panggilan grup (1-4 user)
async function startGroupCall() {
  const targetEmails = Array.from(document.getElementById('callTarget').selectedOptions).map(opt => opt.value);
  if (!targetEmails.length) {
    showToast('Pilih minimal 1 anggota!');
    return;
  }
  if (targetEmails.length > 3) {
    showToast('Maksimal 4 anggota untuk panggilan grup!');
    return;
  }
  queueGtagEvent('group_call_start', { event_category: 'call', event_label: 'group_call_attempt' });
  
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ targetEmails, family_code: localStorage.getItem('family_code') })
    });
    if (res.status === 401) {
      if (await refreshToken()) return startGroupCall();
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    callId = data.callId;
    await initGroupWebRTC(targetEmails);
    queueGtagEvent('call_start_success', { event_category: 'call', event_label: 'call_initiated' });
  });
}

// Inisialisasi WebRTC untuk panggilan grup
async function initGroupWebRTC(targetEmails) {
  try {
    // Cek bandwidth untuk fallback audio-only di jaringan lemah
    const isLowBandwidth = navigator.connection && navigator.connection.downlink < 0.5;
    localStream = await navigator.mediaDevices.getUserMedia({
      video: isLowBandwidth ? false : { width: 640, height: 480, facingMode: 'user' },
      audio: true
    });
    document.getElementById('localVideo').srcObject = localStream;
    document.getElementById('callContainer').style.display = 'block';
    if (isLowBandwidth) {
      showToast('Jaringan lemah, menggunakan audio-only');
      queueGtagEvent('low_bandwidth_mode', { event_category: 'call', event_label: 'audio_only' });
    }

    // Setup peer connection untuk setiap target
    targetEmails.forEach(email => {
      peerConnections[email] = new RTCPeerConnection(configuration);
      
      // Tambah track lokal ke peer
      localStream.getTracks().forEach(track => peerConnections[email].addTrack(track, localStream));

      // Tampilkan stream remote
      peerConnections[email].ontrack = (event) => {
        const video = document.createElement('video');
        video.srcObject = event.streams[0];
        video.autoplay = true;
        video.id = `remote-${email}`;
        document.getElementById('remoteVideos').appendChild(video);
        queueGtagEvent('remote_stream_added', { event_category: 'call', event_label: `remote_${email}` });
      };

      // Kirim ICE candidates
      peerConnections[email].onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { callId, candidate: event.candidate, to: email });
        }
      };

      // Retry ICE jika gagal
      peerConnections[email].oniceconnectionstatechange = () => {
        if (peerConnections[email].iceConnectionState === 'disconnected') {
          peerConnections[email].restartIce();
          queueGtagEvent('ice_retry', { event_category: 'call', event_label: 'ice_failure_retry' });
        }
      };

      // Atur bitrate untuk jaringan lemah
      peerConnections[email].getSenders().forEach(sender => {
        if (sender.track.kind === 'video') {
          sender.setParameters({ encodings: [{ maxBitrate: isLowBandwidth ? 100000 : 500000 }] });
        }
      });

      // Kirim offer ke target
      peerConnections[email].createOffer().then(offer => {
        peerConnections[email].setLocalDescription(offer);
        socket.emit('offer', { callId, offer, to: email });
      });
    });
  } catch (err) {
    showToast('Gagal memulai panggilan: ' + err.message);
    queueGtagEvent('call_error', { event_category: 'call', event_label: err.message });
  }
}

// Handle offer dari user lain
socket.on('offer', async ({ callId: incomingCallId, offer, to }) => {
  if (callId !== incomingCallId || to !== localStorage.getItem('currentUser')) return;
  try {
    const peer = peerConnections[to] || new RTCPeerConnection(configuration);
    peerConnections[to] = peer;
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit('answer', { callId, answer, to });
    queueGtagEvent('offer_received', { event_category: 'call', event_label: 'offer_handled' });
  } catch (err) {
    queueGtagEvent('offer_error', { event_category: 'call', event_label: err.message });
  }
});

// Handle answer dari user lain
socket.on('answer', ({ callId: incomingCallId, answer, to }) => {
  if (callId === incomingCallId && peerConnections[to]) {
    peerConnections[to].setRemoteDescription(new RTCSessionDescription(answer));
    queueGtagEvent('answer_received', { event_category: 'call', event_label: 'answer_handled' });
  }
});

// Handle ICE candidate
socket.on('ice-candidate', ({ callId: incomingCallId, candidate, to }) => {
  if (callId === incomingCallId && peerConnections[to]) {
    peerConnections[to].addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
      queueGtagEvent('ice_candidate_error', { event_category: 'call', event_label: err.message });
    });
  }
});

// Handle panggilan masuk
socket.on('call_incoming', ({ callId: incomingCallId, from }) => {
  showToast(`Panggilan masuk dari ${from}`);
  callId = incomingCallId;
  initGroupWebRTC([from]);
  queueGtagEvent('call_incoming', { event_category: 'call', event_label: `incoming_from_${from}` });
});

// Akhiri panggilan
async function endCall() {
  Object.values(peerConnections).forEach(peer => peer.close());
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  peerConnections = {};
  document.getElementById('callContainer').style.display = 'none';
  document.getElementById('remoteVideos').innerHTML = '';
  socket.emit('end_call', { callId });
  await fetch(`${API_URL}/calls/${callId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ status: 'ended', ended_at: new Date() })
  });
  queueGtagEvent('call_end', { event_category: 'call', event_label: 'call_ended' });
}

// Request izin kamera/mikrofon
async function requestPermissions() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('permissionPrompt').style.display = 'none';
    queueGtagEvent('permission_granted', { event_category: 'call', event_label: 'permissions_allowed' });
  } catch (err) {
    showToast('Izin ditolak, cek pengaturan browser');
    queueGtagEvent('permission_denied', { event_category: 'call', event_label: err.message });
  }
}

// Load daftar user untuk panggilan
async function loadCallTargets() {
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/users`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.status === 401) {
      if (await refreshToken()) return loadCallTargets();
    }
    const users = await res.json();
    console.log('Users loaded:', users); // Debug friend list
    const select = document.getElementById('callTarget');
    select.innerHTML = '<option value="">Pilih anggota</option>';
    users.forEach(user => {
      if (user.email !== localStorage.getItem('currentUser')) {
        select.innerHTML += `<option value="${user.email}">${user.email}</option>`;
      }
    });
    queueGtagEvent('load_call_targets', { event_category: 'call', event_label: 'targets_loaded' });
  });
}

// Inisialisasi saat halaman load
loadCallTargets();