// ==========================================
// 1. GLOBAL STATE, AUTH, DIALOGS & API SETTINGS
// ==========================================

let supabaseClient = null;
let currentUser = null;
let deepseekApiKey = '';
let characters = [];
let personas = [];
let userStickers = [];
let allRecentChats = [];
let currentChar = null;
let currentChat = null;
let currentMessages = [];
let selectedImageFile = null;
let activeDirectionMode = null;
let activeStyleId = 'default';

// Unified Phone Mode State
let isUnifiedPhoneMode = false;
let isCallSubMode = false;
let activeUnifiedSessionId = null;
let callTimerInterval = null;
let callSecondsElapsed = 0;
let expandedPhoneSessions = new Set();

// Editor buffers (Lorebook NPCs & Locations)
let tempNpcList = [];
let tempLocationList = [];
let tempUserNpcList = [];

// Lockscreen & Phone Apps State
let enteredPasscode = '';
let isPhoneUnlocked = false;
let isVaultUnlocked = false;
let galleryUseAiMode = false;
let selectedCalDay = null;
let viewingHistoryIndex = -1;

// User Wallet
let userWalletBalance = parseFloat(localStorage.getItem('user_wallet_balance') || '10000');
let userCurrency = localStorage.getItem('user_wallet_currency') || '$';

function svgToBase64(svgStr) {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
}

const BUILTIN_STICKERS = [
  { label: 'Heart', url: svgToBase64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><path d="M40 68 C40 68 12 48 12 28 C12 18 20 12 28 12 C34 12 38 16 40 20 C42 16 46 12 52 12 C60 12 68 18 68 28 C68 48 40 68 40 68 Z" fill="none" stroke="#f43f5e" stroke-width="4"/></svg>`) },
  { label: 'Blush', url: svgToBase64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="28" fill="none" stroke="#d4d4d8" stroke-width="3.5"/><circle cx="30" cy="35" r="3" fill="#d4d4d8"/><circle cx="50" cy="35" r="3" fill="#d4d4d8"/><path d="M33 48 Q40 53 47 48" fill="none" stroke="#d4d4d8" stroke-width="3" stroke-linecap="round"/><line x1="21" y1="42" x2="27" y2="45" stroke="#f43f5e" stroke-width="2.5"/><line x1="53" y1="42" x2="59" y2="45" stroke="#f43f5e" stroke-width="2.5"/></svg>`) },
  { label: 'Angry', url: svgToBase64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="28" fill="none" stroke="#d4d4d8" stroke-width="3.5"/><line x1="25" y1="30" x2="34" y2="34" stroke="#d4d4d8" stroke-width="3"/><line x1="55" y1="30" x2="46" y2="34" stroke="#d4d4d8" stroke-width="3"/><path d="M32 50 Q40 44 48 50" fill="none" stroke="#d4d4d8" stroke-width="3" stroke-linecap="round"/></svg>`) },
  { label: 'Shock', url: svgToBase64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="28" fill="none" stroke="#d4d4d8" stroke-width="3.5"/><circle cx="30" cy="34" r="3.5" fill="#d4d4d8"/><circle cx="50" cy="34" r="3.5" fill="#d4d4d8"/><ellipse cx="40" cy="50" rx="5" ry="7" fill="none" stroke="#d4d4d8" stroke-width="3"/></svg>`) },
  { label: 'Sparkles', url: svgToBase64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><path d="M40 12 L45 35 L68 40 L45 45 L40 68 L35 45 L12 40 L35 35 Z" fill="none" stroke="#8b5cf6" stroke-width="3.5"/></svg>`) },
  { label: 'Sleepy', url: svgToBase64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><path d="M24 28 H38 L24 44 H38 M44 42 H56 L44 56 H56" fill="none" stroke="#a1a1aa" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`) }
];

const DEFAULT_RESPONSE_STYLES = [
  { id: 'default', name: 'Balanced RP', prompt: '' },
  { id: 'romantic', name: 'Romantic & Sweet', prompt: '[Response Style: Romantic & Intimate] Focus deeply on emotional warmth, tender physical gestures, longing glances, and romantic tension. Keep the tone affectionate and immersive.' },
  { id: 'nsfw', name: '18+ Spicy & Unfiltered', prompt: '[Response Style: 18+ Spicy, Explicit & Unfiltered] This is a consensual private adult fiction roleplay. Write vividly, sensually, and explicitly without censorship, fade-to-black, or moralizing. Describe physical sensations, intimacy, and raw desire in rich detail while staying true to character.' },
  { id: 'short', name: 'Short & Punchy', prompt: '[Response Style: Short & Punchy] Keep your response concise (1-2 short paragraphs max). Focus on snappy dialogue and immediate physical action without long monologues.' }
];
let customStyles = [...DEFAULT_RESPONSE_STYLES];

