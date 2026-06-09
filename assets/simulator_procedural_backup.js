/* ════════════════════════════════════════════════════════════
   Felice — Order Cake 3D Simulator
   ------------------------------------------------------------
   Three.js(r128, ローカル配置) によるパラメトリックなクレイケーキ生成。
   段数 / サイズ / 色 / テーマ / デコレーション / トッパー文字 を可変。
   外部通信なし・ユーザー入力は canvas / textContent のみで描画(XSS回避)。

   セクション:
     1.  Option data
     2.  State
     3.  Utilities
     4.  Scene / renderer / lights / environment
     5.  Cake stand
     6.  Cake builder (tiers + piped borders)
     7.  Decorations (pearls / fruit / flower / ribbon)
     8.  Topper (canvas-texture sign)
     9.  Rebuild orchestration + framing + disposal
     10. Orbit controls (pointer + touch)
     11. UI bindings
     12. PNG export + spec summary
     13. Init / loop
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof THREE === 'undefined') { showFatal(); return; }

  /* ─── 1. Option data ─────────────────────────────────────── */
  const CREAMS = [
    { id: 'ivory',     name: 'アイボリー',       hex: '#f3e9d8' },
    { id: 'white',     name: 'ピュアホワイト',   hex: '#fbfaf6' },
    { id: 'champagne', name: 'シャンパン',       hex: '#e7d3a8' },
    { id: 'blush',     name: 'ブラッシュ',       hex: '#f0d4cc' },
    { id: 'sage',      name: 'セージ',           hex: '#cdd5c1' },
    { id: 'lavender',  name: 'ラベンダー',       hex: '#dcd3e4' },
    { id: 'mocha',     name: 'モカ',             hex: '#cbb295' },
  ];
  const THEMES = [
    { id: 'champagne', name: 'シャンパンゴールド', hex: '#c9a96a', accent: '#caa84e' },
    { id: 'rose',      name: 'ローズ',           hex: '#d98a8a', accent: '#d98a8a' },
    { id: 'red',       name: 'ストロベリー',     hex: '#c0473f', accent: '#c0473f' },
    { id: 'blue',      name: 'ダスティブルー',   hex: '#8aa0bd', accent: '#8aa0bd' },
    { id: 'green',     name: 'リーフ',           hex: '#7d9a6a', accent: '#7d9a6a' },
    { id: 'gold',      name: 'ゴールド',         hex: '#caa84e', accent: '#caa84e' },
  ];
  const DECOS = [
    { id: 'pearl',  name: 'パール' },
    { id: 'fruit',  name: 'フルーツ' },
    { id: 'flower', name: 'お花' },
    { id: 'ribbon', name: 'リボン' },
  ];
  const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL'];
  const CONSULT = {
    instagram: 'https://www.instagram.com/felice.fakecake?igsh=ZGdzejUwdWFsOW40&utm_source=qr',
    minne: 'https://minne.com/@felice-3674?utm_source=simulator',
    creema: 'https://www.creema.jp/c/felice_fakecake/item/onsale?utm_source=simulator',
  };

  /* ─── 2. State ───────────────────────────────────────────── */
  const state = {
    tiers: 3,
    size: 2,                 // index into SIZE_LABELS (0..4) → scale
    cream: 'ivory',
    theme: 'champagne',
    deco: { pearl: true, fruit: true, flower: true, ribbon: false },
    topperOn: true,
    message: 'Happy Wedding',
    sub: 'Felice & You',
  };
  const sizeScale = () => 0.82 + state.size * 0.11;     // 0.82 .. 1.26
  const creamDef  = () => CREAMS.find(c => c.id === state.cream) || CREAMS[0];
  const themeDef  = () => THEMES.find(t => t.id === state.theme) || THEMES[0];

  /* ─── 3. Utilities ───────────────────────────────────────── */
  function showFatal() {
    const el = document.getElementById('stageLoading');
    if (el) { el.textContent = 'お使いの環境では3D表示に対応していません'; el.classList.remove('hidden'); }
  }
  const TAU = Math.PI * 2;
  function lighten(hex, amt) {
    const c = new THREE.Color(hex);
    c.lerp(new THREE.Color('#ffffff'), amt);
    return c;
  }
  function darken(hex, amt) {
    const c = new THREE.Color(hex);
    c.lerp(new THREE.Color('#000000'), amt);
    return c;
  }

  /* ─── 4. Scene / renderer / lights / environment ─────────── */
  const canvas = document.getElementById('cakeCanvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  } catch (e) { showFatal(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = makeBackground();
  scene.environment = makeEnvironment();

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  // lights
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0xcab69a, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff4e2, 1.5);
  key.position.set(4.5, 8, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 30;
  key.shadow.camera.left = -6; key.shadow.camera.right = 6;
  key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0006; key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xeef2ff, 0.4);
  fill.position.set(-5, 3, 3.5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfff0d8, 0.5);
  rim.position.set(-2, 4, -6); scene.add(rim);

  // ground shadow catcher
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ opacity: 0.16 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.64;
  ground.receiveShadow = true;
  scene.add(ground);

  function makeBackground() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#fffdf9'); grd.addColorStop(0.55, '#fbf6ee'); grd.addColorStop(1, '#f2e6d2');
    g.fillStyle = grd; g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; return tex;
  }
  function makeEnvironment() {
    // soft studio IBL from a gradient equirect → PMREM
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 32);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.5, '#f3ead9'); grd.addColorStop(1, '#bda77f');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    tex.dispose(); pmrem.dispose();
    return env;
  }

  /* ─── 5. Cake stand ──────────────────────────────────────── */
  function buildStand(plateR) {
    const grp = new THREE.Group();
    const porcelain = new THREE.MeshStandardMaterial({ color: 0xf6f1e8, roughness: 0.28, metalness: 0.12 });
    const mk = (geo, y) => { const m = new THREE.Mesh(geo, porcelain); m.position.y = y; m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
    mk(new THREE.CylinderGeometry(plateR, plateR * 0.96, 0.07, 80), -0.035);     // plate (top at 0)
    mk(new THREE.TorusGeometry(plateR, 0.022, 12, 80).rotateX(Math.PI / 2), 0);   // plate rim
    mk(new THREE.CylinderGeometry(0.12, 0.15, 0.46, 36), -0.30);                  // stem
    mk(new THREE.CylinderGeometry(0.5, 0.55, 0.07, 48), -0.585);                  // foot
    return grp;
  }

  /* ─── 6. Cake builder ────────────────────────────────────── */
  // returns { group, tiers:[{y0,y1,r}], topY, baseR }
  function buildCake() {
    const grp = new THREE.Group();
    const s = sizeScale();
    const n = state.tiers;
    const baseR = 1.0 * s;
    const tierH = 0.58 * s;
    const shrink = 0.2;
    const cream = creamDef().hex;
    const body = new THREE.MeshStandardMaterial({ color: cream, roughness: 0.62, metalness: 0.04 });
    const pipe = new THREE.MeshStandardMaterial({ color: lighten(cream, 0.12), roughness: 0.5, metalness: 0.04 });

    const tiers = [];
    for (let i = 0; i < n; i++) {
      const r = baseR * (1 - shrink * i);
      const y0 = i * tierH, y1 = y0 + tierH;
      // tier body (very slight taper)
      const geo = new THREE.CylinderGeometry(r * 0.99, r, tierH, 96, 1, false);
      const m = new THREE.Mesh(geo, body);
      m.position.y = (y0 + y1) / 2; m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
      // piped rim — top edge of each tier
      const topRim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, 0.035 * s, 14, 90), pipe);
      topRim.rotation.x = Math.PI / 2; topRim.position.y = y1; topRim.castShadow = true;
      grp.add(topRim);
      // piped rim — base of each tier (sits on the ledge below)
      const botRim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045 * s, 14, 90), pipe);
      botRim.rotation.x = Math.PI / 2; botRim.position.y = y0 + 0.045 * s; botRim.castShadow = true;
      grp.add(botRim);
      tiers.push({ y0, y1, r });
    }
    return { group: grp, tiers, topY: n * tierH, baseR };
  }

  /* ─── 7. Decorations ─────────────────────────────────────── */
  function addPearls(grp, tiers) {
    const s = sizeScale();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf4ecdc, roughness: 0.28, metalness: 0.35 });
    const rad = 0.05 * s;
    const geo = new THREE.SphereGeometry(rad, 16, 16);
    tiers.forEach(t => {
      const ringR = t.r + rad * 0.2;
      const count = Math.max(16, Math.round(ringR * 26));
      const inst = new THREE.InstancedMesh(geo, mat, count);
      inst.castShadow = true;
      const m = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU;
        m.makeTranslation(Math.cos(a) * ringR, t.y0 + 0.09 * s, Math.sin(a) * ringR);
        inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      grp.add(inst);
    });
  }

  function makeBerry(kind) {
    const g = new THREE.Group();
    if (kind === 'straw') {
      const mat = new THREE.MeshStandardMaterial({ color: 0xc4382f, roughness: 0.4, metalness: 0.05 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 18), mat);
      body.scale.y = 1.25; body.castShadow = true; g.add(body);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x6f8f54, roughness: 0.6 });
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.05, 6), leafMat);
      leaf.position.y = 0.1; leaf.rotation.x = Math.PI; g.add(leaf);
    } else {
      const colors = { blue: 0x4a5a8a, black: 0x3a2a40, rasp: 0xb83a63 };
      const mat = new THREE.MeshStandardMaterial({ color: colors[kind] || 0x4a5a8a, roughness: 0.45, metalness: 0.05 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), mat);
      body.castShadow = true; g.add(body);
    }
    return g;
  }
  function addFruit(grp, tiers) {
    const s = sizeScale();
    const top = tiers[tiers.length - 1];
    const kinds = ['straw', 'blue', 'rasp', 'black', 'straw', 'blue'];
    // crown cluster on the very top
    const crownR = top.r * 0.5;
    for (let i = 0; i < 7; i++) {
      const b = makeBerry(kinds[i % kinds.length]);
      const a = (i / 7) * TAU + 0.3;
      const rr = i === 0 ? 0 : crownR * (0.5 + Math.random() * 0.5);
      b.position.set(Math.cos(a) * rr, top.y1 + 0.06 * s, Math.sin(a) * rr);
      b.scale.setScalar(s); grp.add(b);
    }
    // small front clusters cascading on lower ledges
    for (let ti = 0; ti < tiers.length - 1; ti++) {
      const t = tiers[ti];
      for (let i = 0; i < 3; i++) {
        const b = makeBerry(kinds[(ti + i) % kinds.length]);
        const a = -0.5 + i * 0.4;
        b.position.set(Math.cos(a) * (t.r - 0.04), t.y1 - 0.02 * s, Math.sin(a) * (t.r - 0.04));
        b.scale.setScalar(s * 0.92); grp.add(b);
      }
    }
  }

  function makeFlower(petalColor) {
    const g = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({ color: petalColor, roughness: 0.55, metalness: 0.03 });
    const centerMat = new THREE.MeshStandardMaterial({ color: lighten(petalColor.getStyle(), 0.35), roughness: 0.6 });
    const petalGeo = new THREE.SphereGeometry(0.07, 12, 12);
    const N = 6;
    for (let i = 0; i < N; i++) {
      const p = new THREE.Mesh(petalGeo, petalMat);
      const a = (i / N) * TAU;
      p.position.set(Math.cos(a) * 0.075, 0, Math.sin(a) * 0.075);
      p.scale.set(1.5, 0.5, 1.0); p.castShadow = true; g.add(p);
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), centerMat);
    center.position.y = 0.015; g.add(center);
    return g;
  }
  function addFlowers(grp, tiers) {
    const s = sizeScale();
    const col = lighten(themeDef().accent, 0.18);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x7e9a64, roughness: 0.6 });
    const place = (t, a) => {
      const f = makeFlower(col);
      f.position.set(Math.cos(a) * (t.r - 0.02), t.y1 - 0.01 * s, Math.sin(a) * (t.r - 0.02));
      f.scale.setScalar(s); f.rotation.y = -a;
      // a couple of leaves
      for (let k = -1; k <= 1; k += 2) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), leafMat);
        leaf.scale.set(2.0, 0.4, 0.9);
        leaf.position.set(Math.cos(a + k * 0.22) * (t.r - 0.02), t.y1 - 0.03 * s, Math.sin(a + k * 0.22) * (t.r - 0.02));
        leaf.rotation.y = -a; leaf.castShadow = true; grp.add(leaf);
      }
      grp.add(f);
    };
    if (tiers.length >= 1) place(tiers[Math.max(0, tiers.length - 2)], 0.5);
    if (tiers.length >= 2) place(tiers[tiers.length - 1], -0.7);
    if (tiers.length >= 3) place(tiers[0], -0.2);
  }

  function addRibbon(grp, tiers) {
    const s = sizeScale();
    const t = tiers[0];                          // around base tier
    const col = new THREE.Color(themeDef().hex);
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.12, side: THREE.DoubleSide });
    const y = (t.y0 + t.y1) / 2;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 1.005, t.r * 1.005, 0.16 * s, 96, 1, true), mat);
    band.position.y = y; band.castShadow = true; grp.add(band);
    // bow at front (z+)
    const bow = new THREE.Group();
    const loopGeo = new THREE.TorusGeometry(0.11 * s, 0.032 * s, 10, 36);
    for (let k = -1; k <= 1; k += 2) {
      const loop = new THREE.Mesh(loopGeo, mat);
      loop.position.set(k * 0.1 * s, 0, 0); loop.scale.x = 1.2; loop.castShadow = true; bow.add(loop);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 14, 14), mat);
    knot.scale.set(0.7, 1, 0.7); bow.add(knot);
    bow.position.set(0, y, t.r * 1.02); grp.add(bow);
  }

  /* ─── 8. Topper (canvas-texture sign) ────────────────────── */
  let topperTexture = null;
  function addTopper(grp, topY, baseR) {
    const s = sizeScale();
    const themeCol = themeDef().accent;
    // sticks
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xd8c79c, roughness: 0.4, metalness: 0.3 });
    const signY = topY + 0.55 * s;
    for (let k = -1; k <= 1; k += 2) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5 * s, 8), stickMat);
      stick.position.set(k * 0.22 * s, topY + 0.27 * s, 0); grp.add(stick);
    }
    // sign plane with canvas text
    const cw = 1024, ch = 460;
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    g.clearRect(0, 0, cw, ch);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = themeCol;
    g.shadowColor = 'rgba(80,50,20,0.18)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
    const msg = (state.message || '').slice(0, 28);
    const sub = (state.sub || '').slice(0, 32);
    g.font = "600 150px 'Cormorant Garamond','Noto Serif JP',serif";
    g.fillText(msg, cw / 2, sub ? ch / 2 - 48 : ch / 2);
    if (sub) {
      g.shadowBlur = 4;
      g.font = "italic 300 72px 'Cormorant Garamond','Noto Serif JP',serif";
      g.fillStyle = darken(themeCol, 0.05).getStyle();
      g.fillText(sub, cw / 2, ch / 2 + 88);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    topperTexture = tex;
    const planeW = 1.2 * s, planeH = planeW * (ch / cw);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(planeW, planeH),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );
    sign.position.set(0, signY, 0);
    grp.add(sign);
  }

  /* ─── 9. Rebuild orchestration + framing + disposal ──────── */
  const cakeRoot = new THREE.Group();
  scene.add(cakeRoot);
  let pendingRebuild = false;
  function scheduleRebuild() { pendingRebuild = true; }

  function disposeGroup(group) {
    const seen = new Set();
    group.traverse(o => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(mat => {
          if (seen.has(mat)) return; seen.add(mat);
          if (mat.map) mat.map.dispose();
          mat.dispose();
        });
      }
    });
    while (group.children.length) group.remove(group.children[0]);
    topperTexture = null;
  }

  function rebuild() {
    disposeGroup(cakeRoot);
    const cake = buildCake();
    cakeRoot.add(buildStand(cake.baseR * 1.16 + 0.16));
    cakeRoot.add(cake.group);
    if (state.deco.pearl)  addPearls(cake.group, cake.tiers);
    if (state.deco.fruit)  addFruit(cake.group, cake.tiers);
    if (state.deco.flower) addFlowers(cake.group, cake.tiers);
    if (state.deco.ribbon) addRibbon(cake.group, cake.tiers);
    if (state.topperOn)    addTopper(cake.group, cake.topY, cake.baseR);
    frameTarget(cake);
    updateSpec();
  }

  function frameTarget(cake) {
    // keep current orbit angles; recentre vertical target + fit radius bounds
    const ty = cake.topY * 0.46;
    orbit.target.set(0, ty, 0);
    const reach = Math.max(cake.baseR * 1.5, cake.topY * 0.85) + 1.1;
    orbit.minR = reach * 0.7;
    orbit.maxR = reach * 2.4;
    if (!orbit.inited) { orbit.radius = reach * 1.5; orbit.inited = true; }
    orbit.radius = Math.min(Math.max(orbit.radius, orbit.minR), orbit.maxR);
  }

  /* ─── 10. Orbit controls (pointer + touch) ───────────────── */
  const orbit = {
    target: new THREE.Vector3(0, 1, 0),
    theta: Math.PI * 0.16, phi: Math.PI * 0.46,
    radius: 6, minR: 3, maxR: 14,
    autoRotate: true, idle: 0, inited: false,
    update(dt) {
      if (this.autoRotate && this.idle > 2.4) this.theta += dt * 0.16;
      this.phi = Math.min(Math.max(this.phi, Math.PI * 0.2), Math.PI * 0.6);
      const r = this.radius, sp = Math.sin(this.phi), cp = Math.cos(this.phi);
      camera.position.set(
        this.target.x + r * sp * Math.sin(this.theta),
        this.target.y + r * cp,
        this.target.z + r * sp * Math.cos(this.theta)
      );
      camera.lookAt(this.target);
    },
  };
  (function bindOrbit() {
    let dragging = false, lx = 0, ly = 0, pinch = 0;
    const down = (x, y) => { dragging = true; lx = x; ly = y; orbit.idle = 0; };
    const move = (x, y) => {
      if (!dragging) return;
      orbit.theta -= (x - lx) * 0.006;
      orbit.phi   -= (y - ly) * 0.006;
      lx = x; ly = y; orbit.idle = 0;
    };
    const up = () => { dragging = false; };
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); down(e.clientX, e.clientY); });
    canvas.addEventListener('pointermove', e => move(e.clientX, e.clientY));
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      orbit.radius = Math.min(Math.max(orbit.radius * Math.exp(e.deltaY * 0.0012), orbit.minR), orbit.maxR);
      orbit.idle = 0;
    }, { passive: false });
    // touch pinch
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (pinch) { orbit.radius = Math.min(Math.max(orbit.radius * (pinch / d), orbit.minR), orbit.maxR); orbit.idle = 0; }
        pinch = d;
      }
    }, { passive: true });
    canvas.addEventListener('touchend', () => { pinch = 0; });
  })();

  /* ─── 11. UI bindings ────────────────────────────────────── */
  function buildUI() {
    // tiers
    const segTiers = document.getElementById('segTiers');
    [1, 2, 3, 4].forEach(n => {
      const b = document.createElement('button');
      b.textContent = n; b.setAttribute('aria-pressed', String(n === state.tiers));
      b.addEventListener('click', () => {
        state.tiers = n;
        segTiers.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(Number(x.textContent) === n)));
        scheduleRebuild();
      });
      segTiers.appendChild(b);
    });
    // size slider
    const sizeR = document.getElementById('sizeRange');
    const sizeV = document.getElementById('sizeVal');
    sizeR.value = String(state.size);
    const syncSize = () => {
      sizeV.textContent = SIZE_LABELS[state.size];
      sizeR.style.setProperty('--fill', (state.size / 4 * 100) + '%');
    };
    sizeR.addEventListener('input', () => { state.size = Number(sizeR.value); syncSize(); scheduleRebuild(); });
    syncSize();
    // cream swatches
    fillSwatches('swCream', CREAMS, 'cream');
    // theme swatches
    fillSwatches('swTheme', THEMES, 'theme');
    // deco chips
    const chips = document.getElementById('decoChips');
    DECOS.forEach(d => {
      const b = document.createElement('button');
      b.className = 'chip'; b.setAttribute('aria-pressed', String(!!state.deco[d.id]));
      b.innerHTML = '<span class="dot"></span>';
      b.appendChild(document.createTextNode(d.name));
      b.addEventListener('click', () => {
        state.deco[d.id] = !state.deco[d.id];
        b.setAttribute('aria-pressed', String(state.deco[d.id]));
        scheduleRebuild();
      });
      chips.appendChild(b);
    });
    // topper toggle + text
    const sw = document.getElementById('topperSwitch');
    const fields = document.getElementById('topperFields');
    const syncTopper = () => { sw.setAttribute('aria-pressed', String(state.topperOn)); fields.classList.toggle('disabled', !state.topperOn); };
    sw.addEventListener('click', () => { state.topperOn = !state.topperOn; syncTopper(); scheduleRebuild(); });
    syncTopper();
    const msg = document.getElementById('topperMsg');
    const sub = document.getElementById('topperSub');
    msg.value = state.message; sub.value = state.sub;
    let tmr = null;
    const onText = () => {
      state.message = msg.value; state.sub = sub.value;
      clearTimeout(tmr); tmr = setTimeout(scheduleRebuild, 220);
    };
    msg.addEventListener('input', onText);
    sub.addEventListener('input', onText);
    // actions
    document.getElementById('btnSave').addEventListener('click', exportPNG);
    document.getElementById('btnReset').addEventListener('click', resetAll);
    document.getElementById('specCopy').addEventListener('click', copySpec);
    // consult links
    document.getElementById('lnkInstagram').href = CONSULT.instagram;
    document.getElementById('lnkMinne').href = CONSULT.minne;
    document.getElementById('lnkCreema').href = CONSULT.creema;
  }

  function fillSwatches(id, list, key) {
    const wrap = document.getElementById(id);
    list.forEach(o => {
      const b = document.createElement('button');
      b.className = 'swatch'; b.style.background = o.hex; b.title = o.name;
      b.setAttribute('aria-label', o.name);
      b.setAttribute('aria-pressed', String(o.id === state[key]));
      b.addEventListener('click', () => {
        state[key] = o.id;
        wrap.querySelectorAll('.swatch').forEach((x, i) => x.setAttribute('aria-pressed', String(list[i].id === o.id)));
        scheduleRebuild();
      });
      wrap.appendChild(b);
    });
  }

  function resetAll() {
    Object.assign(state, {
      tiers: 3, size: 2, cream: 'ivory', theme: 'champagne',
      deco: { pearl: true, fruit: true, flower: true, ribbon: false },
      topperOn: true, message: 'Happy Wedding', sub: 'Felice & You',
    });
    // refresh UI
    document.getElementById('panel').innerHTML = PANEL_HTML;
    buildUI();
    orbit.inited = false;
    scheduleRebuild();
    toast('初期状態に戻しました');
  }

  /* ─── 12. PNG export + spec summary ──────────────────────── */
  function exportPNG() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const prevRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(w * 2, h * 2, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    let url;
    try { url = renderer.domElement.toDataURL('image/png'); }
    catch (e) { toast('画像の生成に失敗しました'); }
    // restore
    renderer.setPixelRatio(prevRatio);
    resize();
    if (!url) return;
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = `Felice_cake_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.png`;
    a.click();
    toast('プレビュー画像を保存しました');
  }

  function specText() {
    const decoOn = DECOS.filter(d => state.deco[d.id]).map(d => d.name);
    const lines = [
      '◤ Felice オーダーケーキ ご希望内容 ◢',
      `段数 : ${state.tiers}段`,
      `サイズ : ${SIZE_LABELS[state.size]}`,
      `クリームの色 : ${creamDef().name}`,
      `テーマカラー : ${themeDef().name}`,
      `デコレーション : ${decoOn.length ? decoOn.join('・') : 'なし'}`,
    ];
    if (state.topperOn && (state.message || state.sub)) {
      lines.push(`トッパー文字 : ${[state.message, state.sub].filter(Boolean).join(' / ')}`);
    } else {
      lines.push('トッパー : なし');
    }
    lines.push('※ プレビュー画像を添えてご相談ください');
    return lines.join('\n');
  }
  function updateSpec() {
    const box = document.getElementById('specBox');
    if (box) box.textContent = specText();      // textContent → XSSなし
  }
  function copySpec() {
    const text = specText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('ご希望内容をコピーしました'), () => toast('コピーできませんでした'));
    } else {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); toast('ご希望内容をコピーしました'); } catch (e) { toast('コピーできませんでした'); }
      document.body.removeChild(ta);
    }
  }

  let toastTmr = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTmr); toastTmr = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // snapshot of panel markup for reset()
  const PANEL_HTML = document.getElementById('panel').innerHTML;

  /* ─── 13. Init / loop ────────────────────────────────────── */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    orbit.idle += dt;
    if (pendingRebuild) { pendingRebuild = false; rebuild(); }
    orbit.update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function start() {
    buildUI();
    resize();
    rebuild();
    const ld = document.getElementById('stageLoading');
    if (ld) ld.classList.add('hidden');
    requestAnimationFrame(loop);
  }

  // wait for fonts so the topper text renders in the right typeface
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]).then(start);
  } else { start(); }
})();
