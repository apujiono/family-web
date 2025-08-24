const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const socketIo = require('socket.io');
const helmet = require('helmet');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const zlib = require('zlib');
const webpush = require('web-push');

const app = express();
const server = require('http').createServer(app);
const io = socketIo(server, { 
  cors: { 
    origin: 'https://apujiono.github.io', // Ganti dengan URL GitHub Pages Anda
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

app.use(cors({ origin: 'https://apujiono.github.io' })); // Ganti dengan URL GitHub Pages
app.use(express.json());
app.use(helmet());
app.use(express.static('public'));

// Setup Web Push (alternatif OneSignal)
webpush.setVapidDetails(
  'mailto:your-email@gmail.com', // Ganti dengan email Anda
  'your_public_vapid_key',      // Ganti dengan VAPID public key
  'your_private_vapid_key'      // Ganti dengan VAPID private key
);

// MongoDB connection
const client = new MongoClient(process.env.MONGO_URI, {
  maxPoolSize: 100,
  retryWrites: true,
  retryReads: true
});
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('family_web');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

connectDB();

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
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email sudah terdaftar' });
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
    console.error('Register error:', err);
    res.status(500).json({ error: 'Gagal registrasi' });
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
    res.json({ token, refreshToken, email, family_code: user.family_code });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Gagal login' });
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
    console.error('Refresh token error:', err);
    res.status(401).json({ error: 'Refresh token invalid' });
  }
});

// Chat
app.get('/chat', authMiddleware, async (req, res) => {
  try {
    const chats = await db.collection('chats')
      .find({ family_code: req.user.family_code })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();
    res.json(chats);
  } catch (err) {
    console.error('Chat fetch error:', err);
    res.status(500).json({ error: 'Gagal mengambil chat' });
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
    await sendWebPush(req.user.family_code, 'Pesan Baru', `${req.user.email}: ${message}`);
    res.json({ message: 'Pesan terkirim' });
  } catch (err) {
    console.error('Chat send error:', err);
    res.status(500).json({ error: 'Gagal mengirim pesan' });
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
    await sendWebPush(req.user.family_code, 'Foto Baru', `Foto diunggah oleh ${req.user.email}`);
    res.json({ message: 'Foto diunggah' });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Gagal mengunggah foto' });
  }
});

app.get('/photos', authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  try {
    const photos = await db.collection('photos')
      .find({ family_code: req.user.family_code })
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    res.json(photos);
  } catch (err) {
    console.error('Photo fetch error:', err);
    res.status(500).json({ error: 'Gagal mengambil foto' });
  }
});

// Users untuk friend list
app.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await db.collection('users')
      .find({ family_code: req.user.family_code })
      .project({ email: 1, _id: 0 })
      .toArray();
    console.log('Users fetched for family_code', req.user.family_code, ':', users); // Debug
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Gagal mengambil daftar user' });
  }
});

// Video Call
app.post('/call', authMiddleware, async (req, res) => {
  const { targetEmails, family_code } = req.body;
  try {
    if (!targetEmails || targetEmails.length > 3) {
      return res.status(400).json({ error: 'Maksimal 3 target untuk panggilan grup' });
    }
    const users = await db.collection('users').find({ email: { $in: targetEmails }, family_code }).toArray();
    if (users.length !== targetEmails.length) {
      return res.status(404).json({ error: 'User tidak ditemukan atau family_code salah' });
    }
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
    await sendWebPush(family_code, 'Panggilan Masuk', `Panggilan dari ${req.user.email}`);
    console.log('Call initiated:', { callId, initiator: req.user.email, targets: targetEmails }); // Debug
    res.json({ callId });
  } catch (err) {
    console.error('Call start error:', err);
    res.status(500).json({ error: 'Gagal memulai panggilan' });
  }
});

app.put('/calls/:callId', authMiddleware, async (req, res) => {
  const { callId } = req.params;
  const { status, ended_at } = req.body;
  try {
    await db.collection('calls').updateOne(
      { callId: new ObjectId(callId) },
      { $set: { status, ended_at: new Date(ended_at) } }
    );
    res.json({ message: 'Status panggilan diperbarui' });
  } catch (err) {
    console.error('Call update error:', err);
    res.status(500).json({ error: 'Gagal memperbarui panggilan' });
  }
});

// Web Push subscription
app.post('/subscribe-push', authMiddleware, async (req, res) => {
  const subscription = req.body;
  try {
    await db.collection('push_subscriptions').updateOne(
      { email: req.user.email },
      { $set: { subscription, updated_at: new Date() } },
      { upsert: true }
    );
    res.json({ message: 'Subscription saved' });
  } catch (err) {
    console.error('Push subscription error:', err);
    res.status(500).json({ error: 'Gagal menyimpan subscription' });
  }
});

// Fungsi kir