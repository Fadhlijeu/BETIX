function switchNav(page, el, isBottom = false) {

  // Hapus active semua page
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
  });

  // Tampilkan page yang dipilih
  const targetPage = document.getElementById('page-' + page);

  if (targetPage) {
    targetPage.classList.add('active');
  }

  // Reset active nav atas
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // Reset active bottom nav
  document.querySelectorAll('.bottom-item').forEach(item => {
    item.classList.remove('active');
  });

  // Aktifkan nav yang diklik
  if (el) {
    el.classList.add('active');
  }

  // Sinkron nav atas & bawah
  const topNav = document.querySelector(`.nav-item[data-page="${page}"]`);
  const bottomNav = document.getElementById(`btn-${page}`);

  if (topNav) topNav.classList.add('active');
  if (bottomNav) bottomNav.classList.add('active');
}

function navigateTo(page) {

  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
  });

  const target = document.getElementById('page-' + page);

  if (target) {
    target.classList.add('active');
  }
}

function goBack() {
  switchNav('beranda');
}