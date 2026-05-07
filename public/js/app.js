document.addEventListener('DOMContentLoaded', () => {

  // Film
  renderNowPlaying();
  renderComingSoon();
  renderAllMovies();

  // Bioskop
  loadBioskop();

  // Jadwal
  renderDatePicker();
  renderShowtimes();

  // Kursi
  renderSeatGrid();

  // Pembayaran
  renderPayMethods();

  // E-Ticket
  renderEtiket();

  // Riwayat
  renderRiwayat();

  // Promo
  renderPromos();

  // Notifikasi
  renderNotifications();

  // AI
  loadAIRecommendation();

});