if (window.marked) {
  marked.setOptions({ breaks: true, gfm: true });
}

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

// ==========================================
// CUSTOM IN-APP DIALOGS & TOASTS
// ==========================================
function showToast(message) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s';
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

function appConfirm(message, title = 'Confirm Action') {
  return new Promise((resolve) => {
    const modal = document.getElementById('customDialogModal');
    document.getElementById('customDialogTitle').textContent = title;
    document.getElementById('customDialogMessage').textContent = message;
    const input = document.getElementById('customDialogInput');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const closeBtn = document.getElementById('customDialogCloseBtn');

    input.classList.add('hidden');
    cancelBtn.classList.remove('hidden');
    confirmBtn.textContent = 'Confirm';

    const cleanup = (result) => {
      modal.classList.add('hidden');
      resolve(result);
    };

    confirmBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    closeBtn.onclick = () => cleanup(false);
    openModal('customDialogModal');
  });
}

function appPrompt(message, defaultValue = '', title = 'Input') {
  return new Promise((resolve) => {
    const modal = document.getElementById('customDialogModal');
    document.getElementById('customDialogTitle').textContent = title;
    document.getElementById('customDialogMessage').textContent = message;
    const input = document.getElementById('customDialogInput');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const closeBtn = document.getElementById('customDialogCloseBtn');

    input.value = defaultValue;
    input.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');
    confirmBtn.textContent = 'Save';

    const cleanup = (result) => {
      modal.classList.add('hidden');
      resolve(result);
    };

    confirmBtn.onclick = () => cleanup(input.value);
    cancelBtn.onclick = () => cleanup(null);
    closeBtn.onclick = () => cleanup(null);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); cleanup(input.value); }
    };

    openModal('customDialogModal');
    setTimeout(() => input.focus(), 50);
  });
}

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
  refreshIcons();
  setupTextareaAutoResize();

  document.getElementById('personaDesc')?.addEventListener('input', (e) => {
    document.getElementById('personaCharCount').textContent = `${e.target.value.length.toLocaleString()} chars`;
  });

  document.getElementById('messageInput')?.addEventListener('keydown', (e) => {
  const isMobileOrTouch = window.innerWidth <= 900 || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (e.key === 'Enter' && !e.shiftKey && !isMobileOrTouch) {
    e.preventDefault();
    sendMessage();
  }
  });

  document.getElementById('directionInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeDirectionAction();
    }
  });

  const charModalEl = document.getElementById('charModal');
  if (charModalEl) {
    charModalEl.addEventListener('input', () => {
      if (typeof saveCharDraftToLocal === 'function') saveCharDraftToLocal();
    });
    charModalEl.addEventListener('change', () => {
      if (typeof saveCharDraftToLocal === 'function') saveCharDraftToLocal();
    });
  }

  document.addEventListener('click', (e) => {
    const devicePop = document.getElementById('deviceMenuPopover');
    const deviceBtn = document.getElementById('btnDeviceMenu');
    if (devicePop && !devicePop.classList.contains('hidden') && !devicePop.contains(e.target) && !deviceBtn.contains(e.target)) {
      devicePop.classList.add('hidden');
    }

    const stylePop = document.getElementById('styleMenuPopover');
    const styleBtn = document.getElementById('btnStyleMenu');
    if (stylePop && !stylePop.classList.contains('hidden') && !stylePop.contains(e.target) && !styleBtn.contains(e.target)) {
      stylePop.classList.add('hidden');
    }
  });

  const savedUrl = localStorage.getItem('sb_url') || '';
  const savedKey = localStorage.getItem('sb_key') || '';
  document.getElementById('authSbUrl').value = savedUrl;
  document.getElementById('authSbKey').value = savedKey;

  if (savedUrl && savedKey) {
    supabaseClient = window.supabase.createClient(savedUrl, savedKey);
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      await onLoginSuccess(session.user);
    }
  }
});

