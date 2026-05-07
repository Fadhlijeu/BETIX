// ============================================
//  TIX ID — Data Layer (js/data.js)
//  Berisi semua data statis / mock backend
// ============================================

const DATA = {

  // ---------- FILM ----------
  movies: [
    {
      id: 1,
      title: 'Interstellar',
      genre: ['aksi', 'scifi'],
      rating: 8.2,
      reviews: '4.2rb',
      duration: '2j 20m',
      year: 2024,
      age: '17+',
      image: "img/inter2.jpg",
      now: true,
      coming: false,
    },
    {
      id: 2,
      title: 'Transformers One',
      genre: ['aksi', 'animasi'],
      rating: 7.8,
      reviews: '3.1rb',
      duration: '1j 44m',
      year: 2024,
      age: 'SU',
      image: "img/trans.jpg",
      now: true,
      coming: false,
    },
    {
      id: 3,
      title: 'Inside Out 3',
      genre: ['animasi', 'drama'],
      rating: 9.1,
      reviews: '6.7rb',
      duration: '1j 55m',
      year: 2025,
      age: 'SU',
      image: "img/io3.jpg",
      now: true,
      coming: false,
    },
    {
      id: 4,
      title: 'A Quiet Place: Day One',
      genre: ['horor'],
      rating: 7.5,
      reviews: '2.8rb',
      duration: '1j 39m',
      year: 2024,
      age: '13+',
      image: "img/aq.jpg",
      now: true,
      coming: false,
    },
    {
      id: 5,
      title: 'Deadpool & Wolverine',
      genre: ['aksi', 'komedi'],
      rating: 8.5,
      reviews: '5.5rb',
      duration: '2j 7m',
      year: 2024,
      age: '17+',
      image: "img/dead.jpg",
      now: true,
      coming: false,
    },
    {
      id: 6,
      title: 'Interstellar 2',
      genre: ['scifi', 'drama'],
      rating: null,
      reviews: null,
      duration: '2j 45m',
      year: 2025,
      age: '13+',
      image: "img/inter21.jpg",
      now: false,
      coming: true,
    },
    {
      id: 7,
      title: 'Moana 3',
      genre: ['animasi'],
      rating: null,
      reviews: null,
      duration: '1j 50m',
      year: 2025,
      age: 'SU',
      image: "img/moa.jpg",
      now: false,
      coming: true,
    },
    {
      id: 8,
      title: 'Avatar 3',
      genre: ['scifi', 'aksi'],
      rating: null,
      reviews: null,
      duration: '3j 10m',
      year: 2025,
      age: '13+',
      image: "img/ava.jpg",
      now: false,
      coming: true,
    },
  ],

  // ---------- BIOSKOP ----------
  bioskops: {
    jakarta: [
      { name: 'CGV Grand Indonesia', district: 'Jakarta Pusat', dist: '0.8', icon: '🎭' },
      { name: 'XXI Senayan City', district: 'Jakarta Selatan', dist: '1.2', icon: '🎬' },
      { name: 'CGV Paris Van Java Plaza', district: 'Jakarta Barat', dist: '2.1', icon: '🎭' },
      { name: 'Cinepolis Mall of Jakarta', district: 'Jakarta Timur', dist: '3.0', icon: '🎥' },
      { name: 'Platinum Cineplex Pluit', district: 'Jakarta Utara', dist: '4.5', icon: '⭐' },
    ],
    surabaya: [
      { name: 'XXI Tunjungan Plaza', district: 'Surabaya Pusat', dist: '1.0', icon: '🎬' },
      { name: 'CGV Pakuwon Mall', district: 'Surabaya Barat', dist: '2.3', icon: '🎭' },
      { name: 'Cinepolis Galaxy Mall', district: 'Surabaya Timur', dist: '3.1', icon: '🎥' },
    ],
    bandung: [
      { name: 'CGV Paris Van Java', district: 'Bandung Barat', dist: '0.9', icon: '🎭' },
      { name: 'XXI BIP Bandung', district: 'Bandung Pusat', dist: '1.8', icon: '🎬' },
      { name: 'Cinepolis Cihampelas', district: 'Bandung Utara', dist: '2.5', icon: '🎥' },
    ],
    bali: [
      { name: 'CGV Beachwalk Kuta', district: 'Kuta, Badung', dist: '1.2', icon: '🎭' },
      { name: 'XXI Galeria Nusa Dua', district: 'Nusa Dua, Badung', dist: '3.0', icon: '🎬' },
    ],
    tangerang: [
      { name: 'XXI Living World BSD', district: 'BSD City', dist: '0.5', icon: '🎬' },
      { name: 'CGV Summarecon Serpong', district: 'Gading Serpong', dist: '1.1', icon: '🎭' },
      { name: 'Cinepolis AEON Mall', district: 'Tangerang Selatan', dist: '2.0', icon: '🎥' },
      { name: 'XXI Bintaro Jaya Xchange', district: 'Bintaro', dist: '2.8', icon: '🎬' },
    ],
  },

  // ---------- METODE BAYAR ----------
  payMethods: [
    { id: 'gopay', name: 'GoPay', icon: '💚', desc: 'Cashback 10% s.d. Rp 20.000' },
    { id: 'ovo', name: 'OVO', icon: '💜', desc: 'Flash Sale: Cashback 15%' },
    { id: 'dana', name: 'DANA', icon: '💙', desc: 'Bonus poin 2x setiap transaksi' },
    { id: 'bni', name: 'Transfer Bank BNI', icon: '🏦', desc: 'Cicilan 0% hingga 3 bulan' },
    { id: 'debit', name: 'Kartu Debit / Kredit', icon: '💳', desc: 'Visa, Mastercard, JCB' },
  ],

  // ---------- PROMO ----------
  promos: [
    { badge: 'HOT DEAL', title: 'Beli 2 Gratis 1', desc: 'Berlaku Senin–Rabu untuk semua film', color: '#E63946' },
    { badge: 'CASHBACK', title: 'GoPay Cashback 20%', desc: 'Min. transaksi Rp 75.000', color: '#00875a' },
    { badge: 'WEEKEND', title: 'Studio VIP Diskon 30%', desc: 'Khusus Sabtu & Minggu', color: '#7c3aed' },
    { badge: 'MEMBER', title: 'Gold Member 3x Poin', desc: 'Extra poin setiap transaksi', color: '#d97706' },
    { badge: 'STUDENT', title: 'Pelajar Diskon 25%', desc: 'Tunjukkan kartu pelajar aktif', color: '#0891b2' },
  ],

  vouchers: [
    { code: 'TIXAWAL', discount: 'Rp 25.000', min: 'Rp 75.000', expire: '31 Mei 2025' },
    { code: 'GOLD2X', discount: '2x Poin', min: 'Semua transaksi', expire: '30 Jun 2025' },
    { code: 'SERU50', discount: 'Rp 50.000', min: 'Rp 150.000', expire: '15 Mei 2025' },
  ],

  // ---------- NOTIFIKASI ----------
  notifications: [
    { icon: '🎬', title: 'Pembayaran Berhasil!', desc: 'Tiket Interstellar sudah siap. Cek E-Ticket kamu.', time: '5 menit lalu', unread: true },
    { icon: '🎉', title: 'Promo Baru!', desc: 'Cashback 20% dengan GoPay hari ini saja.', time: '2 jam lalu', unread: true },
    { icon: '⭐', title: 'Poin Reward Masuk', desc: 'Kamu mendapat 240 poin dari transaksi terakhir.', time: 'Kemarin', unread: false },
    { icon: '📢', title: 'Film Baru Minggu Ini', desc: 'Inside Out 3 tayang mulai Jumat ini!', time: '2 hari lalu', unread: false },
  ],

  // ---------- E-TICKET (aktif) ----------
  activeTickets: [
    {
      movie: 'Interstellar',
      cinema: 'CGV Grand Indonesia · Studio 5',
      datetime: 'Sabtu, 3 Mei 2025 · 19:30',
      seats: 'D4, D5',
      type: 'Regular',
      total: 'Rp 120.000',
      payment: 'GoPay',
      emoji: '🎬',
    },
  ],

  // ---------- RIWAYAT TIKET ----------
  historyTickets: [
    { movie: 'Dune: Part Two', cinema: 'XXI Senayan City', datetime: '15 Apr 2025 · 20:00', seats: 'E3, E4', total: 'Rp 100.000', status: 'selesai', emoji: '🌌' },
    { movie: 'Kung Fu Panda 4', cinema: 'CGV Grand Indonesia', datetime: '2 Mar 2025 · 14:30', seats: 'C5', total: 'Rp 55.000', status: 'selesai', emoji: '🐼' },
    { movie: 'Aquaman 2', cinema: 'Cinepolis Living World', datetime: '10 Jan 2025 · 19:00', seats: 'F1, F2', total: 'Rp 90.000', status: 'dibatalkan', emoji: '🌊' },
  ],

};

// State global
const STATE = {
  currentPage: 'beranda',
  previousPage: 'beranda',
  selectedMovie: DATA.movies[0],
  selectedSeats: {},
  selectedPayMethod: null,
};