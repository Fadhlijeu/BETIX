// ============================================
//  BE TIX — Auth Layer (js/auth.js)
//  Manajemen Sesi, Proteksi, & Profil
// ============================================

const Auth = {
  // Key untuk localStorage
  SESSION_KEY: 'user_session',

  /**
   * Mengambil data user yang sedang login
   */
  getUser: function() {
    const session = localStorage.getItem(this.SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },

  /**
   * Cek apakah user sudah login. 
   * Jika tidak, arahkan ke login.html
   */
  checkAuth: function() {
    const user = this.getUser();
    const currentPage = window.location.pathname;

    // Jika belum login dan mencoba akses index atau admin
    if (!user && (currentPage.includes('index.html') || currentPage === '/' || currentPage.includes('admin.html'))) {
      window.location.href = '/login.html';
      return false;
    }

    // Jika sudah login tapi mencoba akses login/register lagi
    if (user && (currentPage.includes('login.html') || currentPage.includes('register.html'))) {
      window.location.href = '/index.html';
      return false;
    }

    // Jika user biasa mencoba masuk ke admin.html
    if (user && user.role !== 'admin' && currentPage.includes('admin.html')) {
      window.location.href = '/index.html';
      return false;
    }

    return true;
  },

  /**
   * Keluar dari aplikasi
   */
  logout: function() {
    localStorage.removeItem(this.SESSION_KEY);
    window.location.href = '/login.html';
  },

  /**
   * Sinkronisasi Ganti Password ke Database
   */
  changePassword: async function(oldPassword, newPassword) {
    const user = this.getUser();
    if (!user) return { success: false, message: 'Sesi habis' };

    try {
      const response = await fetch('/api/users/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          oldPassword,
          newPassword
        })
      });
      return await response.json();
    } catch (err) {
      return { success: false, message: 'Gagal menghubungi server' };
    }
  },

  /**
   * Hapus Akun Permanen
   */
  deleteAccount: async function() {
    const user = this.getUser();
    if (!user) return;

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        this.logout();
      }
      return data;
    } catch (err) {
      return { success: false, message: 'Gagal menghapus akun' };
    }
  },

  /**
   * Update UI berdasarkan siapa yang login (Admin/User)
   */
  initUI: function() {
    const user = this.getUser();
    if (!user) return;

    // Tampilkan nama di profil
    const profileName = document.getElementById('user-profile-name');
    const profileEmail = document.getElementById('user-profile-email');
    if (profileName) profileName.textContent = user.name || user.username || '';
    if (profileEmail) profileEmail.textContent = user.email;

    // Tampilkan menu admin jika role adalah admin
    const adminMenu = document.getElementById('admin-link'); // Asumsi ada ID ini di nav
    if (adminMenu) {
      adminMenu.style.display = (user.role === 'admin') ? 'flex' : 'none';
    }
  }
};

// Jalankan proteksi otomatis saat script dimuat
Auth.checkAuth();

// Expose ke global window agar bisa dipanggil dari HTML onclick
window.auth = Auth;