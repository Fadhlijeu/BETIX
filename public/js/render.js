// ============================================
//  TIX ID — Render Layer (js/render.js)
//  Fungsi-fungsi untuk render UI komponen
// ============================================

// ============================================
//  MOVIE CARDS
// ============================================
function makeMovieCard(movie) {
  const ratingHtml = movie.rating
    ? `⭐ ${movie.rating}`
    : `<span style="color:var(--text-muted)">TBA</span>`;

  const nowTag  = movie.now    ? `<span class="now-tag">TAYANG</span>` : '';
  const comiTag = movie.coming ? `<span class="coming-tag">SEGERA</span>` : '';

  return `
    <div class="movie-card" onclick="openFilmDetail(${movie.id})">
      <div class="movie-poster">
      <img src="${movie.image || '/img/default.jpg'}" class="movie-img">
      </div>
      <div class="movie-info">
        <div class="movie-title" title="${movie.title}">${movie.title}</div>
        <div class="movie-genre">${movie.genre[0]}</div>
        <div class="movie-rating">${ratingHtml}</div>
      </div>
    </div>`;
}

async function getMovies() {
  const response = await fetch('/api/film');
  return await response.json();
}

async function renderNowPlaying() {
  const container = document.getElementById('now-playing');

  const films = await getMovies();

  container.innerHTML = films.map(movie => `
    <div class="movie-card">
      <div class="movie-info">
        <div class="movie-title">${movie.judul}</div>
        <div class="movie-genre">${movie.genre}</div>
        <div class="movie-rating">${movie.durasi} menit</div>
      </div>
    </div>
  `).join('');
}

async function renderComingSoon() {
  const container = document.getElementById('coming-soon');

  const films = await getMovies();

  container.innerHTML = films.map(movie => `
    <div class="movie-card">
      <div class="movie-poster">
        <img src="${movie.image || '/img/default.jpg'}" class="movie-img">
      </div>

      <div class="movie-info">
        <div class="movie-title">${movie.title}</div>
        <div class="movie-genre">${movie.genre}</div>
      </div>
    </div>
  `).join('');
}

async function renderAllMovies() {
  const container = document.getElementById('all-movies');

  const films = await getMovies();

  container.innerHTML = films.map(movie => `
    <div class="movie-card">
      <div class="movie-poster">
        <img src="${movie.image || '/img/default.jpg'}" class="movie-img">
      </div>

      <div class="movie-info">
        <div class="movie-title">${movie.title}</div>
        <div class="movie-genre">${movie.genre}</div>
      </div>
    </div>
  `).join('');
}

function filterGenre(genre, el) {
  document.querySelectorAll('#genre-filters .filter-chip')
    .forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderAllMovies(genre);
}

// ============================================
//  FILM DETAIL
// ============================================
function renderFilmDetail(movie) {
  // Poster
  const poster = document.getElementById('detail-poster');
  poster.style.background = movie.poster_bg;
  poster.textContent = movie.emoji;

  // Judul
  document.getElementById('detail-title').textContent = movie.title;

  // Tags (genre + age rating)
  const tagsEl = document.getElementById('detail-tags');
  const tags = [...movie.genre, movie.age]
    .map(t => `<span class="tag">${t}</span>`).join('');
  tagsEl.innerHTML = tags;

  // Meta
  document.getElementById('detail-meta').textContent =
    `${movie.duration} · ${movie.year}`;

  // Rating
  const ratingEl = document.getElementById('detail-rating');
  if (movie.rating) {
    ratingEl.innerHTML = `⭐ ${movie.rating} <span style="color:var(--text-muted);font-size:12px;font-weight:400">(${movie.reviews} ulasan)</span>`;
  } else {
    ratingEl.textContent = 'Belum ada rating';
  }

  // Sinopsis via AI
  const synopsisEl = document.getElementById('synopsis-text');
  synopsisEl.textContent = 'Memuat sinopsis...';
  fetchMovieSynopsis(movie)
    .then(text => { synopsisEl.textContent = text; })
    .catch(() => {
      synopsisEl.textContent = `${movie.title} menghadirkan pengalaman sinematik luar biasa yang memadukan cerita mendalam dengan visual memukau. Jangan lewatkan penampilan para aktor berbakat dalam karya epik tahun ini.`;
    });
}

// ============================================
//  BIOSKOP LIST
// ============================================
function loadBioskop() {
  const kota = document.getElementById('kota-select').value;
  const list = DATA.bioskops[kota] || [];

  const html = list.map(b => `
    <div class="bioskop-card" onclick="navigateTo('pesan')">
      <div class="bioskop-icon">${b.icon}</div>
      <div>
        <div class="bioskop-name">${b.name}</div>
        <div class="bioskop-location">${b.district}</div>
      </div>
      <div class="bioskop-dist">${b.dist} km</div>
    </div>`).join('');

  document.getElementById('bioskop-list').innerHTML = html;
}

