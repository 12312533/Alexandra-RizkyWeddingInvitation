/* ==========================================================================
   3d.js  —  Efek 3D berbasis CSS + JS ringan (tanpa dependensi)
   --------------------------------------------------------------------------
   Dimuat SETELAH script.js. Tidak menyentuh logika undangan; hanya menambah
   kelas / variabel CSS dan mengamati perubahan DOM.

   Modul
     1. Progress scroll          5. Flip countdown
     2. Tilt kartu + kilau       6. Progress timeline
     3. Reveal 3D berurutan      7. Transisi lightbox
     4. Kedalaman cover/hero/penutup
   ========================================================================== */
(() => {
    'use strict';

    const root = document.documentElement;
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    root.classList.add('js3d');
    if (reduce) root.classList.add('reduce-3d');

    /* Posisi pointer global (-1..1), dihaluskan di loop kedalaman */
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    window.addEventListener('pointermove', e => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { pointer.x = 0; pointer.y = 0; });

    const cover = $('#cover-page');
    const coverIsOpen = () => !!cover && cover.style.display !== 'none' && !cover.classList.contains('slide-up');

    /* ------------------------------------------------------------------ 1 */
    function initScrollProgress() {
        const bar = document.createElement('div');
        bar.id = 'scroll-progress';
        bar.setAttribute('aria-hidden', 'true');
        document.body.appendChild(bar);

        let ticking = false;
        const update = () => {
            const max = root.scrollHeight - window.innerHeight;
            bar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max, 0, 1) : 0})`;
            ticking = false;
        };
        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    /* ------------------------------------------------------------------ 2 */
    const TILT_TARGETS = [
        ['.info-card',        { max: 6 }],
        ['.event-card',       { max: 9 }],
        ['.gift-card',        { max: 8 }],
        ['.timeline-content', { max: 6 }],
        ['.countdown-item',   { max: 12 }],
        ['.gallery-item',     { max: 8 }],
        ['.form-card',        { max: 2.5, glare: false }],
        ['.video-container',  { max: 3, glare: false }]
    ];

    function bindTilt(el, { max = 8, glare = true } = {}) {
        if (el.__tilt) return;
        el.__tilt = true;

        let glareEl = null;
        if (glare) {
            glareEl = document.createElement('span');
            glareEl.className = 'tilt-glare';
            glareEl.setAttribute('aria-hidden', 'true');
            el.appendChild(glareEl);
        }

        let rect = null, raf = 0, active = false;
        let tx = 0, ty = 0, cx = 0, cy = 0;

        const apply = () => {
            cx = lerp(cx, tx, 0.14);
            cy = lerp(cy, ty, 0.14);
            el.style.setProperty('--rx', (-cy * max).toFixed(2) + 'deg');
            el.style.setProperty('--ry', (cx * max).toFixed(2) + 'deg');
            el.style.setProperty('--nx', cx.toFixed(3));
            el.style.setProperty('--ny', cy.toFixed(3));
            el.style.setProperty('--gx', ((cx + 1) * 50).toFixed(1) + '%');
            el.style.setProperty('--gy', ((cy + 1) * 50).toFixed(1) + '%');

            const moving = active || Math.abs(cx - tx) > 0.002 || Math.abs(cy - ty) > 0.002;
            raf = moving ? requestAnimationFrame(apply) : 0;
        };
        const kick = () => { if (!raf) raf = requestAnimationFrame(apply); };

        el.addEventListener('pointerenter', () => {
            if (el.classList.contains('r3d')) return;   // tunggu animasi masuk selesai
            el.setAttribute('data-tilt', '');
            el.classList.add('is-tilting');
            rect = el.getBoundingClientRect();
            active = true;
            kick();
        });
        el.addEventListener('pointermove', e => {
            if (!active) return;
            if (!rect) rect = el.getBoundingClientRect();
            tx = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
            ty = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
        });
        el.addEventListener('pointerleave', () => {
            active = false;
            tx = 0; ty = 0;
            el.classList.remove('is-tilting');
            kick();
        });
        window.addEventListener('scroll', () => { rect = null; }, { passive: true });
    }

    function initTilt() {
        if (reduce || !finePointer) return;
        TILT_TARGETS.forEach(([sel, opts]) => $$(sel).forEach(el => bindTilt(el, opts)));

        // Item galeri dibuat oleh script.js; tangkap juga yang muncul belakangan
        const grid = $('#gallery-grid');
        if (grid) {
            new MutationObserver(() => $$('.gallery-item', grid).forEach(el => bindTilt(el, { max: 8 })))
                .observe(grid, { childList: true });
        }
    }

    /* ------------------------------------------------------------------ 3 */
    function initReveal3D() {
        if (reduce || !('IntersectionObserver' in window)) return;

        const targets = $$('.info-card, .event-card, .gift-card, .timeline-item, .countdown-item, .gallery-item, .form-card');
        const targetSet = new Set(targets);

        targets.forEach(el => {
            const siblings = Array.from(el.parentElement.children).filter(c => targetSet.has(c));
            const index = siblings.indexOf(el);
            el.style.setProperty('--d', Math.min(index, 6) * 90 + 'ms');
            el.classList.add('r3d');
        });

        const finish = el => {
            el.classList.remove('r3d', 'in');
            el.style.removeProperty('--d');
        };

        const io = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                obs.unobserve(el);
                el.classList.add('in');

                let done = false;
                const end = () => { if (!done) { done = true; finish(el); } };
                el.addEventListener('transitionend', e => {
                    if (e.target === el && e.propertyName === 'transform') end();
                });
                setTimeout(end, 2200);   // cadangan jika transitionend tidak terpicu
            });
        }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });

        targets.forEach(el => io.observe(el));
    }

    /* ------------------------------------------------------------------ 4 */
    function initDepthLoop() {
        if (reduce) return;

        const coverContent = cover && $('.cover-content', cover);
        const coverFrame = cover && $('.cover-frame', cover);

        const hero = $('#hero');
        const heroContent = hero && $('.hero-content', hero);
        const heroVideo = hero && $('.hero-bg-video', hero);
        const heroTitle = hero && $('.hero-title', hero);

        const closing = $('#closing');
        const closingContent = closing && $('.hero-content', closing);

        let heroVisible = true, closingVisible = false;
        let heroH = hero ? hero.offsetHeight : 0;

        if ('IntersectionObserver' in window) {
            if (hero) new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }).observe(hero);
            if (closing) new IntersectionObserver(es => { closingVisible = es[0].isIntersecting; }, { rootMargin: '100px 0px' }).observe(closing);
        }
        window.addEventListener('resize', () => { if (hero) heroH = hero.offsetHeight; });

        function frame() {
            pointer.sx = lerp(pointer.sx, pointer.x, 0.07);
            pointer.sy = lerp(pointer.sy, pointer.y, 0.07);
            const { sx, sy } = pointer;

            if (coverIsOpen()) {
                if (coverContent) {
                    coverContent.style.transform = `perspective(1100px) rotateY(${(sx * 7).toFixed(2)}deg) rotateX(${(-sy * 6).toFixed(2)}deg)`;
                    coverContent.style.setProperty('--ex', (-sx * 1.2).toFixed(2));
                    coverContent.style.setProperty('--ey', (1 - sy * 0.45).toFixed(2));
                }
                if (coverFrame) coverFrame.style.transform = `translate3d(${(-sx * 10).toFixed(1)}px, ${(-sy * 10).toFixed(1)}px, 0)`;
            } else {
                if (hero && heroVisible && heroContent) {
                    const p = clamp(window.scrollY / (heroH * 0.85 || 1), 0, 1);
                    heroContent.style.transform =
                        `translate3d(${(-sx * 8).toFixed(2)}px, ${(p * 70 - sy * 6).toFixed(2)}px, ${(-p * 220).toFixed(1)}px) ` +
                        `rotateY(${(sx * 5).toFixed(2)}deg) rotateX(${(-sy * 4 + p * 10).toFixed(2)}deg)`;
                    heroContent.style.opacity = String(clamp(1 - p * 1.15, 0, 1));
                    if (heroVideo) {
                        heroVideo.style.transform =
                            `translate3d(${(sx * 14).toFixed(1)}px, ${(p * 60 + sy * 10).toFixed(1)}px, 0) scale(${(1.08 + p * 0.1).toFixed(3)})`;
                    }
                    if (heroTitle) {
                        heroTitle.style.setProperty('--ex', (-sx * 1.2).toFixed(2));
                        heroTitle.style.setProperty('--ey', (1 - sy * 0.45).toFixed(2));
                    }
                }
                if (closing && closingVisible && closingContent) {
                    const r = closing.getBoundingClientRect();
                    const enter = 1 - clamp(1 - r.top / window.innerHeight, 0, 1);   // 1 = baru masuk, 0 = penuh
                    closingContent.style.transform =
                        `translate3d(0, ${(enter * 60).toFixed(1)}px, ${(-enter * 140).toFixed(1)}px) rotateX(${(enter * 10).toFixed(2)}deg)`;
                    closingContent.style.opacity = String(clamp(1 - enter * 0.9, 0, 1));
                }
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    /* ------------------------------------------------------------------ 5 */
    function initCountdownFlip() {
        ['cd-days', 'cd-hours', 'cd-minutes', 'cd-seconds'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            let prev = el.textContent;
            new MutationObserver(() => {
                const now = el.textContent;
                if (now === prev) return;
                prev = now;
                if (reduce) return;
                el.classList.remove('flip');
                void el.offsetWidth;          // restart animasi
                el.classList.add('flip');
            }).observe(el, { childList: true, characterData: true, subtree: true });
        });
    }

    /* ------------------------------------------------------------------ 6 */
    function initTimelineProgress() {
        const tl = $('.timeline');
        if (!tl) return;
        let ticking = false;
        const update = () => {
            const r = tl.getBoundingClientRect();
            const p = clamp((window.innerHeight * 0.6 - r.top) / (r.height || 1), 0, 1);
            tl.style.setProperty('--tl-p', p.toFixed(3));
            ticking = false;
        };
        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    /* ------------------------------------------------------------------ 7 */
    function initLightboxFX() {
        const img = $('#lightbox-img');
        if (!img || reduce) return;
        new MutationObserver(() => {
            img.classList.remove('swap');
            void img.offsetWidth;
            img.classList.add('swap');
        }).observe(img, { attributes: true, attributeFilter: ['src'] });
    }

    /* ---------------------------------------------------------------------- */
    function boot() {
        const steps = [initScrollProgress, initTilt, initReveal3D, initDepthLoop,
                       initCountdownFlip, initTimelineProgress, initLightboxFX];
        // Satu modul gagal tidak boleh menjatuhkan modul lain / fitur undangan
        steps.forEach(fn => { try { fn(); } catch (err) { console.warn('[3D] ' + fn.name + ' dilewati:', err); } });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();