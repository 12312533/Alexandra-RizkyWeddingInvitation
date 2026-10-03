/* ==========================================================================
   3d-webgl.js  —  Adegan WebGL (Three.js) untuk undangan pernikahan
   --------------------------------------------------------------------------
   Dimuat SETELAH script.js dan 3d.js. Three.js diambil dari CDN secara dinamis;
   jika gagal dimuat / WebGL tidak ada, halaman otomatis tetap tampil dengan
   efek CSS 3D saja (tidak ada error, tidak ada layar kosong).

   Adegan
     • cover   : cincin kawin emas bertaut + debu emas (hilang setelah dibuka)
     • hero    : cincin + halo + debu emas + kelopak, bereaksi pada pointer & scroll
     • global  : kelopak, hati emas, dan debu emas di belakang seluruh halaman;
                 kamera "menyusuri" halaman mengikuti scroll (parallax sungguhan)
     • closing : cincin di bagian penutup

   Performa: adegan hanya dirender saat terlihat, pixel-ratio dibatasi,
   jumlah objek menyesuaikan perangkat, dan semuanya berhenti saat tab disembunyikan.
   ========================================================================== */
(function () {
    'use strict';

    const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    const Q = lowEnd ? 0 : (coarse ? 1 : 2);                 // 0 hemat · 1 sedang · 2 penuh
    const byQuality = (low, mid, high) => [low, mid, high][Q];

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const rand = (a, b) => a + Math.random() * (b - a);

    /* Pointer & scroll dibaca sekali, dipakai semua adegan */
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    window.addEventListener('pointermove', e => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    const scroll = { y: 0, p: 0 };
    function readScroll() {
        scroll.y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        scroll.p = max > 0 ? clamp(scroll.y / max, 0, 1) : 0;
    }
    window.addEventListener('scroll', readScroll, { passive: true });
    readScroll();

    function hasWebGL() {
        try {
            const c = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
        } catch (e) { return false; }
    }
    if (!hasWebGL()) return;

    import(THREE_URL)
        .then(init)
        .catch(err => console.warn('[3D] Three.js tidak dapat dimuat — memakai tampilan CSS 3D saja.', err));

    /* ====================================================================== */
    function init(THREE) {
        const stages = [];

        /* ---------- Bahan baku visual ---------- */

        // Peta lingkungan studio (hangat) agar logam emas punya pantulan yang hidup
        function makeEnv(renderer) {
            const c = document.createElement('canvas');
            c.width = 512; c.height = 256;
            const g = c.getContext('2d');
            const grad = g.createLinearGradient(0, 0, 0, 256);
            grad.addColorStop(0, '#fff3d6');
            grad.addColorStop(0.42, '#8a6a34');
            grad.addColorStop(0.5, '#1a0508');
            grad.addColorStop(1, '#4a0f1b');
            g.fillStyle = grad;
            g.fillRect(0, 0, 512, 256);
            g.fillStyle = 'rgba(255, 248, 228, 0.96)';
            [[40, 36, 96, 28], [230, 22, 130, 24], [390, 58, 84, 32], [140, 118, 64, 18], [330, 110, 90, 16]]
                .forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));

            const tex = new THREE.CanvasTexture(c);
            tex.mapping = THREE.EquirectangularReflectionMapping;
            tex.colorSpace = THREE.SRGBColorSpace;
            const pmrem = new THREE.PMREMGenerator(renderer);
            const env = pmrem.fromEquirectangular(tex).texture;
            tex.dispose();
            pmrem.dispose();
            return env;
        }

        function makeDot() {
            const c = document.createElement('canvas');
            c.width = c.height = 64;
            const g = c.getContext('2d');
            const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
            gr.addColorStop(0, 'rgba(255,255,255,1)');
            gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
            gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr;
            g.fillRect(0, 0, 64, 64);
            const t = new THREE.CanvasTexture(c);
            t.colorSpace = THREE.SRGBColorSpace;
            return t;
        }

        // Kelopak mawar: bidang yang menyempit di ujung dan melengkung seperti mangkuk
        function petalGeometry() {
            const g = new THREE.PlaneGeometry(1, 1.4, 6, 8);
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) {
                let x = p.getX(i);
                const y = p.getY(i);
                const t = y / 1.4 + 0.5;
                x *= Math.pow(Math.sin(Math.PI * clamp(t, 0.03, 0.97)), 0.55);
                const z = x * x * 1.4 + (t - 0.5) * (t - 0.5) * 0.5;
                p.setXYZ(i, x, y, z);
            }
            g.computeVertexNormals();
            return g;
        }

        // Hati 3D bertepi bevel
        function heartGeometry() {
            const s = new THREE.Shape();
            s.moveTo(0.25, 0.25);
            s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
            s.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
            s.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
            s.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
            s.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
            s.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
            const g = new THREE.ExtrudeGeometry(s, {
                depth: 0.18, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06,
                bevelSegments: Q ? 4 : 2, curveSegments: Q ? 24 : 12
            });
            g.center();
            g.rotateZ(Math.PI);          // ujung hati menghadap ke bawah
            return g;
        }

        /* ---------- Stage: satu canvas + renderer + scene + kamera ---------- */
        function createStage({ label, host, mode, cls, fov = 40, camZ = 10 }) {
            const canvas = document.createElement('canvas');
            canvas.className = 'fx-canvas ' + cls;
            canvas.setAttribute('aria-hidden', 'true');

            let renderer;
            try {
                renderer = new THREE.WebGLRenderer({
                    canvas, alpha: true, antialias: Q > 0, powerPreference: 'high-performance'
                });
            } catch (err) { return null; }
            host.appendChild(canvas);

            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q === 2 ? 2 : 1.5));
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.05;
            renderer.setClearColor(0x000000, 0);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
            camera.position.set(0, 0, camZ);
            scene.environment = makeEnv(renderer);

            scene.add(new THREE.AmbientLight(0xffffff, 0.55));
            const key = new THREE.DirectionalLight(0xfff0d0, 2.0);
            key.position.set(3, 5, 6);
            scene.add(key);
            const rim = new THREE.DirectionalLight(0xffb7a8, 0.8);
            rim.position.set(-5, -2, 3);
            scene.add(rim);

            const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2));
            const stage = {
                label, host, mode, canvas, renderer, scene, camera, camZ, fov,
                width: 0, height: 0, aspect: 1, lost: false,
                parts: [], custom: null, onResize: null, isActive: () => false,
                dot: makeDot(),
                halfHeightAt: z => (camZ - z) * tanHalf,
                halfWidthAt: z => (camZ - z) * tanHalf * stage.aspect,

                resize(force) {
                    const w = mode === 'fixed' ? window.innerWidth : host.clientWidth;
                    const h = mode === 'fixed' ? window.innerHeight : host.clientHeight;
                    if (!w || !h) return;
                    if (!force && w === stage.width &&
                        (mode === 'fixed' ? Math.abs(h - stage.height) < 140 : h === stage.height)) return;
                    stage.width = w; stage.height = h; stage.aspect = w / h;
                    renderer.setSize(w, h, false);
                    camera.aspect = stage.aspect;
                    camera.updateProjectionMatrix();
                    if (stage.onResize) stage.onResize();
                },
                render(dt, t) {
                    for (let i = 0; i < stage.parts.length; i++) stage.parts[i].update(dt, t);
                    if (stage.custom) stage.custom(dt, t);
                    renderer.render(scene, camera);
                }
            };

            canvas.addEventListener('webglcontextlost', e => {
                e.preventDefault();
                stage.lost = true;
                canvas.style.display = 'none';
                if (label === 'global') root.classList.remove('webgl-on');
            });
            stage.resize(true);
            return stage;
        }

        function disposeStage(stage) {
            if (!stage) return;
            stage.scene.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
                        for (const k in m) { if (m[k] && m[k].isTexture) m[k].dispose(); }
                        m.dispose();
                    });
                }
            });
            if (stage.scene.environment) stage.scene.environment.dispose();
            stage.dot.dispose();
            stage.renderer.dispose();
            if (stage.renderer.forceContextLoss) stage.renderer.forceContextLoss();
            stage.canvas.remove();
            const i = stages.indexOf(stage);
            if (i > -1) stages.splice(i, 1);
        }

        /* ---------- Komponen adegan ---------- */

        function createPetals(stage, o) {
            const colors = [0x9b2335, 0x6d0f1f, 0xb64557, 0xf0cfcb, 0xe8d29a];
            const geo = petalGeometry();
            const mats = colors.map(c => new THREE.MeshStandardMaterial({
                color: c, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.05,
                transparent: true, opacity: o.opacity
            }));
            const group = new THREE.Group();
            const items = [];
            for (let i = 0; i < o.count; i++) {
                const mesh = new THREE.Mesh(geo, mats[i % mats.length]);
                mesh.scale.setScalar(o.size * rand(0.7, 1.3));
                mesh.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
                group.add(mesh);
                items.push({
                    mesh,
                    nx: rand(-1.05, 1.05),
                    y: o.topY - rand(0, o.spanY),
                    z: rand(o.zMin, o.zMax),
                    fall: rand(0.18, 0.45),
                    sway: rand(0.15, 0.5), swayF: rand(0.5, 1.2), ph: rand(0, 6.28),
                    spin: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(rand(0.4, 1.1))
                });
            }
            stage.scene.add(group);
            return {
                update(dt, t) {
                    for (let i = 0; i < items.length; i++) {
                        const it = items[i];
                        it.y -= it.fall * dt;
                        if (it.y < o.topY - o.spanY - 1) it.y += o.spanY + 2;
                        it.mesh.position.set(
                            it.nx * stage.halfWidthAt(it.z) + Math.sin(t * it.swayF + it.ph) * it.sway,
                            it.y, it.z);
                        it.mesh.rotation.x += it.spin.x * dt;
                        it.mesh.rotation.y += it.spin.y * dt;
                        it.mesh.rotation.z += it.spin.z * dt;
                    }
                }
            };
        }

        function createHearts(stage, o) {
            const geo = heartGeometry();
            const mats = [
                new THREE.MeshStandardMaterial({ color: 0xd9b24c, metalness: 1, roughness: 0.2, envMapIntensity: 1.3 }),
                new THREE.MeshPhysicalMaterial({ color: 0x7a0f22, metalness: 0.25, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }),
                new THREE.MeshStandardMaterial({ color: 0xf1dba4, metalness: 1, roughness: 0.25, envMapIntensity: 1.3 })
            ];
            const group = new THREE.Group();
            const items = [];
            for (let i = 0; i < o.count; i++) {
                const mesh = new THREE.Mesh(geo, mats[i % mats.length]);
                group.add(mesh);
                items.push({
                    mesh,
                    side: i % 2 ? 1 : -1,
                    nx: rand(0.55, 0.95),
                    y: o.topY - ((i + rand(-0.3, 0.3)) / o.count) * o.spanY,
                    z: rand(o.zMin, o.zMax),
                    scale: o.size * rand(0.7, 1.2),
                    bobF: rand(0.5, 1.1), ph: rand(0, 6.28), rot: rand(0.3, 0.8) * (Math.random() < 0.5 ? -1 : 1)
                });
            }
            stage.scene.add(group);
            return {
                update(dt, t) {
                    const sizeFactor = clamp(stage.aspect * 1.2, 0.55, 1);
                    for (let i = 0; i < items.length; i++) {
                        const it = items[i];
                        it.mesh.scale.setScalar(it.scale * sizeFactor);
                        it.mesh.position.set(
                            it.side * it.nx * stage.halfWidthAt(it.z),
                            it.y + Math.sin(t * it.bobF + it.ph) * 0.22,
                            it.z);
                        it.mesh.rotation.y += it.rot * dt;
                        it.mesh.rotation.z = Math.sin(t * 0.6 + it.ph) * 0.25;
                    }
                }
            };
        }

        function createDust(stage, o) {
            const pos = new Float32Array(o.count * 3);
            const speed = new Float32Array(o.count);
            const base = new Float32Array(o.count);
            for (let i = 0; i < o.count; i++) {
                base[i] = rand(-o.w, o.w);
                pos[i * 3] = base[i];
                pos[i * 3 + 1] = rand(o.yBottom, o.yTop);
                pos[i * 3 + 2] = rand(o.zMin, o.zMax);
                speed[i] = rand(0.05, 0.22);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const mat = new THREE.PointsMaterial({
                size: o.size, map: stage.dot, color: o.color, transparent: true, opacity: o.opacity,
                depthWrite: false, sizeAttenuation: true,
                blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending
            });
            const points = new THREE.Points(geo, mat);
            points.frustumCulled = false;
            stage.scene.add(points);
            return {
                update(dt, t) {
                    for (let i = 0; i < o.count; i++) {
                        let y = pos[i * 3 + 1] + speed[i] * dt;
                        if (y > o.yTop) y = o.yBottom;
                        pos[i * 3 + 1] = y;
                        pos[i * 3] = base[i] + Math.sin(t * 0.4 + i) * 0.15;
                    }
                    geo.attributes.position.needsUpdate = true;
                }
            };
        }

        // Dua cincin kawin yang saling bertaut + berlian + halo
        function createRings(stage, o) {
            const gold = new THREE.MeshStandardMaterial({ color: 0xd9b24c, metalness: 1, roughness: 0.18, envMapIntensity: 1.25 });
            const champagne = new THREE.MeshStandardMaterial({ color: 0xf1dba4, metalness: 1, roughness: 0.22, envMapIntensity: 1.25 });
            const gemMat = new THREE.MeshPhysicalMaterial({
                color: 0xffffff, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0,
                envMapIntensity: 3, flatShading: true
            });

            const ringGeo = new THREE.TorusGeometry(1, 0.11, Q ? 40 : 24, Q ? 180 : 100);
            const r1 = new THREE.Mesh(ringGeo, gold);                 // bidang XY
            r1.position.x = -0.5;
            const r2 = new THREE.Mesh(ringGeo, champagne);            // bidang XZ → saling menembus lubang
            r2.rotation.x = Math.PI / 2;
            r2.position.x = 0.5;

            const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), gemMat);
            gem.scale.set(1, 1.3, 1);
            gem.position.set(-0.5, 1.17, 0);

            const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({
                map: stage.dot, color: 0xffffff, transparent: true, opacity: 0.8,
                blending: THREE.AdditiveBlending, depthWrite: false
            }));
            sparkle.position.copy(gem.position);

            const group = new THREE.Group();
            group.add(r1, r2, gem, sparkle);

            const halo1 = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.012, 8, 200),
                new THREE.MeshBasicMaterial({ color: 0xe8d29a, transparent: true, opacity: 0.55 }));
            const halo2 = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.007, 8, 200),
                new THREE.MeshBasicMaterial({ color: 0xe8d29a, transparent: true, opacity: 0.35 }));
            halo2.rotation.x = 1.2;

            const holder = new THREE.Group();
            holder.add(group, halo1, halo2);
            stage.scene.add(holder);

            function fit() {
                const vh = 2 * stage.halfHeightAt(0);
                const vw = vh * stage.aspect;
                const s = Math.min((vh * 0.5) / 2.3, (vw * 0.84) / 3.3) * (o.scale || 1);
                holder.scale.setScalar(s);
            }
            const prevResize = stage.onResize;
            stage.onResize = () => { if (prevResize) prevResize(); fit(); };
            fit();

            return {
                update(dt, t) {
                    const p = o.progress ? o.progress() : 0;
                    group.rotation.y = t * 0.32 + pointer.sx * 0.55 + scroll.y * 0.0012;
                    group.rotation.x = 0.5 + pointer.sy * 0.28 + p * 0.5;
                    group.rotation.z = Math.sin(t * 0.4) * 0.06;
                    holder.position.y = p * 1.1 + Math.sin(t * 0.8) * 0.06;
                    halo1.rotation.z = t * 0.08;
                    halo2.rotation.z = -t * 0.06;
                    halo2.rotation.y = t * 0.15;
                    const pulse = Math.sin(t * 2.4);
                    sparkle.material.opacity = 0.55 + 0.35 * pulse;
                    sparkle.scale.setScalar(0.55 + 0.25 * Math.sin(t * 2.4 + 1));
                }
            };
        }

        /* ---------- Perakit adegan ---------- */
        function buildCover(host) {
            const stage = createStage({ label: 'cover', host, mode: 'fixed', cls: 'fx-fixed' });
            if (!stage) return null;
            stage.parts.push(
                createRings(stage, { scale: 0.92 }),
                createDust(stage, {
                    count: byQuality(50, 100, 160), w: 6, yTop: 5, yBottom: -5, zMin: -3, zMax: 4,
                    size: 0.05, color: 0xf1dfae, opacity: 0.9, additive: true
                })
            );
            return stage;
        }

        function buildHero(host) {
            const stage = createStage({ label: 'hero', host, mode: 'inside', cls: 'fx-inside' });
            if (!stage) return null;
            stage.parts.push(
                createRings(stage, { progress: () => clamp(scroll.y / (host.clientHeight || 1), 0, 1) }),
                createDust(stage, {
                    count: byQuality(50, 110, 180), w: 6, yTop: 5, yBottom: -5, zMin: -3, zMax: 4,
                    size: 0.05, color: 0xf1dfae, opacity: 0.9, additive: true
                }),
                createPetals(stage, {
                    count: byQuality(6, 12, 20), topY: 5.5, spanY: 11, zMin: -2.5, zMax: 3.5,
                    size: 0.4, opacity: 0.9
                })
            );
            return stage;
        }

        function buildClosing(host) {
            const stage = createStage({ label: 'closing', host, mode: 'inside', cls: 'fx-inside' });
            if (!stage) return null;
            stage.parts.push(
                createRings(stage, { scale: 0.9 }),
                createDust(stage, {
                    count: byQuality(40, 90, 150), w: 6, yTop: 5, yBottom: -5, zMin: -3, zMax: 4,
                    size: 0.05, color: 0xf1dfae, opacity: 0.9, additive: true
                })
            );
            return stage;
        }

        function buildGlobal() {
            const stage = createStage({ label: 'global', host: document.body, mode: 'fixed', cls: 'fx-global', fov: 45 });
            if (!stage) return null;
            const H = 30;                                   // tinggi "dunia" yang dilalui kamera
            stage.parts.push(
                createPetals(stage, {
                    count: byQuality(10, 20, 34), topY: 4, spanY: H + 8, zMin: -6, zMax: 2.5,
                    size: 0.42, opacity: 0.82
                }),
                createHearts(stage, {
                    count: byQuality(5, 9, 14), topY: 2, spanY: H, zMin: -5, zMax: -0.5, size: 0.62
                }),
                createDust(stage, {
                    count: byQuality(60, 120, 200), w: 8, yTop: 4, yBottom: -H - 4, zMin: -6, zMax: 3,
                    size: 0.07, color: 0xc9a24b, opacity: 0.7, additive: false
                })
            );
            stage.custom = dt => {
                const kY = dt ? Math.min(1, dt * 5) : 1;
                const kX = dt ? Math.min(1, dt * 2) : 1;
                stage.camera.position.y += (-scroll.p * H - stage.camera.position.y) * kY;
                stage.camera.position.x += (pointer.sx * 0.7 - stage.camera.position.x) * kX;
            };
            return stage;
        }

        /* ---------- Pendaftaran, aktivasi & loop ---------- */
        const coverEl = document.getElementById('cover-page');
        const heroEl = document.getElementById('hero');
        const closingEl = document.getElementById('closing');
        const openBtn = document.getElementById('btn-open-invitation');

        const isCoverOpen = () => !!coverEl && coverEl.style.display !== 'none' && !coverEl.classList.contains('slide-up');
        let heroVisible = true, closingVisible = false;

        function register(stage, isActive) {
            if (!stage) return null;
            stage.isActive = isActive;
            stages.push(stage);
            stage.render(0, 0);                         // satu frame awal, supaya tidak ada kedipan
            stage.canvas.classList.add('is-ready');
            return stage;
        }

        let coverStage = coverEl ? register(buildCover(coverEl), isCoverOpen) : null;
        let heroStage = heroEl ? register(buildHero(heroEl), () => !isCoverOpen() && heroVisible) : null;
        let closingStage = null;
        let globalStage = null;

        function ensureGlobal() {
            if (globalStage) return;
            globalStage = register(buildGlobal(), () => {
                if (isCoverOpen()) return false;
                return scroll.y > (heroEl ? heroEl.offsetHeight * 0.55 : 0);
            });
            if (globalStage) root.classList.add('webgl-on');
        }

        if ('IntersectionObserver' in window) {
            if (heroEl) new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }).observe(heroEl);
            if (closingEl) {
                new IntersectionObserver(es => {
                    closingVisible = es[0].isIntersecting;
                    if (closingVisible && !closingStage) {
                        closingStage = register(buildClosing(closingEl), () => closingVisible && !isCoverOpen());
                    }
                }, { rootMargin: '300px 0px' }).observe(closingEl);
            }
        }

        if (isCoverOpen()) {
            if (openBtn) {
                openBtn.addEventListener('click', () => {
                    setTimeout(ensureGlobal, 600);
                    setTimeout(() => { disposeStage(coverStage); coverStage = null; }, 1300);
                });
            }
        } else {
            ensureGlobal();
        }

        let resizeTimer = 0;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => stages.forEach(s => s.resize(false)), 120);
        });

        if (reduceMotion) {
            // Tanpa animasi berkelanjutan: render ulang statis saat scroll / resize
            let queued = false;
            const redraw = () => {
                queued = false;
                stages.forEach(s => { if (!s.lost && s.isActive()) s.render(0, 0); });
            };
            const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(redraw); } };
            window.addEventListener('scroll', schedule, { passive: true });
            window.addEventListener('resize', schedule);
            return;
        }

        let last = performance.now(), time = 0;
        function loop(now) {
            requestAnimationFrame(loop);
            if (document.hidden) { last = now; return; }
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            time += dt;
            const k = Math.min(1, dt * 3.5);
            pointer.sx += (pointer.x - pointer.sx) * k;
            pointer.sy += (pointer.y - pointer.sy) * k;
            for (let i = 0; i < stages.length; i++) {
                const s = stages[i];
                if (!s.lost && s.isActive()) s.render(dt, time);
            }
        }
        requestAnimationFrame(loop);
    }
})();