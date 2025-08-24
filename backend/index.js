const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const socketIo = require('socket.io');
const helmet = require('helmet');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const zlib = require('zlib');

const app = express();
const server = require('http').createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(express.static('public'));

// MongoDB connection
const client = new MongoClient(process.env.MONGO_URI, {
  maxPoolSize: 100,
  retryWrites: true,
  retryReads: true
});
let db;

async function connectDB() {
  await client.connect();
  db = client.db('family_web');
}

connectDB().catch(console.error);

// Middleware autentikasi
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token diperlukan' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalid' });
  }
}

// Register
app.post('/register', async (req, res) => {
  const { email, password, family_code, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({
      email,
      password: hashedPassword,
      family_code,
      role: role || 'member',
      created_at: new Date()
    });
    res.json({ message: 'Registrasi berhasil' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.collection('users').findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }
    const token = jwt.sign({ email, family_code: user.family_code, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ email }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    await db.collection('users').updateOne({ email }, { $set: { last_activity: new Date() } });
    res.json({ token, refreshToken, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh token
app.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await db.collection('users').findOne({ email: decoded.email });
    if (!user) return res.status(401).json({ error: 'User tidak ditemukan' });
    const token = jwt.sign({ email: user.email, family_code: user.family_code, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: 'Refresh token invalid' });
  }
});

// Chat
app.get('/chat', authMiddleware, async (req, res) => {
  try {
    const chats = await db.collection('chats').find({ family_code: req.user.family_code }).toArray();
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/chat', authMiddleware, async (req, res) => {
  const { message } = req.body;
  try {
    const chat = {
      message,
      sender: req.user.email,
      family_code: req.user.family_code,
      created_at: new Date()
    };
    await db.collection('chats').insertOne(chat);
    io.emit('chat_message', chat);
    res.json({ message: 'Pesan terkirim' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Foto
app.post('/photo', authMiddleware, async (req, res) => {
  const { imageUrl, caption } = req.body;
  try {
    await db.collection('photos').insertOne({
      imageUrl,
      caption,
      uploader: req.user.email,
      family_code: req.user.family_code,
      created_at: new Date()
    });
    res.json({ message: 'Foto diunggah' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Diary, Event, Poll, Family Tree, dan endpoint lainnya serupa...

// Video Call
app.post('/call', authMiddleware, async (req, res) => {
  const { targetEmails, family_code } = req.body;
  try {
    const users = await db.collection('users').find({ email: { $in: targetEmails }, family_code }).toArray();
    if (users.length !== targetEmails.length) return res.status(404).json({ error: 'User tidak ditemukan' });
    const callId = new ObjectId();
    await db.collection('calls').insertOne({
      callId,
      initiator: req.user.email,
      targets: targetEmails,
      family_code,
      status: 'initiated',
      created_at: new Date()
    });
    io.emit('call_incoming', { callId, from: req.user.email, to: targetEmails });
    res.json({ callId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.io untuk signaling
io.on('connection', (socket) => {
  socket.on('offer', ({ callId, offer, to }) => {
    socket.broadcast.emit('offer', { callId, offer, to });
  });
  socket.on('answer', ({ callId, answer, to }) => {
    socket.broadcast.emit('answer', { callId, answer, to });
  });
  socket.on('ice-candidate', ({ callId, candidate, to }) => {
    socket.broadcast.emit('ice-candidate', { callId, candidate, to });
  });
  socket.on('end_call', ({ callId }) => {
    db.collection('calls').updateOne({ callId }, { $set: { status: 'ended', ended_at: new Date() } });
    socket.broadcast.emit('end_call', { callId });
  });
});

server.listen(process.env.PORT || 3000, () => console.log('Server berjalan'));