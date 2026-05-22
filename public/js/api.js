// ============================================
//  BE TIX — API Layer
//  Safe wrappers for AI features and backend
//  requests that may not always be available.
// ============================================

(function () {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL = 'claude-sonnet-4-20250514';

  function safeJsonParse(value, fallback = null) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  async function callAnthropicAPI(prompt, maxTokens = 300) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.content
        ?.filter((block) => block.type === 'text')
        ?.map((block) => block.text)
        ?.join('') || '';

      return text.trim();
    } catch (err) {
      console.error('Anthropic API gagal:', err);
      return '';
    }
  }

  async function fetchMovieSynopsis(movie) {
    if (!movie || !movie.title) return 'Sinopsis belum tersedia.';

    const genreText = Array.isArray(movie.genreList)
      ? movie.genreList.join(', ')
      : String(movie.genre || movie.genreText || 'film');

    const prompt = `Kamu adalah penulis sinopsis film profesional Indonesia. 
Tulis sinopsis menarik dalam bahasa Indonesia untuk film berjudul "${movie.title}" 
bergenre ${genreText}, tahun ${movie.year || '-'}, durasi ${movie.duration || '-'}. 
Sinopsis harus terdiri dari 3-4 kalimat yang informatif dan menggugah rasa ingin tahu.
Langsung tulis sinopsisnya tanpa label, tanda kutip, atau penjelasan tambahan.`;

    const result = await callAnthropicAPI(prompt, 200);
    return result || movie.synopsis || 'Sinopsis belum tersedia.';
  }

  async function fetchPersonalRecommendation(userProfile = {}) {
    const favoriteGenres = userProfile.favoriteGenres || ['aksi', 'sci-fi'];
    const lastWatched = userProfile.lastWatched || 'Dune: Part Two';

    const prompt = `Kamu adalah asisten rekomendasi film BE TIX yang ramah dan personal.
Pengguna bernama ${userProfile.name || userProfile.nama || 'Andi'} suka film ${favoriteGenres.join(' dan ')},

terakhir menonton "${lastWatched}".
Film yang tersedia saat ini: Interstellar, Deadpool & Wolverine, Inside Out 3, Transformers One.
Tulis 1 kalimat rekomendasi yang personal, antusias, dan spesifik (sebutkan 1 judul film).
Gunakan nada santai, tidak formal. Langsung tulis kalimatnya saja tanpa awalan apapun.`;

    const result = await callAnthropicAPI(prompt, 120);
    return result || 'Selamat datang di BE TIX! Coba cek film terbaru hari ini.';
  }

  async function fetchPromoSuggestion(movieTitle) {
    const prompt = `Kamu adalah asisten BE TIX. Film yang dipilih pengguna: "${movieTitle}".
Buat 1 kalimat singkat yang menyarankan promo atau diskon yang relevan (contoh: cashback, voucher member).
Nada promosi tapi tidak berlebihan. Maksimal 20 kata. Langsung tulis kalimatnya saja.`;

    const result = await callAnthropicAPI(prompt, 80);
    return result || 'Cek promo dan voucher aktif untuk hemat lebih banyak.';
  }

  async function fetchSeatRecommendation(cinema, time) {
    const prompt = `Kamu adalah asisten pemilihan kursi bioskop BE TIX.
Bioskop: ${cinema}, jam tayang: ${time}.
Berikan 1 saran singkat tentang posisi kursi terbaik untuk pengalaman menonton optimal.
Maksimal 15 kata. Langsung tulis sarannya saja tanpa awalan.`;

    const result = await callAnthropicAPI(prompt, 60);
    return result || 'Pilih kursi tengah agak belakang untuk pengalaman terbaik.';
  }

  // ------------------------------
  // Backend API helpers
  // ------------------------------
  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Request gagal (${response.status})`);
    }
    return data;
  }

  async function getMovies() {
    try {
      const data = await requestJson('/api/film');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Gagal mengambil film:', err);
      return [];
    }
  }

  async function getCinemas() {
    try {
      const data = await requestJson('/api/bioskop');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Gagal mengambil bioskop:', err);
      return [];
    }
  }

  async function getShowtimes() {
    try {
      const data = await requestJson('/api/jadwal');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Gagal mengambil jadwal:', err);
      return [];
    }
  }

  async function getPromos() {
    try {
      const data = await requestJson('/api/promos');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Gagal mengambil promo:', err);
      return [];
    }
  }

  async function getNotifications() {
    try {
      const data = await requestJson('/api/notifications');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Gagal mengambil notifikasi:', err);
      return [];
    }
  }

  async function getTickets() {
    try {
      const data = await requestJson('/api/tiket');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Gagal mengambil tiket:', err);
      return [];
    }
  }

  async function getTransactions() {
    try {
      const data = await requestJson('/api/transaksi');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Gagal mengambil transaksi:', err);
      return [];
    }
  }

  async function getUsers() {
    try {
      const data = await requestJson('/api/users');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Gagal mengambil users:', err);
      return [];
    }
  }

  // ------------------------------
  // Expose globals for legacy calls
  // ------------------------------
  window.callAnthropicAPI = callAnthropicAPI;
  window.fetchMovieSynopsis = fetchMovieSynopsis;
  window.fetchPersonalRecommendation = fetchPersonalRecommendation;
  window.fetchPromoSuggestion = fetchPromoSuggestion;
  window.fetchSeatRecommendation = fetchSeatRecommendation;

  window.getMovies = getMovies;
  window.getCinemas = getCinemas;
  window.getShowtimes = getShowtimes;
  window.getPromos = getPromos;
  window.getNotifications = getNotifications;
  window.getTickets = getTickets;
  window.getTransactions = getTransactions;
  window.getUsers = getUsers;

  window.BE_TIX_API = {
    requestJson,
    safeJsonParse,
    getMovies,
    getCinemas,
    getShowtimes,
    getPromos,
    getNotifications,
    getTickets,
    getTransactions,
    getUsers,
    fetchMovieSynopsis,
    fetchPersonalRecommendation,
    fetchPromoSuggestion,
    fetchSeatRecommendation
  };
})();
