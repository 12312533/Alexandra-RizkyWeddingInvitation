/**
 * DATA Konfigurasi Undangan
 * Ubah data di sini tanpa menyentuh HTML.
 */
const invitationData = {
    groom: "Rizky Pratama",
    bride: "Alexandra Putri",
    date: "12 December 2026",
    eventDate: "2026-12-12T08:00:00+07:00",
    venue: "Grand Ballroom Jakarta",
    mapsUrl: "https://maps.app.goo.gl/placeholder",
    // Opsional: isi nomor WhatsApp (format 628xxxx) agar RSVP juga terkirim lewat WhatsApp.
    // Biarkan kosong ("") jika tidak diperlukan.
    whatsappNumber: "",
    galleryImages: [
        "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1604017011826-d3b4c23f8914?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=800&q=80"
    ]
};

// Tandai bahwa JS aktif (animasi reveal hanya berjalan jika JS hidup)
document.documentElement.classList.add('js');

// Selalu mulai dari atas saat halaman dimuat ulang
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// Elemen musik (script dimuat di akhir <body>, jadi elemen sudah ada)
const bgMusic = document.getElementById('bg-music');
const btnMusic = document.getElementById('btn-music');
let isPlaying = false;

document.addEventListener('DOMContentLoaded', () => {
    initializeGuestName();
    initializeInvitation();
    initializeMaps();
    initializeCountdown();
    initializeNavigation();
    initializeGallery();
    initializeMusic();
    initializeRSVP();
    initializeWishes();
    initializeGift();
    initializeModals();
    initializeScrollAnimation();
    initializeHeroVideo();
});

/* Helper: amankan teks dari HTML (mencegah XSS pada ucapan) */
function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

// 1. Nama tamu dari parameter URL (?to=Nama+Tamu)
function initializeGuestName() {
    const params = new URLSearchParams(window.location.search);
    const guest = params.get('to');
    const el = document.getElementById('guest-name');
    el.textContent = guest && guest.trim() ? guest.trim() : 'Tamu Undangan';
}

// 2. Buka undangan
function initializeInvitation() {
    const btnOpen = document.getElementById('btn-open-invitation');
    const coverPage = document.getElementById('cover-page');

    btnOpen.addEventListener('click', () => {
        coverPage.classList.add('slide-up');
        coverPage.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('locked-scroll');
        window.scrollTo(0, 0);

        playMusic();
        document.querySelectorAll('.float-btn').forEach(btn => {
            if (btn.id !== 'btn-totop') btn.classList.add('show');
        });

        // Lepas cover dari layar setelah animasi selesai
        setTimeout(() => { coverPage.style.display = 'none'; }, 1100);
    });
}

// 3. URL Google Maps
function initializeMaps() {
    const btnMaps = document.getElementById('btn-maps');
    if (btnMaps) btnMaps.href = invitationData.mapsUrl;
}

// 4. Countdown
function initializeCountdown() {
    const targetDate = new Date(invitationData.eventDate).getTime();
    const timer = document.getElementById('countdown-timer');
    const arrived = document.getElementById('cd-arrived');
    const pad = n => String(n).padStart(2, '0');

    function tick() {
        const distance = targetDate - Date.now();

        if (distance <= 0) {
            clearInterval(interval);
            timer.classList.add('hidden');
            arrived.classList.remove('hidden');
            return;
        }

        const d = Math.floor(distance / 86400000);
        const h = Math.floor((distance % 86400000) / 3600000);
        const m = Math.floor((distance % 3600000) / 60000);
        const s = Math.floor((distance % 60000) / 1000);

        document.getElementById('cd-days').textContent = pad(d);
        document.getElementById('cd-hours').textContent = pad(h);
        document.getElementById('cd-minutes').textContent = pad(m);
        document.getElementById('cd-seconds').textContent = pad(s);
    }

    const interval = setInterval(tick, 1000);
    tick(); // tampilkan langsung tanpa menunggu 1 detik
}

