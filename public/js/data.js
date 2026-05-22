// ============================================
//  BE TIX — Data Layer
//  Minimal safe defaults for legacy compatibility.
//  Actual content is fetched from backend APIs.
// ============================================

(function () {
  const STORAGE_KEYS = {
    activeTickets: 'betix_active_tickets',
    historyTickets: 'betix_history_tickets',
    notifications: 'betix_notifications',
    selectedMovie: 'betix_selected_movie',
    selectedCinema: 'betix_selected_cinema',
    selectedDate: 'betix_selected_date',
    selectedShowtime: 'betix_selected_showtime',
    selectedPayment: 'betix_selected_payment',
    selectedSeats: 'betix_selected_seats',
    searchQuery: 'betix_search_query',
    genre: 'betix_genre_filter'
  };

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function getStoredArray(key) {
    return safeParse(localStorage.getItem(key), []);
  }

  function getStoredValue(key, fallback = null) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  function setStoredValue(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore storage errors in sandbox / quota issues
    }
  }

  const DATA = {
    movies: [],
    cinemas: [],
    showtimes: [],
    promos: [],
    notifications: [],
    activeTickets: [],
    historyTickets: [],
    selectedMovie: null,
    selectedCinema: null,
    selectedDate: null,
    selectedShowtime: null,
    selectedPayment: null,
    selectedSeats: [],
    searchQuery: '',
    genreFilter: 'semua'
  };

  function syncLocalDataFromStorage() {
    DATA.activeTickets = getStoredArray(STORAGE_KEYS.activeTickets);
    DATA.historyTickets = getStoredArray(STORAGE_KEYS.historyTickets);
    DATA.notifications = getStoredArray(STORAGE_KEYS.notifications);
    DATA.selectedMovie = getStoredValue(STORAGE_KEYS.selectedMovie, null);
    DATA.selectedCinema = getStoredValue(STORAGE_KEYS.selectedCinema, null);
    DATA.selectedDate = getStoredValue(STORAGE_KEYS.selectedDate, null);
    DATA.selectedShowtime = getStoredValue(STORAGE_KEYS.selectedShowtime, null);
    DATA.selectedPayment = getStoredValue(STORAGE_KEYS.selectedPayment, null);
    DATA.selectedSeats = getStoredValue(STORAGE_KEYS.selectedSeats, []);
    DATA.searchQuery = getStoredValue(STORAGE_KEYS.searchQuery, '');
    DATA.genreFilter = getStoredValue(STORAGE_KEYS.genre, 'semua');
  }

  // Keep the legacy shape alive for scripts that still read DATA directly.
  syncLocalDataFromStorage();

  window.DATA = DATA;
  window.BE_TIX_STORAGE_KEYS = STORAGE_KEYS;
  window.BE_TIX_DATA = {
    DATA,
    STORAGE_KEYS,
    syncLocalDataFromStorage,
    getStoredArray,
    getStoredValue,
    setStoredValue
  };
})();
