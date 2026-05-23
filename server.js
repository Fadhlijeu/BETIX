// ============================================
//  BE TIX — Backend Server (Fixed & Enhanced)
//  Critical fixes:
//  1. Studio management endpoints
//  2. Genre as array/list
//  3. Better foreign key handling
//  4. Sinopsis JSON support
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'BE-TIX-ADMIN-2026';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, 'public');
const SYNOPSIS_DIR = path.join(__dirname, 'data', 'synopsis');

app.use(express.static(PUBLIC_DIR));

// Ensure synopsis directory exists
(async () => {
  try {
    await fs.mkdir(SYNOPSIS_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create synopsis directory:', err);
  }
})();

app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get(['/login', '/login.html'], (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
app.get(['/register', '/register.html'], (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'register.html')));
app.get('/admin.html', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'betix_db',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: false
});

async function pingDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log('✅ Database connected');
  } finally {
    conn.release();
  }
}

function safeDbMessage(err) {
  if (!err) return 'Terjadi kesalahan server';
  if (err.code === 'ER_NO_SUCH_TABLE') return 'Tabel database belum tersedia';
  if (err.code === 'ER_BAD_FIELD_ERROR') return 'Struktur kolom database belum sesuai';
  if (err.code === 'ER_DUP_ENTRY') return 'Data sudah terdaftar';
  if (err.code === 'WARN_DATA_TRUNCATED') return 'Nilai data tidak sesuai dengan tipe kolom';
  if (String(err.message || '').includes('foreign key constraint fails')) {
    return 'Data relasi belum lengkap. Pastikan studio/cinema/movie sudah ada.';
  }
  return err.message || 'Terjadi kesalahan server';
}

function normalizeRole(role) {
  const value = String(role || 'user').trim().toLowerCase();
  if (value === 'administrator') return 'admin';
  if (value === 'customer') return 'user';
  if (value === 'admin' || value === 'user') return value;
  return 'user';
}