// 5. Navigasi (hamburger, navbar berubah saat scroll, menu aktif, tombol ke atas)
function initializeNavigation() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.getElementById('nav-links');
    const links = document.querySelectorAll('.nav-links a');
    const btnTop = document.getElementById('btn-totop');
    const hamburgerIcon = hamburger.querySelector('i');

    function setMenu(open) {
        navLinks.classList.toggle('active', open);
        hamburger.setAttribute('aria-expanded', String(open));
        hamburgerIcon.className = open ? 'ph ph-x' : 'ph ph-list';
    }

    hamburger.addEventListener('click', () => setMenu(!navLinks.classList.contains('active')));
    links.forEach(link => link.addEventListener('click', () => setMenu(false)));

    let ticking = false;
    function onScroll() {
        const y = window.scrollY;
        navbar.classList.toggle('scrolled', y > 60);
        btnTop.classList.toggle('show', y > 500 && !document.body.classList.contains('locked-scroll'));
        ticking = false;
    }
    window.addEventListener('scroll', () => {
        if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
    onScroll();

    btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // Tandai menu yang sedang aktif
    const sectionMap = {};
    links.forEach(l => {
        const sec = document.querySelector(l.getAttribute('href'));
        if (sec) sectionMap[sec.id] = l;
    });
    const spy = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && sectionMap[entry.target.id]) {
                links.forEach(l => l.classList.remove('active'));
                sectionMap[entry.target.id].classList.add('active');
            }
        });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(sectionMap).forEach(id => spy.observe(document.getElementById(id)));
}

// 6. Galeri & Lightbox
function initializeGallery() {
    const grid = document.getElementById('gallery-grid');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.lightbox-close');
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');
    const images = invitationData.galleryImages;
    let currentIndex = 0;

    images.forEach((src, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'gallery-item';
        item.setAttribute('aria-label', `Buka foto ${index + 1}`);
        item.innerHTML = `<img src="${src}" loading="lazy" alt="Foto galeri ${index + 1}">`;
        item.addEventListener('click', () => openLightbox(index));
        grid.appendChild(item);
    });

    function show() { lightboxImg.src = images[currentIndex]; }
    function openLightbox(i) {
        currentIndex = i;
        show();
        lightbox.classList.add('active');
        document.body.classList.add('locked-scroll');
        closeBtn.focus();
    }
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.classList.remove('locked-scroll');
    }
    function changeImage(step) {
        currentIndex = (currentIndex + step + images.length) % images.length;
        show();
    }

    closeBtn.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', () => changeImage(-1));
    nextBtn.addEventListener('click', () => changeImage(1));
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

    document.addEventListener('keydown', e => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') changeImage(-1);
        if (e.key === 'ArrowRight') changeImage(1);
    });

    // Geser (swipe) di layar sentuh
    let startX = 0;
    lightbox.addEventListener('touchstart', e => { startX = e.changedTouches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', e => {
        const diff = e.changedTouches[0].clientX - startX;
        if (Math.abs(diff) > 50) changeImage(diff > 0 ? -1 : 1);
    }, { passive: true });
}

// 7. Musik latar
function setMusicUI(playing) {
    isPlaying = playing;
    btnMusic.classList.toggle('music-spin', playing);
    btnMusic.innerHTML = playing
        ? '<i class="ph ph-speaker-high"></i>'
        : '<i class="ph ph-speaker-slash"></i>';
}

function playMusic() {
    bgMusic.play().then(() => setMusicUI(true)).catch(() => setMusicUI(false));
}

function initializeMusic() {
    btnMusic.addEventListener('click', () => {
        if (isPlaying) { bgMusic.pause(); setMusicUI(false); }
        else playMusic();
    });
    // Jeda otomatis saat tab ditinggalkan, lanjut saat kembali
    let wasPlaying = false;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            wasPlaying = isPlaying;
            if (isPlaying) bgMusic.pause();
        } else if (wasPlaying) {
            bgMusic.play().catch(() => {});
        }
    });
}