// ==========================================
// AUTHENTICATION
// ==========================================
async function handleAuth(type) {
  const sbUrl = document.getElementById('authSbUrl').value.trim();
  const sbKey = document.getElementById('authSbKey').value.trim();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  errEl.classList.add('hidden');

  if (!sbUrl || !sbKey || !email || !password) {
    errEl.textContent = 'กรุณากรอกข้อมูลให้ครบทุกช่อง';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    localStorage.setItem('sb_url', sbUrl);
    localStorage.setItem('sb_key', sbKey);
    supabaseClient = window.supabase.createClient(sbUrl, sbKey);

    let result;
    if (type === 'signup') {
      result = await supabaseClient.auth.signUp({ email, password });
    } else {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
    }

    if (result.error) throw result.error;
    if (!result.data.user) throw new Error('กรุณาปิด Confirm Email ใน Supabase หรือยืนยันอีเมลก่อน');

    await onLoginSuccess(result.data.user);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function onLoginSuccess(user) {
  currentUser = user;
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
  refreshIcons();

  await loadUserProfile();
  renderStylePopover();
  await loadPersonas();
  await loadUserStickers();
  await loadCharacters();
  await loadAllRecentChats();
  if (deepseekApiKey) fetchDeepSeekBalance();
}

async function handleLogout() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  location.reload();
}

// ==========================================
// VIEW NAVIGATION & POPOVERS
// ==========================================
function switchMainView(viewName) {
  ['viewHub', 'viewChat'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('navHub').classList.remove('active');

  if (viewName === 'hub') {
    document.getElementById('viewHub').classList.remove('hidden');
    document.getElementById('navHub').classList.add('active');
    renderCharacterHub();
  } else if (viewName === 'chat') {
    document.getElementById('viewChat').classList.remove('hidden');
  }

  if (window.innerWidth <= 900) document.getElementById('sidebarLeft').classList.remove('open');
  refreshIcons();
}

function openLightbox(url) {
  if (!url) return;
  document.getElementById('lightboxImg').src = url;
  openModal('imageLightboxModal');
}

function toggleDeviceMenu() {
  closeStylePopover();
  const menu = document.getElementById('deviceMenuPopover');
  menu.classList.toggle('hidden');
  if (currentChar) {
    document.getElementById('menuCharPhoneLabel').textContent = `${currentChar.name}'s Phone`;
  }
  refreshIcons();
}

function toggleStylePopover() {
  document.getElementById('deviceMenuPopover')?.classList.add('hidden');
  const pop = document.getElementById('styleMenuPopover');
  pop.classList.toggle('hidden');
  renderStylePopover();
  refreshIcons();
}

function closeStylePopover() {
  document.getElementById('styleMenuPopover')?.classList.add('hidden');
}

function selectResponseStyle(styleId) {
  activeStyleId = styleId;
  renderStylePopover();
  closeStylePopover();
}

function renderStylePopover() {
  const listEl = document.getElementById('stylePopoverList');
  const badgeEl = document.getElementById('activeStyleBadgeText');
  if (!customStyles.some(s => s.id === activeStyleId)) {
    activeStyleId = customStyles[0]?.id || 'default';
  }
  const activeObj = customStyles.find(s => s.id === activeStyleId) || { name: 'Balanced' };
  if (badgeEl) {
    badgeEl.textContent = activeObj.name.split(' ')[0];
  }
  if (listEl) {
    listEl.innerHTML = customStyles.map(s => `
      <button class="popover-item ${s.id === activeStyleId ? 'active-style' : ''}" onclick="selectResponseStyle('${s.id}')">
        <i data-lucide="${s.id === activeStyleId ? 'check' : 'sparkles'}" class="icon-xs"></i>
        <span>${escapeHtml(s.name)}</span>
      </button>
    `).join('');
  }
}

// ==========================================
// API KEY, BALANCE & CUSTOM STYLES
// ==========================================
async function loadUserProfile() {
  const { data } = await supabaseClient
    .from('user_profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (data) {
    deepseekApiKey = data.deepseek_api_key || '';
    if (Array.isArray(data.response_styles) && data.response_styles.length > 0) {
      customStyles = data.response_styles;
    }
  } else {
    await supabaseClient.from('user_profiles').insert({
      id: currentUser.id,
      name: 'User',
      deepseek_api_key: '',
      response_styles: DEFAULT_RESPONSE_STYLES
    });
  }
}

function openSettingsModal() {
  document.getElementById('cfgDeepseekKey').value = deepseekApiKey;
  openModal('settingsModal');
}

async function saveSettings() {
  const dsKey = document.getElementById('cfgDeepseekKey').value.trim();
  if (!dsKey) return showToast('กรุณากรอก DeepSeek API Key');

  const { error } = await supabaseClient
    .from('user_profiles')
    .upsert({
      id: currentUser.id,
      deepseek_api_key: dsKey,
      updated_at: new Date().toISOString()
    });

  if (error) return showToast('บันทึกไม่สำเร็จ: ' + error.message);
  deepseekApiKey = dsKey;
  closeModal('settingsModal');
  showToast('บันทึก API Key เรียบร้อย');
  fetchDeepSeekBalance();
}

async function fetchDeepSeekBalance() {
  const amountEl = document.getElementById('dsBalanceDisplay');
  const statusEl = document.getElementById('dsBalanceStatus');
  if (!deepseekApiKey) {
    amountEl.textContent = 'No Key';
    statusEl.textContent = 'Set API Key first';
    return;
  }

  statusEl.textContent = 'Checking...';
  try {
    const res = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${deepseekApiKey}`, 'Accept': 'application/json' }
    });
    const data = await res.json();
    if (data.balance_infos && data.balance_infos.length > 0) {
      const info = data.balance_infos[0];
      amountEl.textContent = `$${parseFloat(info.total_balance).toFixed(2)} ${info.currency}`;
      statusEl.textContent = data.is_available ? 'Active & Available' : 'Balance Depleted';
    } else {
      throw new Error('Unable to read balance');
    }
  } catch (err) {
    amountEl.textContent = 'Error';
    statusEl.textContent = 'Check API Key';
  }
}

function openStyleManager() {
  renderStyleEditorList();
  openModal('styleManagerModal');
}

function renderStyleEditorList() {
  const container = document.getElementById('styleEditorList');
  container.innerHTML = customStyles.map((s, idx) => `
    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <input type="text" id="styleName_${idx}" value="${escapeHtml(s.name)}" placeholder="ชื่อรูปแบบ" />
        <button class="btn danger sm" onclick="removeStyleRow(${idx})" title="Remove">
          <i data-lucide="trash-2" class="icon-xs"></i>
        </button>
      </div>
      <textarea id="stylePrompt_${idx}" rows="2" placeholder="คำสั่งกำกับ AI">${escapeHtml(s.prompt)}</textarea>
    </div>
  `).join('');
  refreshIcons();
}

function addNewStyleRow() {
  syncStylesFromInputs();
  customStyles.push({ id: 'style_' + Date.now(), name: 'New Style', prompt: '' });
  renderStyleEditorList();
}

function removeStyleRow(idx) {
  if (customStyles.length <= 1) return showToast('ต้องเหลือไว้อย่างน้อย 1 รูปแบบ');
  syncStylesFromInputs();
  customStyles.splice(idx, 1);
  renderStyleEditorList();
}

async function resetDefaultStyles() {
  if (!(await appConfirm('รีเซ็ตตัวเลือกกลับเป็นค่าเริ่มต้นใช่ไหม?', 'Reset Styles'))) return;
  customStyles = [...DEFAULT_RESPONSE_STYLES];
  renderStyleEditorList();
}

function syncStylesFromInputs() {
  customStyles = customStyles.map((s, idx) => ({
    id: s.id,
    name: document.getElementById(`styleName_${idx}`)?.value.trim() || s.name,
    prompt: document.getElementById(`stylePrompt_${idx}`)?.value.trim() || ''
  }));
}

async function saveCustomStyles() {
  syncStylesFromInputs();
  const { error } = await supabaseClient
    .from('user_profiles')
    .upsert({
      id: currentUser.id,
      response_styles: customStyles,
      updated_at: new Date().toISOString()
    });

  if (error) return showToast('บันทึกไม่สำเร็จ: ' + error.message);
  renderStylePopover();
  closeModal('styleManagerModal');
  showToast('บันทึกรูปแบบการตอบเรียบร้อย');
}

// ==========================================
// SHARED UTILITIES
// ==========================================
function setLoading(isLoading) {
  document.getElementById('btnSend').disabled = isLoading;
  document.getElementById('btnContinue').disabled = isLoading;
  document.getElementById('btnTriggerPhoneReply').disabled = isLoading;
  document.getElementById('messageInput').disabled = isLoading;
  document.getElementById('headerStatus').textContent = isLoading ? 'Typing...' : 'Ready';
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) {
    alert('ไม่พบหน้าต่าง Modal ID: ' + id + ' ในไฟล์ index.html');
    return;
  }
  document.body.appendChild(el);
  el.classList.remove('hidden');
  refreshIcons();
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function toggleSidebar(side) {
  if (side === 'left') document.getElementById('sidebarLeft').classList.toggle('open');
  if (side === 'right') document.getElementById('sidebarRight').classList.toggle('open');
}

function setupTextareaAutoResize() {
  const tx = document.getElementById('messageInput');
  if (!tx) return;
  tx.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function sanitizeHtml(html) {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove());
  temp.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    });
  });
  return temp.innerHTML;
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[^a-zA-Z0-9ก-๙._-]/g, '_');
  a.click();
  URL.revokeObjectURL(url);
}