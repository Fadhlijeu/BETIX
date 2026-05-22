// ============================================
//  BE TIX — Render Layer (Fixed & Enhanced)
//  Fixes:
//  1. API endpoint /api/film → /api/movies
//  2. Film cards now render correctly
//  3. Empty state full-width borders
//  4. Hero banner guard when no film
//  5. "Lihat Semua" filter by type (now/coming)
//  6. Search navigates to film page
//  7. Notification badge clears on open
//  8. No bottom profile nav item
// ============================================

(function () {
  const GENRES = ['Aksi','Drama','Komedi','Horor','Thriller','Animasi','Sci-Fi','Romansa','Petualangan','Dokumenter','Fantasi','Biografi'];

  const EMPTY_TEXT = {
    nowPlaying: 'Tidak ada film yang sedang tayang.',
    comingSoon: 'Belum ada film segera hadir.',
    allMovies: 'Belum ada film tersedia.',
    cinemas: 'Belum ada bioskop tersedia.',
    showtimes: 'Belum ada jadwal tayang.',
    seats: 'Pilih jadwal untuk menampilkan kursi.',
    tickets: 'Belum ada tiket aktif.',
    history: 'Belum ada riwayat transaksi.',
    promos: 'Belum ada promo tersedia.',
    notifications: 'Belum ada notifikasi.',
    search: 'Tidak ditemukan hasil pencarian.'
  };

  // ✅ FIXED: Use /api/movies instead of /api/film
  const API = {
    movies: '/api/movies',
    cinemas: '/api/cinemas',
    schedules: '/api/schedules',
    promos: '/api/promos',
    notifications: '/api/notifications',
    tickets: '/api/tickets'
  };

  const STORAGE_KEYS = {
    ticketsActive: 'betix_active_tickets',
    ticketsHistory: 'betix_history_tickets',
    notifications: 'betix_notifications',
    selectedMovie: 'betix_selected_movie',
    selectedCinema: 'betix_selected_cinema',
    selectedDate: 'betix_selected_date',
    selectedShowtime: 'betix_selected_showtime',
    selectedPayment: 'betix_selected_payment',
    selectedSeats: 'betix_selected_seats',
    searchQuery: 'betix_search_query',
    genre: 'betix_genre_filter',
    filmFilter: 'betix_film_filter'
  };

  const state = {
    movies: [],
    cinemas: [],
    showtimes: [],
    promos: [],
    notifications: [],
    activeTickets: [],
    historyTickets: [],
    moviesPromise: null,
    cinemasPromise: null,
    showtimesPromise: null,
    promosPromise: null,
    notificationsPromise: null,
    selectedMovie: null,
    selectedCinema: null,
    selectedDate: null,
    selectedShowtime: null,
    selectedPayment: null,
    selectedSeats: [],
    searchQuery: '',
    genreFilter: 'semua',
    filmFilter: 'semua', // 'semua' | 'now_playing' | 'coming_soon'
    heroIndex: 0,
    heroTimer: null,
    notifRead: false
  };

  // ============================================================
  // HELPERS
  // ============================================================
  function safeArray(value) { return Array.isArray(value) ? value : []; }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function toTitleCase(value) {
    return String(value || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  function formatDateShort(date) {
    return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: '2-digit', month: 'short' }).format(date);
  }

  function formatDateLong(date) {
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }

  function formatCurrency(value) {
    return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
  }

  function getJSON(key, fallback) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
  }

  function setJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
  }

  function requestJson(url, fallback = []) {
    return fetch(url)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .catch(err => { console.warn(`Fetch ${url} failed:`, err.message); return fallback; });
  }

  function getContainer(...ids) {
    for (const id of ids) { const el = document.getElementById(id); if (el) return el; }
    return null;
  }

  // ✅ FIXED: Full-width empty state (no small border)
  function emptyStateMarkup(title, description, icon = '📭') {
    return `
      <div style="
        padding: 48px 20px;
        text-align: center;
        background: rgba(255,255,255,0.02);
        border: 1px dashed rgba(255,255,255,0.12);
        border-radius: 16px;
        width: 100%;
        box-sizing: border-box;
        color: var(--text-muted);
      ">
        <div style="font-size: 44px; line-height: 1; margin-bottom: 14px;">${icon}</div>
        <div style="font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 8px;">${escapeHtml(title)}</div>
        <div style="font-size: 13px; line-height: 1.6; max-width: 260px; margin: 0 auto;">${escapeHtml(description)}</div>
      </div>`;
  }

  function setPageEmpty(container, title, description, icon) {
    if (!container) return;
    container.innerHTML = emptyStateMarkup(title, description, icon);
  }

  // ============================================================
  // MOVIE NORMALIZER
  // ============================================================
  function normalizeGenre(value) {
    if (Array.isArray(value)) return value.map(v => String(v).toLowerCase().trim()).filter(Boolean);
    if (!value) return [];
    return String(value).split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  }

  function normalizeMovie(movie) {
    const title = movie.title || movie.judul || movie.nama || 'Tanpa judul';
    const genreRaw = movie.genreArray || movie.genre || movie.genres || movie.kategori || '';
    const genreList = normalizeGenre(genreRaw);
    const poster = movie.image || movie.poster || movie.gambar || movie.img || '';
    const rating = movie.rating ?? movie.nilai ?? movie.score ?? '';
    const duration = movie.duration || movie.durasi || movie.runtime || '';
    const year = movie.year || movie.tahun || '';
    const synopsis = movie.synopsis || movie.sinopsis || movie.description || '';

    // ✅ FIXED: Support both old and new status fields
    const isNowPlaying =
      movie.is_now_playing === 1 || movie.is_now_playing === true ||
      movie.now === true || movie.now === 1 ||
      movie.status === 'now_playing' || movie.status === 'now' || movie.status === 'tayang';

    const isComingSoon =
      movie.is_coming_soon === 1 || movie.is_coming_soon === true ||
      movie.coming === true || movie.coming === 1 ||
      movie.status === 'coming_soon' || movie.status === 'coming' || movie.status === 'segera';

    return {
      ...movie,
      id: movie.id ?? movie.movie_id ?? movie.film_id ?? title,
      title, genreList, poster, rating, duration, year, synopsis,
      isNowPlaying, isComingSoon
    };
  }

  function normalizeCinema(cinema) {
    const name = cinema.name || cinema.nama || cinema.cinema_name || 'Bioskop';
    return {
      ...cinema,
      id: cinema.id ?? cinema.cinema_id ?? name,
      name,
      city: cinema.city || cinema.kota || cinema.location || '',
      location: cinema.location || cinema.address || cinema.alamat || '',
      distance: cinema.distance || cinema.jarak || ''
    };
  }

  function normalizeShowtime(showtime) {
    const time = showtime.show_time || showtime.time || showtime.jam || showtime.waktu || '';
    const date = showtime.show_date || showtime.date || showtime.tanggal || '';
    const cinemaId = showtime.cinema_id || showtime.bioskop_id || showtime.cinemaId || null;
    const movieId = showtime.movie_id || showtime.film_id || showtime.movieId || null;
    return {
      ...showtime,
      id: showtime.id ?? `${movieId}-${cinemaId}-${date}-${time}`,
      movieId, cinemaId, date, time,
      studio: showtime.studio_id || showtime.studio || showtime.room || 'Studio 1',
      price: Number(showtime.price || showtime.harga || 50000),
      isFull: showtime.full === true || showtime.full === 1 || showtime.status === 'full'
    };
  }

  function normalizeNotification(notification) {
    return {
      ...notification,
      id: notification.id ?? notification.notification_id ?? crypto.randomUUID(),
      title: notification.title || notification.judul || 'Notifikasi',
      message: notification.message || notification.pesan || '',
      image: notification.image || notification.gambar || '',
      createdAt: notification.created_at || notification.createdAt || new Date().toISOString(),
      unread: notification.unread === true || notification.unread === 1 || notification.read === 0
    };
  }

  // ============================================================
  // DATA LOADERS
  // ============================================================
  async function loadMovies(force = false) {
    if (!force && state.movies.length) return state.movies;
    if (!state.moviesPromise || force) {
      state.moviesPromise = requestJson(API.movies, []).then(data => safeArray(data).map(normalizeMovie));
    }
    state.movies = await state.moviesPromise;
    return state.movies;
  }

  async function loadCinemas(force = false) {
    if (!force && state.cinemas.length) return state.cinemas;
    if (!state.cinemasPromise || force) {
      state.cinemasPromise = requestJson(API.cinemas, []).then(data => safeArray(data).map(normalizeCinema));
    }
    state.cinemas = await state.cinemasPromise;
    return state.cinemas;
  }

  async function loadShowtimes(force = false) {
    if (!force && state.showtimes.length) return state.showtimes;
    if (!state.showtimesPromise || force) {
      state.showtimesPromise = requestJson(API.schedules, []).then(data => safeArray(data).map(normalizeShowtime));
    }
    state.showtimes = await state.showtimesPromise;
    return state.showtimes;
  }

  async function loadPromos(force = false) {
    if (!force && state.promos.length) return state.promos;
    if (!state.promosPromise || force) {
      state.promosPromise = requestJson(API.promos, []);
    }
    state.promos = await state.promosPromise;
    return state.promos;
  }

  async function loadNotifications(force = false) {
    if (!force && state.notifications.length) return state.notifications;
    if (!state.notificationsPromise || force) {
      state.notificationsPromise = requestJson(API.notifications, []).then(data => safeArray(data).map(normalizeNotification));
    }
    state.notifications = await state.notificationsPromise;
    return state.notifications;
  }

  function loadStoredTickets() {
    state.activeTickets = safeArray(getJSON(STORAGE_KEYS.ticketsActive, []));
    state.historyTickets = safeArray(getJSON(STORAGE_KEYS.ticketsHistory, []));
  }

  // ============================================================
  // FILTER HELPERS
  // ============================================================
  function matchesQuery(movie, query) {
    if (!query) return true;
    const haystack = [movie.title, movie.year, movie.duration, movie.rating, movie.genreList.join(' ')].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function matchesGenre(movie, genre) {
    if (!genre || genre === 'semua') return true;
    return movie.genreList.some(g => g.includes(genre.toLowerCase()));
  }

  function filteredMovies(allMovies, overrideFilter = null) {
    const query = (state.searchQuery || '').trim();
    const filmFilter = overrideFilter || state.filmFilter || 'semua';
    return allMovies.filter(movie => {
      if (!matchesQuery(movie, query)) return false;
      if (!matchesGenre(movie, state.genreFilter)) return false;
      if (filmFilter === 'now_playing') return movie.isNowPlaying;
      if (filmFilter === 'coming_soon') return movie.isComingSoon;
      return true;
    });
  }

  // ============================================================
  // BADGE
  // ============================================================
  function setBadgeCount(count) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const n = Number(count || 0);
    badge.textContent = String(n);
    badge.style.display = n > 0 ? 'flex' : 'none';
  }

  function refreshNotifBadge() {
    const unread = state.notifications.filter(n => n.unread).length;
    setBadgeCount(unread);
  }

  // ============================================================
  // MOVIE CARD
  // ============================================================
  function movieCardMarkup(movie) {
    const ratingHtml = movie.rating
      ? `⭐ ${escapeHtml(movie.rating)}`
      : `<span style="color:var(--text-muted)">TBA</span>`;
    const genreHtml = movie.genreList.length
      ? movie.genreList.slice(0, 2).map(g => escapeHtml(toTitleCase(g))).join(' · ')
      : 'Tanpa genre';
    const tagHtml = movie.isNowPlaying
      ? '<div class="now-tag">Tayang</div>'
      : movie.isComingSoon ? '<div class="coming-tag">Soon</div>' : '';
    const posterHtml = movie.poster
      ? `<img src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title)}" class="movie-img" onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;font-size:30px;\\'>🎬</div>'">`
      : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:30px;">🎬</div>`;

    return `
      <div class="movie-card" role="button" tabindex="0" onclick="BE_TIX.openMovieDetail(${JSON.stringify(movie.id)})">
        <div class="movie-poster">
          ${tagHtml}
          ${posterHtml}
        </div>
        <div class="movie-info">
          <div class="movie-title" title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</div>
          <div class="movie-genre">${genreHtml}</div>
          <div class="movie-rating">${ratingHtml}</div>
        </div>
      </div>`;
  }

  function renderMovieSection(container, movies, emptyTitle, emptyDescription, emptyIcon) {
    if (!container) return;
    const list = safeArray(movies);
    if (!list.length) {
      setPageEmpty(container, emptyTitle, emptyDescription, emptyIcon);
      return;
    }
    container.innerHTML = list.map(m => movieCardMarkup(m)).join('');
  }

  // ============================================================
  // ✅ HERO CAROUSEL (3 films, prev/next, full ratio)
  // ============================================================
  function renderHeroCarousel(nowPlayingMovies) {
    const hero = document.querySelector('.hero-banner');
    if (!hero) return;

    const films = nowPlayingMovies.slice(0, 5);

    // ✅ FIXED: If no films, show proper empty state, NOT clickable
    if (!films.length) {
      hero.style.cursor = 'default';
      hero.onclick = null;
      hero.innerHTML = `
        <div style="
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
          background: linear-gradient(135deg, rgba(22,22,58,0.96), rgba(10,10,26,0.96));
          border-radius: inherit;
        ">
          <div>
            <div style="font-size: 38px; margin-bottom: 10px;">🎬</div>
            <div style="font-size: 18px; font-weight: 800; color: var(--text); margin-bottom: 6px;">Belum ada film unggulan</div>
            <div style="font-size: 13px; color: var(--text-muted); line-height: 1.6;">Admin belum menambahkan film tayang.</div>
          </div>
        </div>`;
      return;
    }

    if (state.heroTimer) clearInterval(state.heroTimer);
    if (state.heroIndex >= films.length) state.heroIndex = 0;

    function renderSlide(idx) {
      const movie = films[idx];
      const total = films.length;

      // For full-ratio poster display
      const hasPoster = !!movie.poster;

      hero.style.cursor = 'pointer';
      hero.innerHTML = `
        <div class="hero-slide" style="position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;">
          ${hasPoster
            ? `<img src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title)}"
                 style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block;"
                 onerror="this.style.display='none';this.nextElementSibling.style.background='linear-gradient(135deg,#1a0a2e,#2d1b69)'">`
            : ''
          }
          <div style="
            position:absolute;inset:0;
            background: linear-gradient(to top, rgba(10,10,26,0.95) 0%, rgba(10,10,26,0.4) 50%, transparent 100%);
          "></div>

          <div style="position:absolute;bottom:0;left:0;right:0;padding:14px 16px;">
            <div style="display:flex;align-items:flex-end;gap:10px;margin-bottom:8px;">
              <div style="flex:1;">
                <div class="hero-tag">Sedang Tayang</div>
                <h2 class="hero-title" style="margin-top:6px;">${escapeHtml(movie.title)}</h2>
                <div class="hero-meta">
                  <span class="hero-rating">⭐ ${escapeHtml(String(movie.rating || 'TBA'))}</span>
                  <span>${escapeHtml(movie.genreList[0] ? toTitleCase(movie.genreList[0]) : 'Film')}</span>
                  <span>${escapeHtml(movie.duration || '-')}</span>
                </div>
              </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <button class="hero-btn" onclick="event.stopPropagation();BE_TIX.openMovieDetail(${JSON.stringify(movie.id)})">🎟️ Beli Tiket</button>

              ${total > 1 ? `
              <div style="display:flex;align-items:center;gap:8px;">
                <button onclick="event.stopPropagation();BE_TIX.heroPrev()" style="
                  background:rgba(255,255,255,0.15);border:none;color:#fff;
                  width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;
                  display:flex;align-items:center;justify-content:center;
                ">‹</button>
                <div style="display:flex;gap:5px;">
                  ${films.map((_, i) => `
                    <div style="
                      width:${i === idx ? '16px' : '6px'};height:6px;border-radius:3px;
                      background:${i === idx ? '#E63946' : 'rgba(255,255,255,0.35)'};
                      transition:all 0.3s;cursor:pointer;
                    " onclick="event.stopPropagation();BE_TIX.heroGoto(${i})"></div>
                  `).join('')}
                </div>
                <button onclick="event.stopPropagation();BE_TIX.heroNext()" style="
                  background:rgba(255,255,255,0.15);border:none;color:#fff;
                  width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;
                  display:flex;align-items:center;justify-content:center;
                ">›</button>
              </div>` : ''}
            </div>
          </div>
        </div>`;

      hero.onclick = (e) => {
        if (e.target.closest('button')) return;
        BE_TIX.openMovieDetail(movie.id);
      };
    }

    renderSlide(state.heroIndex);

    if (films.length > 1) {
      state.heroTimer = setInterval(() => {
        state.heroIndex = (state.heroIndex + 1) % films.length;
        renderSlide(state.heroIndex);
      }, 4500);
    }

    // Expose for buttons
    window._heroFilms = films;
    window._heroRenderSlide = renderSlide;
  }

  // ============================================================
  // RENDER HOME
  // ============================================================
  function renderHeroAndSections() {
    const allMovies = state.movies;
    const nowPlaying = allMovies.filter(m => m.isNowPlaying);
    const comingSoon = allMovies.filter(m => m.isComingSoon);

    renderHeroCarousel(nowPlaying);

    // Now Playing section
    const npContainer = getContainer('now-playing');
    const filteredNow = filteredMovies(nowPlaying, 'now_playing');
    renderMovieSection(npContainer, filteredNow, 'Tidak ada film tayang', 'Admin belum menambahkan film tayang.', '🎬');

    // Coming Soon section
    const csContainer = getContainer('coming-soon');
    const filteredComing = filteredMovies(comingSoon, 'coming_soon');
    renderMovieSection(csContainer, filteredComing, 'Belum ada film segera hadir', 'Daftar film mendatang akan tampil di sini.', '⏳');

    // All movies
    renderAllMoviesPage();
  }

  function renderAllMoviesPage() {
    const container = getContainer('all-movies', 'all-movies-list');
    if (!container) return;
    const query = (state.searchQuery || '').trim();
    let filtered = filteredMovies(state.movies);

    if (!filtered.length) {
      setPageEmpty(container,
        query ? 'Tidak ditemukan' : 'Belum ada film',
        query ? `Tidak ada film yang cocok dengan "${query}".` : 'Film akan muncul setelah admin menambahkan data.',
        query ? '🔎' : '🎞️'
      );
      return;
    }
    container.innerHTML = filtered.map(m => movieCardMarkup(m)).join('');
  }

  // ============================================================
  // GENRE FILTER CHIPS (Film page)
  // ============================================================
  function renderGenreChips() {
    const container = document.getElementById('genre-filters');
    if (!container) return;

    const chips = [{ label: 'Semua', value: 'semua' }, ...GENRES.map(g => ({ label: g, value: g.toLowerCase() }))];
    container.innerHTML = chips.map(chip => `
      <div class="filter-chip ${state.genreFilter === chip.value ? 'active' : ''}"
           onclick="BE_TIX.setGenreFilter('${chip.value}', this)">
        ${chip.label}
      </div>`).join('');
  }

  // ============================================================
  // CINEMA
  // ============================================================
  function renderCinemaSelectOptions(cinemas) {
    const select = document.getElementById('kota-select');
    if (!select) return;
    if (!cinemas.length) {
      select.innerHTML = `<option value="">Belum ada bioskop tersedia</option>`;
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = cinemas.map((c, i) =>
      `<option value="${escapeHtml(String(c.id))}" ${i === 0 ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
    ).join('');
    if (!state.selectedCinema) { state.selectedCinema = cinemas[0]; persistBookingState(); }
  }

  function renderBookingCinemaSelect(cinemas) {
    const select = document.getElementById('booking-cinema');
    if (!select) return;
    if (!cinemas.length) {
      select.innerHTML = `<option value="">Belum ada bioskop tersedia</option>`;
      select.disabled = true;
      state.selectedCinema = null;
      persistBookingState();
      return;
    }
    const current = state.selectedCinema ? String(state.selectedCinema.id) : '';
    select.disabled = false;
    select.innerHTML = cinemas.map(c =>
      `<option value="${escapeHtml(String(c.id))}" ${current === String(c.id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
    ).join('');
    if (!state.selectedCinema) { state.selectedCinema = cinemas[0]; persistBookingState(); }
  }

  function renderCinemaList(cinemas) {
    const container = getContainer('bioskop-list');
    if (!container) return;
    if (!cinemas.length) {
      setPageEmpty(container, 'Belum ada bioskop', 'Admin belum menambahkan bioskop apa pun.', '📍');
      return;
    }
    container.innerHTML = cinemas.map(c => `
      <div class="bioskop-card" role="button" tabindex="0">
        <div class="bioskop-icon">🎞️</div>
        <div>
          <div class="bioskop-name">${escapeHtml(c.name)}</div>
          <div class="bioskop-location">${escapeHtml(c.city || c.location || 'Alamat belum tersedia')}</div>
        </div>
        <div class="bioskop-dist">${escapeHtml(c.distance || '')}</div>
      </div>`).join('');
  }

  // ============================================================
  // SHOWTIMES
  // ============================================================
  function getShowtimesForSelected() {
    const movie = state.selectedMovie;
    const cinema = state.selectedCinema;
    const date = state.selectedDate;
    let items = state.showtimes.slice();
    if (movie) items = items.filter(s => String(s.movieId) === String(movie.id));
    if (cinema) items = items.filter(s => String(s.cinemaId) === String(cinema.id));
    if (date) items = items.filter(s => String(s.date) === String(date));
    return items;
  }

  function renderShowtimeList(items) {
    const container = document.getElementById('showtime-list');
    if (!container) return;
    if (!items.length) {
      setPageEmpty(container, 'Belum ada jadwal tayang', 'Jadwal akan tampil setelah admin menambahkan data.', '🕒');
      return;
    }
    container.innerHTML = items.map(showtime => `
      <div class="showtime-card">
        <div class="showtime-cinema">${escapeHtml(String(showtime.studio || 'Studio'))}</div>
        <div class="showtime-times">
          <button type="button"
            class="time-chip ${state.selectedShowtime && String(state.selectedShowtime.id) === String(showtime.id) ? 'selected' : ''} ${showtime.isFull ? 'full' : ''}"
            ${showtime.isFull ? 'disabled' : ''}
            onclick="BE_TIX.selectShowtime(${JSON.stringify(showtime.id)})">
            ${escapeHtml(showtime.time || '-')}
          </button>
          <span style="color:var(--text-muted);font-size:11px;align-self:center;">${formatCurrency(showtime.price || 0)}</span>
        </div>
      </div>`).join('');
  }

  // ============================================================
  // DATE PICKER
  // ============================================================
  function renderDatePickerBase() {
    const container = document.getElementById('date-picker');
    if (!container) return;
    const today = new Date();
    const selected = state.selectedDate;
    const chips = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() + idx);
      const iso = d.toISOString().slice(0, 10);
      const active = selected ? String(selected) === String(iso) : idx === 0;
      if (!state.selectedDate && idx === 0) state.selectedDate = iso;
      return `
        <button type="button" class="date-chip ${active ? 'active' : ''}" onclick="BE_TIX.selectDate('${iso}')">
          <div class="date-day">${d.getDate()}</div>
          <div class="date-label">${escapeHtml(formatDateShort(d))}</div>
        </button>`;
    });
    container.innerHTML = chips.join('');
  }

  // ============================================================
  // SEAT GRID
  // ============================================================
  function updateSeatSummary(activeShowtime = null) {
    const countEl = document.getElementById('selected-count');
    const totalEl = document.getElementById('total-price');
    if (!countEl || !totalEl) return;
    const count = safeArray(state.selectedSeats).length;
    const basePrice = activeShowtime ? Number(activeShowtime.price || 50000) : 50000;
    countEl.textContent = String(count);
    totalEl.textContent = formatCurrency(count * basePrice);
  }

  function renderSeatGridBase() {
    const container = getContainer('seat-grid');
    if (!container) return;
    const activeShowtime = state.selectedShowtime || getShowtimesForSelected()[0] || null;
    if (!activeShowtime) {
      setPageEmpty(container, 'Pilih jadwal dulu', 'Setelah jadwal dipilih, grid kursi akan muncul di sini.', '🪑');
      updateSeatSummary();
      return;
    }
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const cols = [1, 2, 3, 4, 5, 6, 7, 8];
    const takenSeats = new Set(['A1', 'A2', 'B4', 'C6', 'D1', 'E8', 'F3']);
    const vipRows = new Set(['A', 'B']);
    const selectedSeats = new Set(safeArray(state.selectedSeats));

    container.innerHTML = rows.map(row => {
      const seats = cols.map(col => {
        const code = `${row}${col}`;
        const isTaken = takenSeats.has(code);
        const isVip = vipRows.has(row);
        const isSelected = selectedSeats.has(code);
        const classes = ['seat', isTaken ? 'taken' : 'available', isVip ? 'vip' : '', isSelected ? 'selected' : ''].filter(Boolean);
        return `<button type="button" class="${classes.join(' ')}" title="${code}" aria-label="Kursi ${code}"
          ${isTaken ? 'disabled' : ''} onclick="BE_TIX.toggleSeat('${code}')"></button>`;
      }).join('');
      return `<div class="seat-row"><div class="row-label">${row}</div>${seats}</div>`;
    }).join('');

    // Update booking info bar
    const infoBar = document.querySelector('.booking-info-bar');
    if (infoBar) {
      const movie = state.selectedMovie;
      const cinema = state.selectedCinema;
      const info = [movie?.title, cinema?.name, activeShowtime.date, activeShowtime.time].filter(Boolean).join(' · ');
      infoBar.textContent = info || 'Pilih film, jadwal, dan bioskop terlebih dahulu';
    }

    updateSeatSummary(activeShowtime);
  }

  // ============================================================
  // PAYMENT METHODS
  // ============================================================
  function renderPayMethodsBase() {
    const container = document.getElementById('pay-methods');
    if (!container) return;
    const methods = [
      { id: 'qris', name: 'QRIS', desc: 'Scan dan bayar cepat', icon: '⬛' },
      { id: 'dana', name: 'DANA', desc: 'Dompet digital', icon: '💙' },
      { id: 'ovo', name: 'OVO', desc: 'Pembayaran instan', icon: '🟣' },
      { id: 'bca', name: 'BCA Virtual Account', desc: 'Transfer via VA', icon: '🏦' }
    ];
    container.innerHTML = methods.map(method => `
      <div class="pay-method ${state.selectedPayment === method.id ? 'selected' : ''}"
           role="button" tabindex="0" onclick="BE_TIX.selectPayment('${method.id}')">
        <div class="pay-logo">${method.icon}</div>
        <div>
          <div class="pay-name">${escapeHtml(method.name)}</div>
          <div class="pay-desc">${escapeHtml(method.desc)}</div>
        </div>
        <div class="pay-check">✓</div>
      </div>`).join('');
  }

  // ============================================================
  // TICKETS / E-TICKET
  // ============================================================
  function makeTicketCard(ticket) {
    const title = ticket.title || ticket.movieTitle || 'Tiket';
    const cinema = ticket.cinema || ticket.bioskop || 'Bioskop';
    const seats = Array.isArray(ticket.seats) ? ticket.seats.join(', ') : (ticket.seats || '-');
    const date = ticket.date || ticket.showDate || ticket.created_at || '';
    const status = ticket.status || ticket.payment_status || 'Selesai';
    const statusClass = /batal/i.test(String(status)) ? 'dibatalkan' : 'selesai';
    return `
      <div class="ticket-card">
        <div class="ticket-header">
          <div class="ticket-poster">🎬</div>
          <div>
            <div class="ticket-movie-title">${escapeHtml(title)}</div>
            <div class="ticket-detail">${escapeHtml(cinema)}</div>
            <div class="ticket-detail">${escapeHtml(date ? formatDateLong(new Date(date)) : 'Tanpa jadwal')}</div>
          </div>
        </div>
        <div class="ticket-body">
          <div class="ticket-row"><span class="ticket-key">Kursi</span><span class="ticket-val">${escapeHtml(seats)}</span></div>
          <div class="ticket-row no-border"><span class="ticket-key">Status</span><span class="riwayat-status ${statusClass}">${escapeHtml(status)}</span></div>
        </div>
      </div>`;
  }

  function renderTicketLists() {
    const activeContainer = document.getElementById('etiket-list');
    const historyContainer = document.getElementById('riwayat-list');
    const active = safeArray(state.activeTickets);
    const history = safeArray(state.historyTickets);
    if (activeContainer) {
      activeContainer.innerHTML = active.length
        ? active.map(t => makeTicketCard(t)).join('')
        : emptyStateMarkup('Belum ada tiket aktif', 'Tiket aktif akan muncul setelah transaksi berhasil.', '🎟️');
    }
    if (historyContainer) {
      historyContainer.innerHTML = history.length
        ? history.map(t => makeTicketCard(t)).join('')
        : emptyStateMarkup('Belum ada riwayat', 'Riwayat transaksi akan muncul setelah ada pembelian tiket.', '📄');
    }
  }

  // ============================================================
  // PROMOS
  // ============================================================
  function renderPromoList(promos) {
    const promoContainer = document.getElementById('promo-list');
    const voucherContainer = document.getElementById('voucher-list');
    if (promoContainer) {
      promoContainer.innerHTML = promos.length
        ? promos.slice(0, 6).map(p => `
            <div class="promo-card">
              <div class="promo-badge">${escapeHtml(p.badge || p.title || 'PROMO')}</div>
              <div class="promo-title">${escapeHtml(p.title || '-')}</div>
              <div class="promo-desc">${escapeHtml(p.description || p.synopsis || '')}</div>
            </div>`).join('')
        : emptyStateMarkup('Belum ada promo', 'Promo akan muncul ketika tersedia.', '🎉');
    }
    if (voucherContainer) {
      voucherContainer.innerHTML = promos.length
        ? promos.slice(0, 4).map(p => `
            <div class="voucher-card">
              <div>
                <div class="voucher-code">${escapeHtml(p.code || p.title || 'VOUCHER')}</div>
                <div class="voucher-info">${escapeHtml(p.description || p.synopsis || '')}</div>
              </div>
              <button type="button" class="use-btn">Pakai</button>
            </div>`).join('')
        : emptyStateMarkup('Belum ada voucher', 'Voucher dan cashback akan tampil di sini.', '🏷️');
    }
  }

  // ============================================================
  // ✅ NOTIFICATIONS (badge clears on open)
  // ============================================================
  function renderNotificationList(notifications) {
    const container = document.getElementById('notif-list');
    if (!container) return;
    if (!notifications.length) {
      setPageEmpty(container, 'Belum ada notifikasi', 'Notifikasi admin akan tampil di sini setelah tersedia.', '🔔');
      setBadgeCount(0);
      return;
    }
    const unreadCount = notifications.filter(n => n.unread).length;
    setBadgeCount(unreadCount);
    container.innerHTML = notifications.map(notif => `
      <div class="notif-card ${notif.unread ? 'unread' : ''}">
        ${notif.unread ? '<div class="notif-dot"></div>' : '<div style="width:8px;height:8px;"></div>'}
        <div class="notif-icon">${escapeHtml(notif.image ? '🖼️' : '🔔')}</div>
        <div style="flex:1;">
          <div class="notif-title">${escapeHtml(notif.title)}</div>
          <div class="notif-desc">${escapeHtml(notif.message)}</div>
          <div class="notif-time">${escapeHtml(new Date(notif.createdAt).toLocaleString('id-ID'))}</div>
        </div>
      </div>`).join('');
  }

  // Mark all as read when user opens notif page
  async function markNotificationsRead() {
    state.notifications = state.notifications.map(n => ({ ...n, unread: false }));
    setBadgeCount(0);
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_role: 'user' })
      });
    } catch (e) { /* silently fail */ }
  }

  // ============================================================
  // MOVIE DETAIL
  // ============================================================
  function renderMovieDetail(movie) {
    const normalized = movie ? normalizeMovie(movie) : null;
    if (!normalized) return;
    state.selectedMovie = normalized;
    persistBookingState();

    const poster = document.getElementById('detail-poster');
    const title = document.getElementById('detail-title');
    const tags = document.getElementById('detail-tags');
    const meta = document.getElementById('detail-meta');
    const rating = document.getElementById('detail-rating');
    const synopsis = document.getElementById('synopsis-text');

    if (poster) {
      if (normalized.poster) {
        poster.style.backgroundImage = `url('${escapeHtml(normalized.poster)}')`;
        poster.style.backgroundSize = 'cover';
        poster.style.backgroundPosition = 'top center';
        poster.textContent = '';
      } else {
        poster.textContent = '🎬';
        poster.style.backgroundImage = '';
      }
    }
    if (title) title.textContent = normalized.title;
    if (tags) {
      tags.innerHTML = normalized.genreList.length
        ? normalized.genreList.map(g => `<span class="tag">${escapeHtml(toTitleCase(g))}</span>`).join('')
        : '<span class="tag">Tanpa Genre</span>';
    }
    if (meta) meta.textContent = [normalized.year || '', normalized.duration || ''].filter(Boolean).join(' · ');
    if (rating) rating.textContent = normalized.rating ? `⭐ ${normalized.rating}` : 'TBA';
    if (synopsis) {
      synopsis.textContent = normalized.synopsis || 'Sinopsis belum tersedia.';
    }
  }

  // ============================================================
  // BOOKING STATE PERSISTENCE
  // ============================================================
  function persistBookingState() {
    setJSON(STORAGE_KEYS.selectedMovie, state.selectedMovie);
    setJSON(STORAGE_KEYS.selectedCinema, state.selectedCinema);
    setJSON(STORAGE_KEYS.selectedDate, state.selectedDate);
    setJSON(STORAGE_KEYS.selectedShowtime, state.selectedShowtime);
    setJSON(STORAGE_KEYS.selectedPayment, state.selectedPayment);
    setJSON(STORAGE_KEYS.selectedSeats, state.selectedSeats);
  }

  function restoreBookingState() {
    const raw = getJSON(STORAGE_KEYS.selectedMovie, null);
    state.selectedMovie = raw ? normalizeMovie(raw) : null;
    state.selectedCinema = getJSON(STORAGE_KEYS.selectedCinema, null);
    state.selectedDate = getJSON(STORAGE_KEYS.selectedDate, null);
    state.selectedShowtime = getJSON(STORAGE_KEYS.selectedShowtime, null);
    state.selectedPayment = getJSON(STORAGE_KEYS.selectedPayment, null);
    state.selectedSeats = getJSON(STORAGE_KEYS.selectedSeats, []);
    state.searchQuery = getJSON(STORAGE_KEYS.searchQuery, '');
    state.genreFilter = getJSON(STORAGE_KEYS.genre, 'semua') || 'semua';
    state.filmFilter = getJSON(STORAGE_KEYS.filmFilter, 'semua') || 'semua';
  }

  // ============================================================
  // PUBLIC ACTIONS
  // ============================================================
  async function initialize() {
    restoreBookingState();
    loadStoredTickets();

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = state.searchQuery || '';
      searchInput.addEventListener('input', e => {
        state.searchQuery = e.target.value || '';
        setJSON(STORAGE_KEYS.searchQuery, state.searchQuery);
        // ✅ FIXED: Navigate to film page on search
        if (state.searchQuery.trim()) {
          if (typeof navigateTo === 'function') navigateTo('film');
        }
        renderAllMoviesPage();
        renderHeroAndSections();
      });
    }

    const bookingCinema = document.getElementById('booking-cinema');
    if (bookingCinema) {
      bookingCinema.addEventListener('change', e => {
        const selected = state.cinemas.find(c => String(c.id) === String(e.target.value));
        state.selectedCinema = selected || null;
        state.selectedShowtime = null;
        state.selectedSeats = [];
        persistBookingState();
        renderShowtimeList(getShowtimesForSelected());
        renderSeatGridBase();
      });
    }

    const kotaSelect = document.getElementById('kota-select');
    if (kotaSelect) {
      kotaSelect.addEventListener('change', e => {
        const selected = state.cinemas.find(c => String(c.id) === String(e.target.value));
        state.selectedCinema = selected || null;
        persistBookingState();
        renderShowtimeList(getShowtimesForSelected());
      });
    }

    const [movies, cinemas, showtimes, promos, notifications] = await Promise.all([
      loadMovies(),
      loadCinemas(),
      loadShowtimes(),
      loadPromos(),
      loadNotifications()
    ]);

    renderGenreChips();
    renderCinemaSelectOptions(cinemas);
    renderBookingCinemaSelect(cinemas);
    renderCinemaList(cinemas);
    renderDatePickerBase();
    renderShowtimeList(getShowtimesForSelected());
    renderSeatGridBase();
    renderPayMethodsBase();
    renderPromoList(promos);
    renderNotificationList(notifications);
    renderTicketLists();
    renderHeroAndSections();

    if (!state.selectedMovie && movies.length) {
      const firstNow = movies.find(m => m.isNowPlaying) || movies[0];
      state.selectedMovie = firstNow;
      persistBookingState();
      renderMovieDetail(firstNow);
    }

    refreshNotifBadge();

    // AI text
    const aiText = document.getElementById('ai-text');
    if (aiText && movies.length) {
      const now = movies.filter(m => m.isNowPlaying);
      aiText.textContent = now.length
        ? `${now[0].title} sedang tayang! ${now.length > 1 ? `Dan ${now.length - 1} film lainnya.` : ''}`
        : 'Selamat datang di BE TIX! Silakan tunggu admin menambahkan data film.';
    }
  }

  async function openMovieDetail(movieId) {
    if (!state.movies.length) await loadMovies();
    const movie = state.movies.find(m => String(m.id) === String(movieId)) || null;
    if (movie) renderMovieDetail(movie);
    if (typeof navigateTo === 'function') navigateTo('film-detail');
  }

  function selectDate(isoDate) {
    state.selectedDate = isoDate;
    persistBookingState();
    renderDatePickerBase();
    renderShowtimeList(getShowtimesForSelected());
    renderSeatGridBase();
  }

  function selectShowtime(showtimeId) {
    const showtime = state.showtimes.find(s => String(s.id) === String(showtimeId));
    if (!showtime || showtime.isFull) return;
    state.selectedShowtime = showtime;
    state.selectedSeats = [];
    persistBookingState();
    renderShowtimeList(getShowtimesForSelected());
    renderSeatGridBase();
  }

  function selectPayment(methodId) {
    state.selectedPayment = methodId;
    persistBookingState();
    renderPayMethodsBase();
  }

  function toggleSeat(code) {
    const exists = state.selectedSeats.includes(code);
    state.selectedSeats = exists
      ? state.selectedSeats.filter(s => s !== code)
      : [...state.selectedSeats, code];
    persistBookingState();
    renderSeatGridBase();
  }

  // ✅ HERO CONTROLS
  function heroPrev() {
    const films = window._heroFilms || [];
    if (!films.length) return;
    state.heroIndex = (state.heroIndex - 1 + films.length) % films.length;
    if (state.heroTimer) clearInterval(state.heroTimer);
    if (window._heroRenderSlide) window._heroRenderSlide(state.heroIndex);
    if (films.length > 1) {
      state.heroTimer = setInterval(() => {
        state.heroIndex = (state.heroIndex + 1) % films.length;
        if (window._heroRenderSlide) window._heroRenderSlide(state.heroIndex);
      }, 4500);
    }
  }

  function heroNext() {
    const films = window._heroFilms || [];
    if (!films.length) return;
    state.heroIndex = (state.heroIndex + 1) % films.length;
    if (state.heroTimer) clearInterval(state.heroTimer);
    if (window._heroRenderSlide) window._heroRenderSlide(state.heroIndex);
    if (films.length > 1) {
      state.heroTimer = setInterval(() => {
        state.heroIndex = (state.heroIndex + 1) % films.length;
        if (window._heroRenderSlide) window._heroRenderSlide(state.heroIndex);
      }, 4500);
    }
  }

  function heroGoto(idx) {
    const films = window._heroFilms || [];
    if (!films.length) return;
    state.heroIndex = idx;
    if (state.heroTimer) clearInterval(state.heroTimer);
    if (window._heroRenderSlide) window._heroRenderSlide(state.heroIndex);
    if (films.length > 1) {
      state.heroTimer = setInterval(() => {
        state.heroIndex = (state.heroIndex + 1) % films.length;
        if (window._heroRenderSlide) window._heroRenderSlide(state.heroIndex);
      }, 4500);
    }
  }

  // ✅ FIXED: filterGenre supports film type context
  async function setGenreFilter(genre, el) {
    state.genreFilter = genre || 'semua';
    setJSON(STORAGE_KEYS.genre, state.genreFilter);
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (el && el.classList) el.classList.add('active');
    renderAllMoviesPage();
  }

  // ✅ FIXED: "Lihat Semua" now differentiates between now/coming
  function viewAllFilms(type = 'semua') {
    state.filmFilter = type;
    setJSON(STORAGE_KEYS.filmFilter, type);
    if (typeof navigateTo === 'function') navigateTo('film');
    renderAllMoviesPage();
    // Update active filter chip if any
    updateFilmTypeChips(type);
  }

  function updateFilmTypeChips(type) {
    const nowBtn = document.getElementById('chip-now-playing');
    const comingBtn = document.getElementById('chip-coming-soon');
    const semuaBtn = document.getElementById('chip-semua');
    [nowBtn, comingBtn, semuaBtn].forEach(b => b && b.classList.remove('active'));
    if (type === 'now_playing' && nowBtn) nowBtn.classList.add('active');
    else if (type === 'coming_soon' && comingBtn) comingBtn.classList.add('active');
    else if (semuaBtn) semuaBtn.classList.add('active');
  }

  async function loadBioskop() {
    const cinemas = await loadCinemas();
    renderCinemaSelectOptions(cinemas);
    renderBookingCinemaSelect(cinemas);
    renderCinemaList(cinemas);
  }

  async function renderNowPlaying() {
    const container = getContainer('now-playing');
    if (!container) return;
    const movies = await loadMovies();
    const filtered = movies.filter(m => m.isNowPlaying);
    renderMovieSection(container, filtered, 'Tidak ada film tayang', 'Film akan tampil setelah admin menambahkan data.', '🎬');
    renderHeroCarousel(filtered);
  }

  async function renderComingSoon() {
    const container = getContainer('coming-soon');
    if (!container) return;
    const movies = await loadMovies();
    const filtered = movies.filter(m => m.isComingSoon);
    renderMovieSection(container, filtered, 'Belum ada film segera hadir', 'Daftar film mendatang akan tampil di sini.', '⏳');
  }

  async function renderAllMovies() {
    const movies = await loadMovies();
    state.movies = movies;
    renderAllMoviesPage();
  }

  async function renderDatePicker() { renderDatePickerBase(); }
  async function renderShowtimes() { renderShowtimeList(getShowtimesForSelected()); }
  async function renderSeatGrid() { renderSeatGridBase(); }
  async function renderPayMethods() { renderPayMethodsBase(); }
  async function renderEtiket() { loadStoredTickets(); renderTicketLists(); }
  async function renderRiwayat() { loadStoredTickets(); renderTicketLists(); }

  async function renderPromos() {
    const promos = await loadPromos();
    renderPromoList(promos);
  }

  // ✅ FIXED: Mark as read when user opens notif page
  async function renderNotifications() {
    const notifications = await loadNotifications();
    renderNotificationList(notifications);
    await markNotificationsRead();
  }

  async function loadAIRecommendation() {
    const aiText = document.getElementById('ai-text');
    if (!aiText) return;
    const movies = await loadMovies();
    const now = movies.filter(m => m.isNowPlaying);
    if (!movies.length) {
      aiText.textContent = 'Selamat datang di BE TIX! Silakan tunggu admin menambahkan data film.';
      return;
    }
    aiText.textContent = now.length
      ? `${now[0].title} sedang tayang${now.length > 1 ? ` dan ${now.length - 1} film lainnya!` : '!'}`
      : `Cek film ${movies[0].title} yang akan segera tayang!`;
  }

  async function processPayment() {
    const showtime = state.selectedShowtime || getShowtimesForSelected()[0] || null;
    const cinema = state.selectedCinema || (state.cinemas.length && state.cinemas[0]) || null;
    const movie = state.selectedMovie || (state.movies.length && state.movies[0]) || null;

    if (!movie) { alert('Pilih film terlebih dahulu.'); return; }
    if (!cinema) { alert('Belum ada bioskop yang dipilih.'); return; }
    if (!showtime) { alert('Pilih jadwal tayang terlebih dahulu.'); return; }
    if (!safeArray(state.selectedSeats).length) { alert('Pilih minimal satu kursi.'); return; }
    if (!state.selectedPayment) { alert('Pilih metode pembayaran terlebih dahulu.'); return; }

    const total = safeArray(state.selectedSeats).length * Number(showtime.price || 50000);
    const ticket = {
      id: `TIX-${Date.now()}`,
      title: movie.title, movieTitle: movie.title,
      cinema: cinema.name,
      seats: state.selectedSeats.slice(),
      date: showtime.date || state.selectedDate || new Date().toISOString().slice(0, 10),
      showTime: showtime.time, status: 'Aktif', total,
      paymentMethod: state.selectedPayment,
      created_at: new Date().toISOString()
    };

    const active = safeArray(getJSON(STORAGE_KEYS.ticketsActive, []));
    active.unshift(ticket);
    setJSON(STORAGE_KEYS.ticketsActive, active);

    const history = safeArray(getJSON(STORAGE_KEYS.ticketsHistory, []));
    history.unshift({ ...ticket, status: 'Selesai' });
    setJSON(STORAGE_KEYS.ticketsHistory, history);

    state.activeTickets = active;
    state.historyTickets = history;
    state.selectedSeats = [];
    persistBookingState();

    renderTicketLists();
    renderSeatGridBase();
    renderPayMethodsBase();

    const modal = document.getElementById('success-modal') || document.querySelector('.success-modal');
    if (modal) modal.classList.add('is-open');
    if (typeof navigateTo === 'function') navigateTo('etiket');
  }

  // ============================================================
  // DOM LIFECYCLE
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    initialize().catch(err => console.error('Render init gagal:', err));
  });

  // ============================================================
  // EXPOSE
  // ============================================================
  window.BE_TIX = {
    openMovieDetail,
    selectDate, selectShowtime, selectPayment, toggleSeat,
    processPayment,
    setGenreFilter,
    viewAllFilms,
    heroPrev, heroNext, heroGoto,
    loadBioskop,
    renderNowPlaying, renderComingSoon, renderAllMovies,
    renderDatePicker, renderShowtimes, renderSeatGrid,
    renderPayMethods, renderEtiket, renderRiwayat,
    renderPromos, renderNotifications, loadAIRecommendation,
    state
  };

  // Backwards compat
  window.filterGenre = (genre, el) => BE_TIX.setGenreFilter(genre, el);
  window.processPayment = processPayment;
  window.getMovies = loadMovies;
  window.renderNowPlaying = renderNowPlaying;
  window.renderComingSoon = renderComingSoon;
  window.renderAllMovies = renderAllMovies;
  window.loadBioskop = loadBioskop;
  window.renderDatePicker = renderDatePickerBase;
  window.renderShowtimes = () => renderShowtimeList(getShowtimesForSelected());
  window.renderSeatGrid = renderSeatGridBase;
  window.renderPayMethods = renderPayMethodsBase;
  window.renderEtiket = () => { loadStoredTickets(); renderTicketLists(); };
  window.renderRiwayat = () => { loadStoredTickets(); renderTicketLists(); };
  window.renderPromos = renderPromos;
  window.renderNotifications = renderNotifications;
  window.loadAIRecommendation = loadAIRecommendation;
})();