// ============================================
//  DATE PICKER
// ============================================
function renderDatePicker() {
  const days  = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  const today = new Date();
  let html = '';

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const isActive = i === 0 ? 'active' : '';
    html += `
      <div class="date-chip ${isActive}" onclick="selectDate(this)">
        <div class="date-day">${d.getDate()}</div>
        <div class="date-label">${days[d.getDay()]} ${months[d.getMonth()]}</div>
      </div>`;
  }

  document.getElementById('date-picker').innerHTML = html;
}

function selectDate(el) {
  document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ============================================
//  SHOWTIME LIST
// ============================================
function renderShowtimes() {
  const showtimes = [
    { cinema: 'CGV Grand Indonesia · Studio 5 · 2D', times: ['10:00','12:30','15:00','17:30','19:30','21:00','23:30'], full: [2,5] },
    { cinema: 'XXI Senayan City · Studio 3 · IMAX', times: ['11:00','14:00','17:00','20:00'], full: [0] },
  ];

  const html = showtimes.map(s => `
    <div class="showtime-card">
      <div class="showtime-cinema">${s.cinema}</div>
      <div class="showtime-times">
        ${s.times.map((t, i) => `
          <div class="time-chip ${s.full.includes(i) ? 'full' : ''}"
               onclick="if(!this.classList.contains('full')){
                 document.querySelectorAll('.time-chip').forEach(c=>c.classList.remove('selected'));
                 this.classList.add('selected');
               }">
            ${t}
          </div>`).join('')}
      </div>
    </div>`).join('');

  document.getElementById('showtime-list').innerHTML = html;
}

// ============================================
//  SEAT MAP
// ============================================
const ROWS = ['A','B','C','D','E','F','G','H'];
const COLS = 8;
const VIP_ROWS = ['A','B'];
const TAKEN_SEATS = ['B2','B3','C5','C6','E1','F4','F5','F6','G2','H7'];
const SEAT_PRICES = { vip: 75000, regular: 50000 };

function renderSeatGrid() {
  STATE.selectedSeats = {};
  updateSeatSummary();

  let html = '';
  ROWS.forEach(r => {
    html += `<div class="seat-row"><span class="row-label">${r}</span>`;
    for (let c = 1; c <= COLS; c++) {
      const sid = r + c;
      const taken = TAKEN_SEATS.includes(sid);
      const vip = VIP_ROWS.includes(r);
      const cls = ['seat', vip ? 'vip' : '', taken ? 'taken' : 'available'].join(' ');
      const price = vip ? SEAT_PRICES.vip : SEAT_PRICES.regular;
      html += `<div class="${cls}" id="seat-${sid}" title="${sid}${vip?' (VIP)':''}" onclick="toggleSeat('${sid}', ${price})"></div>`;
    }
    html += `</div>`;
  });

  document.getElementById('seat-grid').innerHTML = html;
}

function toggleSeat(id, price) {
  const el = document.getElementById('seat-' + id);
  if (!el || el.classList.contains('taken')) return;

  if (el.classList.contains('selected')) {
    el.classList.remove('selected');
    el.classList.add('available');
    delete STATE.selectedSeats[id];
  } else {
    el.classList.add('selected');
    el.classList.remove('available');
    STATE.selectedSeats[id] = price;
  }
  updateSeatSummary();
}

function updateSeatSummary() {
  const count = Object.keys(STATE.selectedSeats).length;
  const total = Object.values(STATE.selectedSeats).reduce((a, b) => a + b, 0);
  document.getElementById('selected-count').textContent = count;
  document.getElementById('total-price').textContent =
    'Rp ' + total.toLocaleString('id-ID');
}

// ============================================
//  PAYMENT METHODS
// ============================================
function renderPayMethods() {
  const html = DATA.payMethods.map(m => `
    <div class="pay-method" id="pm-${m.id}" onclick="selectPay('${m.id}')">
      <div class="pay-logo">${m.icon}</div>
      <div>
        <div class="pay-name">${m.name}</div>
        <div class="pay-desc">${m.desc}</div>
      </div>
      <div class="pay-check" id="pc-${m.id}">✓</div>
    </div>`).join('');

  document.getElementById('pay-methods').innerHTML = html;
}

function selectPay(id) {
  document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('selected'));
  const el = document.getElementById('pm-' + id);
  if (el) el.classList.add('selected');
  STATE.selectedPayMethod = id;
}

