// ============================================
//  BE TIX — Navigation Layer
//  Refactor aman untuk history back,
//  active state sync, dan page routing
// ============================================

(function () {
  const state = {
    history: [],
    currentPage: null,
    suppressHistory: false
  };

  function getActivePageId() {
    const active = document.querySelector('.page.active');
    return active ? active.id : null;
  }

  function setActiveNav(page, el, isBottom = false) {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.bottom-item').forEach((item) => item.classList.remove('active'));

    const topNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    const bottomNav = document.getElementById(`btn-${page}`);

    if (topNav) topNav.classList.add('active');
    if (bottomNav) bottomNav.classList.add('active');
    if (el && el.classList) el.classList.add('active');
  }

  function showPage(pageId) {
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
  }

  function pushHistory(pageId) {
    if (!pageId) return;
    if (state.suppressHistory) return;
    if (state.currentPage && state.currentPage !== pageId) {
      state.history.push(state.currentPage);
    }
    state.currentPage = pageId;
  }

  function navigateTo(page, options = {}) {
    const pageId = `page-${page}`;
    const target = document.getElementById(pageId);
    const currentPageId = getActivePageId();

    if (!target) return;

    if (!options.replace) {
      if (currentPageId && currentPageId !== pageId) {
        state.history.push(currentPageId);
      }
    }

    state.currentPage = pageId;
    showPage(pageId);

    // update URL hash
    if (!options.replace) {
      history.pushState({}, '', `#${page}`);
    } else {
      history.replaceState({}, '', `#${page}`);
}

    const navEl = options.el || document.querySelector(`.nav-item[data-page="${page}"]`) || document.getElementById(`btn-${page}`);
    setActiveNav(page, navEl, !!options.isBottom);

    if (window.BE_TIX && typeof window.BE_TIX.renderShowtimes === 'function' && page === 'pesan') {
      window.BE_TIX.renderDatePicker();
      window.BE_TIX.renderShowtimes();
    }

    if (window.BE_TIX && typeof window.BE_TIX.renderSeatGrid === 'function' && page === 'kursi') {
      window.BE_TIX.renderSeatGrid();
    }

    if (window.BE_TIX && typeof window.BE_TIX.renderPayMethods === 'function' && page === 'bayar') {
      window.BE_TIX.renderPayMethods();
    }

    if (window.BE_TIX && typeof window.BE_TIX.renderEtiket === 'function' && page === 'etiket') {
      window.BE_TIX.renderEtiket();
    }

    if (window.BE_TIX && typeof window.BE_TIX.renderRiwayat === 'function' && page === 'riwayat') {
      window.BE_TIX.renderRiwayat();
    }

    if (window.BE_TIX && typeof window.BE_TIX.renderNotifications === 'function' && page === 'notif') {
      window.BE_TIX.renderNotifications();
    }

    if (window.BE_TIX && typeof window.BE_TIX.renderPromos === 'function' && page === 'promo') {
      window.BE_TIX.renderPromos();
    }

    if (window.BE_TIX && typeof window.BE_TIX.renderAllMovies === 'function' && page === 'film') {
      window.BE_TIX.renderAllMovies();
    }

    if (window.BE_TIX && typeof window.BE_TIX.loadBioskop === 'function' && page === 'bioskop') {
      window.BE_TIX.loadBioskop();
    }

    if (window.BE_TIX && typeof window.BE_TIX.renderNowPlaying === 'function' && page === 'beranda') {
      window.BE_TIX.renderNowPlaying();
      window.BE_TIX.renderComingSoon();
      window.BE_TIX.loadAIRecommendation();
    }
  }

  function goBack() {
    const previous = state.history.pop();
    if (!previous) {
      navigateTo('beranda', { replace: true });
      return;
    }

    state.suppressHistory = true;
    showPage(previous);

    const pageName = previous.replace('page-', '');
    setActiveNav(pageName, null);
    state.currentPage = previous;
    state.suppressHistory = false;

    if (window.BE_TIX) {
      if (pageName === 'pesan') {
        window.BE_TIX.renderDatePicker();
        window.BE_TIX.renderShowtimes();
      } else if (pageName === 'kursi') {
        window.BE_TIX.renderSeatGrid();
      } else if (pageName === 'bayar') {
        window.BE_TIX.renderPayMethods();
      } else if (pageName === 'etiket') {
        window.BE_TIX.renderEtiket();
      } else if (pageName === 'riwayat') {
        window.BE_TIX.renderRiwayat();
      } else if (pageName === 'notif') {
        window.BE_TIX.renderNotifications();
      } else if (pageName === 'promo') {
        window.BE_TIX.renderPromos();
      } else if (pageName === 'film') {
        window.BE_TIX.renderAllMovies();
      } else if (pageName === 'bioskop') {
        window.BE_TIX.loadBioskop();
      } else if (pageName === 'beranda') {
        window.BE_TIX.renderNowPlaying();
        window.BE_TIX.renderComingSoon();
      }
    }
  }

  function switchNav(page, el, isBottom = false) {
    navigateTo(page, { el, isBottom });
  }

  function syncInitialPage() {
    const defaultPage = getActivePageId() || 'page-beranda';
    state.currentPage = defaultPage;
    const pageName = defaultPage.replace('page-', '');
    setActiveNav(pageName);
  }

  document.addEventListener('DOMContentLoaded', () => {

    const hash = window.location.hash.replace('#', '');

    if (hash) {
      navigateTo(hash, { replace: true });
    } else {
      syncInitialPage();
      navigateTo('beranda', { replace: true });
    }

  });

  document.addEventListener('DOMContentLoaded', () => {

    const hash = window.location.hash.replace('#', '');

    if (hash) {
      navigateTo(hash, { replace: true });
    } else {
      syncInitialPage();
      navigateTo('beranda', { replace: true });
    }

  });

  window.navigateTo = navigateTo;
  window.switchNav = switchNav;
  window.goBack = goBack;
  window.__BE_TIX_NAV__ = state;
})();
