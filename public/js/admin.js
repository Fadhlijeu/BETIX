// ============================================
//  BE TIX — Admin JS (Fixed & Enhanced)
//  Fixes:
//  1. Edit functionality (film, bioskop, jadwal)
//  2. Genre as multi-select list
//  3. Studio dropdown loaded from API
//  4. Status display fix (not "-")
//  5. User management (ban, pw reset, delete)
//  6. Bulk schedule upload
// ============================================

(function () {
  const ADMIN_SESSION_KEY = 'user_session';
  const toastState = { timer: null };
  let editingId = { film: null, cinema: null, showtime: null, notification: null };

  const GENRES = ['Aksi','Drama','Komedi','Horor','Thriller','Animasi','Sci-Fi','Romansa','Petualangan','Dokumenter','Fantasi','Biografi'];

  function safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function getSessionUser() { return safeParse(localStorage.getItem(ADMIN_SESSION_KEY)); }

  function requireAdmin() {
    const user = getSessionUser();
    if (!user) { window.location.assign('/login.html'); return null; }
    if (String(user.role || '').toLowerCase() !== 'admin') { window.location.assign('/index.html'); return null; }
    return user;
  }

  function el(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
  }

  function showToast(message, type = 'info') {
    const toast = el('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = type === 'error' ? 'rgba(230,57,70,0.4)' : 'rgba(255,183,3,0.3)';
    toast.classList.add('show');
    clearTimeout(toastState.timer);
    toastState.timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || `Request gagal (${res.status})`);
    return data;
  }

  function setActiveSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = el(id); if (target) target.classList.add('active');
    document.querySelectorAll('.nav-btn[data-target]').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-target="${id}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  function renderEmptyRow(tbody, colspan, message = 'Data belum tersedia.') {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${colspan}"><div class="empty">${escapeHtml(message)}</div></td></tr>`;
  }

  function getFormData(form) { return Object.fromEntries(new FormData(form).entries()); }
  function resetForm(form) { if (form) form.reset(); }

  // ============================================================
  // GENRE MULTI-SELECT
  // ============================================================
  function renderGenreMultiSelect(containerId, selectedGenres = []) {
    const container = el(containerId);
    if (!container) return;
    const sel = Array.isArray(selectedGenres) ? selectedGenres : String(selectedGenres).split(',').map(g => g.trim()).filter(Boolean);
    container.innerHTML = GENRES.map(g => `
      <label style="
        display:inline-flex;align-items:center;gap:5px;
        padding:5px 11px;border-radius:999px;cursor:pointer;
        border:1px solid ${sel.includes(g) ? 'var(--red)' : 'var(--line)'};
        background:${sel.includes(g) ? 'rgba(230,57,70,0.14)' : 'rgba(255,255,255,0.03)'};
        font-size:12px;font-weight:600;transition:all 0.15s;
        color:${sel.includes(g) ? '#fff' : 'var(--muted)'};
      ">
        <input type="checkbox" name="genre_${g}" value="${g}" ${sel.includes(g) ? 'checked' : ''}
               style="display:none;" onchange="BE_TIX_ADMIN.toggleGenreChip(this)">
        ${escapeHtml(g)}
      </label>`).join('');
  }

  function getSelectedGenres(containerId) {
    const container = el(containerId);
    if (!container) return [];
    return [...container.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
  }

  // ============================================================
  // LOAD DATA
  // ============================================================
  async function loadData() {
    try {
      const [films, cinemas, showtimes, users, transactions, notifications, studios] = await Promise.all([
        fetch('/api/movies').then(r => r.json()).catch(() => []),
        fetch('/api/cinemas').then(r => r.json()).catch(() => []),
        fetch('/api/schedules').then(r => r.json()).catch(() => []),
        fetch('/api/users').then(r => r.json()).catch(() => []),
        fetch('/api/transactions').then(r => r.json()).catch(() => []),
        fetch('/api/notifications').then(r => r.json()).catch(() => []),
        fetch('/api/studios').then(r => r.json()).catch(() => [])
      ]);

      renderDashboard(films, cinemas, showtimes, users, transactions, notifications);
      renderFilmTable(films);
      renderCinemaTable(cinemas);
      renderShowtimeTable(showtimes, films, cinemas, studios);
      renderUsersTable(users);
      renderTransactionsTable(transactions);
      renderNotificationsTable(notifications);
      renderStudiosTable(studios, cinemas);
      populateLinkedSelects(films, cinemas, studios);

      window._adminData = { films, cinemas, showtimes, users, transactions, notifications, studios };
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  function renderDashboard(films, cinemas, showtimes, users, transactions, notifications) {
    ['count-films','count-cinemas','count-showtimes','count-users'].forEach((id, i) => {
      const counts = [films.length, cinemas.length, showtimes.length, users.length];
      const e = el(id); if (e) e.textContent = counts[i];
    });
    const empty = el('dashboard-empty');
    if (empty) {
      const paid = transactions.filter(t => t.payment_status === 'paid').length;
      const revenue = transactions.filter(t => t.payment_status === 'paid').reduce((s, t) => s + (t.total_price || 0), 0);
      empty.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;text-align:left;">
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:12px;padding:14px;">
            <div style="color:var(--muted);font-size:11px;margin-bottom:4px;">Film Tayang</div>
            <div style="font-size:20px;font-weight:800;">${films.filter(f => f.is_now_playing).length}</div>
          </div>
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:12px;padding:14px;">
            <div style="color:var(--muted);font-size:11px;margin-bottom:4px;">Film Segera</div>
            <div style="font-size:20px;font-weight:800;">${films.filter(f => f.is_coming_soon).length}</div>
          </div>
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:12px;padding:14px;">
            <div style="color:var(--muted);font-size:11px;margin-bottom:4px;">Transaksi Sukses</div>
            <div style="font-size:20px;font-weight:800;color:#7bf2b5;">${paid}</div>
          </div>
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:12px;padding:14px;">
            <div style="color:var(--muted);font-size:11px;margin-bottom:4px;">Total Revenue</div>
            <div style="font-size:16px;font-weight:800;color:var(--gold);">Rp ${revenue.toLocaleString('id-ID')}</div>
          </div>
        </div>
        <div style="margin-top:12px;font-size:12px;color:var(--muted);text-align:center;">
          Studio: ${(window._adminData?.studios||[]).length} • Notifikasi: ${notifications.length}
        </div>`;
    }
  }

  // ============================================================
  // FILM TABLE
  // ============================================================
  function getStatusBadge(film) {
    if (film.is_now_playing == 1 || film.is_now_playing === true) {
      return `<span class="badge admin">Now Playing</span>`;
    }
    if (film.is_coming_soon == 1 || film.is_coming_soon === true) {
      return `<span class="badge user">Coming Soon</span>`;
    }
    return `<span class="badge" style="background:rgba(255,255,255,0.06);color:var(--muted)">Draft</span>`;
  }

  function renderFilmTable(films) {
    const tbody = el('table-films');
    if (!tbody) return;
    if (!films.length) return renderEmptyRow(tbody, 6, 'Belum ada film.');
    tbody.innerHTML = films.map(film => `
      <tr>
        <td>${escapeHtml(film.id ?? '-')}</td>
        <td>
          <div style="font-weight:700;">${escapeHtml(film.title || '-')}</div>
          <div style="font-size:11px;color:var(--muted);">${escapeHtml(film.genre || '-')}</div>
        </td>
        <td>${escapeHtml(film.duration || '-')}</td>
        <td>${escapeHtml(film.year || '-')}</td>
        <td>${getStatusBadge(film)}</td>
        <td>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" data-action="edit-film" data-id="${film.id}">✏️ Edit</button>
          <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" data-action="delete-film" data-id="${film.id}">🗑 Hapus</button>
        </td>
      </tr>`).join('');
  }

  // ============================================================
  // CINEMA TABLE
  // ============================================================
  function renderCinemaTable(cinemas) {
    const tbody = el('table-cinemas');
    if (!tbody) return;
    if (!cinemas.length) return renderEmptyRow(tbody, 5, 'Belum ada bioskop.');
    tbody.innerHTML = cinemas.map(c => `
      <tr>
        <td>${escapeHtml(c.id ?? '-')}</td>
        <td style="font-weight:700;">${escapeHtml(c.name || '-')}</td>
        <td>${escapeHtml(c.city || '-')}</td>
        <td>${escapeHtml(c.location || '-')}</td>
        <td>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" data-action="edit-cinema" data-id="${c.id}">✏️ Edit</button>
          <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" data-action="delete-cinema" data-id="${c.id}">🗑 Hapus</button>
        </td>
      </tr>`).join('');
  }

  // ============================================================
  // SHOWTIME TABLE
  // ============================================================
  function renderShowtimeTable(showtimes, films, cinemas, studios) {
    const tbody = el('table-showtimes');
    if (!tbody) return;
    if (!showtimes.length) return renderEmptyRow(tbody, 8, 'Belum ada jadwal.');
    tbody.innerHTML = showtimes.map(s => {
      const film = films.find(f => String(f.id) === String(s.movie_id)) || {};
      const cinema = cinemas.find(c => String(c.id) === String(s.cinema_id)) || {};
      const studio = studios.find(st => String(st.id) === String(s.studio_id)) || {};
      return `
        <tr>
          <td>${escapeHtml(s.id ?? '-')}</td>
          <td style="font-weight:700;">${escapeHtml(film.title || '-')}</td>
          <td>${escapeHtml(cinema.name || '-')}</td>
          <td>${escapeHtml(studio.name || s.studio_id || '-')}</td>
          <td>${escapeHtml(s.show_date || '-')}</td>
          <td>${escapeHtml(s.show_time || '-')}</td>
          <td>Rp ${Number(s.price || 0).toLocaleString('id-ID')}</td>
          <td>
            <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" data-action="edit-showtime" data-id="${s.id}">✏️ Edit</button>
            <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" data-action="delete-showtime" data-id="${s.id}">🗑 Hapus</button>
          </td>
        </tr>`;
    }).join('');
  }

  // ============================================================
  // STUDIOS TABLE
  // ============================================================
  function renderStudiosTable(studios, cinemas) {
    const tbody = el('table-studios');
    if (!tbody) return;
    if (!studios.length) return renderEmptyRow(tbody, 5, 'Belum ada studio.');
    tbody.innerHTML = studios.map(s => {
      const cinema = cinemas.find(c => String(c.id) === String(s.cinema_id)) || {};
      return `
        <tr>
          <td>${escapeHtml(s.id ?? '-')}</td>
          <td style="font-weight:700;">${escapeHtml(s.name || '-')}</td>
          <td>${escapeHtml(cinema.name || '-')}</td>
          <td>${escapeHtml(s.seat_capacity || 40)}</td>
          <td>
            <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" data-action="delete-studio" data-id="${s.id}">🗑 Hapus</button>
          </td>
        </tr>`;
    }).join('');
  }

  // ============================================================
  // USERS TABLE (with management)
  // ============================================================
  function renderUsersTable(users) {
    const tbody = el('table-users');
    if (!tbody) return;
    if (!users.length) return renderEmptyRow(tbody, 6, 'Belum ada user.');
    tbody.innerHTML = users.map(user => `
      <tr>
        <td>${escapeHtml(user.id ?? '-')}</td>
        <td style="font-weight:700;">${escapeHtml(user.name || '-')}</td>
        <td>${escapeHtml(user.email || '-')}</td>
        <td>
          <span class="badge ${(user.role || 'user').toLowerCase()}">${escapeHtml(user.role || 'user')}</span>
        </td>
        <td>${escapeHtml(user.points || 0)} pts</td>
        <td>
          <button class="btn btn-ghost" style="padding:5px 9px;font-size:11px;" data-action="view-pw" data-id="${user.id}" data-pw="${escapeHtml(user.password || '')}">🔑 PW</button>
          <button class="btn btn-ghost" style="padding:5px 9px;font-size:11px;" data-action="reset-pw" data-id="${user.id}">♻️ Reset</button>
          <button class="btn btn-danger" style="padding:5px 9px;font-size:11px;" data-action="delete-user" data-id="${user.id}">🗑</button>
        </td>
      </tr>`).join('');
  }

  // ============================================================
  // TRANSACTIONS TABLE
  // ============================================================
  function renderTransactionsTable(transactions) {
    const tbody = el('table-transactions');
    if (!tbody) return;
    if (!transactions.length) return renderEmptyRow(tbody, 5, 'Belum ada transaksi.');
    tbody.innerHTML = transactions.map(tx => {
      const statusColor = tx.payment_status === 'paid' ? 'admin' : tx.payment_status === 'cancelled' ? 'danger' : 'user';
      return `
        <tr>
          <td>${escapeHtml(tx.id ?? '-')}</td>
          <td>${escapeHtml(tx.user_id || '-')}</td>
          <td>Rp ${Number(tx.total_price || 0).toLocaleString('id-ID')}</td>
          <td><span class="badge ${statusColor}">${escapeHtml(tx.payment_status || 'pending')}</span></td>
          <td>${escapeHtml(tx.created_at ? new Date(tx.created_at).toLocaleDateString('id-ID') : '-')}</td>
        </tr>`;
    }).join('');
  }

  // ============================================================
  // NOTIFICATIONS TABLE
  // ============================================================
  function renderNotificationsTable(notifications) {
    const tbody = el('table-notifications');
    if (!tbody) return;
    if (!notifications.length) return renderEmptyRow(tbody, 5, 'Belum ada notifikasi.');
    tbody.innerHTML = notifications.map(n => `
      <tr>
        <td>${escapeHtml(n.id ?? '-')}</td>
        <td style="font-weight:700;">${escapeHtml(n.title || '-')}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n.message || '-')}</td>
        <td>${escapeHtml(n.created_at ? new Date(n.created_at).toLocaleDateString('id-ID') : '-')}</td>
        <td>
          <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" data-action="delete-notification" data-id="${n.id}">🗑 Hapus</button>
        </td>
      </tr>`).join('');
  }

  // ============================================================
  // POPULATE SELECTS
  // ============================================================
  function populateLinkedSelects(films, cinemas, studios) {
    const movieSelect = el('movie-select');
    const cinemaSelect = el('cinema-select');
    const studioSelect = el('studio-select');
    const studioCinemaSelect = el('studio-cinema-select');

    if (movieSelect) {
      movieSelect.innerHTML = films.length
        ? films.map(f => `<option value="${escapeHtml(String(f.id))}">${escapeHtml(f.title || '-')}</option>`).join('')
        : `<option value="">Belum ada film</option>`;
    }

    if (cinemaSelect) {
      cinemaSelect.innerHTML = cinemas.length
        ? cinemas.map(c => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.name || '-')}</option>`).join('')
        : `<option value="">Belum ada bioskop</option>`;
    }

    // ✅ FIXED: Studio as dropdown, not text input
    if (studioSelect) {
      studioSelect.innerHTML = studios.length
        ? `<option value="">Pilih Studio</option>` + studios.map(s => {
            const cinema = (window._adminData?.cinemas || cinemas).find(c => String(c.id) === String(s.cinema_id)) || {};
            return `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(cinema.name || 'Bioskop ?')} (${s.seat_capacity} kursi)</option>`;
          }).join('')
        : `<option value="">Belum ada studio — buat studio dulu</option>`;
    }

    if (studioCinemaSelect) {
      studioCinemaSelect.innerHTML = cinemas.length
        ? `<option value="">Pilih Bioskop</option>` + cinemas.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
        : `<option value="">Belum ada bioskop</option>`;
    }
  }

  // ============================================================
  // SUBMIT FILM
  // ============================================================
  async function submitFilm(form) {
    const data = getFormData(form);
    const genres = getSelectedGenres('genre-multiselect');

    if (!data.title || !data.duration || !genres.length) {
      showToast('Judul, durasi, dan minimal 1 genre wajib diisi.', 'error');
      return;
    }

    const payload = {
      title: data.title,
      duration: data.duration,
      genre: genres.join(', '),
      poster: data.poster || '',
      rating: data.rating || null,
      year: data.year || null,
      synopsis: data.synopsis || '',
      is_now_playing: data.status === 'now_playing' ? 1 : 0,
      is_coming_soon: data.status === 'coming_soon' ? 1 : 0
    };

    const isEditing = !!editingId.film;
    const url = isEditing ? `/api/movies/${editingId.film}` : '/api/movies';
    const method = isEditing ? 'PUT' : 'POST';

    await fetchJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    resetForm(form);
    editingId.film = null;
    updateFormEditState('form-film', false, 'film');
    renderGenreMultiSelect('genre-multiselect');
    showToast(isEditing ? 'Film berhasil diperbarui' : 'Film berhasil disimpan');
    await loadData();
  }

  // ============================================================
  // SUBMIT CINEMA
  // ============================================================
  async function submitCinema(form) {
    const payload = getFormData(form);
    const isEditing = !!editingId.cinema;
    const url = isEditing ? `/api/cinemas/${editingId.cinema}` : '/api/cinemas';
    const method = isEditing ? 'PUT' : 'POST';
    await fetchJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    resetForm(form);
    editingId.cinema = null;
    updateFormEditState('form-cinema', false, 'cinema');
    showToast(isEditing ? 'Bioskop berhasil diperbarui' : 'Bioskop berhasil disimpan');
    await loadData();
  }

  // ============================================================
  // SUBMIT STUDIO
  // ============================================================
  async function submitStudio(form) {
    const payload = getFormData(form);
    if (!payload.cinema_id || !payload.name) {
      showToast('Bioskop dan nama studio wajib diisi.', 'error'); return;
    }
    await fetchJson('/api/studios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    resetForm(form);
    showToast('Studio berhasil dibuat');
    await loadData();
  }

  // ============================================================
  // SUBMIT SHOWTIME (with bulk)
  // ============================================================
  async function submitShowtime(form) {
    const data = getFormData(form);
    const movieId = data.movie_id;
    const studioId = data.studio_id;
    const price = data.price || 50000;

    if (!movieId || !studioId) {
      showToast('Film dan studio wajib dipilih.', 'error'); return;
    }

    // Collect all schedule rows
    const rows = document.querySelectorAll('.schedule-row');
    if (!rows.length) {
      showToast('Tambahkan minimal 1 jadwal.', 'error'); return;
    }

    const schedules = [];
    let valid = true;
    rows.forEach(row => {
      const date = row.querySelector('.sched-date')?.value;
      const time = row.querySelector('.sched-time')?.value;
      const stId = row.querySelector('.sched-studio')?.value || studioId;
      const pr = row.querySelector('.sched-price')?.value || price;
      if (!date || !time) { valid = false; return; }
      schedules.push({ movie_id: movieId, studio_id: stId, show_date: date, show_time: time, price: pr });
    });

    if (!valid) { showToast('Isi tanggal dan jam untuk semua jadwal.', 'error'); return; }

    const isEditing = !!editingId.showtime;
    if (isEditing && schedules.length === 1) {
      await fetchJson(`/api/schedules/${editingId.showtime}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schedules[0])
      });
      editingId.showtime = null;
      updateFormEditState('form-showtime', false, 'showtime');
    } else {
      await fetchJson('/api/schedules/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movie_id: movieId, schedules })
      });
    }

    resetForm(form);
    document.querySelectorAll('.schedule-row').forEach(r => r.remove());
    addScheduleRow(); // Add one fresh row
    showToast(`${schedules.length} jadwal berhasil disimpan`);
    await loadData();
  }

  // ============================================================
  // SCHEDULE ROWS (Bulk UI)
  // ============================================================
  function addScheduleRow(date = '', time = '', studioId = '') {
    const container = el('schedule-rows');
    if (!container) return;
    const studios = window._adminData?.studios || [];
    const studioOptions = studios.length
      ? studios.map(s => `<option value="${s.id}" ${String(s.id) === String(studioId) ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')
      : '<option value="">Belum ada studio</option>';

    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center;';
    row.innerHTML = `
      <input type="date" class="sched-date field input" value="${escapeHtml(date)}" style="background:rgba(255,255,255,0.04);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:10px 12px;outline:none;font:inherit;">
      <input type="time" class="sched-time field input" value="${escapeHtml(time)}" style="background:rgba(255,255,255,0.04);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:10px 12px;outline:none;font:inherit;">
      <select class="sched-studio" style="background:rgba(255,255,255,0.04);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:10px 12px;outline:none;font:inherit;">
        ${studioOptions}
      </select>
      <input type="number" class="sched-price" placeholder="Harga" value="50000" style="background:rgba(255,255,255,0.04);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:10px 12px;outline:none;font:inherit;">
      <button type="button" onclick="this.closest('.schedule-row').remove()" style="background:rgba(230,57,70,0.12);border:1px solid rgba(230,57,70,0.28);color:#ffb7bf;border-radius:8px;padding:9px;cursor:pointer;font-size:14px;">✕</button>`;
    container.appendChild(row);
  }

  // ============================================================
  // SUBMIT NOTIFICATION
  // ============================================================
  async function submitNotification(form) {
    const payload = getFormData(form);
    await fetchJson('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    resetForm(form);
    showToast('Notifikasi berhasil dikirim');
    await loadData();
  }

  // ============================================================
  // EDIT HANDLERS
  // ============================================================
  function updateFormEditState(formId, isEditing, type) {
    const form = el(formId);
    if (!form) return;
    const btn = form.querySelector('button[type=submit]');
    const cancelBtn = form.querySelector('.btn-cancel-edit');

    if (btn) btn.textContent = isEditing ? `Update ${type === 'film' ? 'Film' : type === 'cinema' ? 'Bioskop' : 'Jadwal'}` : `Simpan ${type === 'film' ? 'Film' : type === 'cinema' ? 'Bioskop' : 'Jadwal'}`;
    if (cancelBtn) cancelBtn.style.display = isEditing ? 'inline-flex' : 'none';

    // Scroll form into view
    if (isEditing && form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleEdit(action, id) {
    const data = window._adminData;
    if (!data) return;

    if (action === 'edit-film') {
      const film = data.films.find(f => String(f.id) === String(id));
      if (!film) return;
      editingId.film = id;
      setActiveSection('films');

      // Switch to form tab
      const formTab = document.querySelector('.tab[data-tab="film-form"]');
      if (formTab) formTab.click();

      const form = el('form-film');
      if (form) {
        form.querySelector('[name=title]').value = film.title || '';
        form.querySelector('[name=duration]').value = film.duration || '';
        form.querySelector('[name=year]').value = film.year || '';
        form.querySelector('[name=rating]').value = film.rating || '';
        form.querySelector('[name=poster]').value = film.poster || '';
        form.querySelector('[name=synopsis]').value = film.synopsis || '';
        form.querySelector('[name=status]').value =
          film.is_now_playing ? 'now_playing' : film.is_coming_soon ? 'coming_soon' : 'now_playing';
      }

      const currentGenres = film.genre ? film.genre.split(',').map(g => g.trim()) : [];
      renderGenreMultiSelect('genre-multiselect', currentGenres);
      updateFormEditState('form-film', true, 'film');
      showToast(`Edit mode: ${film.title}`);
    }

    if (action === 'edit-cinema') {
      const cinema = data.cinemas.find(c => String(c.id) === String(id));
      if (!cinema) return;
      editingId.cinema = id;
      setActiveSection('cinemas');

      const form = el('form-cinema');
      if (form) {
        form.querySelector('[name=name]').value = cinema.name || '';
        form.querySelector('[name=city]').value = cinema.city || '';
        form.querySelector('[name=location]').value = cinema.location || '';
      }
      updateFormEditState('form-cinema', true, 'cinema');
      showToast(`Edit mode: ${cinema.name}`);
    }

    if (action === 'edit-showtime') {
      const showtime = data.showtimes.find(s => String(s.id) === String(id));
      if (!showtime) return;
      editingId.showtime = id;
      setActiveSection('showtimes');

      // Populate main selects
      const movieSel = el('movie-select');
      const studioCinemaInput = el('cinema-select');
      if (movieSel) movieSel.value = showtime.movie_id;
      if (studioCinemaInput) studioCinemaInput.value = showtime.cinema_id;

      // Clear rows and add one pre-filled
      const rowsContainer = el('schedule-rows');
      if (rowsContainer) rowsContainer.innerHTML = '';
      addScheduleRow(showtime.show_date, showtime.show_time, showtime.studio_id);

      const priceInput = el('bulk-price');
      if (priceInput) priceInput.value = showtime.price || 50000;

      updateFormEditState('form-showtime', true, 'showtime');
      showToast(`Edit mode: Jadwal #${id}`);
    }
  }

  // ============================================================
  // DELETE HANDLERS
  // ============================================================
  const deleteRoutes = {
    'delete-film': id => `/api/movies/${id}`,
    'delete-cinema': id => `/api/cinemas/${id}`,
    'delete-showtime': id => `/api/schedules/${id}`,
    'delete-notification': id => `/api/notifications/${id}`,
    'delete-studio': id => `/api/studios/${id}`,
    'delete-user': id => `/api/users/${id}`
  };

  async function handleDelete(action, id) {
    const url = deleteRoutes[action] ? deleteRoutes[action](id) : null;
    if (!url) return;
    if (!confirm('Yakin ingin menghapus data ini?')) return;
    await fetchJson(url, { method: 'DELETE' });
    showToast('Data berhasil dihapus');
    await loadData();
  }

  // ============================================================
  // USER MANAGEMENT
  // ============================================================
  async function handleUserAction(action, id, pw) {
    if (action === 'view-pw') {
      alert(`Password user #${id}:\n\n${pw || '(kosong)'}\n\n⚠️ Jangan bagikan ke siapapun.`);
      return;
    }
    if (action === 'reset-pw') {
      const newPw = prompt(`Reset password user #${id}.\nMasukkan password baru:`);
      if (!newPw) return;
      await fetchJson(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPw })
      });
      showToast('Password berhasil direset');
      await loadData();
    }
  }

  // ============================================================
  // DELEGATE EVENTS
  // ============================================================
  function bindDelegatedActions() {
    document.addEventListener('click', async event => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const id = target.dataset.id;
      const pw = target.dataset.pw;
      try {
        if (action.startsWith('delete-')) await handleDelete(action, id);
        else if (action.startsWith('edit-')) await handleEdit(action, id);
        else if (action === 'view-pw' || action === 'reset-pw') await handleUserAction(action, id, pw);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // ============================================================
  // BIND UI
  // ============================================================
  function buildFilmsSection() {
    const filmsSection = el('films');
    if (!filmsSection) return;

    // Find the form and add genre multi-select
    const form = el('form-film');
    if (!form) return;

    // Insert genre multiselect after the status field
    const statusField = form.querySelector('.field:has([name=status])') || form.querySelector('.field');
    if (statusField && !el('genre-multiselect-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'field full';
      wrapper.id = 'genre-multiselect-wrapper';
      wrapper.innerHTML = `
        <label>Genre <span style="color:var(--muted);font-weight:400;">(pilih yang sesuai)</span></label>
        <div id="genre-multiselect" style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:12px;min-height:44px;"></div>`;
      form.insertBefore(wrapper, form.querySelector('button[type=submit]')?.closest('.field') || form.lastElementChild);
    }

    // Add cancel edit button
    const submitBtn = form.querySelector('button[type=submit]')?.closest('.field');
    if (submitBtn && !form.querySelector('.btn-cancel-edit')) {
      const cancelWrapper = document.createElement('div');
      cancelWrapper.className = 'field';
      cancelWrapper.innerHTML = `<button type="button" class="btn-cancel-edit btn btn-ghost" style="display:none;" onclick="BE_TIX_ADMIN.cancelEditFilm()">✕ Batal Edit</button>`;
      submitBtn.parentElement.insertBefore(cancelWrapper, submitBtn.nextSibling);
    }

    renderGenreMultiSelect('genre-multiselect');
  }

  function buildShowtimesSection() {
    const section = el('showtimes');
    if (!section) return;

    // Replace studio_id text input with dropdown
    const form = el('form-showtime');
    if (!form) return;

    // Replace studio_id manual input with select
    const studioField = form.querySelector('[name=studio_id]');
    if (studioField && studioField.tagName === 'INPUT') {
      const sel = document.createElement('select');
      sel.name = 'studio_id';
      sel.id = 'studio-select';
      sel.style.cssText = studioField.style.cssText;
      sel.className = studioField.className;
      sel.innerHTML = `<option value="">Pilih Studio</option>`;
      studioField.parentElement.replaceChild(sel, studioField);
    }

    // Add bulk schedule rows container
    if (!el('schedule-rows-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.id = 'schedule-rows-wrapper';
      wrapper.className = 'field full';
      wrapper.innerHTML = `
        <label>Jadwal Tayang <span style="color:var(--muted);font-weight:400;">(bisa bulk per film)</span></label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:6px;">
          <span style="font-size:11px;color:var(--muted);padding:4px 0;">Tanggal</span>
          <span style="font-size:11px;color:var(--muted);padding:4px 0;">Jam</span>
          <span style="font-size:11px;color:var(--muted);padding:4px 0;">Studio</span>
          <span style="font-size:11px;color:var(--muted);padding:4px 0;">Harga</span>
          <span></span>
        </div>
        <div id="schedule-rows"></div>
        <button type="button" class="btn btn-ghost" style="margin-top:6px;width:100%;" onclick="BE_TIX_ADMIN.addScheduleRow()">+ Tambah Jadwal</button>`;
      const submitField = form.querySelector('button[type=submit]')?.closest('.field');
      if (submitField) form.insertBefore(wrapper, submitField);

      // Remove old date/time fields
      ['show_date','show_time','price'].forEach(name => {
        const f = form.querySelector(`[name=${name}]`);
        if (f) f.closest('.field')?.remove();
      });

      addScheduleRow();
    }

    // Cancel edit button
    if (!form.querySelector('.btn-cancel-edit')) {
      const submitField = form.querySelector('button[type=submit]')?.closest('.field');
      if (submitField) {
        const cancelEl = document.createElement('div');
        cancelEl.className = 'field';
        cancelEl.innerHTML = `<button type="button" class="btn btn-ghost btn-cancel-edit" style="display:none;" onclick="BE_TIX_ADMIN.cancelEditShowtime()">✕ Batal Edit</button>`;
        submitField.parentElement.insertBefore(cancelEl, submitField.nextSibling);
      }
    }
  }

  function buildStudiosSection() {
    const section = el('cinemas');
    if (!section) return;
    if (el('studio-section-inner')) return;

    const studioPanel = document.createElement('div');
    studioPanel.id = 'studio-section-inner';
    studioPanel.style.marginTop = '24px';
    studioPanel.innerHTML = `
      <div class="panel-head">
        <div>
          <h2 style="font-size:16px;">Studio</h2>
          <p style="color:var(--muted);font-size:12px;">Studio harus ada sebelum membuat jadwal.</p>
        </div>
      </div>
      <form id="form-studio" class="form-grid">
        <div class="field">
          <label>Bioskop</label>
          <select name="cinema_id" id="studio-cinema-select" required>
            <option value="">Pilih Bioskop</option>
          </select>
        </div>
        <div class="field"><label>Nama Studio</label><input name="name" placeholder="Studio 1, Studio IMAX" required></div>
        <div class="field"><label>Kapasitas Kursi</label><input name="seat_capacity" type="number" value="40" placeholder="40"></div>
        <div class="field" style="align-self:end;"><button class="btn btn-primary" type="submit">+ Buat Studio</button></div>
      </form>
      <div style="height:14px;"></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Nama Studio</th><th>Bioskop</th><th>Kapasitas</th><th>Aksi</th></tr></thead>
          <tbody id="table-studios"></tbody>
        </table>
      </div>`;
    section.appendChild(studioPanel);

    const formStudio = el('form-studio');
    if (formStudio) {
      formStudio.addEventListener('submit', async e => {
        e.preventDefault();
        try { await submitStudio(formStudio); } catch (err) { showToast(err.message, 'error'); }
      });
    }
  }

  function bindUI() {
    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
      btn.addEventListener('click', () => setActiveSection(btn.dataset.target));
    });

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const parent = tab.parentElement;
        parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        const scope = tab.closest('.panel');
        scope.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const sec = scope.querySelector('#' + target);
        if (sec) sec.classList.add('active');
      });
    });

    const formFilm = el('form-film');
    const formCinema = el('form-cinema');
    const formShowtime = el('form-showtime');
    const formNotification = el('form-notification');
    const refreshAll = el('refresh-all');
    const logoutAdmin = el('logout-admin');

    if (formFilm) formFilm.addEventListener('submit', async e => {
      e.preventDefault();
      try { await submitFilm(formFilm); } catch (err) { showToast(err.message, 'error'); }
    });

    if (formCinema) formCinema.addEventListener('submit', async e => {
      e.preventDefault();
      try { await submitCinema(formCinema); } catch (err) { showToast(err.message, 'error'); }
    });

    if (formShowtime) formShowtime.addEventListener('submit', async e => {
      e.preventDefault();
      try { await submitShowtime(formShowtime); } catch (err) { showToast(err.message, 'error'); }
    });

    if (formNotification) formNotification.addEventListener('submit', async e => {
      e.preventDefault();
      try { await submitNotification(formNotification); } catch (err) { showToast(err.message, 'error'); }
    });

    if (refreshAll) refreshAll.addEventListener('click', () => loadData().catch(err => showToast(err.message, 'error')));

    if (logoutAdmin) logoutAdmin.addEventListener('click', () => {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      window.location.assign('/login.html');
    });
  }

  // ============================================================
  // CANCEL EDIT
  // ============================================================
  function cancelEditFilm() {
    editingId.film = null;
    const form = el('form-film');
    if (form) resetForm(form);
    renderGenreMultiSelect('genre-multiselect');
    updateFormEditState('form-film', false, 'film');
  }

  function cancelEditCinema() {
    editingId.cinema = null;
    const form = el('form-cinema');
    if (form) resetForm(form);
    updateFormEditState('form-cinema', false, 'cinema');
  }

  function cancelEditShowtime() {
    editingId.showtime = null;
    const rowsContainer = el('schedule-rows');
    if (rowsContainer) rowsContainer.innerHTML = '';
    addScheduleRow();
    updateFormEditState('form-showtime', false, 'showtime');
  }

  function toggleGenreChip(checkbox) {
    const label = checkbox.closest('label');
    if (!label) return;
    const isChecked = checkbox.checked;
    label.style.borderColor = isChecked ? 'var(--red)' : 'var(--line)';
    label.style.background = isChecked ? 'rgba(230,57,70,0.14)' : 'rgba(255,255,255,0.03)';
    label.style.color = isChecked ? '#fff' : 'var(--muted)';
  }

  // ============================================================
  // INIT
  // ============================================================
  document.addEventListener('DOMContentLoaded', async () => {
    const user = requireAdmin();
    if (!user) return;

    const info = el('admin-info');
    if (info) info.textContent = `${user.name || user.email || 'Admin'} • ${user.email || ''}`.trim();

    bindUI();
    buildFilmsSection();
    buildShowtimesSection();
    buildStudiosSection();
    bindDelegatedActions();

    try {
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ============================================================
  // EXPOSE
  // ============================================================
  window.BE_TIX_ADMIN = {
    loadData, requireAdmin, showToast, setActiveSection,
    addScheduleRow, cancelEditFilm, cancelEditCinema, cancelEditShowtime,
    toggleGenreChip
  };
})();
