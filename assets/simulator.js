/* ════════════════════════════════════════════════════════════
   Felice — Order Cake 3D Simulator  (GLB parts assembler)
   ------------------------------------------------------------
   GLBモデル部品(assets/models/<カテゴリ>/*.glb)を読み込み、原点=接地点・
   サイズを正規化して、段の積み重ね・装飾配置・トッパーを組み合わせる。
   部品の追加/差し替えは GLB を置いて gen_manifest.py を実行するだけ。
   ※ GLB読み込みに fetch を使うため http 配信(サーバー起動.py)で開くこと。

   セクション:
     1. 設定/状態
     2. ユーティリティ
     3. シーン/レンダラ/ライト/環境
     4. ケーキスタンド
     5. モデル読込・正規化・プリロード
     6. 配置(段/装飾/トッパー)
     7. 再構築
     8. オービット操作
     9. UI(マニフェスト駆動)
     10. PNG保存/仕様/リセット
     11. 初期化/ループ
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const MANIFEST_URL = 'assets/models/manifest.json';
  const DECO_CATS = ['berry', 'flower', 'macaron', 'ribbon', 'pearl'];
  const CAT_LABEL = { berry: '苺・ベリー', flower: 'お花', macaron: 'マカロン', ribbon: 'リボン', pearl: 'パール', tier: '生地' };
  const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL'];
  const CONSULT = {
    instagram: 'https://www.instagram.com/felice.fakecake?igsh=ZGdzejUwdWFsOW40&utm_source=qr',
    minne: 'https://minne.com/@felice-3674?utm_source=simulator',
    creema: 'https://www.creema.jp/c/felice_fakecake/item/onsale?utm_source=simulator',
  };

  function showFatal(msg) {
    const el = document.getElementById('stageLoading');
    if (el) { el.textContent = msg || 'お使いの環境では3D表示に対応していません'; el.classList.remove('hidden'); }
  }
  if (typeof THREE === 'undefined' || !THREE.GLTFLoader) { showFatal(); return; }

  /* ─── 1. 状態 ─────────────────────────────────────────────── */
  let manifest = null;
  const MODELS = {}; // file -> { node, dim }
  const state = {
    tiers: 3, size: 2, tier: null, density: 2,
    deco: { berry: true, flower: true, macaron: false, ribbon: false, pearl: true },
    variant: {}, topperOn: true, topper: null,
  };
  const sizeScale = () => 0.82 + state.size * 0.11;
  const densityF = () => [0.45, 0.72, 1.0, 1.35, 1.75][state.density];

  /* ─── 2. ユーティリティ ──────────────────────────────────── */
  const TAU = Math.PI * 2;
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ─── 3. シーン/レンダラ/ライト/環境 ─────────────────────── */
  const canvas = document.getElementById('cakeCanvas');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); }
  catch (e) { showFatal(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = makeBackground();
  scene.environment = makeEnvironment();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  const hemi = new THREE.HemisphereLight(0xfff6e8, 0xcab69a, 0.5); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff4e2, 1.45);
  key.position.set(4.5, 8, 5.5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 1; key.shadow.camera.far = 30;
  key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  key.shadow.bias = -0.0006; key.shadow.radius = 4; scene.add(key);
  const fill = new THREE.DirectionalLight(0xeef2ff, 0.38); fill.position.set(-5, 3, 3.5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfff0d8, 0.5); rim.position.set(-2, 4, -6); scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.64; ground.receiveShadow = true; scene.add(ground);

  function makeBackground() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 256; const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#fffdf9'); grd.addColorStop(.55, '#fbf6ee'); grd.addColorStop(1, '#f2e6d2');
    g.fillStyle = grd; g.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function makeEnvironment() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 32);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(.5, '#f3ead9'); grd.addColorStop(1, '#bda77f');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 32);
    const tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromEquirectangular(tex).texture;
    tex.dispose(); pm.dispose(); return env;
  }

  /* ─── 4. ケーキスタンド ──────────────────────────────────── */
  const standRoot = new THREE.Group(); scene.add(standRoot);
  function buildStand(plateR) {
    disposeOwn(standRoot);
    const porcelain = new THREE.MeshStandardMaterial({ color: 0xf6f1e8, roughness: 0.28, metalness: 0.12 });
    const mk = (geo, y) => { const m = new THREE.Mesh(geo, porcelain); m.position.y = y; m.castShadow = true; m.receiveShadow = true; standRoot.add(m); };
    mk(new THREE.CylinderGeometry(plateR, plateR * 0.96, 0.07, 80), -0.035);
    mk(new THREE.TorusGeometry(plateR, 0.022, 12, 80).rotateX(Math.PI / 2), 0);
    mk(new THREE.CylinderGeometry(0.12, 0.15, 0.46, 36), -0.30);
    mk(new THREE.CylinderGeometry(0.5, 0.55, 0.07, 48), -0.585);
  }
  function disposeOwn(group) {
    group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    while (group.children.length) group.remove(group.children[0]);
  }

  /* ─── 5. モデル読込・正規化・プリロード ──────────────────── */
  const loader = new THREE.GLTFLoader();
  function normalize(root) {
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(root);
    const dim = box.getSize(new THREE.Vector3());
    const ctr = box.getCenter(new THREE.Vector3());
    root.position.x -= ctr.x; root.position.z -= ctr.z; root.position.y -= box.min.y;
    const wrap = new THREE.Group(); wrap.add(root);
    return { node: wrap, dim: { x: dim.x, y: dim.y, z: dim.z } };
  }
  function loadModel(file) {
    return new Promise((res, rej) => loader.load(file, g => res(normalize(g.scene)), undefined, rej));
  }
  async function preload() {
    const files = [];
    Object.values(manifest).forEach(arr => arr.forEach(p => files.push(p.file)));
    await Promise.all([...new Set(files)].map(async f => { MODELS[f] = await loadModel(f); }));
  }

  /* ─── 6. 配置 ────────────────────────────────────────────── */
  const partsRoot = new THREE.Group(); scene.add(partsRoot);

  function defById(cat, id) { return (manifest[cat] || []).find(d => d.id === id); }
  function variantDefs(cat) {
    const list = manifest[cat] || []; if (!list.length) return [];
    const v = state.variant[cat];
    if (v === 'mix' || !v) return list;
    const d = defById(cat, v); return d ? [d] : list;
  }
  function placeClone(def, x, y, z, rotY, tilt, extra) {
    const m = MODELS[def.file]; if (!m) return;
    const node = m.node.clone(true);
    const target = (def.size || 0.4) * sizeScale() * (extra || 1);
    const sc = target / Math.max(m.dim.x, m.dim.y, m.dim.z);
    node.scale.setScalar(sc);
    node.position.set(x, y, z);
    node.rotation.y = rotY || 0;
    if (tilt) node.rotation.z = tilt;
    partsRoot.add(node);
  }

  function buildTiers() {
    const tdef = defById('tier', state.tier) || (manifest.tier && manifest.tier[0]);
    const m = tdef && MODELS[tdef.file];
    const s = sizeScale(), baseR = 1.0 * s, n = state.tiers, shrink = 0.18;
    const tiers = []; let y = 0;
    if (!m) return { tiers, topY: 0.6, baseR };
    const rUnit = Math.max(m.dim.x, m.dim.z) / 2 || 1;
    for (let i = 0; i < n; i++) {
      const r = baseR * (1 - shrink * i);
      const scale = r / rUnit;
      const h = m.dim.y * scale;
      const node = m.node.clone(true);
      node.scale.setScalar(scale); node.position.set(0, y, 0);
      partsRoot.add(node);
      tiers.push({ y0: y, y1: y + h, r }); y += h;
    }
    return { tiers, topY: y, baseR };
  }

  function addBerries(tiers) {
    const defs = variantDefs('berry'); if (!defs.length) return;
    const top = tiers[tiers.length - 1];
    const rnd = mulberry32(101);
    const pick = () => defs[(rnd() * defs.length) | 0];
    // crown on top
    const crown = Math.round(6 * densityF());
    for (let i = 0; i < crown; i++) {
      const a = rnd() * TAU, rr = (i === 0 ? 0 : top.r * 0.55 * Math.sqrt(rnd()));
      placeClone(pick(), Math.cos(a) * rr, top.y1 + 0.02, Math.sin(a) * rr, rnd() * TAU, (rnd() - 0.5) * 0.5);
    }
    // ring on each tier top rim
    tiers.forEach(t => {
      const ring = Math.round(t.r * 7 * densityF());
      for (let k = 0; k < ring; k++) {
        const a = (k / ring) * TAU + rnd() * 0.3;
        placeClone(pick(), Math.cos(a) * t.r * 0.97, t.y1 - 0.01, Math.sin(a) * t.r * 0.97, rnd() * TAU, 0.2 + rnd() * 0.3);
      }
    });
  }
  function addCategoryRing(tiers, cat, tierIndexFromTop, baseCount) {
    const defs = variantDefs(cat); if (!defs.length) return;
    const idx = Math.max(0, tiers.length - 1 - tierIndexFromTop);
    const t = tiers[idx]; const rnd = mulberry32(cat.length * 37 + 7);
    const ring = Math.round(t.r * baseCount * densityF());
    for (let k = 0; k < ring; k++) {
      const a = (k / Math.max(1, ring)) * TAU + 0.2;
      const def = defs[(rnd() * defs.length) | 0];
      placeClone(def, Math.cos(a) * t.r * 0.9, t.y1 - 0.01, Math.sin(a) * t.r * 0.9, -a, 0);
    }
  }
  function addFlowers(tiers) {
    const defs = variantDefs('flower'); if (!defs.length) return;
    const rnd = mulberry32(303); const total = Math.max(1, Math.round(3 * densityF()));
    for (let i = 0; i < total; i++) {
      const t = tiers[Math.min(tiers.length - 1, i % tiers.length)];
      const a = -0.6 + i * 1.3 + rnd() * 0.3;
      placeClone(defs[(rnd() * defs.length) | 0], Math.cos(a) * t.r * 0.85, t.y1 - 0.01, Math.sin(a) * t.r * 0.85, -a, 0, 1);
    }
  }
  function addPearls(tiers) {
    const defs = variantDefs('pearl'); if (!defs.length) return; const def = defs[0];
    tiers.forEach(t => {
      const ring = Math.round(t.r * 20);
      for (let k = 0; k < ring; k++) {
        const a = (k / ring) * TAU;
        placeClone(def, Math.cos(a) * t.r, t.y0 + 0.02, Math.sin(a) * t.r, 0, 0);
      }
    });
  }
  function addRibbon(tiers) {
    const defs = variantDefs('ribbon'); if (!defs.length) return;
    const t = tiers[0];
    placeClone(defs[0], 0, (t.y0 + t.y1) / 2, t.r * 1.02, 0, 0, 1.2);
  }
  function addTopper(topY) {
    if (!state.topperOn || !manifest.topper || !manifest.topper.length) return;
    const def = defById('topper', state.topper) || manifest.topper[0];
    placeClone(def, 0, topY + 0.02, 0, 0, 0, 1);
  }

  /* ─── 7. 再構築 ──────────────────────────────────────────── */
  let pending = false;
  const scheduleRebuild = () => { pending = true; };
  function rebuild() {
    while (partsRoot.children.length) partsRoot.remove(partsRoot.children[0]); // clones share cache → 破棄しない
    const cake = buildTiers();
    buildStand(cake.baseR * 1.16 + 0.16);
    if (cake.tiers.length) {
      if (state.deco.pearl) addPearls(cake.tiers);
      if (state.deco.macaron) addCategoryRing(cake.tiers, 'macaron', 1, 5);
      if (state.deco.flower) addFlowers(cake.tiers);
      if (state.deco.berry) addBerries(cake.tiers);
      if (state.deco.ribbon) addRibbon(cake.tiers);
      addTopper(cake.topY);
    }
    frameTarget(cake); updateSpec();
  }
  function frameTarget(cake) {
    const ty = cake.topY * 0.46; orbit.target.set(0, ty, 0);
    const reach = Math.max(cake.baseR * 1.5, cake.topY * 0.85) + 1.1;
    orbit.minR = reach * 0.7; orbit.maxR = reach * 2.4;
    if (!orbit.inited) { orbit.radius = reach * 1.55; orbit.inited = true; }
    orbit.radius = Math.min(Math.max(orbit.radius, orbit.minR), orbit.maxR);
  }

  /* ─── 8. オービット操作 ──────────────────────────────────── */
  const orbit = {
    target: new THREE.Vector3(0, 1, 0), theta: Math.PI * 0.16, phi: Math.PI * 0.46,
    radius: 6, minR: 3, maxR: 14, autoRotate: true, idle: 0, inited: false,
    update(dt) {
      if (this.autoRotate && this.idle > 2.4) this.theta += dt * 0.16;
      this.phi = Math.min(Math.max(this.phi, Math.PI * 0.2), Math.PI * 0.6);
      const r = this.radius, sp = Math.sin(this.phi), cp = Math.cos(this.phi);
      camera.position.set(this.target.x + r * sp * Math.sin(this.theta), this.target.y + r * cp, this.target.z + r * sp * Math.cos(this.theta));
      camera.lookAt(this.target);
    },
  };
  (function bindOrbit() {
    let drag = false, lx = 0, ly = 0, pinch = 0;
    const dn = (x, y) => { drag = true; lx = x; ly = y; orbit.idle = 0; };
    const mv = (x, y) => { if (!drag) return; orbit.theta -= (x - lx) * 0.006; orbit.phi -= (y - ly) * 0.006; lx = x; ly = y; orbit.idle = 0; };
    const up = () => { drag = false; };
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); dn(e.clientX, e.clientY); });
    canvas.addEventListener('pointermove', e => mv(e.clientX, e.clientY));
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); orbit.radius = Math.min(Math.max(orbit.radius * Math.exp(e.deltaY * 0.0012), orbit.minR), orbit.maxR); orbit.idle = 0; }, { passive: false });
    canvas.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
    canvas.addEventListener('touchmove', e => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) { orbit.radius = Math.min(Math.max(orbit.radius * (pinch / d), orbit.minR), orbit.maxR); orbit.idle = 0; } pinch = d; } }, { passive: true });
    canvas.addEventListener('touchend', () => { pinch = 0; });
  })();

  /* ─── 9. UI(マニフェスト駆動) ───────────────────────────── */
  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fieldLabel(jp, en) { const d = el('div', 'field-label'); d.appendChild(document.createTextNode(jp)); const s = el('span', 'en', en); d.appendChild(s); return d; }

  function buildUI() {
    const panel = document.getElementById('panel'); panel.textContent = '';

    // 段数
    let f = el('div'); f.appendChild(fieldLabel('段数', 'Tiers'));
    const seg = el('div', 'seg');
    [1, 2, 3, 4].forEach(n => {
      const b = el('button', null, String(n)); b.setAttribute('aria-pressed', String(n === state.tiers));
      b.addEventListener('click', () => { state.tiers = n; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(+x.textContent === n))); scheduleRebuild(); });
      seg.appendChild(b);
    });
    f.appendChild(seg); panel.appendChild(f);

    // サイズ
    f = el('div'); f.appendChild(fieldLabel('サイズ', 'Size'));
    const sr = el('div', 'slider-row'); const range = el('input'); range.type = 'range'; range.min = 0; range.max = 4; range.step = 1; range.value = state.size;
    const val = el('span', 'slider-val', SIZE_LABELS[state.size]);
    const syncS = () => { val.textContent = SIZE_LABELS[state.size]; range.style.setProperty('--fill', (state.size / 4 * 100) + '%'); };
    range.addEventListener('input', () => { state.size = +range.value; syncS(); scheduleRebuild(); });
    sr.appendChild(range); sr.appendChild(val); f.appendChild(sr); syncS(); panel.appendChild(f);

    // 生地(tier) — 種類が2つ以上のときだけ
    if (manifest.tier && manifest.tier.length > 1) {
      f = el('div'); f.appendChild(fieldLabel('生地', 'Base'));
      const chips = el('div', 'chips');
      manifest.tier.forEach(d => {
        const b = el('button', 'chip', d.name); b.setAttribute('aria-pressed', String(d.id === state.tier));
        b.addEventListener('click', () => { state.tier = d.id; chips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); scheduleRebuild(); });
        chips.appendChild(b);
      });
      f.appendChild(chips); panel.appendChild(f);
    }

    // 装飾量
    f = el('div'); f.appendChild(fieldLabel('装飾量', 'Amount'));
    const dr = el('div', 'slider-row'); const drange = el('input'); drange.type = 'range'; drange.min = 0; drange.max = 4; drange.step = 1; drange.value = state.density;
    const dval = el('span', 'slider-val', ['少', 'やや少', '標準', 'やや多', '多'][state.density]);
    const syncD = () => { dval.textContent = ['少', 'やや少', '標準', 'やや多', '多'][state.density]; drange.style.setProperty('--fill', (state.density / 4 * 100) + '%'); };
    drange.addEventListener('input', () => { state.density = +drange.value; syncD(); scheduleRebuild(); });
    dr.appendChild(drange); dr.appendChild(dval); f.appendChild(dr); syncD(); panel.appendChild(f);

    panel.appendChild(el('div', 'divider'));

    // 装飾カテゴリ(マニフェストにあるものだけ)
    DECO_CATS.forEach(cat => {
      const list = manifest[cat]; if (!list || !list.length) return;
      const row = el('div', 'part-row');
      const head = el('div', 'switch-row');
      const lbl = fieldLabel(CAT_LABEL[cat], ''); lbl.style.margin = '0';
      const sw = el('button', 'switch'); sw.setAttribute('aria-pressed', String(!!state.deco[cat]));
      sw.setAttribute('aria-label', CAT_LABEL[cat] + 'の表示切替');
      head.appendChild(lbl); head.appendChild(sw); row.appendChild(head);
      // バリアント選択 (2つ以上のとき)
      if (list.length > 1 || cat === 'berry') {
        const sel = el('select', 'select'); sel.style.marginTop = '10px';
        if (list.length > 1) { const o = el('option', null, 'ミックス'); o.value = 'mix'; sel.appendChild(o); }
        list.forEach(d => { const o = el('option', null, d.name); o.value = d.id; sel.appendChild(o); });
        sel.value = state.variant[cat] || (list.length > 1 ? 'mix' : list[0].id);
        sel.addEventListener('change', () => { state.variant[cat] = sel.value; if (state.deco[cat]) scheduleRebuild(); });
        const wrap = el('div', 'variant-wrap'); wrap.appendChild(sel); row.appendChild(wrap);
        if (!state.deco[cat]) wrap.classList.add('disabled');
        row._wrap = wrap;
      }
      sw.addEventListener('click', () => { state.deco[cat] = !state.deco[cat]; sw.setAttribute('aria-pressed', String(state.deco[cat])); if (row._wrap) row._wrap.classList.toggle('disabled', !state.deco[cat]); scheduleRebuild(); });
      panel.appendChild(row);
    });

    // トッパー
    if (manifest.topper && manifest.topper.length) {
      panel.appendChild(el('div', 'divider'));
      const row = el('div', 'part-row'); const head = el('div', 'switch-row');
      const lbl = fieldLabel('トッパー', 'Topper'); lbl.style.margin = '0';
      const sw = el('button', 'switch'); sw.setAttribute('aria-pressed', String(state.topperOn));
      head.appendChild(lbl); head.appendChild(sw); row.appendChild(head);
      if (manifest.topper.length > 1) {
        const sel = el('select', 'select'); sel.style.marginTop = '10px';
        manifest.topper.forEach(d => { const o = el('option', null, d.name); o.value = d.id; sel.appendChild(o); });
        sel.value = state.topper || manifest.topper[0].id;
        sel.addEventListener('change', () => { state.topper = sel.value; if (state.topperOn) scheduleRebuild(); });
        const wrap = el('div', 'variant-wrap'); wrap.appendChild(sel); row.appendChild(wrap);
        if (!state.topperOn) wrap.classList.add('disabled'); row._wrap = wrap;
      }
      sw.addEventListener('click', () => { state.topperOn = !state.topperOn; sw.setAttribute('aria-pressed', String(state.topperOn)); if (row._wrap) row._wrap.classList.toggle('disabled', !state.topperOn); scheduleRebuild(); });
      panel.appendChild(row);
    }

    // アクション
    const actions = el('div', 'actions');
    const save = el('button', 'btn btn-primary', 'プレビュー画像を保存'); save.type = 'button'; save.addEventListener('click', exportPNG);
    const reset = el('button', 'btn btn-ghost', '最初からやり直す'); reset.type = 'button'; reset.addEventListener('click', resetAll);
    actions.appendChild(save); actions.appendChild(reset); panel.appendChild(actions);

    // 相談 + 仕様
    const consult = el('div', 'consult');
    consult.appendChild(el('div', 'consult-title', 'この内容で相談する'));
    const links = el('div', 'consult-links');
    [['Instagram', CONSULT.instagram], ['minne', CONSULT.minne], ['Creema', CONSULT.creema]].forEach(([t, h]) => {
      const a = el('a', null, t); a.href = h; a.target = '_blank'; a.rel = 'noopener'; links.appendChild(a);
    });
    consult.appendChild(links);
    const spec = el('div', 'spec'); const box = el('div', 'spec-box'); box.id = 'specBox'; spec.appendChild(box);
    const copy = el('button', 'spec-copy', '＋ ご希望内容をコピー'); copy.type = 'button'; copy.addEventListener('click', copySpec);
    spec.appendChild(copy); consult.appendChild(spec); panel.appendChild(consult);
  }

  function resetAll() {
    Object.assign(state, { tiers: 3, size: 2, tier: manifest.tier ? manifest.tier[0].id : null, density: 2,
      deco: { berry: true, flower: true, macaron: false, ribbon: false, pearl: true }, topperOn: true });
    initVariants(); orbit.inited = false; buildUI(); scheduleRebuild(); toast('初期状態に戻しました');
  }
  function initVariants() {
    state.variant = {};
    DECO_CATS.forEach(c => { const l = manifest[c]; if (l && l.length) state.variant[c] = l.length > 1 ? 'mix' : l[0].id; });
    if (manifest.tier && manifest.tier.length) state.tier = manifest.tier[0].id;
    if (manifest.topper && manifest.topper.length) state.topper = manifest.topper[0].id;
  }

  /* ─── 10. PNG保存/仕様 ──────────────────────────────────── */
  function exportPNG() {
    const w = canvas.clientWidth, h = canvas.clientHeight, pr = renderer.getPixelRatio();
    renderer.setPixelRatio(1); renderer.setSize(w * 2, h * 2, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    let url; try { url = renderer.domElement.toDataURL('image/png'); } catch (e) { toast('画像の生成に失敗しました'); }
    renderer.setPixelRatio(pr); resize();
    if (!url) return;
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const a = el('a'); a.href = url; a.download = `Felice_cake_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.png`;
    a.click(); toast('プレビュー画像を保存しました');
  }
  function specText() {
    const lines = ['◤ Felice オーダーケーキ ご希望内容 ◢', `段数 : ${state.tiers}段`, `サイズ : ${SIZE_LABELS[state.size]}`];
    if (manifest.tier && manifest.tier.length > 1) { const t = defById('tier', state.tier); if (t) lines.push(`生地 : ${t.name}`); }
    lines.push(`装飾量 : ${['少', 'やや少', '標準', 'やや多', '多'][state.density]}`);
    const deco = [];
    DECO_CATS.forEach(c => { if (state.deco[c] && manifest[c] && manifest[c].length) { const v = state.variant[c]; const nm = (!v || v === 'mix') ? 'ミックス' : (defById(c, v) || {}).name; deco.push(`${CAT_LABEL[c]}(${nm})`); } });
    lines.push(`装飾 : ${deco.length ? deco.join('・') : 'なし'}`);
    if (state.topperOn && manifest.topper && manifest.topper.length) { const t = defById('topper', state.topper) || manifest.topper[0]; lines.push(`トッパー : ${t.name}`); }
    lines.push('※ プレビュー画像を添えてご相談ください'); return lines.join('\n');
  }
  function updateSpec() { const b = document.getElementById('specBox'); if (b) b.textContent = specText(); }
  function copySpec() {
    const text = specText();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('ご希望内容をコピーしました'), () => toast('コピーできませんでした'));
    else { const ta = el('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('ご希望内容をコピーしました'); } catch (e) { toast('コピーできませんでした'); } document.body.removeChild(ta); }
  }
  let toastTmr = null;
  function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastTmr); toastTmr = setTimeout(() => t.classList.remove('show'), 2200); }

  /* ─── 11. 初期化/ループ ─────────────────────────────────── */
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now; orbit.idle += dt;
    if (pending) { pending = false; rebuild(); }
    orbit.update(dt); renderer.render(scene, camera); requestAnimationFrame(loop);
  }

  async function start() {
    try {
      manifest = await (await fetch(MANIFEST_URL, { cache: 'no-cache' })).json();
    } catch (e) { showFatal('モデル一覧(manifest.json)を読み込めませんでした。サーバー起動.py 経由で開いてください。'); return; }
    if (!manifest.tier || !manifest.tier.length) { showFatal('段(tier)のモデルがありません。assets/models/tier に GLB を追加してください。'); return; }
    initVariants();
    try { await preload(); } catch (e) { showFatal('モデルの読み込みに失敗しました（パス/形式をご確認ください）。'); return; }
    resize(); buildUI(); rebuild();
    const ld = document.getElementById('stageLoading'); if (ld) ld.classList.add('hidden');
    requestAnimationFrame(loop);
  }

  if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]).then(start);
  else start();
})();