// 8. RSVP
function initializeRSVP() {
    const form = document.getElementById('rsvp-form');
    const modal = document.getElementById('modal-rsvp');

    form.addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('rsvp-name').value.trim();
        const status = document.getElementById('rsvp-status').value;
        const guests = document.getElementById('rsvp-guest').value;

        // Titik integrasi Firebase / Google Sheets bisa ditambahkan di sini.
        if (invitationData.whatsappNumber) {
            const text = `Halo, saya ${name}. Konfirmasi kehadiran: ${status} (${guests} orang). Terima kasih.`;
            window.open(`https://wa.me/${invitationData.whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        }

        modal.classList.add('show');
        form.reset();
    });
}

// 9. Ucapan & doa (disimpan di localStorage perangkat ini - hanya demo)
function initializeWishes() {
    const form = document.getElementById('wishes-form');
    const list = document.getElementById('wishes-list');
    const KEY = 'wedding_wishes';

    let wishes = [];
    try { wishes = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { wishes = []; }

    function timeAgo(ts) {
        if (!ts) return '';
        const sec = Math.floor((Date.now() - ts) / 1000);
        if (sec < 60) return 'Baru saja';
        if (sec < 3600) return `${Math.floor(sec / 60)} menit lalu`;
        if (sec < 86400) return `${Math.floor(sec / 3600)} jam lalu`;
        return `${Math.floor(sec / 86400)} hari lalu`;
    }

    function render() {
        list.innerHTML = '';
        if (!wishes.length) {
            list.innerHTML = '<p class="wish-empty">Jadilah yang pertama mengirim ucapan.</p>';
            return;
        }
        wishes.forEach(w => {
            const div = document.createElement('div');
            div.className = 'wish-card';
            div.innerHTML = `
                <div class="wish-header">
                    <span class="wish-name">${escapeHTML(w.name)}</span>
                    <span class="wish-time">${timeAgo(w.ts)}</span>
                </div>
                <p class="wish-text">"${escapeHTML(w.message)}"</p>`;
            list.appendChild(div);
        });
    }
    render();

    form.addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('wish-name').value.trim();
        const message = document.getElementById('wish-message').value.trim();
        if (!name || !message) return;

        wishes.unshift({ name, message, ts: Date.now() });
        try { localStorage.setItem(KEY, JSON.stringify(wishes)); } catch (err) { /* abaikan */ }
        render();
        form.reset();
    });

    setInterval(render, 60000); // segarkan label waktu
}

// 10. Hadiah (salin teks & QR)
function initializeGift() {
    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* abaikan */ }
        document.body.removeChild(ta);
    }

    document.querySelectorAll('.btn-copy').forEach(btn => {
        const originalText = btn.textContent;
        btn.addEventListener('click', async () => {
            const text = document.getElementById(btn.dataset.copy).innerText.trim();
            try {
                if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
                else fallbackCopy(text);
            } catch (e) { fallbackCopy(text); }

            btn.textContent = 'Tersalin!';
            btn.style.backgroundColor = 'var(--maroon)';
            btn.style.borderColor = 'var(--maroon)';
            btn.style.color = '#fff';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.backgroundColor = '';
                btn.style.borderColor = '';
                btn.style.color = '';
            }, 2000);
        });
    });

    document.getElementById('btn-show-qr').addEventListener('click', () => {
        document.getElementById('modal-qr').classList.add('show');
    });
}

// 11. Modal (tutup lewat tombol, klik luar, atau tombol Esc)
function initializeModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.querySelectorAll('.close-modal').forEach(btn =>
            btn.addEventListener('click', () => modal.classList.remove('show')));
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') modals.forEach(m => m.classList.remove('show'));
    });
}

// 12. Animasi muncul saat scroll
function initializeScrollAnimation() {
    const reveals = document.querySelectorAll('.section-reveal');

    if (!('IntersectionObserver' in window)) {
        reveals.forEach(r => r.classList.add('active'));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    reveals.forEach(r => observer.observe(r));
}

// 13. Video hero (jeda saat tidak terlihat, cadangan jika gagal dimuat)
function initializeHeroVideo() {
    const video = document.getElementById('hero-video');
    if (!video) return;

    // Jika SEMUA sumber video gagal dimuat, sembunyikan agar gambar poster tampil
    const sources = video.querySelectorAll('source');
    const lastSource = sources[sources.length - 1];
    if (lastSource) {
        lastSource.addEventListener('error', () => {
            console.warn('Video hero gagal dimuat. Cek lokasi & nama file: video/prewedding.mp4');
            video.style.display = 'none';
        });
    }

    // Hemat baterai: putar hanya saat hero terlihat
    new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) video.play().catch(() => {});
            else video.pause();
        });
    }, { threshold: 0.1 }).observe(video);
}