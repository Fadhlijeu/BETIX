// ============================================
//  BE TIX — App Bootstrap Layer
//  Ringan, aman, dan tidak double-render.
//  Fokus pada startup, fallback, dan UI helpers.
// ============================================

(function () {
  function safeCall(fn) {
    try {
      if (typeof fn === 'function') fn();
    } catch (err) {
      console.error('App bootstrap error:', err);
    }
  }

  function syncProfile() {
    safeCall(function () {
      if (typeof window.syncUserProfile === 'function') {
        window.syncUserProfile();
      }
    });
  }

  function bindSuccessModal() {
    const modal = document.getElementById('success-modal');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('is-open');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.classList.remove('is-open');
      }
    });
  }

  function initCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (!activePage) {
      if (typeof window.navigateTo === 'function') {
        window.navigateTo('beranda', { replace: true });
      }
      return;
    }

    const pageName = activePage.id.replace('page-', '');
    if (typeof window.switchNav === 'function') {
      const navEl = document.querySelector(`.bottom-item#btn-${pageName}`) || document.querySelector(`.nav-item[data-page="${pageName}"]`);
      if (navEl && navEl.classList) {
        navEl.classList.add('active');
      }
    }
  }

  function bindGlobalErrorGuard() {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error || event.message || event);
    });
  }

  function refreshDynamicUI() {
    syncProfile();

    if (window.BE_TIX) {
      safeCall(() => window.BE_TIX.renderNowPlaying && window.BE_TIX.renderNowPlaying());
      safeCall(() => window.BE_TIX.renderComingSoon && window.BE_TIX.renderComingSoon());
      safeCall(() => window.BE_TIX.renderAllMovies && window.BE_TIX.renderAllMovies());
      safeCall(() => window.BE_TIX.renderNotifications && window.BE_TIX.renderNotifications());
      safeCall(() => window.BE_TIX.loadAIRecommendation && window.BE_TIX.loadAIRecommendation());
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindGlobalErrorGuard();
    bindSuccessModal();
    initCurrentPage();
    refreshDynamicUI();

    // Menjaga query search tetap konsisten jika user reload halaman.
    const searchInput = document.getElementById('search-input');
    if (searchInput && typeof searchInput.value === 'string') {
      searchInput.value = searchInput.value || '';
    }
  });

  // Expose helper kecil jika perlu dipakai file lain.
  window.BE_TIX_APP = {
    refreshDynamicUI,
    syncProfile,
    initCurrentPage
  };
})();
