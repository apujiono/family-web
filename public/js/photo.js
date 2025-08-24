import Hammer from 'https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js';

let currentPage = 1;

async function uploadPhoto() {
  const file = document.getElementById('photoInput').files[0];
  const caption = document.getElementById('photoCaption').value;
  if (!file) return showToast('Pilih foto dulu!');
  queueGtagEvent('upload_photo_attempt', { event_category: 'photo', event_label: 'photo_upload' });
  if (file.size > 2 * 1024 * 1024) {
    const chunks = [];
    for (let i = 0; i < file.size; i += 500 * 1024) {
      chunks.push(file.slice(i, i + 500 * 1024));
    }
    await Promise.all(chunks.map((chunk, index) => uploadChunk(chunk, index, caption)));
  } else {
    await uploadSingle(file, caption);
  }
  queueGtagEvent('upload_photo_success', { event_category: 'photo', event_label: 'photo_uploaded' });
}

async function uploadSingle(file, caption) {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('caption', caption);
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/photo`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });
    if (res.status === 401) {
      if (await refreshToken()) return uploadSingle(file, caption);
    }
  });
}

async function loadPhotos(page) {
  currentPage = page;
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/photos?page=${page}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.status === 401) {
      if (await refreshToken()) return loadPhotos(page);
    }
    const photos = await res.json();
    document.getElementById('photoGallery').innerHTML = photos.map(photo => `
      <img src="${photo.imageUrl}" alt="${photo.caption}">
      <input class="commentInput" placeholder="Komentar..." data-photo-id="${photo._id}">
      <button onclick="addComment('${photo._id}')">Komentar</button>
    `).join('');
    queueGtagEvent('load_photos', { event_category: 'photo', event_label: 'photos_loaded' });
  });
}

function initPhotoGallery() {
  const gallery = document.getElementById('photoGallery');
  const hammer = new Hammer(gallery);
  hammer.on('swipeleft', () => loadPhotos(currentPage + 1));
  hammer.on('swiperight', () => loadPhotos(currentPage - 1));
  queueGtagEvent('gallery_swipe', { event_category: 'ui', event_label: 'photo_swipe' });
}

loadPhotos(1);
initPhotoGallery();