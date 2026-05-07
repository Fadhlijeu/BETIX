// ============================================
//  TIX ID — API Layer (js/api.js)
//  Koneksi ke Anthropic API untuk fitur AI
// ============================================

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Fungsi utama untuk memanggil Anthropic API
 * @param {string} prompt - prompt yang dikirim ke AI
 * @param {number} maxTokens - batas token output
 * @returns {Promise<string>} - teks respons dari AI
 */
async function callAnthropicAPI(prompt, maxTokens = 300) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // API key dihandle oleh Anthropic proxy saat dijalankan di claude.ai
      // Untuk deploy mandiri, tambahkan: 'x-api-key': 'sk-ant-...'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content
    ?.filter(block => block.type === 'text')
    ?.map(block => block.text)
    ?.join('') || '';

  return text.trim();
}

/**
 * Mengambil sinopsis film dari AI
 * @param {Object} movie - objek film
 * @returns {Promise<string>}
 */
async function fetchMovieSynopsis(movie) {
  const genreText = movie.genre.join(', ');
  const prompt = `Kamu adalah penulis sinopsis film profesional Indonesia. 
Tulis sinopsis menarik dalam bahasa Indonesia untuk film berjudul "${movie.title}" 
bergenre ${genreText}, tahun ${movie.year}, durasi ${movie.duration}.
Sinopsis harus terdiri dari 3-4 kalimat yang informatif dan menggugah rasa ingin tahu.
Langsung tulis sinopsisnya tanpa label, tanda kutip, atau penjelasan tambahan.`;

  return await callAnthropicAPI(prompt, 200);
}

/**
 * Mengambil rekomendasi personal dari AI
 * @param {Object} userProfile - profil pengguna (genre favorit, dll)
 * @returns {Promise<string>}
 */
async function fetchPersonalRecommendation(userProfile = {}) {
  const favoriteGenres = userProfile.favoriteGenres || ['aksi', 'sci-fi'];
  const lastWatched = userProfile.lastWatched || 'Dune: Part Two';

  const prompt = `Kamu adalah asisten rekomendasi film BE TIX yang ramah dan personal.
Pengguna bernama ${userProfile.name || 'Andi'} suka film ${favoriteGenres.join(' dan ')}, 
terakhir menonton "${lastWatched}".
Film yang tersedia saat ini: Interstellar, Deadpool & Wolverine, Inside Out 3, Transformers One.
Tulis 1 kalimat rekomendasi yang personal, antusias, dan spesifik (sebutkan 1 judul film).
Gunakan nada santai, tidak formal. Langsung tulis kalimatnya saja tanpa awalan apapun.`;

  return await callAnthropicAPI(prompt, 120);
}

/**
 * Mengambil info promo relevan dari AI
 * @param {string} movieTitle - judul film yang dipilih
 * @returns {Promise<string>}
 */
async function fetchPromoSuggestion(movieTitle) {
  const prompt = `Kamu adalah asisten BE TIX. Film yang dipilih pengguna: "${movieTitle}".
Buat 1 kalimat singkat yang menyarankan promo atau diskon yang relevan (contoh: cashback, voucher member).
Nada promosi tapi tidak berlebihan. Maksimal 20 kata. Langsung tulis kalimatnya saja.`;

  return await callAnthropicAPI(prompt, 80);
}

/**
 * Mengambil rekomendasi kursi dari AI
 * @param {string} cinema - nama bioskop
 * @param {string} time - jam tayang
 * @returns {Promise<string>}
 */
async function fetchSeatRecommendation(cinema, time) {
  const prompt = `Kamu adalah asisten pemilihan kursi bioskop BE TIX.
Bioskop: ${cinema}, jam tayang: ${time}.
Berikan 1 saran singkat tentang posisi kursi terbaik untuk pengalaman menonton optimal.
Maksimal 15 kata. Langsung tulis sarannya saja tanpa awalan.`;

  return await callAnthropicAPI(prompt, 60);
}

// ============================================
//  Helper: Tampilkan loading state sementara
// ============================================
function showLoading(elementId, message = 'Memuat...') {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
  }
}

function showText(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = text;
}

function showError(elementId, fallback) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = fallback;
}