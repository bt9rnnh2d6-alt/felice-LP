/* ═══════════════════════════════════════════
   Felice 書類づくり — app.js
   データはこの端末の localStorage のみに保存。外部送信は一切しない。
   ═══════════════════════════════════════════ */
'use strict';

/* ═══ ヘルパー ═══ */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => new Intl.NumberFormat('ja-JP').format(Math.round(n || 0));
const yen = n => '¥' + num(n);
const fmtQty = q => (q === Math.floor(q)) ? String(q) : String(q);

function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDays(iso, days){
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + (days || 0));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtJP(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}
function fmtShort(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-').map(Number);
  return `${y}/${m}/${d}`;
}
function uid(){
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
function sanitizeFile(s){ return String(s).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60); }

/* ═══ 書類タイプ定義 ═══ */
const ICONS = {
  quote:    '<svg viewBox="0 0 24 24"><path d="M3.5 12.5v-7a2 2 0 0 1 2-2h7L20 11a2 2 0 0 1 0 2.8L14 20a2 2 0 0 1-2.8 0l-7.1-7.1a2 2 0 0 1-.6-.4z" stroke-linejoin="round"/><circle cx="8.2" cy="8.2" r="1.6"/></svg>',
  invoice:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M9 7.5l3 4 3-4M12 11.5V17M9.6 13h4.8M9.6 15.4h4.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  delivery: '<svg viewBox="0 0 24 24"><path d="M3.8 8L12 4l8.2 4v8L12 20l-8.2-4z" stroke-linejoin="round"/><path d="M3.8 8L12 12l8.2-4M12 12v8" stroke-linejoin="round"/></svg>',
  receipt:  '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4L10 21l-2-1.4L6 21z" stroke-linejoin="round"/><path d="M9.3 8.2h5.4M9.3 12h5.4" stroke-linecap="round"/></svg>',
  share:    '<svg viewBox="0 0 24 24"><path d="M12 15V4M7.5 7.5L12 3l4.5 4.5M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  edit:     '<svg viewBox="0 0 24 24"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z" stroke-linejoin="round"/><path d="M14.5 7.5l3 3"/></svg>',
  copy:     '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke-linecap="round"/></svg>',
  trash:    '<svg viewBox="0 0 24 24"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 21h16" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  print:    '<svg viewBox="0 0 24 24"><path d="M7 8V3h10v5M7 17H4V9.5h16V17h-3M7 14h10v7H7z" stroke-linejoin="round"/></svg>',
  person:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5" stroke-linecap="round"/></svg>',
  check:    '<svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-11" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const DOC_TYPES = {
  quote:    { label:'見積書', sheetTitle:'御 見 積 書', prefix:'Q', color:'#7f9376',
              desc:'金額の目安を伝える書類', greeting:'下記の通りお見積り申し上げます。' },
  invoice:  { label:'請求書', sheetTitle:'御 請 求 書', prefix:'I', color:'#c09355',
              desc:'お支払いをお願いする書類', greeting:'下記の通りご請求申し上げます。' },
  delivery: { label:'納品書', sheetTitle:'納 品 書', prefix:'D', color:'#7e93a8',
              desc:'お品物にそえて渡す書類', greeting:'下記の通り納品いたします。' },
  receipt:  { label:'領収書', sheetTitle:'領 収 書', prefix:'R', color:'#b77b5e',
              desc:'お金を受け取った証明の書類', greeting:'' },
};
const TYPE_ORDER = ['quote', 'invoice', 'delivery', 'receipt'];
const STATUS_LABEL = { draft:'下書き', issued:'発行済み', paid:'入金済み' };

/* ═══ ストレージ ═══ */
const PREFIX = 'felice.billing.';
const DEFAULT_SETTINGS = {
  issuerName: 'Felice Clay Cake Studio',
  issuerPerson: '', postal: '', address: '', tel: '',
  email: 'info@felice-fakecake.com',
  bank: { bankName:'', branch:'', type:'普通', number:'', holder:'' },
  defaults: { quoteValidDays:30, paymentTermDays:30, receiptProviso:'クレイケーキ制作代として', bankFeeNote:true },
  showStampBox: false,
  onboarded: false,
};

function loadKey(key, fallback){
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function saveKey(key, val){
  try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); }
  catch { toast('保存できませんでした（容量やプライベートモードをご確認ください）'); }
}

const S = {
  settings:  Object.assign({}, DEFAULT_SETTINGS, loadKey('settings', {})),
  customers: loadKey('customers', []),
  documents: loadKey('documents', []),
  counters:  loadKey('counters', {}),
  meta:      loadKey('meta', { schemaVersion:1, lastBackupAt:null, docCountAtBackup:0 }),
};
S.settings.bank = Object.assign({}, DEFAULT_SETTINGS.bank, S.settings.bank || {});
S.settings.defaults = Object.assign({}, DEFAULT_SETTINGS.defaults, S.settings.defaults || {});

const saveSettings  = () => saveKey('settings',  S.settings);
const saveCustomers = () => saveKey('customers', S.customers);
const saveDocuments = () => saveKey('documents', S.documents);
const saveCounters  = () => saveKey('counters',  S.counters);
const saveMeta      = () => saveKey('meta',      S.meta);

const docById  = id => S.documents.find(d => d.id === id);
const custById = id => S.customers.find(c => c.id === id);

/* ═══ 採番 ═══ */
function proposeNumber(type, issueDate){
  const t = DOC_TYPES[type];
  const year = (issueDate || todayStr()).slice(0, 4);
  const n = (S.counters[`${t.prefix}-${year}`] || 0) + 1;
  return `${t.prefix}-${year}-${String(n).padStart(3, '0')}`;
}
function commitNumber(doc){
  const m = String(doc.number).match(/^([A-Z])-(\d{4})-(\d+)$/);
  if (!m) return;
  const t = DOC_TYPES[doc.type];
  if (m[1] !== t.prefix) return;
  const key = `${m[1]}-${m[2]}`;
  S.counters[key] = Math.max(S.counters[key] || 0, parseInt(m[3], 10));
  saveCounters();
}

/* ═══ トースト・確認・アクションシート ═══ */
function toast(msg, ms = 2400){
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<svg class="ic" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-11" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(msg)}`;
  $('#toast-wrap').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
}

function ask(msg, okLabel = 'OK'){
  return new Promise(resolve => {
    $('#confirm-msg').textContent = msg;
    $('#confirm-yes').textContent = okLabel;
    const wrap = $('#confirm-wrap');
    wrap.classList.add('open');
    const done = v => { wrap.classList.remove('open'); yes.removeEventListener('click', onYes); no.removeEventListener('click', onNo); resolve(v); };
    const yes = $('#confirm-yes'), no = $('#confirm-no');
    const onYes = () => done(true), onNo = () => done(false);
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
  });
}

