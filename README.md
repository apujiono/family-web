# Family Web
Web keluarga untuk chat, foto, diary, event, poll, family tree, dan video call.

## Setup
1. Clone repo: `git clone https://github.com/yourusername/family-web.git`
2. Backend:
   - Install: `cd backend && npm install`
   - Set `.env` (MONGO_URI, JWT_SECRET, dll)
   - Run: `npm start`
3. Frontend:
   - Host `public/` di GitHub Pages
   - Update `API_URL` di js/*.js
4. Test:
   - Login, tes semua fitur
   - Cek GA4 untuk event tracking

## Deploy dari HP Android
1. Edit kode di github.com via browser
2. Backend: Deploy ke Railway
3. Frontend: Commit ke GitHub Pages
4. Tes: Akses https://username.github.io/family-web/