/* ==========================================================================
   3d-flowers.js — Bunga mawar 3D sungguhan (mesh Three.js, bukan SVG/2D)
   Dimuat SETELAH 3d-webgl.js. Tidak mengubah fitur lama; hanya menyisipkan
   dua panggung 3D baru:
     1. Buket mawar di "Our Special Day"  → mekar saat terlihat, geser untuk
        memutar, ketuk = buket berputar + kelopak berhamburan
     2. Kado di "Wedding Gift"            → ketuk: tutup terbuka, mawar naik
        & mekar, kelopak beterbangan. Ketuk lagi untuk menutup.
   Jika WebGL/Three.js gagal, tidak ada yang disisipkan (halaman tetap normal).
   ========================================================================== */
(function () {
    'use strict';
    const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4;
    const idle = reduce ? 0 : 1;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (a, b) => a + Math.random() * (b - a);
    const ease = t => 1 - Math.pow(1 - t, 3);

    try {
        const c = document.createElement('canvas');
        if (!(c.getContext('webgl2') || c.getContext('webgl'))) return;
    } catch (e) { return; }

    import(THREE_URL).then(init).catch(e => console.warn('[3D bunga] dilewati:', e));

    function init(THREE) {
        /* ---------- CSS (disisipkan lewat JS) ---------- */
        const css = document.createElement('style');
        css.textContent = `
        .flower-stage{position:relative;width:100%;max-width:560px;height:clamp(300px,72vw,440px);margin:-.5rem auto 1.5rem}
        .fl-canvas{width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab;opacity:0;transition:opacity 1s ease}
        .fl-canvas.ready{opacity:1}.fl-canvas:active{cursor:grabbing}
        .fl-hint{position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:.75rem;letter-spacing:2px;
          text-transform:uppercase;color:var(--gold-dark);pointer-events:none;animation:flHint 2.4s ease-in-out infinite}
        @keyframes flHint{50%{opacity:.4}}
        @media (prefers-reduced-motion:reduce){.fl-hint{animation:none}}`;
        document.head.appendChild(css);

        /* ---------- Bahan visual ---------- */
        function makeEnv(r) {
            const c = document.createElement('canvas'); c.width = 256; c.height = 128;
            const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
            gr.addColorStop(0, '#fff3d6'); gr.addColorStop(.5, '#7a5a30'); gr.addColorStop(1, '#3a0b14');
            g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
            g.fillStyle = 'rgba(255,248,228,.95)';
            [[30, 20, 60, 18], [150, 12, 80, 16], [100, 60, 50, 12]].forEach(a => g.fillRect(...a));
            const t = new THREE.CanvasTexture(c);
            t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
            const p = new THREE.PMREMGenerator(r), e = p.fromEquirectangular(t).texture;
            t.dispose(); p.dispose(); return e;
        }

        // Kelopak: pangkal di origin, memanjang ke +Y, melengkung seperti mangkuk
        const PET = (() => {
            const g = new THREE.PlaneGeometry(0.9, 1, 5, 7); g.translate(0, 0.5, 0);
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) {
                let x = p.getX(i); const y = p.getY(i);
                x *= 0.35 + 0.65 * Math.sin(Math.PI * Math.pow(y, 0.8));
                p.setXYZ(i, x, y, -x * x * 0.9 + y * y * y * 0.35);
            }
            g.computeVertexNormals(); return g;
        })();

        const green = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: .6, side: THREE.DoubleSide });
        const gold = new THREE.MeshStandardMaterial({ color: 0xd9b24c, metalness: 1, roughness: .22, envMapIntensity: 1.2 });

        /* ---------- Mawar 3D: 5 lapis kelopak, kelopak/daun/batang ---------- */
        function makeRose(inner, outer, L, layers) {
            const g = new THREE.Group(), petals = [];
            const c1 = new THREE.Color(inner), c2 = new THREE.Color(outer), N = [3, 4, 5, 6, 7];
            const LY = layers || 5;
            for (let l = 0; l < LY; l++) {
                const mat = new THREE.MeshStandardMaterial({
                    color: c1.clone().lerp(c2, l / (LY - 1)), side: THREE.DoubleSide, roughness: .5, metalness: .05
                });
                for (let k = 0; k < N[l]; k++) {
                    const pv = new THREE.Group(); pv.rotation.order = 'YXZ';
                    pv.rotation.y = k / N[l] * Math.PI * 2 + l * .6; pv.position.y = l * .015;
                    const m = new THREE.Mesh(PET, mat);
                    m.scale.setScalar(.28 + l * .09); m.position.z = .02 + l * .03;
                    pv.add(m); g.add(pv);
                    petals.push({ pv, c: .12 + l * .09, o: .5 + l * .27, d: l * .1 });
                }
            }
            for (let k = 0; k < 5; k++) {                       // kelopak hijau di pangkal
                const pv = new THREE.Group(); pv.rotation.order = 'YXZ';
                pv.rotation.set(1.9, k * Math.PI * 2 / 5, 0); pv.position.y = -.02;
                const m = new THREE.Mesh(PET, green); m.scale.set(.22, .4, .22); pv.add(m); g.add(pv);
            }
            const bud = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 10), green);
            bud.position.y = -.06; bud.scale.y = .8; g.add(bud);
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, L, 8), green);
            stem.position.y = -L / 2; g.add(stem);
            for (let i = 0; i < 2; i++) {                       // daun di batang
                const pv = new THREE.Group(); pv.rotation.order = 'YXZ';
                pv.rotation.set(1.0, i * 3.1 + .5, 0); pv.position.y = -L * (.35 + .2 * i);
                const m = new THREE.Mesh(PET, green); m.scale.set(.6, .9, .6); pv.add(m); g.add(pv);
            }
            return {
                group: g,
                setBloom(b) {
                    for (const p of petals) p.pv.rotation.x = lerp(p.c, p.o, ease(clamp((b - p.d) / .6, 0, 1)));
                    g.scale.setScalar(.85 + .15 * b);
                }
            };
        }

        /* ---------- Kelopak berhamburan ---------- */
        function makeBurst(scene, n) {
            const mat = new THREE.MeshStandardMaterial({ color: 0x9b2335, side: THREE.DoubleSide, roughness: .5 });
            const mat2 = new THREE.MeshStandardMaterial({ color: 0xf0cfcb, side: THREE.DoubleSide, roughness: .5 });
            const items = [];
            for (let i = 0; i < n; i++) {
                const m = new THREE.Mesh(PET, i % 3 ? mat : mat2);
                m.scale.setScalar(.2); m.visible = false; scene.add(m);
                items.push({ m, v: new THREE.Vector3(), s: new THREE.Vector3(), life: 0 });
            }
            return {
                spawn(pos, k) {
                    let c = 0;
                    for (const it of items) if (it.life <= 0 && c < k) {
                        c++; it.life = rand(2, 3.4); it.m.position.copy(pos);
                        it.v.set(rand(-1.8, 1.8), rand(2, 4.2), rand(-1.2, 1.8));
                        it.s.set(rand(-4, 4), rand(-4, 4), rand(-4, 4)); it.m.visible = true;
                    }
                },
                update(dt) {
                    for (const it of items) {
                        if (it.life <= 0) continue;
                        it.life -= dt; it.v.y -= 3 * dt; it.v.x *= 1 - dt * .5;
                        it.m.position.addScaledVector(it.v, dt);
                        it.m.rotation.x += it.s.x * dt; it.m.rotation.y += it.s.y * dt; it.m.rotation.z += it.s.z * dt;
                        if (it.life <= 0) it.m.visible = false;
                    }
                }
            };
        }

        /* ---------- Panggung (canvas + renderer + interaksi) ---------- */
        const stages = [];
        function createStage(host, o) {
            const canvas = document.createElement('canvas'); canvas.className = 'fl-canvas';
            canvas.setAttribute('aria-hidden', 'true');
            let r;
            try { r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !lowEnd }); } catch (e) { return null; }
            host.appendChild(canvas);
            r.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
            r.outputColorSpace = THREE.SRGBColorSpace;
            r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
            const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, .1, 100);
            cam.position.set(0, o.camY, o.camZ); cam.lookAt(0, o.lookY, 0);
            scene.environment = makeEnv(r);
            scene.add(new THREE.AmbientLight(0xffffff, .6));
            const key = new THREE.DirectionalLight(0xfff0d0, 2.2); key.position.set(3, 6, 6); scene.add(key);
            const rim = new THREE.DirectionalLight(0xffb7a8, .9); rim.position.set(-5, 2, -3); scene.add(rim);

            const st = { canvas, r, scene, cam, visible: false, yaw: 0, yawT: 0, hx: 0, onTap: null, update: null };
            const fit = () => {
                const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
                r.setSize(w, h, false); cam.aspect = w / h;
                const k = Math.max(1, 1 / cam.aspect);               // layar sempit → lebarkan pandangan
                cam.fov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(19)) * k) * 180 / Math.PI;
                cam.updateProjectionMatrix();
            };
            fit();
            if ('ResizeObserver' in window) new ResizeObserver(fit).observe(host); else addEventListener('resize', fit);
            if ('IntersectionObserver' in window)
                new IntersectionObserver(es => { st.visible = es[0].isIntersecting; }, { rootMargin: '80px' }).observe(host);
            else st.visible = true;

            let down = false, lx = 0, moved = 0;
            canvas.addEventListener('pointerdown', e => { down = true; lx = e.clientX; moved = 0; });
            canvas.addEventListener('pointermove', e => {
                const b = canvas.getBoundingClientRect();
                st.hx = clamp(((e.clientX - b.left) / b.width) * 2 - 1, -1, 1);
                if (down) { const dx = e.clientX - lx; lx = e.clientX; moved += Math.abs(dx); st.yawT += dx * .012; }
            });
            const up = () => { if (down && moved < 6 && st.onTap) st.onTap(); down = false; };
            canvas.addEventListener('pointerup', up);
            canvas.addEventListener('pointercancel', () => { down = false; });
            canvas.addEventListener('pointerleave', () => { st.hx = 0; down = false; });
            st.show = () => canvas.classList.add('ready');
            stages.push(st); return st;
        }

        function mount(parentSel, beforeSel, hint) {
            const p = document.querySelector(parentSel); if (!p) return null;
            const before = p.querySelector(beforeSel); if (!before) return null;
            const d = document.createElement('div'); d.className = 'flower-stage';
            const h = document.createElement('span'); h.className = 'fl-hint'; h.textContent = hint;
            before.parentNode.insertBefore(d, before);
            return { host: d, hint: h, attach() { d.appendChild(h); } };
        }

        /* ---------- Adegan 1: buket mawar ---------- */
        function bouquet() {
            const m = mount('#details .container', '.info-card', 'Geser untuk memutar · ketuk bunga'); if (!m) return;
            const st = createStage(m.host, { camZ: 9.5, camY: .6, lookY: .2 }); if (!st) return;
            m.attach();
            const pivot = new THREE.Group(); pivot.position.y = -2.3; st.scene.add(pivot);

            [-1.05, -.6, -.25, .25, .6, 1.05].forEach(a => {          // daun belakang
                const h = new THREE.Group(); h.rotation.z = a; h.position.z = -.25;
                const leaf = new THREE.Mesh(PET, green); leaf.scale.set(1.1, 2.6, 1); leaf.position.y = .6;
                h.add(leaf); pivot.add(h);
            });
            const defs = [   // [rotZ, rotX, panjang, warna dalam, warna luar]
                [0, 0, 3.2, 0x4f0d19, 0x9b2335], [-.4, .15, 2.9, 0xd89aa0, 0xf7e1dd], [.4, -.1, 2.9, 0xd89aa0, 0xf7e1dd],
                [-.75, .05, 2.5, 0x6d0f1f, 0xb64557], [.75, -.15, 2.5, 0x6d0f1f, 0xb64557]
            ];
            const roses = defs.map((d, i) => {
                const h = new THREE.Group(); h.rotation.set(d[1], 0, d[0]);
                const r = makeRose(d[3], d[4], d[2]); r.group.position.y = d[2];
                r.setBloom(0); h.add(r.group); pivot.add(h); return { r, i, pulse: 0 };
            });
            const dotG = new THREE.IcosahedronGeometry(.07, 0), dotM = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: .6 });
            for (let i = 0; i < 18; i++) {                              // baby's breath
                const a = rand(-.95, .95), d = rand(2.9, 3.7), s = new THREE.Mesh(dotG, dotM);
                s.position.set(Math.sin(a) * d, Math.cos(a) * d, rand(-.4, .3)); pivot.add(s);
            }
            const band = new THREE.Mesh(new THREE.CylinderGeometry(.34, .3, .35, 20), gold); band.position.y = .9; pivot.add(band);
            [-1, 1].forEach(s => {                                       // pita
                const loop = new THREE.Mesh(new THREE.TorusGeometry(.26, .06, 8, 24), gold);
                loop.position.set(s * .3, .95, .34); loop.scale.y = 1.3; loop.rotation.z = s * .5; pivot.add(loop);
                const tail = new THREE.Mesh(new THREE.BoxGeometry(.12, .8, .03), gold);
                tail.position.set(s * .18, .35, .38); tail.rotation.z = s * .22; pivot.add(tail);
            });
            const burst = makeBurst(st.scene, 40), tip = new THREE.Vector3();
            let t0 = -1;

            st.onTap = () => {
                st.yawT += Math.PI * 2; roses.forEach(o => { o.pulse = 1; });
                roses.forEach(o => { o.r.group.getWorldPosition(tip); burst.spawn(tip, 6); });
            };
            st.update = (dt, t) => {
                if (t0 < 0) { t0 = t; st.show(); }
                roses.forEach(o => {
                    o.pulse = Math.max(0, o.pulse - dt * 1.6);
                    o.r.setBloom(reduce ? 1 : clamp((t - t0 - o.i * .25) / 2, 0, 1));
                    o.r.group.scale.multiplyScalar(1 + .14 * Math.sin(o.pulse * Math.PI));
                });
                pivot.rotation.y = st.yaw + st.hx * .3 * idle + Math.sin(t * .5) * .22 * idle;
                pivot.rotation.z = Math.sin(t * .8) * .02 * idle;
                pivot.position.y = -2.3 + Math.sin(t * 1.1) * .05 * idle;
                burst.update(dt);
            };
        }

        /* ---------- Adegan 2: kado + mawar mekar ---------- */
        function giftBox() {
            const m = mount('#gift .container', '.gift-grid', 'Ketuk kado untuk membuka'); if (!m) return;
            const st = createStage(m.host, { camZ: 11, camY: 1.6, lookY: 1.1 }); if (!st) return;
            m.attach();
            const grp = new THREE.Group(); grp.position.y = -1.2; st.scene.add(grp);
            const red = new THREE.MeshPhysicalMaterial({ color: 0x6d0f1f, roughness: .35, clearcoat: .6, clearcoatRoughness: .25 });
            const box = (w, h, d, mat, x, y, z, par) => {
                const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); (par || grp).add(b); return b;
            };
            box(2.4, 1.5, 2.4, red, 0, .75, 0);
            box(.4, 1.52, 2.44, gold, 0, .75, 0); box(2.44, 1.52, .4, gold, 0, .75, 0);
            const dark = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshBasicMaterial({ color: 0x1f0409 }));
            dark.rotation.x = -Math.PI / 2; dark.position.y = 1.505; grp.add(dark);

            const lid = new THREE.Group(); lid.position.set(0, 1.5, -1.3); grp.add(lid);
            box(2.6, .4, 2.6, red, 0, .2, 1.3, lid);
            box(.4, .42, 2.64, gold, 0, .2, 1.3, lid); box(2.64, .42, .4, gold, 0, .2, 1.3, lid);
            [-1, 1].forEach(s => {
                const loop = new THREE.Mesh(new THREE.TorusGeometry(.3, .07, 10, 28), gold);
                loop.position.set(s * .34, .6, 1.3); loop.scale.y = 1.3; loop.rotation.z = s * .55; lid.add(loop);
            });
            const knot = new THREE.Mesh(new THREE.SphereGeometry(.14, 14, 12), gold); knot.position.set(0, .52, 1.3); lid.add(knot);

            const pos = [[0, 0, 2.5, 0x4f0d19, 0x9b2335, 0], [-.55, .25, 2.1, 0xd89aa0, 0xf7e1dd, .28], [.55, -.2, 2.0, 0x6d0f1f, 0xb64557, -.28]];
            const roses = pos.map(p => {
                const h = new THREE.Group(); h.position.set(p[0], 1.5, p[1]); h.rotation.z = p[5];
                const r = makeRose(p[3], p[4], p[2]); r.setBloom(0); r.group.position.y = -.6;
                h.add(r.group); grp.add(h); return { r, L: p[2] };
            });
            const burst = makeBurst(st.scene, 44), tip = new THREE.Vector3(0, 2.4, 0);
            let open = false, o = reduce ? 0 : 0;

            st.yaw = st.yawT = .35;
            st.onTap = () => { open = !open; if (open) burst.spawn(grp.localToWorld(tip.clone().set(0, 1.8, 0)), 40);
                m.hint.textContent = open ? 'Ketuk lagi untuk menutup' : 'Ketuk kado untuk membuka'; };
            st.update = (dt, t) => {
                if (!o && !open) st.show(); else st.show();
                o += ((open ? 1 : 0) - o) * Math.min(1, dt * (reduce ? 30 : 2.6));
                lid.rotation.x = -o * 2.0 - (1 - o) * Math.max(0, Math.sin(t * 2.2)) * .05 * idle;
                const rise = ease(clamp((o - .35) / .65, 0, 1)), bl = clamp((o - .6) / .4, 0, 1);
                roses.forEach(r => { r.r.group.position.y = lerp(-.6, r.L, rise); r.r.setBloom(bl); });
                grp.rotation.y = st.yaw + st.hx * .35 * idle;
                grp.position.y = -1.2 + Math.sin(t * 1.2) * .05 * idle;
                burst.update(dt);
            };
        }

        /* ---------- Adegan 3: rangkaian bunga di sisi layar + hujan kelopak ---------- */
        function ambient() {
            const canvas = document.createElement('canvas'); canvas.className = 'fl-ambient';
            canvas.setAttribute('aria-hidden', 'true');
            const sty = document.createElement('style');
            sty.textContent = '.fl-ambient{position:fixed;inset:0;width:100%;height:100%;z-index:60;pointer-events:none;opacity:0;transition:opacity 1.2s ease}.fl-ambient.on{opacity:1}';
            document.head.appendChild(sty);
            let r; try { r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !lowEnd }); } catch (e) { return; }
            document.body.appendChild(canvas);
            r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
            r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
            const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, .1, 100), CZ = 12;
            cam.position.set(0, 0, CZ); scene.environment = makeEnv(r);
            scene.add(new THREE.AmbientLight(0xffffff, .65));
            const key = new THREE.DirectionalLight(0xfff0d0, 2.2); key.position.set(3, 6, 8); scene.add(key);
            const rim = new THREE.DirectionalLight(0xffb7a8, .8); rim.position.set(-5, 2, -3); scene.add(rim);
            const tanH = Math.tan(THREE.MathUtils.degToRad(22.5));
            const hH = z => (CZ - z) * tanH, hW = z => hH(z) * cam.aspect;

            const n = coarse ? 4 : 7, per = coarse ? 2 : 3, sp = coarse ? 9 : 7.5, H = n * sp;
            const green2 = new THREE.MeshStandardMaterial({ color: 0x4a7a47, roughness: .6, side: THREE.DoubleSide });
            const dotG = new THREE.IcosahedronGeometry(.06, 0), dotM = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: .6 });
            const pal = [[0x4f0d19, 0x9b2335], [0xd89aa0, 0xf7e1dd], [0x6d0f1f, 0xb64557], [0x8a6823, 0xe8d29a]];
            const clusters = [];

            // Satu rangkaian: sulur melengkung dari tepi layar + mawar mekar + daun + mutiara + kuncup
            function cluster(side, y, idx) {
                const dir = -side, g = new THREE.Group(), bend = rand(-.6, .6);
                const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [.9, .35 + bend * .6, rand(-.2, .2)],
                    [1.8, bend - .1, rand(-.2, .3)], [2.7, bend * .5 - .6, rand(-.2, .2)]]
                    .map(a => new THREE.Vector3(a[0] * dir, a[1], a[2])));
                g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .05, 6), green));
                for (let i = 0; i < (coarse ? 5 : 8); i++) {
                    const h = new THREE.Group(); h.position.copy(curve.getPoint(rand(.05, 1)));
                    h.rotation.set(rand(-.5, .5), rand(-.5, .5), rand(0, 6.28));
                    const m = new THREE.Mesh(PET, i % 2 ? green : green2), s = rand(.7, 1.1);
                    m.scale.set(.5 * s, 1.1 * s, .5 * s); h.add(m); g.add(h);
                }
                [.3, .62, .92].slice(0, per).forEach((t, k) => {
                    const c = pal[(idx + k) % pal.length], rose = makeRose(c[0], c[1], .3, 4);
                    rose.setBloom(1); rose.group.rotation.y = rand(0, 6.28);
                    const h = new THREE.Group(); h.add(rose.group);
                    h.position.copy(curve.getPoint(t)); h.position.z += k * .15;
                    h.rotation.set(Math.PI / 2 + rand(-.3, .3), 0, rand(-.3, .3));
                    h.scale.setScalar([1.5, 1.25, 1][k] * rand(.9, 1.1)); g.add(h);
                });
                const bud = makeRose(0x4f0d19, 0x9b2335, .2, 3); bud.setBloom(.1);
                const bh = new THREE.Group(); bh.add(bud.group); bh.position.copy(curve.getPoint(1));
                bh.rotation.set(Math.PI / 2 - .6, 0, dir * -.8); bh.scale.setScalar(.7); g.add(bh);
                for (let i = 0; i < 7; i++) {
                    const s = new THREE.Mesh(dotG, i % 3 ? dotM : gold), p = curve.getPoint(rand(.1, 1));
                    s.position.set(p.x + rand(-.3, .3), p.y + rand(-.5, .5), p.z + rand(-.1, .3)); g.add(s);
                }
                scene.add(g);
                clusters.push({ g, side, y, ph: rand(0, 6.28) });
            }
            for (let k = 0; k < n; k++) {      // kiri & kanan berselang-seling sepanjang halaman
                cluster(-1, -(k * sp + sp * .4), k);
                cluster(1, -(k * sp + sp * .9), k + 1);
            }

            // Hujan kelopak (InstancedMesh: 1 draw call untuk semua kelopak)
            const cnt = idle ? (lowEnd ? 45 : coarse ? 70 : 130) : 0, P = [];
            const pg = new THREE.Group(); scene.add(pg);
            let inst = null; const tmp = new THREE.Object3D();
            if (cnt) {
                inst = new THREE.InstancedMesh(PET, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .5 }), cnt);
                inst.frustumCulled = false; pg.add(inst);
                const cols = [0x9b2335, 0x6d0f1f, 0xb64557, 0xf0cfcb, 0xe8d29a].map(c => new THREE.Color(c));
                for (let i = 0; i < cnt; i++) {
                    inst.setColorAt(i, cols[i % 5]);
                    P.push({ x: 0, y: 0, z: rand(-3, 4), fall: rand(.5, 1.3), sw: rand(.2, .7), sf: rand(.6, 1.4), ph: rand(0, 6.28),
                        rx: rand(0, 6.28), ry: rand(0, 6.28), rz: rand(0, 6.28), sx: rand(-2, 2), sy: rand(-2, 2), sz: rand(-2, 2),
                        s: rand(.18, .38), bx: 0, by: 0 });
                }
            }
            const respawn = (q, anywhere) => { q.x = rand(-1.1, 1.1) * hW(q.z); q.y = anywhere ? rand(-hH(q.z), hH(q.z)) : hH(q.z) + 1 + rand(0, 2); };

            let sc = 1;
            function fit() {
                const w = innerWidth, h = innerHeight; r.setSize(w, h, false);
                cam.aspect = w / h; cam.updateProjectionMatrix();
                const unitPx = w / (2 * hW(0)), target = clamp((w - 1100) / 2, 70, 300);
                sc = clamp(target / (unitPx * 2.7), .3, 1.3);
                clusters.forEach(c => { c.g.scale.setScalar(sc); c.g.position.x = c.side * hW(0) * 1.03; });
            }
            fit(); P.forEach(q => respawn(q, true));
            let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(fit, 120); });

            const ptr = { x: 0 };
            addEventListener('pointermove', e => { ptr.x = e.clientX / innerWidth * 2 - 1; }, { passive: true });
            const cover = document.getElementById('cover-page');
            const coverOpen = () => !!cover && cover.style.display !== 'none' && !cover.classList.contains('slide-up');
            let bi = 0;
            addEventListener('click', e => {          // klik di mana saja = kelopak tersembur
                if (coverOpen() || !P.length) return;
                const nx = e.clientX / innerWidth * 2 - 1, ny = -(e.clientY / innerHeight * 2 - 1);
                for (let k = 0; k < 22; k++) {
                    const q = P[bi++ % P.length]; q.z = rand(-1, 2);
                    q.x = nx * hW(q.z) + rand(-.3, .3); q.y = ny * hH(q.z) + rand(-.3, .3);
                    q.bx = rand(-4, 4); q.by = rand(1, 5);
                }
            });

            let last = performance.now(), time = 0, lastY = scrollY, sv = 0;
            (function loop(now) {
                requestAnimationFrame(loop);
                if (document.hidden || coverOpen()) { last = now; return; }
                canvas.classList.add('on');
                const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
                const max = document.documentElement.scrollHeight - innerHeight, p = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
                sv = lerp(sv, (scrollY - lastY) / Math.max(dt, .001), Math.min(1, dt * 6)); lastY = scrollY;
                cam.position.y += (-p * H - cam.position.y) * Math.min(1, dt * 4);
                pg.position.y = cam.position.y;
                const wind = clamp(sv * .002, -4, 4) + ptr.x * .5;
                clusters.forEach(c => {
                    c.g.rotation.z = (Math.sin(time * .7 + c.ph) * .04 + clamp(sv * .00006, -.08, .08)) * idle;
                    c.g.position.y = c.y + Math.sin(time * .9 + c.ph) * .08 * idle;
                });
                if (inst) {
                    const k = Math.min(1, dt * 1.6);
                    for (let i = 0; i < cnt; i++) {
                        const q = P[i], ex = hH(q.z) + 1, wx = hW(q.z) * 1.15;
                        q.bx -= q.bx * k; q.by -= q.by * k;
                        q.x += (Math.sin(time * q.sf + q.ph) * q.sw + wind * (1 + q.z * .1) + q.bx) * dt;
                        q.y += (-q.fall + q.by) * dt;
                        if (q.y < -ex) respawn(q, false);
                        if (q.x > wx) q.x = -wx; else if (q.x < -wx) q.x = wx;
                        q.rx += q.sx * dt; q.ry += q.sy * dt; q.rz += q.sz * dt;
                        tmp.position.set(q.x, q.y, q.z); tmp.rotation.set(q.rx, q.ry, q.rz);
                        tmp.scale.setScalar(q.s); tmp.updateMatrix(); inst.setMatrixAt(i, tmp.matrix);
                    }
                    inst.instanceMatrix.needsUpdate = true;
                }
                r.render(scene, cam);
            })(last);
        }

        try { bouquet(); } catch (e) { console.warn('[3D bunga] buket:', e); }
        try { giftBox(); } catch (e) { console.warn('[3D bunga] kado:', e); }
        try { ambient(); } catch (e) { console.warn('[3D bunga] ambient:', e); }
        if (!stages.length) return;

        let last = performance.now(), time = 0;
        (function loop(now) {
            requestAnimationFrame(loop);
            if (document.hidden) { last = now; return; }
            const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
            for (const s of stages) {
                if (!s.visible) continue;
                s.yaw += (s.yawT - s.yaw) * Math.min(1, dt * 4);
                s.update(dt, time); s.r.render(s.scene, s.cam);
            }
        })(last);
    }
})();