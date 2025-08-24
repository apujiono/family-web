const socket = io(API_URL, { auth: { token: localStorage.getItem('token') } });
let peerConnections = {};
let localStream;
let callId;

async function startGroupCall() {
  const targetEmails = Array.from(document.getElementById('callTarget').selectedOptions).map(opt => opt.value);
  if (!targetEmails.length) return showToast('Pilih minimal 1 anggota!');
  queueGtagEvent('group_call_start', { event_category: 'call', event_label: 'group_call' });
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
    initGroupWebRTC(targetEmails);
    queueGtagEvent('call_start_success', { event_category: 'call', event_label: 'call_initiated' });
  });
}

async function initGroupWebRTC(targetEmails) {
  const isLowBandwidth = navigator.connection && navigator.connection.downlink < 0.5;
  localStream = await navigator.mediaDevices.getUserMedia({
    video: isLowBandwidth ? { width: 320, height: 240 } : { width: 640, height: 480 },
    audio: true
  });
  document.getElementById('localVideo').srcObject = localStream;
  document.getElementById('callContainer').style.display = 'block';

  targetEmails.forEach(email => {
    peerConnections[email] = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: process.env.TURN_SERVER_URL, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL },
        { urls: 'turn:turn2.your-server.com', username: 'user', credential: 'pass' }
      ]
    });
    localStream.getTracks().forEach(track => peerConnections[email].addTrack(track, localStream));
    peerConnections[email].ontrack = (event) => {
      const video = document.createElement('video');
      video.srcObject = event.streams[0];
      video.autoplay = true;
      video.id = `remote-${email}`;
      document.getElementById('remoteVideos').appendChild(video);
    };
    peerConnections[email].onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { callId, candidate: event.candidate, to: email });
      }
    };
    peerConnections[email].oniceconnectionstatechange = () => {
      if (peerConnections[email].iceConnectionState === 'disconnected') {
        peerConnections[email].restartIce();
        queueGtagEvent('ice_retry', { event_category: 'call', event_label: 'ice_failure_retry' });
      }
    };
    peerConnections[email].getSenders().forEach(sender => {
      if (sender.track.kind === 'video') {
        sender.setParameters({ encodings: [{ maxBitrate: isLowBandwidth ? 100000 : 500000 }] });
      }
    });
    peerConnections[email].createOffer().then(offer => {
      peerConnections[email].setLocalDescription(offer);
      socket.emit('offer', { callId, offer, to: email });
    });
  });
}

socket.on('offer', async ({ callId: incomingCallId, offer, to }) => {
  if (callId !== incomingCallId || to !== localStorage.getItem('currentUser')) return;
  const peer = peerConnections[to] || new RTCPeerConnection(configuration);
  peerConnections[to] = peer;
  await peer.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit('answer', { callId, answer, to });
});

socket.on('answer', ({ callId: incomingCallId, answer, to }) => {
  if (callId === incomingCallId && peerConnections[to]) {
    peerConnections[to].setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on('ice-candidate', ({ callId: incomingCallId, candidate, to }) => {
  if (callId === incomingCallId && peerConnections[to]) {
    peerConnections[to].addIceCandidate(new RTCIceCandidate(candidate));
  }
});

socket.on('call_incoming', ({ callId: incomingCallId, from }) => {
  showToast(`Panggilan masuk dari ${from}`);
  callId = incomingCallId;
  initGroupWebRTC([from]);
});

async function endCall() {
  Object.values(peerConnections).forEach(peer => peer.close());
  localStream.getTracks().forEach(track => track.stop());
  document.getElementById('callContainer').style.display = 'none';
  document.getElementById('remoteVideos').innerHTML = '';
  socket.emit('end_call', { callId });
  queueGtagEvent('call_end', { event_category: 'call', event_label: 'call_ended' });
}

async function requestPermissions() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('permissionPrompt').style.display = 'none';
  } catch (err) {
    showToast('Izin ditolak, cek pengaturan browser');
    queueGtagEvent('permission_denied', { event_category: 'call', event_label: err.message });
  }
}

async function loadCallTargets() {
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/users`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.status === 401) {
      if (await refreshToken()) return loadCallTargets();
    }
    const users = await res.json();
    const select = document.getElementById('callTarget');
    users.forEach(user => {
      if (user.email !== localStorage.getItem('currentUser')) {
        select.innerHTML += `<option value="${user.email}">${user.email}</option>`;
      }
    });
  });
}

loadCallTargets();