function pick(body, keys, fallback = '') {
  for (const key of keys) {
    const value = body && body[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
}

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toFloat(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolInt(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes' ? 1 : 0;
}

function buildUpdateClause(map) {
  const entries = Object.entries(map).filter(([, value]) => value !== undefined);
  if (!entries.length) return { clause: '', values: [] };
  return {
    clause: entries.map(([key]) => `${key} = ?`).join(', '),
    values: entries.map(([, value]) => value)
  };
}

function sendError(res, err, status = 500) {
  console.error(err);
  return res.status(status).json({
    success: false,
    message: safeDbMessage(err),
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
}

async function queryRows(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await queryRows(sql, params);
  return rows[0] || null;
}

// ============================================
// SYNOPSIS JSON HELPERS
// ============================================
async function saveSynopsis(movieId, synopsis) {
  if (!synopsis) return;
  const filePath = path.join(SYNOPSIS_DIR, `${movieId}.json`);
  await fs.writeFile(filePath, JSON.stringify({ synopsis, updated_at: new Date().toISOString() }), 'utf8');
}

async function loadSynopsis(movieId) {
  try {
    const filePath = path.join(SYNOPSIS_DIR, `${movieId}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    return data.synopsis || '';
  } catch (err) {
    return '';
  }
}

async function deleteSynopsis(movieId) {
  try {
    const filePath = path.join(SYNOPSIS_DIR, `${movieId}.json`);
    await fs.unlink(filePath);
  } catch (err) {
    // Ignore if file doesn't exist
  }
}

// ============================================
// MOVIE BODY NORMALIZER (with genre array)
// ============================================
function normalizeMovieBody(body = {}) {
  const genreValue = pick(body, ['genre', 'genres', 'kategori'], '');
  
  // Parse genre as array
  let genreArray = [];
  if (Array.isArray(genreValue)) {
    genreArray = genreValue.filter(Boolean);
  } else if (typeof genreValue === 'string' && genreValue.trim()) {
    genreArray = genreValue.split(',').map(g => g.trim()).filter(Boolean);
  }
  
  const genreString = genreArray.join(', ');

  return {
    title: pick(body, ['title', 'judul', 'name'], ''),
    duration: String(pick(body, ['duration', 'durasi'], '')).slice(0, 6),
    genre: genreString,
    genreArray, // Keep for response
    synopsis: pick(body, ['synopsis', 'sinopsis', 'description'], ''),
    poster: pick(body, ['poster', 'image', 'gambar', 'img'], ''),
    rating: toFloat(pick(body, ['rating', 'nilai', 'score'], null), null),
    year: toInt(pick(body, ['year', 'tahun'], null), null),
    is_now_playing: toBoolInt(body.is_now_playing ?? body.now ?? body.isNowPlaying ?? body.status === 'now_playing'),
    is_coming_soon: toBoolInt(body.is_coming_soon ?? body.coming ?? body.isComingSoon ?? body.status === 'coming_soon')
  };
}

function normalizeCinemaBody(body = {}) {
  return {
    name: pick(body, ['name', 'nama', 'nama_bioskop'], ''),
    city: pick(body, ['city', 'kota'], null),
    location: pick(body, ['location', 'alamat', 'address', 'lokasi'], '')
  };
}

function normalizeStudioBody(body = {}) {
  return {
    cinema_id: toInt(pick(body, ['cinema_id', 'id_bioskop', 'bioskop_id'], null), null),
    name: pick(body, ['name', 'nama', 'nama_studio'], ''),
    seat_capacity: toInt(pick(body, ['seat_capacity', 'kapasitas'], 40), 40)
  };
}

function normalizeScheduleBody(body = {}) {
  return {
    movie_id: toInt(pick(body, ['movie_id', 'id_film', 'film_id'], null), null),
    studio_id: toInt(pick(body, ['studio_id', 'id_studio'], null), null),
    show_date: pick(body, ['show_date', 'tanggal', 'date'], ''),
    show_time: pick(body, ['show_time', 'jam', 'time'], ''),
    price: toInt(pick(body, ['price', 'harga'], 35000), 35000),
    cinema_id: pick(body, ['cinema_id', 'id_bioskop', 'bioskop_id'], null)
  };
}

async function resolveCinemaIdFromStudio(studioId) {
  const studio = await queryOne('SELECT cinema_id FROM studios WHERE id = ? LIMIT 1', [studioId]);
  return studio ? toInt(studio.cinema_id, null) : null;
}

async function createScheduleEntry(entry, fallbackMovieId = null) {
  const movieId = toInt(entry.movie_id ?? fallbackMovieId, null);
  const studioId = toInt(entry.studio_id, null);
  const showDate = entry.show_date;
  const showTime = entry.show_time;
  const price = toInt(entry.price, 35000);

  if (!movieId || !studioId || !showDate || !showTime) {
    const err = new Error('movie_id, studio_id, show_date, dan show_time wajib diisi');
    err.statusCode = 400;
    throw err;
  }

  // Verify studio exists
  const studio = await queryOne('SELECT id, cinema_id FROM studios WHERE id = ? LIMIT 1', [studioId]);
  if (!studio) {
    const err = new Error(`Studio dengan ID ${studioId} tidak ditemukan. Buat studio terlebih dahulu.`);
    err.statusCode = 404;
    throw err;
  }

  const cinemaId = entry.cinema_id ? toInt(entry.cinema_id, null) : studio.cinema_id;

  const [result] = await pool.query(
    'INSERT INTO schedules (movie_id, studio_id, show_date, show_time, price, cinema_id) VALUES (?, ?, ?, ?, ?, ?)',
    [movieId, studioId, showDate, showTime, price, cinemaId]
  );

  return result.insertId;
}

function normalizeNotificationBody(body = {}) {
  return {
    title: pick(body, ['title', 'judul'], ''),
    message: pick(body, ['message', 'pesan'], ''),
    image: pick(body, ['image', 'gambar'], ''),
    target_role: normalizeRole(pick(body, ['target_role', 'targetRole'], 'user')),
    unread: body.unread !== undefined ? toBoolInt(body.unread) : 1
  };
}

function normalizeTransactionBody(body = {}) {
  return {
    user_id: toInt(pick(body, ['user_id', 'id_user'], null), null),
    total_price: toInt(pick(body, ['total_price', 'total'], null), null),
    payment_method: pick(body, ['payment_method'], ''),
    payment_status: pick(body, ['payment_status'], 'pending')
  };
}

function normalizeTicketBody(body = {}) {
  return {
    transaction_id: toInt(pick(body, ['transaction_id'], null), null),
    schedule_id: toInt(pick(body, ['schedule_id'], null), null),
    seat_code: pick(body, ['seat_code'], ''),
    qr_code: pick(body, ['qr_code'], ''),
    status: pick(body, ['status'], 'active')
  };
}

// ============================================
// AUTH
// ============================================
app.post('/register', async (req, res) => {
  try {
    const name = pick(req.body, ['name', 'nama', 'username'], '');
    const email = pick(req.body, ['email'], '');
    const password = pick(req.body, ['password'], '');
    const role = normalizeRole(pick(req.body, ['role'], 'user'));

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi' });
    }

    if (role === 'admin') {
      const adminPasscode = String(req.body.adminPasscode || '').trim();
      if (!adminPasscode || adminPasscode !== ADMIN_PASSCODE) {
        return res.status(403).json({ success: false, message: 'Admin passcode tidak valid' });
      }
    }

    const [result] = await pool.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, password, role]);

    return res.json({ success: true, message: 'Register berhasil', user: { id: result.insertId, name, email, role } });
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/login', async (req, res) => {
  try {
    const email = pick(req.body, ['email'], '');
    const password = pick(req.body, ['password'], '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });
    }

    const user = await queryOne('SELECT id, name, email, password, role, points, created_at FROM users WHERE email = ? AND password = ? LIMIT 1', [email, password]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Login gagal' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        created_at: user.created_at
      }
    });
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/api/users/update-password', async (req, res) => {
  try {
    const userId = toInt(req.body.userId, null);
    const oldPassword = pick(req.body, ['oldPassword'], '');
    const newPassword = pick(req.body, ['newPassword'], '');

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'userId, oldPassword, dan newPassword wajib diisi' });
    }

    const user = await queryOne('SELECT id, password FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    if (user.password !== oldPassword) {
      return res.status(400).json({ success: false, message: 'Password lama salah' });
    }

    await pool.query('UPDATE users SET password = ? WHERE id = ?', [newPassword, userId]);
    return res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    return sendError(res, err);
  }
});

// ============================================
// USERS
// ============================================
app.get('/api/users', async (_req, res) => {
  try {
    const rows = await queryRows('SELECT id, name, email, role, points, created_at FROM users ORDER BY id DESC');
    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const updates = {
      name: pick(req.body, ['name', 'nama', 'username'], undefined),
      email: pick(req.body, ['email'], undefined),
      password: pick(req.body, ['password'], undefined),
      role: req.body.role !== undefined ? normalizeRole(req.body.role) : undefined,
      points: req.body.points !== undefined ? toInt(req.body.points, undefined) : undefined
    };

    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });

    await pool.query(`UPDATE users SET ${clause} WHERE id = ?`, [...values, id]);
    return res.json({ success: true, message: 'User berhasil diperbarui' });
  } catch (err) {
    return sendError(res, err);
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

// ============================================
// MOVIES (with synopsis JSON)
// ============================================
app.get('/api/movies', async (_req, res) => {
  try {
    const rows = await queryRows('SELECT id, title, duration, genre, poster, rating, is_now_playing, is_coming_soon, created_at, year FROM movies ORDER BY id DESC');
    
    // Load synopsis from JSON files
    const moviesWithSynopsis = await Promise.all(
      rows.map(async (movie) => {
        const synopsis = await loadSynopsis(movie.id);
        const genreArray = movie.genre ? movie.genre.split(',').map(g => g.trim()) : [];
        
        // Determine status
        let status = '';
        if (movie.is_now_playing) status = 'now_playing';
        else if (movie.is_coming_soon) status = 'coming_soon';
        
        return {
          ...movie,
          synopsis,
          genreArray,
          status,
          now: movie.is_now_playing,
          coming: movie.is_coming_soon
        };
      })
    );
    
    return res.json(moviesWithSynopsis);
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route (for backwards compatibility)
app.get('/api/film', async (_req, res) => {
  try {
    const rows = await queryRows('SELECT id, title, duration, genre, poster, rating, is_now_playing, is_coming_soon, created_at, year FROM movies ORDER BY id DESC');
    const moviesWithSynopsis = await Promise.all(rows.map(async (movie) => {
      const synopsis = await loadSynopsis(movie.id);
      const genreArray = movie.genre ? movie.genre.split(',').map(g => g.trim()) : [];
      const status = movie.is_now_playing ? 'now_playing' : movie.is_coming_soon ? 'coming_soon' : '';
      return { ...movie, synopsis, genreArray, status, now: movie.is_now_playing, coming: movie.is_coming_soon };
    }));
    return res.json(moviesWithSynopsis);
  } catch (err) { return sendError(res, err); }
});

app.post('/api/movies', async (req, res) => {
  try {
    const payload = normalizeMovieBody(req.body);

    if (!payload.title || !payload.duration || !payload.genre) {
      return res.status(400).json({ success: false, message: 'Title, duration, dan genre wajib diisi' });
    }

    const [result] = await pool.query(
      'INSERT INTO movies (title, duration, genre, poster, rating, is_now_playing, is_coming_soon, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [payload.title, payload.duration, payload.genre, payload.poster, payload.rating, payload.is_now_playing, payload.is_coming_soon, payload.year]
    );

    const movieId = result.insertId;
    
    // Save synopsis to JSON
    if (payload.synopsis) {
      await saveSynopsis(movieId, payload.synopsis);
    }

    return res.json({ success: true, message: 'Film berhasil disimpan', id: movieId });
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route
app.post('/api/film', async (req, res) => {
  try {
    const payload = normalizeMovieBody(req.body);
    if (!payload.title || !payload.duration || !payload.genre) {
      return res.status(400).json({ success: false, message: 'Title, duration, dan genre wajib diisi' });
    }
    const [result] = await pool.query(
      'INSERT INTO movies (title, duration, genre, poster, rating, is_now_playing, is_coming_soon, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [payload.title, payload.duration, payload.genre, payload.poster, payload.rating, payload.is_now_playing, payload.is_coming_soon, payload.year]
    );
    if (payload.synopsis) await saveSynopsis(result.insertId, payload.synopsis);
    return res.json({ success: true, message: 'Film berhasil disimpan', id: result.insertId });
  } catch (err) { return sendError(res, err); }
});

app.put('/api/movies/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const body = normalizeMovieBody(req.body);
    
    const updates = {
      title: body.title,
      duration: body.duration,
      genre: body.genre,
      poster: body.poster,
      rating: body.rating,
      is_now_playing: body.is_now_playing,
      is_coming_soon: body.is_coming_soon,
      year: body.year
    };

    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });

    await pool.query(`UPDATE movies SET ${clause} WHERE id = ?`, [...values, id]);
    
    // Update synopsis
    if (body.synopsis !== undefined) {
      if (body.synopsis) {
        await saveSynopsis(id, body.synopsis);
      } else {
        await deleteSynopsis(id);
      }
    }
    
    return res.json({ success: true, message: 'Film berhasil diperbarui' });
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route
app.put('/api/film/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const body = normalizeMovieBody(req.body);
    const updates = { title: body.title, duration: body.duration, genre: body.genre, poster: body.poster, rating: body.rating, is_now_playing: body.is_now_playing, is_coming_soon: body.is_coming_soon, year: body.year };
    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });
    await pool.query(`UPDATE movies SET ${clause} WHERE id = ?`, [...values, id]);
    if (body.synopsis !== undefined) { if (body.synopsis) await saveSynopsis(id, body.synopsis); else await deleteSynopsis(id); }
    return res.json({ success: true, message: 'Film berhasil diperbarui' });
  } catch (err) { return sendError(res, err); }
});

app.delete('/api/movies/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM movies WHERE id = ?', [id]);
    await deleteSynopsis(id);
    return res.json({ success: true, message: 'Film berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route
app.delete('/api/film/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM movies WHERE id = ?', [id]);
    await deleteSynopsis(id);
    return res.json({ success: true, message: 'Film berhasil dihapus' });
  } catch (err) { return sendError(res, err); }
});

// ============================================
// CINEMAS
// ============================================
app.get('/api/cinemas', async (_req, res) => {
  try {
    const rows = await queryRows('SELECT id, name, city, location, created_at FROM cinemas ORDER BY id DESC');
    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route
app.get('/api/bioskop', async (_req, res) => {
  try {
    const rows = await queryRows('SELECT id, name, city, location, created_at FROM cinemas ORDER BY id DESC');
    return res.json(rows);
  } catch (err) { return sendError(res, err); }
});

app.post('/api/cinemas', async (req, res) => {
  try {
    const payload = normalizeCinemaBody(req.body);

    if (!payload.name || !payload.location) {
      return res.status(400).json({ success: false, message: 'Nama bioskop dan location wajib diisi' });
    }

    const [result] = await pool.query('INSERT INTO cinemas (name, city, location) VALUES (?, ?, ?)', [payload.name, payload.city, payload.location]);
    return res.json({ success: true, message: 'Bioskop berhasil disimpan', id: result.insertId });
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route
app.post('/api/bioskop', async (req, res) => {
  try {
    const payload = normalizeCinemaBody(req.body);
    if (!payload.name || !payload.location) return res.status(400).json({ success: false, message: 'Nama bioskop dan location wajib diisi' });
    const [result] = await pool.query('INSERT INTO cinemas (name, city, location) VALUES (?, ?, ?)', [payload.name, payload.city, payload.location]);
    return res.json({ success: true, message: 'Bioskop berhasil disimpan', id: result.insertId });
  } catch (err) { return sendError(res, err); }
});

app.put('/api/cinemas/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const payload = normalizeCinemaBody(req.body);
    const updates = { name: payload.name, city: payload.city, location: payload.location };

    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });

    await pool.query(`UPDATE cinemas SET ${clause} WHERE id = ?`, [...values, id]);
    return res.json({ success: true, message: 'Bioskop berhasil diperbarui' });
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route
app.put('/api/bioskop/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const payload = normalizeCinemaBody(req.body);
    const updates = { name: payload.name, city: payload.city, location: payload.location };
    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });
    await pool.query(`UPDATE cinemas SET ${clause} WHERE id = ?`, [...values, id]);
    return res.json({ success: true, message: 'Bioskop berhasil diperbarui' });
  } catch (err) { return sendError(res, err); }
});

app.delete('/api/cinemas/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM cinemas WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Bioskop berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route
app.delete('/api/bioskop/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM cinemas WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Bioskop berhasil dihapus' });
  } catch (err) { return sendError(res, err); }
});

// ============================================
// STUDIOS (NEW - Critical for schedules!)
// ============================================
app.get('/api/studios', async (req, res) => {
  try {
    const cinemaId = req.query.cinema_id ? toInt(req.query.cinema_id, null) : null;
    const rows = cinemaId
      ? await queryRows('SELECT id, cinema_id, name, seat_capacity FROM studios WHERE cinema_id = ? ORDER BY id DESC', [cinemaId])
      : await queryRows('SELECT id, cinema_id, name, seat_capacity FROM studios ORDER BY id DESC');
    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/api/studios', async (req, res) => {
  try {
    const payload = normalizeStudioBody(req.body);
    if (!payload.cinema_id || !payload.name) {
      return res.status(400).json({ success: false, message: 'cinema_id dan name studio wajib diisi' });
    }

    const [result] = await pool.query('INSERT INTO studios (cinema_id, name, seat_capacity) VALUES (?, ?, ?)', [payload.cinema_id, payload.name, payload.seat_capacity]);
    return res.json({ success: true, message: 'Studio berhasil disimpan', id: result.insertId });
  } catch (err) {
    return sendError(res, err);
  }
});

app.put('/api/studios/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const payload = normalizeStudioBody(req.body);
    const updates = { cinema_id: payload.cinema_id, name: payload.name, seat_capacity: payload.seat_capacity };

    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });

    await pool.query(`UPDATE studios SET ${clause} WHERE id = ?`, [...values, id]);
    return res.json({ success: true, message: 'Studio berhasil diperbarui' });
  } catch (err) {
    return sendError(res, err);
  }
});

app.delete('/api/studios/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM studios WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Studio berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

// ============================================
// SEATS
// ============================================
app.get('/api/seats', async (req, res) => {
  try {
    const studioId = req.query.studio_id ? toInt(req.query.studio_id, null) : null;
    const rows = studioId
      ? await queryRows('SELECT id, studio_id, seat_number FROM seats WHERE studio_id = ? ORDER BY id ASC', [studioId])
      : await queryRows('SELECT id, studio_id, seat_number FROM seats ORDER BY id ASC');
    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/api/seats', async (req, res) => {
  try {
    const studioId = toInt(pick(req.body, ['studio_id'], null), null);
    const seatNumber = pick(req.body, ['seat_number'], '');

    if (!studioId || !seatNumber) {
      return res.status(400).json({ success: false, message: 'studio_id dan seat_number wajib diisi' });
    }

    const [result] = await pool.query('INSERT INTO seats (studio_id, seat_number) VALUES (?, ?)', [studioId, seatNumber]);
    return res.json({ success: true, message: 'Seat berhasil disimpan', id: result.insertId });
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/api/seats/bulk', async (req, res) => {
  try {
    const studioId = toInt(pick(req.body, ['studio_id'], null), null);
    const seatNumbers = Array.isArray(req.body.seat_numbers) ? req.body.seat_numbers : [];

    if (!studioId || !seatNumbers.length) {
      return res.status(400).json({ success: false, message: 'studio_id dan seat_numbers wajib diisi' });
    }

    const values = seatNumbers.map((seat) => [studioId, String(seat)]);
    await pool.query('INSERT INTO seats (studio_id, seat_number) VALUES ?', [values]);
    return res.json({ success: true, message: 'Seat bulk berhasil disimpan', total: values.length });
  } catch (err) {
    return sendError(res, err);
  }
});

app.delete('/api/seats/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM seats WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Seat berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

// ============================================
// SCHEDULES (Enhanced with bulk support)
// ============================================
app.get('/api/schedules', async (req, res) => {
  try {
    const movieId = req.query.movie_id ? toInt(req.query.movie_id, null) : null;
    const studioId = req.query.studio_id ? toInt(req.query.studio_id, null) : null;
    const cinemaId = req.query.cinema_id ? toInt(req.query.cinema_id, null) : null;

    const clauses = [];
    const params = [];
    if (movieId) {
      clauses.push('movie_id = ?');
      params.push(movieId);
    }
    if (studioId) {
      clauses.push('studio_id = ?');
      params.push(studioId);
    }
    if (cinemaId) {
      clauses.push('cinema_id = ?');
      params.push(cinemaId);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await queryRows(
      `SELECT id, movie_id, studio_id, show_date, show_time, price, cinema_id FROM schedules ${where} ORDER BY show_date DESC, show_time DESC`,
      params
    );

    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route
app.get('/api/jadwal', async (req, res) => {
  try {
    const movieId = req.query.movie_id ? toInt(req.query.movie_id, null) : null;
    const studioId = req.query.studio_id ? toInt(req.query.studio_id, null) : null;
    const cinemaId = req.query.cinema_id ? toInt(req.query.cinema_id, null) : null;
    const clauses = []; const params = [];
    if (movieId) { clauses.push('movie_id = ?'); params.push(movieId); }
    if (studioId) { clauses.push('studio_id = ?'); params.push(studioId); }
    if (cinemaId) { clauses.push('cinema_id = ?'); params.push(cinemaId); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await queryRows(`SELECT id, movie_id, studio_id, show_date, show_time, price, cinema_id FROM schedules ${where} ORDER BY show_date DESC, show_time DESC`, params);
    return res.json(rows);
  } catch (err) { return sendError(res, err); }
});

app.post('/api/schedules', async (req, res) => {
  try {
    const payload = normalizeScheduleBody(req.body);
    const insertedId = await createScheduleEntry(payload);
    return res.json({ success: true, message: 'Jadwal berhasil disimpan', id: insertedId });
  } catch (err) {
    return sendError(res, err, err.statusCode || 500);
  }
});

// Legacy route
app.post('/api/jadwal', async (req, res) => {
  try {
    const payload = normalizeScheduleBody(req.body);
    const insertedId = await createScheduleEntry(payload);
    return res.json({ success: true, message: 'Jadwal berhasil disimpan', id: insertedId });
  } catch (err) { return sendError(res, err, err.statusCode || 500); }
});

app.post('/api/schedules/bulk', async (req, res) => {
  try {
    const body = req.body || {};
    const fallbackMovieId = toInt(pick(body, ['movie_id'], null), null);

    let entries = [];
    if (Array.isArray(body.schedules)) entries = body.schedules;
    if (!entries.length && Array.isArray(body.entries)) entries = body.entries;

    if (!entries.length) {
      return res.status(400).json({ success: false, message: 'schedules atau entries wajib berupa array' });
    }

    const inserted = [];
    const errors = [];
    
    for (let i = 0; i < entries.length; i++) {
      try {
        const id = await createScheduleEntry(entries[i], fallbackMovieId);
        inserted.push(id);
      } catch (err) {
        errors.push({ index: i, message: err.message });
      }
    }

    return res.json({ 
      success: errors.length === 0, 
      message: `Bulk jadwal: ${inserted.length} berhasil${errors.length > 0 ? `, ${errors.length} gagal` : ''}`, 
      ids: inserted,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    return sendError(res, err, err.statusCode || 500);
  }
});

// Legacy route
app.post('/api/jadwal/bulk', async (req, res) => {
  try {
    const body = req.body || {};
    const fallbackMovieId = toInt(pick(body, ['movie_id'], null), null);
    let entries = Array.isArray(body.schedules) ? body.schedules : (Array.isArray(body.entries) ? body.entries : []);
    if (!entries.length) return res.status(400).json({ success: false, message: 'schedules atau entries wajib berupa array' });
    const inserted = []; const errors = [];
    for (let i = 0; i < entries.length; i++) {
      try { inserted.push(await createScheduleEntry(entries[i], fallbackMovieId)); }
      catch (err) { errors.push({ index: i, message: err.message }); }
    }
    return res.json({ success: errors.length === 0, message: `Bulk jadwal: ${inserted.length} berhasil${errors.length > 0 ? `, ${errors.length} gagal` : ''}`, ids: inserted, errors: errors.length > 0 ? errors : undefined });
  } catch (err) { return sendError(res, err, err.statusCode || 500); }
});

app.put('/api/schedules/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const payload = normalizeScheduleBody(req.body);

    const updates = {
      movie_id: payload.movie_id,
      studio_id: payload.studio_id,
      show_date: payload.show_date,
      show_time: payload.show_time,
      price: payload.price,
      cinema_id: payload.cinema_id ? toInt(payload.cinema_id, null) : undefined
    };

    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });

    await pool.query(`UPDATE schedules SET ${clause} WHERE id = ?`, [...values, id]);
    return res.json({ success: true, message: 'Jadwal berhasil diperbarui' });
  } catch (err) {
    return sendError(res, err, err.statusCode || 500);
  }
});

// Legacy route
app.put('/api/jadwal/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const payload = normalizeScheduleBody(req.body);
    const updates = { movie_id: payload.movie_id, studio_id: payload.studio_id, show_date: payload.show_date, show_time: payload.show_time, price: payload.price, cinema_id: payload.cinema_id ? toInt(payload.cinema_id, null) : undefined };
    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });
    await pool.query(`UPDATE schedules SET ${clause} WHERE id = ?`, [...values, id]);
    return res.json({ success: true, message: 'Jadwal berhasil diperbarui' });
  } catch (err) { return sendError(res, err, err.statusCode || 500); }
});

app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM schedules WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Jadwal berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route
app.delete('/api/jadwal/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM schedules WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Jadwal berhasil dihapus' });
  } catch (err) { return sendError(res, err); }
});

// ============================================
// NOTIFICATIONS
// ============================================
app.get('/api/notifications', async (_req, res) => {
  try {
    const rows = await queryRows('SELECT id, title, message, image, target_role, unread, created_at FROM notifications ORDER BY id DESC');
    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const payload = normalizeNotificationBody(req.body);
    if (!payload.title || !payload.message) {
      return res.status(400).json({ success: false, message: 'Judul dan pesan notifikasi wajib diisi' });
    }

    const [result] = await pool.query(
      'INSERT INTO notifications (title, message, image, target_role, unread) VALUES (?, ?, ?, ?, ?)',
      [payload.title, payload.message, payload.image, payload.target_role, payload.unread]
    );

    return res.json({ success: true, message: 'Notifikasi berhasil dibuat', id: result.insertId });
  } catch (err) {
    return sendError(res, err);
  }
});

app.put('/api/notifications/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const updates = {
      title: pick(req.body, ['title'], undefined),
      message: pick(req.body, ['message'], undefined),
      image: pick(req.body, ['image'], undefined),
      target_role: req.body.target_role !== undefined ? normalizeRole(req.body.target_role) : undefined,
      unread: req.body.unread !== undefined ? toBoolInt(req.body.unread) : undefined
    };

    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });

    await pool.query(`UPDATE notifications SET ${clause} WHERE id = ?`, [...values, id]);
    return res.json({ success: true, message: 'Notifikasi berhasil diperbarui' });
  } catch (err) {
    return sendError(res, err);
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM notifications WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Notifikasi berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/api/notifications/mark-read', async (req, res) => {
  try {
    const targetRole = req.body.target_role ? normalizeRole(req.body.target_role) : 'user';
    await pool.query('UPDATE notifications SET unread = 0 WHERE target_role = ? OR ? = "all"', [targetRole, targetRole]);
    return res.json({ success: true, message: 'Notifikasi ditandai sudah dibaca' });
  } catch (err) {
    return sendError(res, err);
  }
});

// ============================================
// TICKETS
// ============================================
app.get('/api/tickets', async (req, res) => {
  try {
    const userId = req.query.user_id ? toInt(req.query.user_id, null) : null;
    const scheduleId = req.query.schedule_id ? toInt(req.query.schedule_id, null) : null;

    const clauses = [];
    const params = [];
    if (userId) {
      clauses.push('tr.user_id = ?');
      params.push(userId);
    }
    if (scheduleId) {
      clauses.push('t.schedule_id = ?');
      params.push(scheduleId);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = await queryRows(
      `SELECT t.id, t.transaction_id, t.schedule_id, t.seat_code, t.qr_code, t.status,
              tr.user_id, tr.total_price, tr.payment_method, tr.payment_status, tr.created_at
       FROM tickets t
       LEFT JOIN transactions tr ON tr.id = t.transaction_id
       ${where}
       ORDER BY t.id DESC`,
      params
    );

    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

// Legacy route
app.get('/api/tiket', async (req, res) => {
  try {
    const userId = req.query.user_id ? toInt(req.query.user_id, null) : null;
    const scheduleId = req.query.schedule_id ? toInt(req.query.schedule_id, null) : null;
    const clauses = []; const params = [];
    if (userId) { clauses.push('tr.user_id = ?'); params.push(userId); }
    if (scheduleId) { clauses.push('t.schedule_id = ?'); params.push(scheduleId); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await queryRows(`SELECT t.id, t.transaction_id, t.schedule_id, t.seat_code, t.qr_code, t.status, tr.user_id, tr.total_price, tr.payment_method, tr.payment_status, tr.created_at FROM tickets t LEFT JOIN transactions tr ON tr.id = t.transaction_id ${where} ORDER BY t.id DESC`, params);
    return res.json(rows);
  } catch (err) { return sendError(res, err); }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const payload = normalizeTicketBody(req.body);
    if (!payload.transaction_id || !payload.schedule_id) {
      return res.status(400).json({ success: false, message: 'transaction_id dan schedule_id wajib diisi' });
    }

    const [result] = await pool.query(
      'INSERT INTO tickets (transaction_id, schedule_id, seat_code, qr_code, status) VALUES (?, ?, ?, ?, ?)',
      [payload.transaction_id, payload.schedule_id, payload.seat_code, payload.qr_code, payload.status]
    );

    return res.json({ success: true, message: 'Ticket berhasil dibuat', id: result.insertId });
  } catch (err) {
    return sendError(res, err);
  }
});

app.put('/api/tickets/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const updates = {
      transaction_id: req.body.transaction_id !== undefined ? toInt(req.body.transaction_id, null) : undefined,
      schedule_id: req.body.schedule_id !== undefined ? toInt(req.body.schedule_id, null) : undefined,
      seat_code: pick(req.body, ['seat_code'], undefined),
      qr_code: pick(req.body, ['qr_code'], undefined),
      status: pick(req.body, ['status'], undefined)
    };

    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });

    await pool.query(`UPDATE tickets SET ${clause} WHERE id = ?`, [...values, id]);
    return res.json({ success: true, message: 'Ticket berhasil diperbarui' });
  } catch (err) {
    return sendError(res, err);
  }
});

app.delete('/api/tickets/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM tickets WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Ticket berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

// ============================================
// TRANSACTIONS + DETAILS
// ============================================
app.get('/api/transactions', async (_req, res) => {
  try {
    const rows = await queryRows('SELECT id, user_id, total_price, payment_method, payment_status, created_at FROM transactions ORDER BY id DESC');
    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

app.get('/api/transaksi', async (_req, res) => {
  try {
    const rows = await queryRows('SELECT id, user_id, total_price, payment_method, payment_status, created_at FROM transactions ORDER BY id DESC');
    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const payload = normalizeTransactionBody(req.body);
    if (!payload.user_id || payload.total_price === null) {
      return res.status(400).json({ success: false, message: 'user_id dan total_price wajib diisi' });
    }

    const [result] = await pool.query(
      'INSERT INTO transactions (user_id, total_price, payment_method, payment_status) VALUES (?, ?, ?, ?)',
      [payload.user_id, payload.total_price, payload.payment_method, payload.payment_status]
    );

    return res.json({ success: true, message: 'Transaksi berhasil dibuat', id: result.insertId });
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/api/transaksi', async (req, res) => {
  try {
    const payload = normalizeTransactionBody(req.body);
    if (!payload.user_id || payload.total_price === null) {
      return res.status(400).json({ success: false, message: 'user_id dan total_price wajib diisi' });
    }

    const [result] = await pool.query(
      'INSERT INTO transactions (user_id, total_price, payment_method, payment_status) VALUES (?, ?, ?, ?)',
      [payload.user_id, payload.total_price, payload.payment_method, payload.payment_status]
    );

    return res.json({ success: true, message: 'Transaksi berhasil dibuat', id: result.insertId });
  } catch (err) {
    return sendError(res, err);
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const updates = {
      user_id: req.body.user_id !== undefined ? toInt(req.body.user_id, null) : undefined,
      total_price: req.body.total_price !== undefined ? toInt(req.body.total_price, null) : undefined,
      payment_method: pick(req.body, ['payment_method'], undefined),
      payment_status: pick(req.body, ['payment_status'], undefined)
    };

    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });

    await pool.query(`UPDATE transactions SET ${clause} WHERE id = ?`, [...values, id]);
    return res.json({ success: true, message: 'Transaksi berhasil diperbarui' });
  } catch (err) {
    return sendError(res, err);
  }
});

app.put('/api/transaksi/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    const updates = {
      user_id: req.body.user_id !== undefined ? toInt(req.body.user_id, null) : undefined,
      total_price: req.body.total_price !== undefined ? toInt(req.body.total_price, null) : undefined,
      payment_method: pick(req.body, ['payment_method'], undefined),
      payment_status: pick(req.body, ['payment_status'], undefined)
    };

    const { clause, values } = buildUpdateClause(updates);
    if (!clause) return res.status(400).json({ success: false, message: 'Tidak ada data untuk diubah' });

    await pool.query(`UPDATE transactions SET ${clause} WHERE id = ?`, [...values, id]);
    return res.json({ success: true, message: 'Transaksi berhasil diperbarui' });
  } catch (err) {
    return sendError(res, err);
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM transactions WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Transaksi berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

app.delete('/api/transaksi/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM transactions WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Transaksi berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

app.get('/api/transaction-details', async (_req, res) => {
  try {
    const rows = await queryRows('SELECT id, transaction_id, ticket_id FROM transaction_details ORDER BY id DESC');
    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

app.get('/api/detail-transaksi', async (_req, res) => {
  try {
    const rows = await queryRows('SELECT id, transaction_id, ticket_id FROM transaction_details ORDER BY id DESC');
    return res.json(rows);
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/api/transaction-details', async (req, res) => {
  try {
    const transactionId = toInt(pick(req.body, ['transaction_id'], null), null);
    const ticketId = toInt(pick(req.body, ['ticket_id'], null), null);

    if (!transactionId || !ticketId) {
      return res.status(400).json({ success: false, message: 'transaction_id dan ticket_id wajib diisi' });
    }

    const [result] = await pool.query('INSERT INTO transaction_details (transaction_id, ticket_id) VALUES (?, ?)', [transactionId, ticketId]);
    return res.json({ success: true, message: 'Detail transaksi berhasil dibuat', id: result.insertId });
  } catch (err) {
    return sendError(res, err);
  }
});

app.post('/api/detail-transaksi', async (req, res) => {
  try {
    const transactionId = toInt(pick(req.body, ['transaction_id'], null), null);
    const ticketId = toInt(pick(req.body, ['ticket_id'], null), null);

    if (!transactionId || !ticketId) {
      return res.status(400).json({ success: false, message: 'transaction_id dan ticket_id wajib diisi' });
    }

    const [result] = await pool.query('INSERT INTO transaction_details (transaction_id, ticket_id) VALUES (?, ?)', [transactionId, ticketId]);
    return res.json({ success: true, message: 'Detail transaksi berhasil dibuat', id: result.insertId });
  } catch (err) {
    return sendError(res, err);
  }
});

app.delete('/api/transaction-details/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM transaction_details WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Detail transaksi berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

app.delete('/api/detail-transaksi/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    await pool.query('DELETE FROM transaction_details WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Detail transaksi berhasil dihapus' });
  } catch (err) {
    return sendError(res, err);
  }
});

// ============================================
// PROMOS
// ============================================
app.get('/api/promos', async (_req, res) => {
  try {
    const promos = await queryRows('SELECT id, title, duration, genre, poster, rating, is_now_playing, is_coming_soon, year, created_at FROM movies ORDER BY created_at DESC, id DESC');
    return res.json(promos.slice(0, 10));
  } catch (err) {
    return sendError(res, err);
  }
});

// ============================================
// HEALTH
// ============================================
app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// START
// ============================================
(async () => {
  try {
    await pingDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Server running di http://localhost:${PORT}`);
      console.log(`📊 Admin passcode: ${ADMIN_PASSCODE}`);
    });
  } catch (err) {
    console.error('❌ Gagal connect ke database:', err);
    app.listen(PORT, () => {
      console.log(`⚠️  Server running di http://localhost:${PORT} (database belum siap)`);
    });
  }
})();