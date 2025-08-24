i18next.init({
  lng: localStorage.getItem('language') || 'id',
  resources: {
    id: {
      translation: {
        login_title: 'Masuk ke Family Web',
        dashboard_title: 'Dashboard Keluarga',
        chat: 'Chat',
        photos: 'Foto',
        diary: 'Diary',
        events: 'Event',
        polls: 'Poll',
        family_tree: 'Pohon Keluarga',
        video_call: 'Video Call'
      }
    },
    en: { translation: { /* translations */ } },
    jv: { translation: { dashboard_title: 'Dashboard Kulawarga' } },
    su: { translation: { dashboard_title: 'Dashboard Kulawargi' } }
  }
}, () => {
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    elem.textContent = i18next.t(elem.dataset.i18n);
  });
});

document.getElementById('languageSelect').addEventListener('change', (e) => {
  i18next.changeLanguage(e.target.value);
  localStorage.setItem('language', e.target.value);
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    elem.textContent = i18next.t(elem.dataset.i18n);
  });
  queueGtagEvent('language_change', { event_category: 'ui', event_label: e.target.value });
});