// ============================================
//  E-TICKET
// ============================================
function renderEtiket() {
  const html = DATA.activeTickets.map(t => `
    <div class="ticket-card">
      <div class="ticket-header">
        <div class="ticket-poster">${t.emoji}</div>
        <div>
          <div class="ticket-movie-title">${t.movie}</div>
          <div class="ticket-detail">${t.cinema}</div>
          <div class="ticket-detail">${t.datetime}</div>
        </div>
      </div>
      <div class="ticket-body">
        <div class="ticket-row"><span class="ticket-key">Kursi</span><span class="ticket-val">${t.seats}</span></div>
        <div class="ticket-row"><span class="ticket-key">Tipe Kursi</span><span class="ticket-val">${t.type}</span></div>
        <div class="ticket-row"><span class="ticket-key">Total Bayar</span><span class="ticket-val gold-text">${t.total}</span></div>
        <div class="ticket-row no-border"><span class="ticket-key">Metode Bayar</span><span class="ticket-val">${t.payment}</span></div>
      </div>
      <div class="qr-section">
        <div class="qr-code">${generateQRSVG()}</div>
        <div class="qr-text">Tunjukkan QR Code ini di pintu masuk bioskop</div>
      </div>
    </div>`).join('');

  document.getElementById('etiket-list').innerHTML = html;
}

function generateQRSVG() {
  // QR code simulasi menggunakan grid SVG
  const pattern = [
    1,1,1,0,1,0,1,
    1,0,1,0,0,1,1,
    1,1,1,0,1,0,0,
    0,0,0,1,1,1,0,
    1,0,1,1,0,0,1,
    1,1,0,0,1,0,1,
    0,1,1,1,1,1,1,
  ];
  const size = 7;
  const cellSize = 10;
  const total = size * cellSize;
  let rects = '';
  pattern.forEach((bit, i) => {
    const x = (i % size) * cellSize;
    const y = Math.floor(i / size) * cellSize;
    if (bit) rects += `<rect x="${x}" y="${y}" width="${cellSize - 1}" height="${cellSize - 1}" fill="#000"/>`;
  });
  return `<svg width="${total}" height="${total}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

// ============================================
//  RIWAYAT
// ============================================
function renderRiwayat() {
  const html = DATA.historyTickets.map(t => `
    <div class="riwayat-card">
      <div class="riwayat-poster">${t.emoji}</div>
      <div style="flex:1">
        <div class="riwayat-title">${t.movie}</div>
        <div class="riwayat-meta">${t.cinema}</div>
        <div class="riwayat-meta">${t.datetime} · ${t.seats}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
          <span class="riwayat-status ${t.status}">${t.status === 'selesai' ? '✓ Selesai' : '✗ Dibatalkan'}</span>
          <span style="font-size:12px;font-weight:600;color:var(--gold)">${t.total}</span>
        </div>
      </div>
    </div>`).join('');

  document.getElementById('riwayat-list').innerHTML = html;
}

// ============================================
//  PROMO
// ============================================
function renderPromos() {
  const promoHtml = DATA.promos.map(p => `
    <div class="promo-card">
      <div class="promo-badge" style="background:${p.color}22;color:${p.color}">${p.badge}</div>
      <div class="promo-title">${p.title}</div>
      <div class="promo-desc">${p.desc}</div>
    </div>`).join('');

  document.getElementById('promo-list').innerHTML = promoHtml;

  const voucherHtml = DATA.vouchers.map(v => `
    <div class="voucher-card">
      <div>
        <div class="voucher-code">${v.code}</div>
        <div class="voucher-info">Diskon ${v.discount} · Min ${v.min}</div>
        <div class="voucher-info" style="margin-top:2px">Berlaku s.d. ${v.expire}</div>
      </div>
      <button class="use-btn">Pakai</button>
    </div>`).join('');

  document.getElementById('voucher-list').innerHTML = voucherHtml;
}

// ============================================
//  NOTIFIKASI
// ============================================
function renderNotifications() {
  const html = DATA.notifications.map(n => `
    <div class="notif-card ${n.unread ? 'unread' : ''}">
      <div class="notif-icon">${n.icon}</div>
      <div style="flex:1">
        <div class="notif-title">${n.title}</div>
        <div class="notif-desc">${n.desc}</div>
        <div class="notif-time">${n.time}</div>
      </div>
      ${n.unread ? '<div class="notif-dot"></div>' : ''}
    </div>`).join('');

  document.getElementById('notif-list').innerHTML = html;
}

// ============================================
//  AI REKOMENDASI (Beranda)
// ============================================
function loadAIRecommendation() {
  const userProfile = { name: 'Andi', favoriteGenres: ['aksi', 'sci-fi'], lastWatched: 'Dune: Part Two' };

  fetchPersonalRecommendation(userProfile)
    .then(text => {
      document.getElementById('ai-text').textContent = text;
    })
    .catch(() => {
      document.getElementById('ai-text').textContent =
        'Berdasarkan tontonan terakhirmu, kami rekomendasikan Deadpool & Wolverine, aksi non-stop yang pasti menghibur malam ini!';
    });
}


const currentUser = JSON.parse(localStorage.getItem('user'));
console.log(currentUser);

const user = JSON.parse(localStorage.getItem('user'));

if (user && user.role === 'admin') {

  document.getElementById('admin-panel').style.display = 'block';

}