function openActionSheet(title, html){
  $('#asheet').innerHTML = (title ? `<h3>${esc(title)}</h3>` : '') + html;
  $('#asheet-wrap').classList.add('open');
}
function closeActionSheet(){ $('#asheet-wrap').classList.remove('open'); }
$('#asheet-bg').addEventListener('click', closeActionSheet);

/* ═══ ナビゲーション ═══ */
let currentView = 'home';
function showTab(name){
  currentView = name;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'home') renderHome();
  if (name === 'docs') renderDocs();
  if (name === 'customers') renderCustomers();
  if (name === 'settings') renderSettingsMeta();
  window.scrollTo({ top: 0 });
}
$$('.nav-btn').forEach(b => b.addEventListener('click', () => showTab(b.dataset.view)));

/* オーバーレイ（戻るボタン対応） */
const ovStack = [];
function openOverlay(id){
  $('#' + id).classList.add('open');
  ovStack.push(id);
  history.pushState({ ov: id }, '');
}
function closeTopOverlay(){
  const id = ovStack.pop();
  if (id) $('#' + id).classList.remove('open');
}
function requestCloseOverlay(){
  if (ovStack.length) history.back();
}
window.addEventListener('popstate', () => {
  if ($('#asheet-wrap').classList.contains('open')) { closeActionSheet(); history.pushState({}, ''); return; }
  closeTopOverlay();
});

/* ═══ ホーム ═══ */
function backupBannerHTML(){
  const n = S.documents.length;
  if (!n) return '';
  const since = n - (S.meta.docCountAtBackup || 0);
  const days = S.meta.lastBackupAt ? (Date.now() - new Date(S.meta.lastBackupAt).getTime()) / 86400000 : Infinity;
  const need = S.meta.lastBackupAt ? (since >= 5 || days > 30) : n >= 3;
  if (!need) return '';
  return `<div class="banner">
    <svg class="ic" viewBox="0 0 24 24"><path d="M12 8.5v5M12 16.8h.01M12 3l9.5 17h-19z" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span style="flex:1">データのバックアップをそろそろ保存しましょう</span>
    <button id="banner-backup">保存する</button>
  </div>`;
}

function docCardHTML(d){
  const t = DOC_TYPES[d.type];
  return `<button class="doc-card" data-id="${d.id}">
    <span class="doc-badge" style="background:${t.color}">${t.label.slice(0,2)}</span>
    <span class="doc-card-main">
      <span class="doc-card-name">${esc(d.customerName)} ${esc(d.customerHonorific)}</span>
      <span class="doc-card-sub">${esc(d.number)} ・ ${fmtShort(d.issueDate)}${d.title ? ' ・ ' + esc(d.title) : ''}</span>
    </span>
    <span class="doc-card-right">
      <span class="doc-card-amount">${yen(d.total)}</span><br>
      <span class="status-chip status-${d.status}">${STATUS_LABEL[d.status]}</span>
    </span>
  </button>`;
}

const EMPTY_CAKE = `<svg viewBox="0 0 120 120">
  <path d="M30 78h60v22a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4z"/>
  <path d="M38 56h44v22H38z"/><path d="M46 38h28v18H46z"/><circle cx="60" cy="30" r="6"/>
  <path d="M30 78c6-6 14 6 20 0s14 6 20 0 14 6 20 0" class="drip"/></svg>`;

function renderHome(){
  $('#backup-banner').innerHTML = backupBannerHTML();
  const bb = $('#banner-backup');
  if (bb) bb.addEventListener('click', () => exportBackup());
  const now = new Date();
  const wd = ['日','月','火','水','木','金','土'][now.getDay()];
  $('#home-date').textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日（${wd}）`;
  $('#home-quick').innerHTML = TYPE_ORDER.map(k => {
    const t = DOC_TYPES[k];
    return `<button class="quick-btn" data-type="${k}">
      <span class="dot" style="background:${t.color}">${ICONS[k]}</span>${t.label}</button>`;
  }).join('');
  $$('#home-quick .quick-btn').forEach(b =>
    b.addEventListener('click', () => startWizard({ mode:'new', type:b.dataset.type, skipType:true })));
  const recent = [...S.documents].sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0, 5);
  $('#home-recent').innerHTML = recent.length
    ? recent.map(docCardHTML).join('')
    : `<div class="empty">${EMPTY_CAKE}<br>まだ書類がありません。<br>上のボタンから最初の1枚をつくってみましょう。</div>`;
  bindDocCards('#home-recent');
}
function bindDocCards(scope){
  $$(scope + ' .doc-card').forEach(c => c.addEventListener('click', () => openDetail(c.dataset.id)));
}

/* ═══ 書類一覧 ═══ */
const docFilter = { type:'all', status:'all', q:'' };
function renderDocs(){
  $('#doc-type-chips').innerHTML =
    `<button class="chip ${docFilter.type==='all'?'active':''}" data-t="all">すべて</button>` +
    TYPE_ORDER.map(k => `<button class="chip ${docFilter.type===k?'active':''}" data-t="${k}">${DOC_TYPES[k].label}</button>`).join('');
  $('#doc-status-chips').innerHTML =
    `<button class="chip ${docFilter.status==='all'?'active':''}" data-s="all">すべての状態</button>` +
    Object.keys(STATUS_LABEL).map(k => `<button class="chip ${docFilter.status===k?'active':''}" data-s="${k}">${STATUS_LABEL[k]}</button>`).join('');
  $$('#doc-type-chips .chip').forEach(c => c.addEventListener('click', () => { docFilter.type = c.dataset.t; renderDocs(); }));
  $$('#doc-status-chips .chip').forEach(c => c.addEventListener('click', () => { docFilter.status = c.dataset.s; renderDocs(); }));

  let list = [...S.documents];
  if (docFilter.type !== 'all') list = list.filter(d => d.type === docFilter.type);
  if (docFilter.status !== 'all') list = list.filter(d => d.status === docFilter.status);
  if (docFilter.q) {
    const q = docFilter.q.toLowerCase();
    list = list.filter(d => [d.customerName, d.title, d.number].join(' ').toLowerCase().includes(q));
  }
  list.sort((a,b) => (b.issueDate + b.createdAt).localeCompare(a.issueDate + a.createdAt));
  $('#doc-list').innerHTML = list.length
    ? list.map(docCardHTML).join('')
    : `<div class="empty">${EMPTY_CAKE}<br>該当する書類がありません</div>`;
  bindDocCards('#doc-list');
}
$('#doc-search').addEventListener('input', e => { docFilter.q = e.target.value.trim(); renderDocs(); });

/* ═══ 宛先リスト ═══ */
function renderCustomers(){
  const list = [...S.customers].sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
  $('#customer-list').innerHTML = list.length
    ? list.map(c => `<button class="doc-card" data-id="${c.id}">
        <span class="doc-badge" style="background:var(--tan)">${ICONS.person.replace('<svg','<svg style="width:22px;height:22px;stroke:#fff;fill:none;stroke-width:1.8"')}</span>
        <span class="doc-card-main">
          <span class="doc-card-name">${esc(c.name)} ${esc(c.honorific)}</span>
          <span class="doc-card-sub">${esc(c.address || '住所未登録')}</span>
        </span></button>`).join('')
    : `<div class="empty">${EMPTY_CAKE}<br>まだ宛先がありません。<br>書類をつくると自動でここに登録されます。</div>`;
  $$('#customer-list .doc-card').forEach(c => c.addEventListener('click', () => openCustomerEditor(c.dataset.id)));
}

function openCustomerEditor(id){
  const c = id ? custById(id) : null;
  openActionSheet(c ? '宛先を編集' : '宛先を追加', `
    <label class="field"><span>名前</span><input type="text" id="ce-name" value="${esc(c?.name || '')}"></label>
    <div class="seg" id="ce-hon">
      <button data-v="御中" class="${(!c || c.honorific==='御中') ? 'active':''}">御中<small>会社・お店あて</small></button>
      <button data-v="様" class="${c?.honorific==='様' ? 'active':''}">様<small>個人あて</small></button>
    </div>
    <label class="field"><span>住所（省略できます）</span><input type="text" id="ce-addr" value="${esc(c?.address || '')}"></label>
    <label class="field"><span>メモ（書類には印字されません）</span><input type="text" id="ce-note" value="${esc(c?.note || '')}"></label>
    <button class="btn-primary" id="ce-save">保存する</button>
    ${c ? '<button class="btn-ghost" id="ce-del">この宛先を削除</button>' : ''}
  `);
  $$('#ce-hon button').forEach(b => b.addEventListener('click', () => {
    $$('#ce-hon button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  }));
  $('#ce-save').addEventListener('click', () => {
    const name = $('#ce-name').value.trim();
    if (!name) { toast('名前を入れてください'); return; }
    const hon = $('#ce-hon button.active')?.dataset.v || '御中';
    const now = new Date().toISOString();
    if (c) Object.assign(c, { name, honorific:hon, address:$('#ce-addr').value.trim(), note:$('#ce-note').value.trim(), updatedAt:now });
    else S.customers.push({ id:uid(), name, honorific:hon, address:$('#ce-addr').value.trim(), note:$('#ce-note').value.trim(), createdAt:now, updatedAt:now });
    saveCustomers(); closeActionSheet(); renderCustomers(); toast('保存しました');
  });
  const del = $('#ce-del');
  if (del) del.addEventListener('click', async () => {
    closeActionSheet();
    if (await ask(`「${c.name}」を宛先リストから削除しますか？\n（作成済みの書類はそのまま残ります）`, '削除する')) {
      S.customers = S.customers.filter(x => x.id !== c.id);
      saveCustomers(); renderCustomers(); toast('削除しました');
    }
  });
}
$('#btn-add-customer').addEventListener('click', () => openCustomerEditor(null));

/* ═══ 設定 ═══ */
const SETTING_FIELDS = [
  ['set-issuerName',   s => s.issuerName,   (s,v) => s.issuerName = v],
  ['set-issuerPerson', s => s.issuerPerson, (s,v) => s.issuerPerson = v],
  ['set-postal',       s => s.postal,       (s,v) => s.postal = v],
  ['set-address',      s => s.address,      (s,v) => s.address = v],
  ['set-tel',          s => s.tel,          (s,v) => s.tel = v],
  ['set-email',        s => s.email,        (s,v) => s.email = v],
  ['set-bankName',     s => s.bank.bankName,(s,v) => s.bank.bankName = v],
  ['set-branch',       s => s.bank.branch,  (s,v) => s.bank.branch = v],
  ['set-bankType',     s => s.bank.type,    (s,v) => s.bank.type = v],
  ['set-bankNumber',   s => s.bank.number,  (s,v) => s.bank.number = v],
  ['set-bankHolder',   s => s.bank.holder,  (s,v) => s.bank.holder = v],
  ['set-receiptProviso', s => s.defaults.receiptProviso, (s,v) => s.defaults.receiptProviso = v],
];
function bindSettings(){
  SETTING_FIELDS.forEach(([id, get, set]) => {
    const el = $('#' + id);
    el.value = get(S.settings) ?? '';
    el.addEventListener('change', () => { set(S.settings, el.value.trim()); saveSettings(); toast('設定を保存しました', 1400); });
  });
  const qv = $('#set-quoteValidDays'), pt = $('#set-paymentTermDays');
  qv.value = S.settings.defaults.quoteValidDays;
  pt.value = S.settings.defaults.paymentTermDays;
  qv.addEventListener('change', () => { S.settings.defaults.quoteValidDays = Math.max(1, parseInt(qv.value,10) || 30); qv.value = S.settings.defaults.quoteValidDays; saveSettings(); toast('設定を保存しました', 1400); });
  pt.addEventListener('change', () => { S.settings.defaults.paymentTermDays = Math.max(1, parseInt(pt.value,10) || 30); pt.value = S.settings.defaults.paymentTermDays; saveSettings(); toast('設定を保存しました', 1400); });
  const fee = $('#set-bankFeeNote'), stamp = $('#set-showStampBox');
  fee.checked = !!S.settings.defaults.bankFeeNote;
  stamp.checked = !!S.settings.showStampBox;
  fee.addEventListener('change', () => { S.settings.defaults.bankFeeNote = fee.checked; saveSettings(); toast('設定を保存しました', 1400); });
  stamp.addEventListener('change', () => { S.settings.showStampBox = stamp.checked; saveSettings(); toast('設定を保存しました', 1400); });
  $('#btn-export').addEventListener('click', () => exportBackup());
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; });
}
function renderSettingsMeta(){
  $('#backup-last').textContent = S.meta.lastBackupAt
    ? `前回のバックアップ：${fmtShort(S.meta.lastBackupAt.slice(0,10))}`
    : 'まだバックアップを保存していません。';
}

/* ═══ ウィザード ═══ */
const wiz = { steps:[], stepIdx:0, mode:'new', doc:null, sourceId:null, dirty:false };

function blankDoc(type){
  const today = todayStr();
  const d = {
    id: uid(), type, number: proposeNumber(type, today), issueDate: today,
    customerId: null, customerName: '', customerHonorific: '御中', customerAddress: '',
    title: '', items: [newItem()], total: 0, notes: '', status: 'draft',
    links: { sourceId: null, derivedIds: [] },
    createdAt: '', updatedAt: '',
  };
  applyTypeDefaults(d);
  return d;
}
function newItem(){ return { name:'', qty:1, unit:'点', unitPrice:0, amount:0 }; }
function applyTypeDefaults(d){
  const df = S.settings.defaults;
  if (d.type === 'quote')    d.validUntil   = d.validUntil   || addDays(d.issueDate, df.quoteValidDays);
  if (d.type === 'invoice')  d.dueDate      = d.dueDate      || addDays(d.issueDate, df.paymentTermDays);
  if (d.type === 'delivery') d.deliveryDate = d.deliveryDate || d.issueDate;
  if (d.type === 'receipt')  d.proviso      = d.proviso      || df.receiptProviso;
}

function startWizard({ mode = 'new', type = 'quote', doc = null, skipType = false, sourceId = null }){
  wiz.mode = mode;
  wiz.sourceId = sourceId;
  wiz.dirty = false;
  wiz.doc = doc ? JSON.parse(JSON.stringify(doc)) : blankDoc(type);
  if (!wiz.doc.items.length) wiz.doc.items = [newItem()];
  wiz.steps = (mode === 'new' && !skipType) ? ['type','customer','content','confirm'] : ['customer','content','confirm'];
  wiz.stepIdx = 0;
  $('#wiz-title').textContent = mode === 'edit' ? DOC_TYPES[wiz.doc.type].label + 'を編集' : '書類をつくる';
  buildTypeCards();
  fillWizardInputs();
  renderWizardStep();
  openOverlay('wizard');
}

function buildTypeCards(){
  $('#type-cards').innerHTML = TYPE_ORDER.map(k => {
    const t = DOC_TYPES[k];
    return `<button class="type-card ${wiz.doc.type === k ? 'selected' : ''}" data-type="${k}">
      <span class="dot" style="background:${t.color}">${ICONS[k]}</span>
      <span><b>${t.label}</b><small>${t.desc}</small></span>
    </button>`;
  }).join('');
  $$('#type-cards .type-card').forEach(c => c.addEventListener('click', () => {
    const k = c.dataset.type;
    if (wiz.doc.type !== k) {
      wiz.doc.type = k;
      delete wiz.doc.validUntil; delete wiz.doc.dueDate; delete wiz.doc.deliveryDate; delete wiz.doc.proviso;
      wiz.doc.number = proposeNumber(k, wiz.doc.issueDate);
      applyTypeDefaults(wiz.doc);
      fillWizardInputs();
    }
    $$('#type-cards .type-card').forEach(x => x.classList.toggle('selected', x === c));
    setTimeout(() => nextStep(), 160);
  }));
}

function fillWizardInputs(){
  $('#wiz-cust-name').value = wiz.doc.customerName || '';
  $('#wiz-cust-addr').value = wiz.doc.customerAddress || '';
  $$('#wiz-honorific button').forEach(b => b.classList.toggle('active', b.dataset.v === wiz.doc.customerHonorific));
  $('#wiz-title-input').value = wiz.doc.title || '';
  $('#wiz-issueDate').value = wiz.doc.issueDate;
  $('#wiz-number').value = wiz.doc.number;
  $('#wiz-notes').value = wiz.doc.notes || '';
  renderTypeFields();
  renderItems();
  renderCustSuggest('');
}

function renderTypeFields(){
  const d = wiz.doc;
  let html = '';
  if (d.type === 'quote')    html = `<label class="field"><span>見積の有効期限</span><input type="date" id="wf-validUntil" value="${d.validUntil}"></label>`;
  if (d.type === 'invoice')  html = `<label class="field"><span>お支払い期限</span><input type="date" id="wf-dueDate" value="${d.dueDate}"></label>`;
  if (d.type === 'delivery') html = `<label class="field"><span>納品日</span><input type="date" id="wf-deliveryDate" value="${d.deliveryDate}"></label>`;
  if (d.type === 'receipt')  html = `<label class="field"><span>なんの代金？（但し書き）</span><input type="text" id="wf-proviso" value="${esc(d.proviso)}"></label>`;
  $('#wiz-type-fields').innerHTML = html;
  const bind = (id, key) => { const el = $('#' + id); if (el) el.addEventListener('change', () => { wiz.doc[key] = el.value; wiz.dirty = true; }); };
  bind('wf-validUntil', 'validUntil'); bind('wf-dueDate', 'dueDate');
  bind('wf-deliveryDate', 'deliveryDate'); bind('wf-proviso', 'proviso');
}

/* 宛先サジェスト */
function renderCustSuggest(q){
  const wrap = $('#wiz-cust-suggest');
  let list = [...S.customers].sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
  if (q) list = list.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
  list = list.slice(0, 6);
  if (!list.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="suggest-title">${q ? '見つかった宛先' : 'このリストからえらべます'}</div>` +
    list.map(c => `<button class="suggest-row ${wiz.doc.customerId === c.id ? 'selected' : ''}" data-id="${c.id}">
      ${ICONS.person.replace('<svg', '<svg class="ic"')} ${esc(c.name)}<small>${esc(c.honorific)}</small></button>`).join('');
  $$('#wiz-cust-suggest .suggest-row').forEach(r => r.addEventListener('click', () => {
    const c = custById(r.dataset.id);
    wiz.doc.customerId = c.id;
    wiz.doc.customerName = c.name;
    wiz.doc.customerHonorific = c.honorific;
    wiz.doc.customerAddress = c.address || '';
    wiz.dirty = true;
    $('#wiz-cust-name').value = c.name;
    $('#wiz-cust-addr').value = c.address || '';
    $$('#wiz-honorific button').forEach(b => b.classList.toggle('active', b.dataset.v === c.honorific));
    renderCustSuggest($('#wiz-cust-name').value.trim());
  }));
}
$('#wiz-cust-name').addEventListener('input', e => {
  wiz.doc.customerName = e.target.value.trim();
  wiz.doc.customerId = null;
  wiz.dirty = true;
  renderCustSuggest(e.target.value.trim());
});
$('#wiz-cust-addr').addEventListener('change', e => { wiz.doc.customerAddress = e.target.value.trim(); wiz.dirty = true; });
$$('#wiz-honorific button').forEach(b => b.addEventListener('click', () => {
  $$('#wiz-honorific button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  wiz.doc.customerHonorific = b.dataset.v;
  wiz.dirty = true;
}));
$('#wiz-title-input').addEventListener('change', e => { wiz.doc.title = e.target.value.trim(); wiz.dirty = true; });
$('#wiz-issueDate').addEventListener('change', e => {
  const old = wiz.doc.issueDate;
  wiz.doc.issueDate = e.target.value || todayStr();
  const df = S.settings.defaults;
  if (wiz.doc.type === 'quote'    && wiz.doc.validUntil   === addDays(old, df.quoteValidDays))  { wiz.doc.validUntil = addDays(wiz.doc.issueDate, df.quoteValidDays); }
  if (wiz.doc.type === 'invoice'  && wiz.doc.dueDate      === addDays(old, df.paymentTermDays)) { wiz.doc.dueDate = addDays(wiz.doc.issueDate, df.paymentTermDays); }
  if (wiz.doc.type === 'delivery' && wiz.doc.deliveryDate === old) { wiz.doc.deliveryDate = wiz.doc.issueDate; }
  renderTypeFields();
  wiz.dirty = true;
});
$('#wiz-number').addEventListener('change', e => { wiz.doc.number = e.target.value.trim() || proposeNumber(wiz.doc.type, wiz.doc.issueDate); wiz.dirty = true; });
$('#wiz-notes').addEventListener('change', e => { wiz.doc.notes = e.target.value.trim(); wiz.dirty = true; });

/* 品目エディタ */
function recalcItems(){
  wiz.doc.items.forEach(it => { it.amount = Math.round((parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0)); });
  wiz.doc.total = wiz.doc.items.reduce((a, it) => a + it.amount, 0);
  updateWizFooter();
}
function renderItems(){
  const wrap = $('#wiz-items');
  wrap.innerHTML = wiz.doc.items.map((it, i) => `
    <div class="item-row" data-i="${i}">
      <div class="row1">
        <input type="text" class="it-name" placeholder="品名（例：クレイケーキ 2段）" value="${esc(it.name)}">
        <button class="item-del" aria-label="この品目を削除">${ICONS.trash.replace('<svg', '<svg class="ic"')}</button>
      </div>
      <div class="row2">
        <input type="number" class="it-qty" inputmode="decimal" min="0" step="any" value="${it.qty}" aria-label="数量">
        <span class="x">×</span>
        <input type="number" class="it-price" inputmode="numeric" min="0" step="1" placeholder="単価（円）" value="${it.unitPrice || ''}" aria-label="単価">
        <select class="it-unit" aria-label="単位">${['点','個','式','セット','件'].map(u => `<option ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      </div>
      <div class="item-amount">＝ ${yen(it.amount)}</div>
    </div>`).join('');
  $$('#wiz-items .item-row').forEach(row => {
    const i = +row.dataset.i, it = wiz.doc.items[i];
    row.querySelector('.it-name').addEventListener('input', e => { it.name = e.target.value; wiz.dirty = true; });
    row.querySelector('.it-qty').addEventListener('input', e => { it.qty = parseFloat(e.target.value) || 0; wiz.dirty = true; recalcItems(); row.querySelector('.item-amount').textContent = '＝ ' + yen(it.amount); });
    row.querySelector('.it-price').addEventListener('input', e => { it.unitPrice = parseFloat(e.target.value) || 0; wiz.dirty = true; recalcItems(); row.querySelector('.item-amount').textContent = '＝ ' + yen(it.amount); });
    row.querySelector('.it-unit').addEventListener('change', e => { it.unit = e.target.value; wiz.dirty = true; });
    row.querySelector('.item-del').addEventListener('click', () => {
      if (wiz.doc.items.length === 1) { wiz.doc.items[0] = newItem(); }
      else wiz.doc.items.splice(i, 1);
      wiz.dirty = true; recalcItems(); renderItems();
    });
  });
  recalcItems();
}
$('#btn-add-item').addEventListener('click', () => {
  wiz.doc.items.push(newItem());
  renderItems();
  const rows = $$('#wiz-items .item-row');
  rows[rows.length - 1].querySelector('.it-name').focus();
});

/* ステップ制御 */
function renderWizardStep(){
  const step = wiz.steps[wiz.stepIdx];
  $$('.wstep').forEach(s => s.classList.remove('active'));
  $('#wstep-' + step).classList.add('active');
  $('#wiz-dots').innerHTML = wiz.steps.map((_, i) => `<i class="${i <= wiz.stepIdx ? 'on' : ''}"></i>`).join('');
  $('#wiz-back').style.visibility = wiz.stepIdx === 0 ? 'hidden' : 'visible';
  const next = $('#wiz-next');
  if (step === 'type') { next.textContent = 'つぎへ'; }
  else if (step === 'confirm') { next.textContent = wiz.mode === 'edit' ? '保存する' : 'この内容で保存'; }
  else next.textContent = 'つぎへ';
  if (step === 'confirm') mountPreview($('#wiz-preview'), wiz.doc);
  updateWizFooter();
  $('#wiz-body').scrollTo({ top: 0 });
}
function updateWizFooter(){
  const step = wiz.steps[wiz.stepIdx];
  $('#wiz-total').innerHTML = (step === 'content' || step === 'confirm')
    ? `<small>合計（税込）</small><strong>${yen(wiz.doc.total)}</strong>` : '';
}
function validateStep(step){
  if (step === 'customer' && !wiz.doc.customerName) { toast('宛先の名前を入れてください'); $('#wiz-cust-name').focus(); return false; }
  if (step === 'content') {
    wiz.doc.items = wiz.doc.items.filter(it => it.name.trim() || it.amount > 0);
    if (!wiz.doc.items.length) { wiz.doc.items = [newItem()]; renderItems(); toast('品目を1つ以上入れてください'); return false; }
    if (wiz.doc.items.some(it => !it.name.trim())) { renderItems(); toast('品名が空の行があります'); return false; }
    recalcItems();
    wiz.doc.title = $('#wiz-title-input').value.trim();
  }
  return true;
}
function nextStep(){
  const step = wiz.steps[wiz.stepIdx];
  if (!validateStep(step)) return;
  if (step === 'confirm') { saveWizardDoc(); return; }
  wiz.stepIdx = Math.min(wiz.steps.length - 1, wiz.stepIdx + 1);
  renderWizardStep();
}
$('#wiz-next').addEventListener('click', nextStep);
$('#wiz-back').addEventListener('click', () => {
  if (wiz.stepIdx > 0) { wiz.stepIdx--; renderWizardStep(); }
});
$('#wiz-close').addEventListener('click', async () => {
  if (wiz.dirty && !(await ask('つくりかけの内容は保存されません。\nとじてもよいですか？', 'とじる'))) return;
  requestCloseOverlay();
});

async function saveWizardDoc(){
  const d = wiz.doc;
  const dup = S.documents.find(x => x.number === d.number && x.id !== d.id);
  if (dup && !(await ask(`同じ番号（${d.number}）の書類がすでにあります。\nこのまま保存しますか？`, '保存する'))) return;

  /* 宛先を台帳へ反映 */
  let cust = d.customerId ? custById(d.customerId) : S.customers.find(c => c.name === d.customerName);
  const now = new Date().toISOString();
  if (!cust) {
    cust = { id: uid(), name: d.customerName, honorific: d.customerHonorific, address: d.customerAddress || '', note: '', createdAt: now, updatedAt: now };
    S.customers.push(cust);
  } else {
    cust.honorific = d.customerHonorific;
    if (d.customerAddress) cust.address = d.customerAddress;
    cust.updatedAt = now;
  }
  d.customerId = cust.id;
  saveCustomers();

  const isNew = !S.documents.some(x => x.id === d.id);
  d.updatedAt = now;
  if (isNew) {
    d.createdAt = now;
    S.documents.push(d);
    commitNumber(d);
    if (wiz.sourceId) {
      const src = docById(wiz.sourceId);
      if (src) { d.links.sourceId = src.id; (src.links.derivedIds ||= []).push(d.id); }
    }
  } else {
    const idx = S.documents.findIndex(x => x.id === d.id);
    S.documents[idx] = d;
  }
  saveDocuments();
  wiz.dirty = false;
  requestCloseOverlay();
  toast('保存しました');
  setTimeout(() => openDetail(d.id), 380);
  if (currentView === 'home') renderHome();
}
$('#btn-create').addEventListener('click', () => startWizard({ mode: 'new' }));
$('#link-all-docs').addEventListener('click', () => showTab('docs'));

/* ═══ 帳票シートHTML ═══ */
function issuerHTML(){
  const st = S.settings;
  return `<div class="s-issuer">
    <div class="s-issuer-name">${esc(st.issuerName)}</div>
    ${st.issuerPerson ? `<div class="s-issuer-sub">${esc(st.issuerPerson)}</div>` : ''}
    ${(st.postal || st.address) ? `<div>${st.postal ? '〒' + esc(st.postal) + '　' : ''}${esc(st.address)}</div>` : ''}
    ${st.tel ? `<div>TEL：${esc(st.tel)}</div>` : ''}
    ${st.email ? `<div>${esc(st.email)}</div>` : ''}
  </div>`;
}

function sheetHTML(d){
  const t = DOC_TYPES[d.type];
  if (d.type === 'receipt') return receiptSheetHTML(d, t);
  const rows = d.items.map(it => `<tr>
      <td>${esc(it.name)}</td>
      <td class="ctr">${fmtQty(it.qty)}</td>
      <td class="ctr">${esc(it.unit || '')}</td>
      <td class="num">${num(it.unitPrice)}</td>
      <td class="num">${num(it.amount)}</td>
    </tr>`).join('');
  const pads = Array.from({ length: Math.max(0, 8 - d.items.length) }, () =>
    `<tr>${'<td class="pad"></td>'.repeat(5)}</tr>`).join('');
  const terms =
    d.type === 'quote'    ? `お見積り有効期限：<b>${fmtJP(d.validUntil)}</b>` :
    d.type === 'invoice'  ? `お支払い期限：<b>${fmtJP(d.dueDate)}</b>` :
    d.type === 'delivery' ? `納品日：<b>${fmtJP(d.deliveryDate)}</b>` : '';
  const st = S.settings;
  const bank = (d.type === 'invoice' && (st.bank.bankName || st.bank.number)) ? `
    <div class="s-bank"><b>お振込先</b>
      ${esc(st.bank.bankName)}　${esc(st.bank.branch)}　${esc(st.bank.type)}　${esc(st.bank.number)}<br>
      口座名義：${esc(st.bank.holder)}
      ${st.defaults.bankFeeNote ? '<div class="fee">※恐れ入りますが、お振込手数料はご負担くださいますようお願いいたします。</div>' : ''}
    </div>` : '';
  return `<div class="sheet st-${d.type}">
    <div class="s-title">${t.sheetTitle}</div>
    <div class="s-cols">
      <div class="s-left">
        <div class="s-to-name">${esc(d.customerName)}<small>${esc(d.customerHonorific)}</small></div>
        ${d.customerAddress ? `<div class="s-to-addr">${esc(d.customerAddress)}</div>` : ''}
        <p class="s-greet">${d.title ? `件名：<b>${esc(d.title)}</b><br>` : ''}${t.greeting}</p>
        <div class="s-amount">
          <span class="s-amount-label">合計金額</span>
          <span class="s-amount-val">${yen(d.total)} −</span>
          <span class="s-amount-tax">（税込）</span>
        </div>
        ${terms ? `<div class="s-terms">${terms}</div>` : ''}
      </div>
      <div class="s-right">
        <div class="s-no">No. ${esc(d.number)}<br>発行日：${fmtJP(d.issueDate)}</div>
        ${issuerHTML()}
      </div>
    </div>
    <table class="s-items">
      <thead><tr><th style="width:44%">品名</th><th style="width:10%">数量</th><th style="width:10%">単位</th><th style="width:18%">単価（円）</th><th style="width:18%">金額（円）</th></tr></thead>
      <tbody>${rows}${pads}</tbody>
      <tfoot>
        <tr class="sub"><td colspan="3"></td><td class="t-label">小計</td><td class="t-val">${num(d.total)}</td></tr>
        <tr class="grand"><td colspan="3"></td><td class="t-label">合計（税込）</td><td class="t-val">${yen(d.total)}</td></tr>
      </tfoot>
    </table>
    ${bank}
    ${d.notes ? `<div class="s-note"><b>備考</b><p>${esc(d.notes)}</p></div>` : ''}
    <div class="s-foot">${esc(S.settings.issuerName)}</div>
  </div>`;
}

function receiptSheetHTML(d, t){
  const stamp = S.settings.showStampBox ? `
    <div>
      <div class="s-stamp">収入印紙</div>
      <div class="s-stamp-note">※紙で渡す場合、5万円以上は収入印紙が必要なことがあります（くわしくは国税庁の案内をご確認ください）</div>
    </div>` : '<div></div>';
  return `<div class="sheet st-receipt">
    <div class="s-title">${t.sheetTitle}</div>
    <div class="s-cols">
      <div class="s-left s-to-block">
        <div class="s-to-name">${esc(d.customerName)}<small>${esc(d.customerHonorific)}</small></div>
      </div>
      <div class="s-right">
        <div class="s-no">No. ${esc(d.number)}<br>発行日：${fmtJP(d.issueDate)}</div>
      </div>
    </div>
    <div class="s-amount-big">
      <span class="lbl">金　額</span>
      <span class="val">${yen(d.total)} −</span>
      <span class="tax">（税込）</span>
    </div>
    <p class="s-proviso">但し　${esc(d.proviso || '')}</p>
    <p class="s-received">上記正に領収いたしました</p>
    ${d.notes ? `<div class="s-note"><b>備考</b><p>${esc(d.notes)}</p></div>` : ''}
    <div class="s-receipt-bottom">
      ${stamp}
      ${issuerHTML()}
    </div>
    <div class="s-foot">${esc(S.settings.issuerName)}</div>
  </div>`;
}

/* プレビュー（縮小表示） */
function fitPreview(container){
  const inner = container.querySelector('.preview-scale');
  const sheet = inner && inner.firstElementChild;
  if (!sheet) return;
  const w = container.clientWidth || container.parentElement.clientWidth;
  if (!w || !sheet.offsetWidth) return;
  const scale = w / sheet.offsetWidth;
  inner.style.transform = `scale(${scale})`;
  container.style.height = sheet.offsetHeight * scale + 'px';
}
function mountPreview(container, doc){
  container.innerHTML = `<div class="preview-scale">${sheetHTML(doc)}</div>`;
  fitPreview(container);
}
window.addEventListener('resize', () => $$('.preview-wrap').forEach(fitPreview));

/* ═══ PDF 生成・共有 ═══ */
function pdfFileName(d){
  return sanitizeFile(`${DOC_TYPES[d.type].label}_${d.number}_${d.customerName}`) + '.pdf';
}
async function makePdfBlob(d){
  const stage = $('#pdf-stage');
  stage.innerHTML = sheetHTML(d);
  const el = stage.firstElementChild;
  try { await document.fonts.ready; } catch {}
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false });
  stage.innerHTML = '';
  const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageW = 210, pageH = 297;
  const pagePx = Math.floor(canvas.width * pageH / pageW);
  let y = 0, first = true;
  while (y < canvas.height - 8) {
    const sliceH = Math.min(pagePx, canvas.height - y);
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = sliceH;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, pageW, sliceH * pageW / canvas.width);
    y += sliceH; first = false;
  }
  return pdf.output('blob');
}
function downloadBlob(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function markIssued(d){
  if (d.status === 'draft') {
    d.status = 'issued';
    d.updatedAt = new Date().toISOString();
    saveDocuments();
    if (detailId === d.id) renderDetailMeta(d);
    toast('この書類を「発行済み」にしました');
  }
}
async function sharePdf(d, btn){
  if (btn) { btn.disabled = true; }
  toast('PDFをつくっています…', 1600);
  try {
    const blob = await makePdfBlob(d);
    const file = new File([blob], pdfFileName(d), { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: pdfFileName(d) });
        markIssued(d);
      } catch (e) {
        if (e && e.name !== 'AbortError') { downloadBlob(blob, pdfFileName(d)); markIssued(d); }
      }
    } else {
      downloadBlob(blob, pdfFileName(d));
      toast('PDFを保存しました');
      markIssued(d);
    }
  } catch (e) {
    console.error(e);
    toast('PDFの作成に失敗しました');
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function downloadPdf(d){
  toast('PDFをつくっています…', 1600);
  try {
    const blob = await makePdfBlob(d);
    downloadBlob(blob, pdfFileName(d));
    toast('PDFを保存しました');
    markIssued(d);
  } catch (e) { console.error(e); toast('PDFの作成に失敗しました'); }
}
function printDoc(d){
  const stage = $('#print-stage');
  stage.innerHTML = sheetHTML(d);
  const before = document.title;
  document.title = pdfFileName(d).replace(/\.pdf$/, '');
  window.print();
  document.title = before;
  setTimeout(() => { stage.innerHTML = ''; }, 800);
}

/* ═══ 書類詳細 ═══ */
let detailId = null;
function statusChoices(d){
  return d.type === 'invoice' ? ['draft', 'issued', 'paid'] : ['draft', 'issued'];
}
function renderDetailMeta(d){
  const src = d.links?.sourceId ? docById(d.links.sourceId) : null;
  const derived = (d.links?.derivedIds || []).map(docById).filter(Boolean);
  $('#detail-meta').innerHTML = `
    ${statusChoices(d).map(s =>
      `<button class="status-chip status-${s} pick ${d.status === s ? 'on' : ''}" data-s="${s}">${STATUS_LABEL[s]}</button>`).join('')}
    ${src ? `<div class="detail-src">『${esc(src.number)} ${DOC_TYPES[src.type].label}』からつくった書類です <button data-go="${src.id}">開く</button></div>` : ''}
    ${derived.map(x => `<div class="detail-src">この書類から『${esc(x.number)} ${DOC_TYPES[x.type].label}』ができています <button data-go="${x.id}">開く</button></div>`).join('')}
  `;
  $$('#detail-meta .status-chip').forEach(c => c.addEventListener('click', () => {
    d.status = c.dataset.s;
    d.updatedAt = new Date().toISOString();
    saveDocuments();
    renderDetailMeta(d);
    toast(`「${STATUS_LABEL[d.status]}」にしました`, 1500);
  }));
  $$('#detail-meta [data-go]').forEach(b => b.addEventListener('click', () => {
    requestCloseOverlay();
    setTimeout(() => openDetail(b.dataset.go), 400);
  }));
}
function openDetail(id){
  const d = docById(id);
  if (!d) return;
  detailId = id;
  $('#detail-title').textContent = `${DOC_TYPES[d.type].label}　${d.number}`;
  renderDetailMeta(d);
  mountPreview($('#detail-preview'), d);
  openOverlay('detail');
}
$('#detail-back').addEventListener('click', requestCloseOverlay);
$('#btn-share').addEventListener('click', e => { const d = docById(detailId); if (d) sharePdf(d, e.currentTarget); });

$('#btn-convert').addEventListener('click', () => {
  const d = docById(detailId);
  if (!d) return;
  const others = TYPE_ORDER.filter(k => k !== d.type);
  openActionSheet('この内容から次の書類をつくる', others.map(k => {
    const t = DOC_TYPES[k];
    return `<button class="as-btn" data-conv="${k}">
      <span class="dot" style="background:${t.color}">${ICONS[k]}</span>
      <span><b>${t.label}</b>をつくる</span></button>`;
  }).join(''));
  $$('#asheet [data-conv]').forEach(b => b.addEventListener('click', () => {
    closeActionSheet();
    convertDoc(d, b.dataset.conv);
  }));
});

function convertDoc(src, newType){
  const d = blankDoc(newType);
  d.customerId = src.customerId;
  d.customerName = src.customerName;
  d.customerHonorific = src.customerHonorific;
  d.customerAddress = src.customerAddress || '';
  d.title = src.title;
  d.items = JSON.parse(JSON.stringify(src.items));
  d.notes = src.notes;
  d.total = src.total;
  requestCloseOverlay();
  setTimeout(() => startWizard({ mode: 'new', type: newType, doc: d, skipType: true, sourceId: src.id }), 400);
}

function duplicateDoc(src){
  const d = blankDoc(src.type);
  const keep = { id: d.id, number: d.number, issueDate: d.issueDate, status: 'draft', createdAt: '', updatedAt: '' };
  Object.assign(d, JSON.parse(JSON.stringify(src)), keep);
  d.links = { sourceId: null, derivedIds: [] };
  delete d.validUntil; delete d.dueDate; delete d.deliveryDate; /* 期限類は新しい発行日から引き直す */
  applyTypeDefaults(d);
  requestCloseOverlay();
  setTimeout(() => startWizard({ mode: 'new', type: d.type, doc: d, skipType: true }), 400);
}

$('#detail-menu').addEventListener('click', () => {
  const d = docById(detailId);
  if (!d) return;
  openActionSheet(`${DOC_TYPES[d.type].label}　${d.number}`, `
    <button class="as-btn" data-act="edit">${ICONS.edit.replace('<svg', '<svg class="ic"')}内容を編集する</button>
    <button class="as-btn" data-act="dup">${ICONS.copy.replace('<svg', '<svg class="ic"')}複製して新しくつくる</button>
    <button class="as-btn" data-act="dl">${ICONS.download.replace('<svg', '<svg class="ic"')}PDFをダウンロード</button>
    <button class="as-btn" data-act="print">${ICONS.print.replace('<svg', '<svg class="ic"')}印刷する<small>パソコン向け</small></button>
    <button class="as-btn danger" data-act="del">${ICONS.trash.replace('<svg', '<svg class="ic"')}この書類を削除する</button>
  `);
  $$('#asheet [data-act]').forEach(b => b.addEventListener('click', async () => {
    closeActionSheet();
    const act = b.dataset.act;
    if (act === 'edit') { requestCloseOverlay(); setTimeout(() => startWizard({ mode: 'edit', doc: d }), 400); }
    if (act === 'dup') duplicateDoc(d);
    if (act === 'dl') downloadPdf(d);
    if (act === 'print') printDoc(d);
    if (act === 'del') {
      if (await ask(`${DOC_TYPES[d.type].label}「${d.number}」を削除しますか？\nこの操作は元に戻せません。`, '削除する')) {
        S.documents = S.documents.filter(x => x.id !== d.id);
        S.documents.forEach(x => { if (x.links?.derivedIds) x.links.derivedIds = x.links.derivedIds.filter(i => i !== d.id); });
        saveDocuments();
        requestCloseOverlay();
        toast('削除しました');
        renderHome(); if (currentView === 'docs') renderDocs();
      }
    }
  }));
});

/* ═══ バックアップ ═══ */
function backupJSON(){
  return JSON.stringify({
    app: 'felice-billing', schemaVersion: 1, exportedAt: new Date().toISOString(),
    data: { settings: S.settings, customers: S.customers, documents: S.documents, counters: S.counters },
  }, null, 1);
}
function backupFileName(){ return `felice-billing-backup-${todayStr()}.json`; }
async function exportBackup(){
  const blob = new Blob([backupJSON()], { type: 'application/json' });
  const file = new File([blob], backupFileName(), { type: 'application/json' });
  let done = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: backupFileName() }); done = true; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (!done) downloadBlob(blob, backupFileName());
  S.meta.lastBackupAt = new Date().toISOString();
  S.meta.docCountAtBackup = S.documents.length;
  saveMeta();
  renderSettingsMeta();
  $('#backup-banner').innerHTML = backupBannerHTML();
  toast('バックアップを保存しました');
}
async function importBackup(file){
  let obj;
  try { obj = JSON.parse(await file.text()); }
  catch { toast('ファイルを読み込めませんでした'); return; }
  if (obj?.app !== 'felice-billing' || !obj.data) { toast('このアプリのバックアップファイルではないようです'); return; }
  const n = obj.data.documents?.length || 0, m = obj.data.customers?.length || 0;
  const ok = await ask(
    `バックアップから戻します。\n読み込む内容：書類 ${n}件・宛先 ${m}件\n\nいまこの端末にあるデータ（書類 ${S.documents.length}件）は置き換えられます。念のため、先に現在のデータを自動でダウンロードします。`,
    '置き換える');
  if (!ok) return;
  if (S.documents.length) downloadBlob(new Blob([backupJSON()], { type: 'application/json' }), `felice-billing-before-import-${todayStr()}.json`);
  S.settings  = Object.assign({}, DEFAULT_SETTINGS, obj.data.settings || {});
  S.settings.bank = Object.assign({}, DEFAULT_SETTINGS.bank, obj.data.settings?.bank || {});
  S.settings.defaults = Object.assign({}, DEFAULT_SETTINGS.defaults, obj.data.settings?.defaults || {});
  S.customers = obj.data.customers || [];
  S.documents = obj.data.documents || [];
  S.counters  = obj.data.counters || {};
  saveSettings(); saveCustomers(); saveDocuments(); saveCounters();
  S.meta.lastBackupAt = new Date().toISOString();
  S.meta.docCountAtBackup = S.documents.length;
  saveMeta();
  toast('バックアップから戻しました');
  setTimeout(() => location.reload(), 900);
}

/* ═══ オンボーディング ═══ */
function isIOS(){ return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function initOnboarding(){
  if (S.settings.onboarded) return;
  const ob = $('#ob');
  ob.classList.add('show');
  $('#ob-issuerName').value = S.settings.issuerName;
  $('#ob-email').value = S.settings.email;
  if (isIOS()) $('#ob-a2hs-text').innerHTML = 'Safariの共有ボタン（<b>□↑</b>）から<br>「<b>ホーム画面に追加</b>」をしておくと、<br>アプリのようにすぐ開けて、データも消えにくくなります。';
  let idx = 1;
  const show = i => {
    idx = i;
    $$('.ob-slide').forEach(s => s.classList.toggle('active', +s.dataset.slide === i));
  };
  $$('.ob-next').forEach(b => b.addEventListener('click', () => {
    if (idx === 2) {
      S.settings.issuerName = $('#ob-issuerName').value.trim() || DEFAULT_SETTINGS.issuerName;
      S.settings.issuerPerson = $('#ob-issuerPerson').value.trim();
      S.settings.email = $('#ob-email').value.trim();
      saveSettings();
    }
    if (idx >= 3) { finishOnboarding(); return; }
    show(idx + 1);
  }));
  $$('.ob-skip').forEach(b => b.addEventListener('click', () => show(idx + 1)));
}
function finishOnboarding(){
  S.settings.onboarded = true;
  saveSettings();
  $('#ob').classList.remove('show');
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  renderHome();
}

/* ═══ 起動 ═══ */
function init(){
  bindSettings();
  renderHome();
  initOnboarding();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
init();
