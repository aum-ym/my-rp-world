// --- STATE MANAGEMENT ---
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

// Unified Phone Mode State (รวม Texting + Call ในเซสชันเดียวกัน)
let isUnifiedPhoneMode = false;
let isCallSubMode = false;
let activeUnifiedSessionId = null;
let callTimerInterval = null;
let callSecondsElapsed = 0;
let expandedPhoneSessions = new Set();

// Editor buffers (NPCs & Locations)
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

// กระเป๋าเงิน User
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

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
  refreshIcons();
  setupTextareaAutoResize();

  document.getElementById('personaDesc').addEventListener('input', (e) => {
    document.getElementById('personaCharCount').textContent = `${e.target.value.length.toLocaleString()} chars`;
  });

  document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('directionInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeDirectionAction();
    }
  });

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

// --- AUTHENTICATION ---
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

// --- VIEW NAVIGATION & POPOVERS ---
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

// --- API KEY, BALANCE & CUSTOM STYLES ---
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
// CHARACTERS HUB & CRUD (6 TABS + LOCATIONS & NPCS)
// ==========================================
async function loadCharacters() {
  const { data, error } = await supabaseClient
    .from('characters')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error) {
    characters = data || [];
    renderCharacterHub();
  }
}

function renderCharacterHub() {
  const grid = document.getElementById('characterHubGrid');
  const query = (document.getElementById('hubSearchInput')?.value || '').toLowerCase();
  const filtered = characters.filter(c => c.name.toLowerCase().includes(query) || (c.personality || '').toLowerCase().includes(query));

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="hint">ยังไม่มีตัวละคร กดปุ่ม Create Character ทางซ้ายเพื่อสร้างตัวแรกได้เลย</div>';
    return;
  }

  grid.innerHTML = filtered.map(c => `
    <div class="hub-card">
      <div class="hub-card-top">
        <img src="${c.avatar_url || 'https://via.placeholder.com/48/1f1f24/71717a?text=' + encodeURIComponent(c.name[0])}" class="hub-card-avatar" />
        <div style="overflow:hidden; flex:1;">
          <div style="font-weight:600; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(c.name)}</div>
          <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(c.starting_balance || '$5,000.00')}</div>
        </div>
      </div>
      <div class="hub-card-desc">${escapeHtml(c.personality || c.scenario || 'No description provided.')}</div>
      <div class="btn-row">
        <button class="btn primary sm" style="flex:1;" onclick="startOrResumeCharacter('${c.id}')">
          <i data-lucide="message-square" class="icon-xs"></i> Chat
        </button>
        <button class="btn secondary sm" onclick="editCharacterById('${c.id}')" title="Configure">
          <i data-lucide="sliders" class="icon-xs"></i>
        </button>
      </div>
    </div>
  `).join('');
  refreshIcons();
}

function switchCharTab(tabName, btnEl) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`charTab_${tabName}`).classList.remove('hidden');
  btnEl.classList.add('active');
}

function editCharacterById(charId) {
  currentChar = characters.find(c => c.id === charId);
  openCharModal(true);
}

async function uploadCharacterAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    showToast('กำลังอัปโหลดรูปตัวละคร...');
    const url = await uploadImageToSupabase(file);
    document.getElementById('charAvatar').value = url;
    document.getElementById('charAvatarPreview').src = url;
    showToast('อัปโหลดรูปโปรไฟล์ตัวละครเรียบร้อย');
  } catch (err) {
    showToast('อัปโหลดไม่สำเร็จ: ' + err.message);
  }
}

function renderNpcEditorList() {
  const container = document.getElementById('npcEditorList');
  if (tempNpcList.length === 0) {
    container.innerHTML = '<div class="hint">ยังไม่มีตัวละครสมทบ กดปุ่มด้านล่างเพื่อเพิ่ม NPC ประจำเรื่อง</div>';
    return;
  }
  container.innerHTML = tempNpcList.map((npc, idx) => `
    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:10px;">
      <div style="display:flex; gap:8px; margin-bottom:6px;">
        <input type="text" id="npcName_${idx}" value="${escapeHtml(npc.name || '')}" placeholder="ชื่อ NPC (เช่น Min-ho, Mom)" />
        <input type="text" id="npcRole_${idx}" value="${escapeHtml(npc.role || '')}" placeholder="ความสัมพันธ์ (เช่น เพื่อนสนิท, แม่)" />
        <button class="btn danger sm" onclick="removeNpcRow(${idx})" title="Remove">
          <i data-lucide="trash-2" class="icon-xs"></i>
        </button>
      </div>
      <input type="text" id="npcTraits_${idx}" value="${escapeHtml(npc.traits || '')}" placeholder="นิสัยหรือจุดเด่นสั้นๆ..." />
    </div>
  `).join('');
  refreshIcons();
}

function syncNpcsFromInputs() {
  tempNpcList = tempNpcList.map((npc, idx) => ({
    name: document.getElementById(`npcName_${idx}`)?.value.trim() || '',
    role: document.getElementById(`npcRole_${idx}`)?.value.trim() || '',
    traits: document.getElementById(`npcTraits_${idx}`)?.value.trim() || ''
  })).filter(n => n.name);
}

function addNewNpcRow() {
  syncNpcsFromInputs();
  tempNpcList.push({ name: '', role: '', traits: '' });
  renderNpcEditorList();
}

function removeNpcRow(idx) {
  syncNpcsFromInputs();
  tempNpcList.splice(idx, 1);
  renderNpcEditorList();
}

function renderLocationEditorList() {
  const container = document.getElementById('locationEditorList');
  if (tempLocationList.length === 0) {
    container.innerHTML = '<div class="hint">ยังไม่มีสถานที่ในเรื่อง กดปุ่มด้านล่างเพื่อเพิ่มสถานที่และกฎข้อห้าม</div>';
    return;
  }
  container.innerHTML = tempLocationList.map((loc, idx) => `
    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:10px;">
      <div style="display:flex; gap:8px; margin-bottom:6px;">
        <input type="text" id="locName_${idx}" value="${escapeHtml(loc.name || '')}" placeholder="ชื่อสถานที่ (เช่น Shared Apartment, St. Jude Academy)" />
        <button class="btn danger sm" onclick="removeLocationRow(${idx})" title="Remove">
          <i data-lucide="trash-2" class="icon-xs"></i>
        </button>
      </div>
      <textarea id="locDetails_${idx}" rows="2" placeholder="รายละเอียดพื้นที่ & บรรยากาศ (เช่น ห้องอยู่ชั้น 4 มีระเบียงเชื่อมต่อกัน...)" style="margin-bottom:6px;">${escapeHtml(loc.details || '')}</textarea>
      <input type="text" id="locRules_${idx}" value="${escapeHtml(loc.rules || '')}" placeholder="กฎระเบียบ / ข้อห้ามของสถานที่นี้ (เช่น ห้ามพาคนนอกเข้าหลัง 22:00, ต้องสแกนบัตร)" />
    </div>
  `).join('');
  refreshIcons();
}

function syncLocationsFromInputs() {
  tempLocationList = tempLocationList.map((loc, idx) => ({
    name: document.getElementById(`locName_${idx}`)?.value.trim() || '',
    details: document.getElementById(`locDetails_${idx}`)?.value.trim() || '',
    rules: document.getElementById(`locRules_${idx}`)?.value.trim() || ''
  })).filter(l => l.name);
}

function addNewLocationRow() {
  syncLocationsFromInputs();
  tempLocationList.push({ name: '', details: '', rules: '' });
  renderLocationEditorList();
}

function removeLocationRow(idx) {
  syncLocationsFromInputs();
  tempLocationList.splice(idx, 1);
  renderLocationEditorList();
}

function openCharModal(isEdit = false) {
  switchCharTab('basic', document.querySelector('.tab-btn'));

  if (isEdit && currentChar) {
    document.getElementById('charModalTitle').textContent = `Configure — ${currentChar.name}`;
    document.getElementById('editCharId').value = currentChar.id;
    document.getElementById('charName').value = currentChar.name;
    document.getElementById('charAvatar').value = currentChar.avatar_url || '';
    document.getElementById('charAvatarPreview').src = currentChar.avatar_url || 'https://via.placeholder.com/56/1f1f24/71717a?text=' + encodeURIComponent(currentChar.name[0]);
    document.getElementById('charImportantDates').value = currentChar.important_dates || '';
    document.getElementById('charPersonality').value = currentChar.personality || '';
    document.getElementById('charScenario').value = currentChar.scenario || '';
    document.getElementById('charFirstMsg').value = currentChar.first_message || '';
    document.getElementById('charSystemPrompt').value = currentChar.system_prompt || '';
    document.getElementById('charExampleDialogue').value = currentChar.example_dialogue || '';
    document.getElementById('charJailbreak').value = currentChar.jailbreak || '';
    document.getElementById('charHtmlBio').value = currentChar.html_bio || '';
    document.getElementById('charPhonePasscode').value = currentChar.phone_passcode || '';
    document.getElementById('charStartingBalance').value = currentChar.starting_balance || '$5,000.00';
    document.getElementById('charPhoneHint').value = currentChar.phone_hint || '';
    tempNpcList = Array.isArray(currentChar.supporting_chars) ? JSON.parse(JSON.stringify(currentChar.supporting_chars)) : [];
    tempLocationList = Array.isArray(currentChar.locations) ? JSON.parse(JSON.stringify(currentChar.locations)) : [];
    document.getElementById('btnDeleteChar').classList.remove('hidden');
  } else {
    document.getElementById('charModalTitle').textContent = 'Create New Character';
    document.getElementById('editCharId').value = '';
    ['charName', 'charAvatar', 'charImportantDates', 'charPersonality', 'charScenario', 'charFirstMsg', 'charSystemPrompt', 'charExampleDialogue', 'charJailbreak', 'charHtmlBio', 'charPhonePasscode', 'charPhoneHint'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('charAvatarPreview').src = 'https://via.placeholder.com/56/1f1f24/71717a?text=C';
    document.getElementById('charStartingBalance').value = '$5,000.00';
    tempNpcList = [];
    tempLocationList = [];
    document.getElementById('btnDeleteChar').classList.add('hidden');
  }
  renderNpcEditorList();
  renderLocationEditorList();
  openModal('charModal');
}

async function saveCharacter() {
  const id = document.getElementById('editCharId').value;
  const rawPasscode = document.getElementById('charPhonePasscode').value.replace(/[^0-9]/g, '').slice(0, 4);
  syncNpcsFromInputs();
  syncLocationsFromInputs();

  const payload = {
    user_id: currentUser.id,
    name: document.getElementById('charName').value.trim(),
    avatar_url: document.getElementById('charAvatar').value.trim(),
    important_dates: document.getElementById('charImportantDates').value.trim(),
    personality: document.getElementById('charPersonality').value.trim(),
    scenario: document.getElementById('charScenario').value.trim(),
    first_message: document.getElementById('charFirstMsg').value.trim(),
    system_prompt: document.getElementById('charSystemPrompt').value.trim(),
    example_dialogue: document.getElementById('charExampleDialogue').value.trim(),
    jailbreak: document.getElementById('charJailbreak').value.trim(),
    html_bio: document.getElementById('charHtmlBio').value,
    phone_passcode: rawPasscode,
    starting_balance: document.getElementById('charStartingBalance').value.trim() || '$5,000.00',
    phone_hint: document.getElementById('charPhoneHint').value.trim(),
    supporting_chars: tempNpcList,
    locations: tempLocationList
  };

  if (!payload.name || !payload.first_message) {
    return showToast('ต้องกรอก Character Name และ First Message ในแท็บแรกก่อนนะ');
  }

  if (id) {
    const { data, error } = await supabaseClient.from('characters').update(payload).eq('id', id).select().single();
    if (error) return showToast(error.message);
    currentChar = data;
  } else {
    const { data, error } = await supabaseClient.from('characters').insert(payload).select().single();
    if (error) return showToast(error.message);
    currentChar = data;
  }

  closeModal('charModal');
  showToast('บันทึกข้อมูลตัวละคร สถานที่ และ NPC เรียบร้อย');
  await loadCharacters();
  await loadAllRecentChats();
  startOrResumeCharacter(currentChar.id);
}

async function deleteCharacter() {
  if (!currentChar || !(await appConfirm(`ลบ "${currentChar.name}" และห้องแชททั้งหมดทิ้งใช่ไหม?`, 'Delete Character'))) return;
  await supabaseClient.from('characters').delete().eq('id', currentChar.id);
  currentChar = null;
  currentChat = null;
  closeModal('charModal');
  showToast('ลบตัวละครเรียบร้อย');
  await loadCharacters();
  await loadAllRecentChats();
  switchMainView('hub');
}

function openBioModal() {
  if (!currentChar) return;
  document.getElementById('bioModalTitle').textContent = `${currentChar.name} — Profile Card`;
  const container = document.getElementById('bioRenderContainer');
  container.innerHTML = sanitizeHtml(currentChar.html_bio) || '<p class="hint">ยังไม่ได้ใส่โค้ด HTML Profile Card สำหรับตัวละครนี้</p>';
  openModal('bioModal');
}

// ==========================================
// LEFT SIDEBAR: RECENT CHATS & CHAT BRANCHING
// ==========================================
async function loadAllRecentChats() {
  const { data, error } = await supabaseClient
    .from('chats')
    .select('*, characters(id, name, avatar_url)')
    .order('updated_at', { ascending: false });

  if (!error) {
    allRecentChats = data || [];
    renderRecentChatsList();
  }
}

function renderRecentChatsList() {
  const container = document.getElementById('recentChatsList');
  if (allRecentChats.length === 0) {
    container.innerHTML = '<div class="hint">ยังไม่มีประวัติการแชท</div>';
    return;
  }

  container.innerHTML = allRecentChats.map(chat => {
    const char = chat.characters || { name: 'Unknown', avatar_url: '' };
    const isActive = currentChat && currentChat.id === chat.id;
    return `
      <div class="recent-chat-item ${isActive ? 'active' : ''}" onclick="openSpecificChat('${chat.id}')">
        <img src="${char.avatar_url || 'https://via.placeholder.com/34/1f1f24/71717a?text=' + encodeURIComponent(char.name[0])}" class="avatar-sm" />
        <div class="recent-chat-info">
          <div class="recent-chat-char">${escapeHtml(char.name)}</div>
          <div class="recent-chat-title">${escapeHtml(chat.title || 'Chat Session')}</div>
        </div>
        <button class="msg-action-btn" onclick="event.stopPropagation(); renameChatById('${chat.id}')" title="Rename">
          <i data-lucide="edit-3" class="icon-xs"></i>
        </button>
      </div>
    `;
  }).join('');
  refreshIcons();
}

async function startOrResumeCharacter(charId) {
  currentChar = characters.find(c => c.id === charId);
  if (!currentChar) return;

  const existing = allRecentChats.find(c => c.character_id === charId);
  if (existing) {
    await openSpecificChat(existing.id);
  } else {
    await createNewChatSession();
  }
}

async function createNewChatSession() {
  if (!currentChar) return;
  const count = allRecentChats.filter(c => c.character_id === currentChar.id).length + 1;
  const { data: newChat, error } = await supabaseClient.from('chats').insert({
    user_id: currentUser.id,
    character_id: currentChar.id,
    title: `Session #${count}`,
    persona_id: currentChat ? currentChat.persona_id : null,
    phone_data: {},
    phone_history: []
  }).select().single();

  if (error) return showToast(error.message);
  await loadAllRecentChats();
  await openSpecificChat(newChat.id);
}

async function branchChatFromMessage(upToMsgId = null) {
  if (!currentChat || !currentChar) return;
  const defaultTitle = `${currentChat.title} (Branch)`;
  const branchTitle = await appPrompt('ตั้งชื่อห้องแชท Branch ใหม่:', defaultTitle, 'Branch Chat Session');
  if (!branchTitle || !branchTitle.trim()) return;

  try {
    showToast('กำลังสร้าง Branch ห้องแชทใหม่...');
    let msgsToCopy = [...currentMessages];
    if (upToMsgId) {
      const cutIdx = msgsToCopy.findIndex(m => m.id === upToMsgId);
      if (cutIdx >= 0) msgsToCopy = msgsToCopy.slice(0, cutIdx + 1);
    }

    const { data: newChat, error } = await supabaseClient.from('chats').insert({
      user_id: currentUser.id,
      character_id: currentChar.id,
      title: branchTitle.trim(),
      persona_id: currentChat.persona_id || null,
      memory_notes: currentChat.memory_notes || '',
      phone_data: currentChat.phone_data || {},
      phone_history: currentChat.phone_history || []
    }).select().single();

    if (error) throw error;

    if (msgsToCopy.length > 0) {
      const nowBase = Date.now();
      const rows = msgsToCopy.map((m, i) => ({
        user_id: currentUser.id,
        chat_id: newChat.id,
        role: m.role,
        content: m.content,
        image_url: m.image_url || null,
        is_favorite: m.is_favorite || false,
        swipes: [m.content],
        swipe_index: 0,
        session_type: m.session_type || 'rp',
        session_group: m.session_group || null,
        created_at: new Date(nowBase + i * 100).toISOString()
      }));
      const { error: msgErr } = await supabaseClient.from('messages').insert(rows);
      if (msgErr) throw msgErr;
    }

    await loadAllRecentChats();
    await openSpecificChat(newChat.id);
    showToast(`สร้าง Branch "${branchTitle.trim()}" เรียบร้อย!`);
  } catch (err) {
    showToast('สร้าง Branch ไม่สำเร็จ: ' + err.message);
  }
}

async function openSpecificChat(chatId) {
  const { data: chat } = await supabaseClient.from('chats').select('*').eq('id', chatId).single();
  if (!chat) return;

  if (isUnifiedPhoneMode) toggleUnifiedPhoneMode(false);

  currentChat = chat;
  currentChar = characters.find(c => c.id === chat.character_id);
  if (!currentChar) return;

  document.getElementById('headerCharName').textContent = currentChar.name;
  document.getElementById('headerAvatar').src = currentChar.avatar_url || 'https://via.placeholder.com/34/1f1f24/71717a?text=' + encodeURIComponent(currentChar.name[0]);
  document.getElementById('btnNewChat').disabled = false;

  document.getElementById('rightEmptyHint').classList.add('hidden');
  document.getElementById('activeSessionControls').classList.remove('hidden');
  document.getElementById('rightCharName').textContent = currentChar.name;
  document.getElementById('rightCharBioPreview').textContent = currentChar.personality || currentChar.scenario || '';
  document.getElementById('memoryInput').value = currentChat.memory_notes || '';

  updateActivePersonaCard();
  renderRecentChatsList();
  switchMainView('chat');
  if (window.innerWidth <= 900) document.getElementById('sidebarRight').classList.remove('open');

  const { data: msgs } = await supabaseClient
    .from('messages')
    .select('*')
    .eq('chat_id', currentChat.id)
    .order('created_at', { ascending: true });

  if (!msgs || msgs.length === 0) {
    const { data: firstMsg } = await supabaseClient.from('messages').insert({
      user_id: currentUser.id,
      chat_id: currentChat.id,
      role: 'assistant',
      content: currentChar.first_message,
      swipes: [currentChar.first_message],
      swipe_index: 0,
      session_type: 'rp'
    }).select().single();
    currentMessages = [firstMsg];
  } else {
    currentMessages = msgs;
  }

  renderMessages(false, true);
}

async function renameChatById(chatId) {
  const chat = allRecentChats.find(c => c.id === chatId);
  if (!chat) return;
  const newTitle = await appPrompt('กรอกชื่อห้องแชทใหม่:', chat.title || '', 'Rename Chat Session');
  if (!newTitle || !newTitle.trim()) return;

  await supabaseClient.from('chats').update({ title: newTitle.trim() }).eq('id', chatId);
  showToast('เปลี่ยนชื่อห้องแชทแล้ว');
  await loadAllRecentChats();
}

async function deleteCurrentChat() {
  if (!currentChat || !(await appConfirm(`ลบห้องแชท "${currentChat.title}" ทิ้งใช่ไหม?`, 'Delete Chat'))) return;
  await supabaseClient.from('chats').delete().eq('id', currentChat.id);
  currentChat = null;
  document.getElementById('activeSessionControls').classList.add('hidden');
  document.getElementById('rightEmptyHint').classList.remove('hidden');
  showToast('ลบห้องแชทแล้ว');
  await loadAllRecentChats();
  switchMainView('hub');
}

// ==========================================
// PERSONA LIBRARY + USER'S SUPPORTING CAST
// ==========================================
async function loadPersonas() {
  const { data, error } = await supabaseClient
    .from('personas')
    .select('*')
    .order('created_at', { ascending: true });

  if (!error) {
    personas = data || [];
    updateActivePersonaCard();
  }
}

function getActivePersona() {
  if (currentChat && currentChat.persona_id) {
    const found = personas.find(p => p.id === currentChat.persona_id);
    if (found) return found;
  }
  return { id: '', name: 'Default User', avatar_url: '', description: '', supporting_chars: [] };
}

function updateActivePersonaCard() {
  const active = getActivePersona();
  document.getElementById('activePersonaName').textContent = active.name;
  document.getElementById('activePersonaSub').textContent = active.description ? active.description : 'Click to choose persona';
  document.getElementById('activePersonaAvatar').src = active.avatar_url || 'https://via.placeholder.com/38/1f1f24/71717a?text=' + encodeURIComponent(active.name[0]);
}

function openPersonaPickerModal() {
  const grid = document.getElementById('personaPickerGrid');
  const currentId = currentChat ? (currentChat.persona_id || '') : '';

  const defaultCard = `
    <div class="picker-card ${currentId === '' ? 'selected' : ''}" onclick="selectChatPersona('')">
      <img src="https://via.placeholder.com/64/1f1f24/71717a?text=U" class="picker-card-avatar" />
      <div style="font-weight:600; font-size:13.5px;">Default User</div>
      <div class="hint" style="font-size:11px;">ไม่ระบุโปรไฟล์พิเศษ</div>
    </div>
  `;

  const personaCards = personas.map(p => `
    <div class="picker-card ${currentId === p.id ? 'selected' : ''}" onclick="selectChatPersona('${p.id}')">
      <img src="${p.avatar_url || 'https://via.placeholder.com/64/1f1f24/71717a?text=' + encodeURIComponent(p.name[0])}" class="picker-card-avatar" />
      <div style="font-weight:600; font-size:13.5px;">${escapeHtml(p.name)}</div>
      <div class="hint" style="font-size:11px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
        ${escapeHtml(p.description || 'No description')}
      </div>
    </div>
  `).join('');

  grid.innerHTML = defaultCard + personaCards;
  openModal('personaPickerModal');
}

async function selectChatPersona(personaId) {
  if (!currentChat) return;
  const val = personaId || null;
  await supabaseClient.from('chats').update({ persona_id: val }).eq('id', currentChat.id);
  currentChat.persona_id = val;
  updateActivePersonaCard();
  closeModal('personaPickerModal');
  renderMessages(false, false);
  showToast('เปลี่ยน Persona ประจำห้องแล้ว');
}

function renderUserNpcEditorList() {
  const container = document.getElementById('userNpcEditorList');
  if (tempUserNpcList.length === 0) {
    container.innerHTML = '<div class="hint" style="font-size:11.5px;">ยังไม่มีตัวละครเสริมฝั่งเรา</div>';
    return;
  }
  container.innerHTML = tempUserNpcList.map((npc, idx) => `
    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:8px;">
      <div style="display:flex; gap:6px; margin-bottom:5px;">
        <input type="text" id="userNpcName_${idx}" value="${escapeHtml(npc.name || '')}" placeholder="ชื่อ (เช่น พี่ชาย, เพื่อนสนิท)" style="padding:6px 8px; font-size:12px;" />
        <input type="text" id="userNpcRole_${idx}" value="${escapeHtml(npc.role || '')}" placeholder="ความสัมพันธ์" style="padding:6px 8px; font-size:12px;" />
        <button class="btn danger sm" style="padding:4px 8px;" onclick="removeUserNpcRow(${idx})"><i data-lucide="trash-2" class="icon-xs"></i></button>
      </div>
      <input type="text" id="userNpcTraits_${idx}" value="${escapeHtml(npc.traits || '')}" placeholder="นิสัยหรือรายละเอียดสั้นๆ..." style="padding:6px 8px; font-size:12px;" />
    </div>
  `).join('');
  refreshIcons();
}

function syncUserNpcsFromInputs() {
  tempUserNpcList = tempUserNpcList.map((npc, idx) => ({
    name: document.getElementById(`userNpcName_${idx}`)?.value.trim() || '',
    role: document.getElementById(`userNpcRole_${idx}`)?.value.trim() || '',
    traits: document.getElementById(`userNpcTraits_${idx}`)?.value.trim() || ''
  })).filter(n => n.name);
}

function addNewUserNpcRow() {
  syncUserNpcsFromInputs();
  tempUserNpcList.push({ name: '', role: '', traits: '' });
  renderUserNpcEditorList();
}

function removeUserNpcRow(idx) {
  syncUserNpcsFromInputs();
  tempUserNpcList.splice(idx, 1);
  renderUserNpcEditorList();
}

function openPersonaManager() {
  renderPersonaLibraryList();
  if (personas.length > 0) editPersonaItem(personas[0].id);
  else resetPersonaForm();
  openModal('personaManagerModal');
}

function renderPersonaLibraryList() {
  const listEl = document.getElementById('personaLibraryList');
  const activeId = document.getElementById('editPersonaId').value;
  if (personas.length === 0) {
    listEl.innerHTML = '<div class="hint">ยังไม่มี Persona</div>';
    return;
  }
  listEl.innerHTML = personas.map(p => `
    <div class="persona-list-card ${activeId === p.id ? 'active' : ''}" onclick="editPersonaItem('${p.id}')">
      <img src="${p.avatar_url || 'https://via.placeholder.com/28/1f1f24/71717a?text=' + encodeURIComponent(p.name[0])}" class="avatar-sm" style="width:28px; height:28px;" />
      <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.name)}</span>
    </div>
  `).join('');
}

function resetPersonaForm() {
  document.getElementById('editPersonaId').value = '';
  document.getElementById('personaName').value = '';
  document.getElementById('personaAvatarUrl').value = '';
  document.getElementById('personaAvatarPreview').src = 'https://via.placeholder.com/56/1f1f24/71717a?text=U';
  document.getElementById('personaDesc').value = '';
  document.getElementById('personaCharCount').textContent = '0 chars';
  tempUserNpcList = [];
  renderUserNpcEditorList();
  document.getElementById('btnDeletePersona').classList.add('hidden');
  renderPersonaLibraryList();
}

function editPersonaItem(id) {
  const p = personas.find(item => item.id === id);
  if (!p) return;
  document.getElementById('editPersonaId').value = p.id;
  document.getElementById('personaName').value = p.name;
  document.getElementById('personaAvatarUrl').value = p.avatar_url || '';
  document.getElementById('personaAvatarPreview').src = p.avatar_url || 'https://via.placeholder.com/56/1f1f24/71717a?text=' + encodeURIComponent(p.name[0]);
  document.getElementById('personaDesc').value = p.description || '';
  document.getElementById('personaCharCount').textContent = `${(p.description || '').length.toLocaleString()} chars`;
  tempUserNpcList = Array.isArray(p.supporting_chars) ? JSON.parse(JSON.stringify(p.supporting_chars)) : [];
  renderUserNpcEditorList();
  document.getElementById('btnDeletePersona').classList.remove('hidden');
  renderPersonaLibraryList();
}

async function uploadPersonaAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    showToast('กำลังอัปโหลดรูปโปรไฟล์...');
    const url = await uploadImageToSupabase(file);
    document.getElementById('personaAvatarUrl').value = url;
    document.getElementById('personaAvatarPreview').src = url;
    showToast('อัปโหลดรูปโปรไฟล์เรียบร้อย');
  } catch (err) {
    showToast('อัปโหลดรูปไม่สำเร็จ: ' + err.message);
  }
}

async function savePersona() {
  const id = document.getElementById('editPersonaId').value;
  syncUserNpcsFromInputs();
  const payload = {
    user_id: currentUser.id,
    name: document.getElementById('personaName').value.trim(),
    avatar_url: document.getElementById('personaAvatarUrl').value.trim(),
    description: document.getElementById('personaDesc').value,
    supporting_chars: tempUserNpcList
  };
  if (!payload.name) return showToast('กรุณาใส่ชื่อ Persona');

  if (id) {
    const { error } = await supabaseClient.from('personas').update(payload).eq('id', id);
    if (error) return showToast(error.message);
  } else {
    const { data, error } = await supabaseClient.from('personas').insert(payload).select().single();
    if (error) return showToast(error.message);
    document.getElementById('editPersonaId').value = data.id;
  }

  await loadPersonas();
  renderPersonaLibraryList();
  if (currentMessages.length > 0) renderMessages(false, false);
  showToast('บันทึก Persona และตัวละครเสริมฝั่งเราเรียบร้อย');
}

async function deletePersona() {
  const id = document.getElementById('editPersonaId').value;
  if (!id || !(await appConfirm('ลบ Persona นี้ใช่ไหม?', 'Delete Persona'))) return;
  await supabaseClient.from('personas').delete().eq('id', id);
  await loadPersonas();
  resetPersonaForm();
  showToast('ลบ Persona เรียบร้อย');
}

// ==========================================
// UNIFIED PHONE MODE (TEXTING + VOICE CALL IN ONE SESSION)
// ==========================================
function toggleUnifiedPhoneMode(forceState = null) {
  isUnifiedPhoneMode = forceState !== null ? forceState : !isUnifiedPhoneMode;
  const banner = document.getElementById('unifiedPhoneBanner');
  const toggleBtn = document.getElementById('btnToggleUnifiedPhone');
  const continueBtn = document.getElementById('btnContinue');

  if (isUnifiedPhoneMode) {
    activeUnifiedSessionId = 'phone_' + Date.now();
    expandedPhoneSessions.add(activeUnifiedSessionId);
    isCallSubMode = false;
    banner.classList.remove('hidden');
    toggleBtn.classList.add('active-mode');
    continueBtn.classList.add('hidden');
    updateUnifiedPhoneBannerUI();
  } else {
    clearInterval(callTimerInterval);
    isCallSubMode = false;
    if (activeUnifiedSessionId) {
      expandedPhoneSessions.delete(activeUnifiedSessionId);
      activeUnifiedSessionId = null;
    }
    banner.classList.add('hidden');
    toggleBtn.classList.remove('active-mode');
    document.getElementById('btnTriggerPhoneReply').classList.add('hidden');
    continueBtn.classList.remove('hidden');
    document.getElementById('messageInput').placeholder = 'Type action (*text*), dialogue, or (OOC: ...)...';
  }
  renderMessages(false, isUnifiedPhoneMode);
  refreshIcons();
}

function toggleCallSubMode() {
  if (!isUnifiedPhoneMode) return;
  isCallSubMode = !isCallSubMode;

  if (isCallSubMode) {
    callSecondsElapsed = 0;
    clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
      callSecondsElapsed++;
      const m = String(Math.floor(callSecondsElapsed / 60)).padStart(2, '0');
      const s = String(callSecondsElapsed % 60).padStart(2, '0');
      const timerEl = document.getElementById('callTimerDisplay');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
    showToast(`กำลังโทรหา ${currentChar.name} (ต่อจากแชทเมื่อกี้)...`);
  } else {
    clearInterval(callTimerInterval);
    showToast('วางสายแล้ว — กลับมาพิมพ์แชทต่อได้เลย');
  }
  updateUnifiedPhoneBannerUI();
  refreshIcons();
}

function updateUnifiedPhoneBannerUI() {
  const banner = document.getElementById('unifiedPhoneBanner');
  const statusText = document.getElementById('unifiedPhoneStatusText');
  const subBtn = document.getElementById('btnSwitchCallSubMode');
  const askReplyBtn = document.getElementById('btnTriggerPhoneReply');
  const inputEl = document.getElementById('messageInput');

  if (isCallSubMode) {
    banner.classList.add('calling-active');
    statusText.innerHTML = `<span class="call-live-dot"></span> <b>On Call</b> • <span id="callTimerDisplay" style="font-family:monospace; font-weight:700;">00:00</span>`;
    subBtn.className = 'btn danger sm';
    subBtn.innerHTML = `<i data-lucide="phone-off" class="icon-xs"></i> <span>Hang Up</span>`;
    askReplyBtn.classList.add('hidden');
    inputEl.placeholder = 'พูดคุยผ่านสายโทรศัพท์ (กด Send เพื่อพูดโต้ตอบสด)...';
  } else {
    banner.classList.remove('calling-active');
    statusText.innerHTML = `<i data-lucide="smartphone" class="icon-xs" style="color:var(--accent);"></i> <span><b>Phone Texting</b> — พิมพ์รัวๆ แล้วกด <b>Reply</b></span>`;
    subBtn.className = 'btn secondary sm';
    subBtn.innerHTML = `<i data-lucide="phone" class="icon-xs" style="color:#34d399;"></i> <span>Call</span>`;
    askReplyBtn.classList.remove('hidden');
    inputEl.placeholder = 'พิมพ์แชท หรือ *บรรยาย* แล้วกด Reply เมื่อพิมพ์เสร็จ...';
  }
}

// เปิด/ปิดการ์ดประวัติแชทโทรศัพท์ โดยไม่เลื่อนจอหนีลงล่างสุด (autoScroll = false)
function togglePhoneSessionCard(sessionId) {
  if (expandedPhoneSessions.has(sessionId)) {
    expandedPhoneSessions.delete(sessionId);
  } else {
    expandedPhoneSessions.add(sessionId);
  }
  renderMessages(false, false);
}

async function triggerPhoneChatBotReply() {
  if (!isUnifiedPhoneMode || isCallSubMode || !deepseekApiKey) return showToast('กรุณาใส่ DeepSeek API Key ก่อน');
  setLoading(true);
  renderMessages(true, true);

  try {
    const phoneRule = `[HYBRID SMARTPHONE TEXTING MODE ACTIVE — OVERRIDE LONG NARRATION FORMAT]
You are texting ${getActivePersona().name} via smartphone messaging app (NOT face-to-face).
- IGNORE any character formatting rules that ask for long paragraphs or date/location headers!
- Break your reply into 2 to 4 very short text bubbles separated strictly by |||.
- You can naturally use emojis (e.g., 🙄, 💀, 🖤, 🫠, 👍) when it fits your character's texting style.
- Each part can EITHER be a short casual text message OR a 1-sentence physical action wrapped in *asterisks* (e.g., *He glances down at his phone screen.* ||| wait what ||| are you serious right now? 💀 ||| [STICKER: Shock]).`;

    const rawBotText = await requestDeepSeekCompletion(currentMessages, phoneRule);
    const cleanBotText = stripLegacyHudTag(rawBotText);
    processBotTransferToUser(cleanBotText);

    const bubbles = cleanBotText.split('|||').map(b => b.trim()).filter(Boolean);
    for (let i = 0; i < bubbles.length; i++) {
      const part = bubbles[i];
      const { data: botMsg } = await supabaseClient.from('messages').insert({
        user_id: currentUser.id,
        chat_id: currentChat.id,
        role: 'assistant',
        content: part,
        swipes: [part],
        swipe_index: 0,
        session_type: 'phone_chat',
        session_group: activeUnifiedSessionId
      }).select().single();

      currentMessages.push(botMsg);
      renderMessages(i < bubbles.length - 1, true);
      if (i < bubbles.length - 1) {
        await new Promise(r => setTimeout(r, 550));
      }
    }

    await supabaseClient.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', currentChat.id);
    loadAllRecentChats();
    fetchDeepSeekBalance();
  } catch (err) {
    renderMessages(false, false);
    showToast('Reply failed: ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ==========================================
// PHOTO ALBUM & CHAT-SPECIFIC FAVORITES
// ==========================================
function updateRightSidebarCounts() {
  const photoCount = currentMessages.filter(m => m.image_url).length;
  const favCount = currentMessages.filter(m => m.is_favorite).length;
  document.getElementById('albumCountBadge').textContent = photoCount;
  document.getElementById('favCountBadge').textContent = favCount;
}

function openPhotoAlbumModal() {
  const container = document.getElementById('albumGridContainer');
  const photoMsgs = currentMessages.filter(m => m.image_url);

  if (photoMsgs.length === 0) {
    container.innerHTML = '<div class="hint">ยังไม่มีรูปภาพที่ส่งในห้องแชทนี้</div>';
  } else {
    container.innerHTML = photoMsgs.map(m => `
      <div class="album-item">
        <img src="${m.image_url}" onclick="openLightbox('${m.image_url}')" title="Click to enlarge" />
        <button class="album-delete-btn" onclick="deletePhotoFromAlbum('${m.id}', '${m.image_url}')" title="Delete Photo">
          <i data-lucide="trash-2" class="icon-xs"></i>
        </button>
      </div>
    `).join('');
  }
  openModal('albumModal');
}

async function deletePhotoFromAlbum(msgId, imageUrl) {
  if (!(await appConfirm('ลบรูปภาพนี้ออกจากอัลบั้มและแชทใช่ไหม?', 'Delete Photo'))) return;
  const pathParts = imageUrl.split('/rp-images/');
  if (pathParts[1]) {
    await supabaseClient.storage.from('rp-images').remove([decodeURIComponent(pathParts[1])]);
  }
  await supabaseClient.from('messages').update({ image_url: null }).eq('id', msgId);
  const msg = currentMessages.find(m => m.id === msgId);
  if (msg) msg.image_url = null;

  showToast('ลบรูปภาพเรียบร้อย');
  openPhotoAlbumModal();
  renderMessages(false, false);
}

function openChatFavoritesModal() {
  const container = document.getElementById('chatFavoritesList');
  const favMsgs = currentMessages.filter(m => m.is_favorite);
  const activePersona = getActivePersona();

  if (favMsgs.length === 0) {
    container.innerHTML = '<div class="hint">ยังไม่มีข้อความโปรดในห้องแชทนี้</div>';
  } else {
    container.innerHTML = favMsgs.map(m => {
      const sender = m.role === 'user' ? activePersona.name : currentChar.name;
      return `
        <div class="fav-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:13px; color:var(--accent);">${escapeHtml(sender)}</strong>
            <button class="msg-action-btn favorited" onclick="toggleFavoriteMessage('${m.id}'); openChatFavoritesModal();">
              <i data-lucide="heart-off" class="icon-xs"></i> Remove
            </button>
          </div>
          <div class="msg-bubble" style="padding:0; background:transparent;">${formatRichContent(m.content, sender)}</div>
        </div>
      `;
    }).join('');
  }
  openModal('chatFavoritesModal');
}

// ==========================================
// EXPORT STORY (.MD) & BACKUP CHARACTER (.JSON)
// ==========================================
function exportChatAsMarkdown() {
  if (!currentChat || !currentChar) return;
  const activePersona = getActivePersona();
  let md = `# ${currentChar.name} & ${activePersona.name} — ${currentChat.title}\n\n`;
  if (currentChat.memory_notes) {
    md += `> **Pinned Memory:**\n> ${currentChat.memory_notes.replace(/\n/g, '\n> ')}\n\n---\n\n`;
  }

  currentMessages.forEach(m => {
    const cleanText = stripOocText(m.content);
    if (!cleanText) return;
    const speaker = m.role === 'user' ? activePersona.name : currentChar.name;
    const tag = m.session_type === 'phone_chat' ? ' `[Phone Text]`' : (m.session_type === 'phone_call' ? ' `[Phone Call]`' : '');
    md += `### ${speaker}${tag}\n${cleanText}\n\n`;
  });

  downloadTextFile(`${currentChar.name}_${currentChat.title}.md`, md, 'text/markdown');
  showToast('ดาวน์โหลดไฟล์นิยาย (.md) เรียบร้อย');
}

function backupCharacterJson() {
  if (!currentChar) return;
  const backupData = {
    exported_at: new Date().toISOString(),
    character: currentChar,
    chat_session: currentChat,
    messages: currentMessages
  };
  downloadTextFile(`${currentChar.name}_${currentChat ? currentChat.title : 'backup'}.json`, JSON.stringify(backupData, null, 2), 'application/json');
  showToast('สำรองข้อมูลตัวละคร (.json) เรียบร้อย');
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

// ==========================================
// MY PHONE (USER PHONE: WALLET, STICKERS & SYNCED CHAT HISTORY)
// ==========================================
async function loadUserStickers() {
  const { data, error } = await supabaseClient
    .from('user_stickers')
    .select('*')
    .order('created_at', { ascending: false });
  if (!error) userStickers = data || [];
}

function formatWalletString() {
  return `${userCurrency}${userWalletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function openUserPhoneModal() {
  if (!currentChar) return;
  const activePersona = getActivePersona();
  document.getElementById('userPhoneOwnerLabel').textContent = `${activePersona.name}'s Phone`;
  document.getElementById('userPhoneClock').textContent = new Date().toTimeString().slice(0, 5);
  renderUserPhoneHome();
  openModal('userPhoneModal');
}

function renderUserPhoneHome() {
  document.getElementById('userPhoneNavBar').classList.add('hidden');
  const screen = document.getElementById('userPhoneScreen');
  screen.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; justify-content:space-between;">
      <div>
        <div class="bank-card">
          <div style="font-size: 10px; color: var(--accent); font-weight:700; letter-spacing:0.06em; margin-bottom: 4px;">MY WALLET BALANCE</div>
          <div style="font-size: 20px; font-weight:700; color: #34d399;">${escapeHtml(formatWalletString())}</div>
        </div>

        <div class="app-grid-9" style="grid-template-columns: repeat(3, 1fr); gap:14px;">
          <button class="app-icon-btn" onclick="openUserPhoneApp('messages')">
            <div class="app-icon-box" style="background:#3b82f6;"><i data-lucide="message-circle"></i></div>
            <span class="app-icon-label">Messages</span>
          </button>

          <button class="app-icon-btn" onclick="openUserPhoneApp('wallet')">
            <div class="app-icon-box" style="background:#10b981;"><i data-lucide="send"></i></div>
            <span class="app-icon-label">Transfer</span>
          </button>

          <button class="app-icon-btn" onclick="openUserPhoneApp('stickers')">
            <div class="app-icon-box" style="background:#8b5cf6;"><i data-lucide="smile"></i></div>
            <span class="app-icon-label">Stickers</span>
          </button>
        </div>
      </div>
      <p class="hint" style="text-align:center;">แชทมือถือทั้งหมดจะซิงค์เข้ามาในแอป Messages ของเครื่องนี้ด้วย</p>
    </div>
  `;
  refreshIcons();
}

function openUserPhoneApp(appName) {
  const nav = document.getElementById('userPhoneNavBar');
  const title = document.getElementById('userPhoneAppTitle');
  const screen = document.getElementById('userPhoneScreen');
  nav.classList.remove('hidden');

  if (appName === 'messages') {
    title.textContent = `Chat with ${currentChar.name}`;
    const phoneMsgs = currentMessages.filter(m => m.session_type === 'phone_chat');
    if (phoneMsgs.length === 0) {
      screen.innerHTML = '<p class="hint">ยังไม่มีประวัติแชทมือถือกับตัวละครนี้ (กดเปิดโหมด Phone Mode ด้านบนเพื่อเริ่มแชท)</p>';
    } else {
      const bubbles = phoneMsgs.map(m => {
        const isNarration = /^\*[^*]+\*$/.test(m.content.trim());
        if (isNarration) {
          return `<div class="hybrid-narration-line">${escapeHtml(m.content.replace(/^\*|\*$/g, ''))}</div>`;
        }
        return `
          <div class="phone-chat-bubble ${m.role === 'user' ? 'outgoing' : 'incoming'}">
            ${formatRichContent(m.content, m.role === 'user' ? getActivePersona().name : currentChar.name)}
          </div>
        `;
      }).join('');
      screen.innerHTML = `<div style="display:flex; flex-direction:column;">${bubbles}</div>`;
    }
  } else if (appName === 'wallet') {
    title.textContent = 'Wallet & Currency';
    screen.innerHTML = `
      <div class="bank-card">
        <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.06em;">AVAILABLE BALANCE</div>
        <div style="font-size:22px; font-weight:700; color:#34d399; margin:4px 0 10px;">${escapeHtml(formatWalletString())}</div>

        <label style="font-size:11px;">สกุลเงิน & ยอดเงินคงเหลือ</label>
        <div style="display:flex; gap:6px; margin-top:4px;">
          <input type="text" id="editUserCurrencyInput" value="${escapeHtml(userCurrency)}" placeholder="$, ฿, ₩" style="width:65px; padding:6px 8px; font-size:12px; text-align:center;" />
          <input type="number" id="editUserBalanceInput" value="${userWalletBalance}" placeholder="ยอดเงิน..." style="padding:6px 8px; font-size:12px;" />
          <button class="btn secondary sm" onclick="updateUserWalletSettings()">Save</button>
        </div>
      </div>

      <div class="field-group">
        <label>โอนเงินให้ ${escapeHtml(currentChar.name)} (${escapeHtml(userCurrency)})</label>
        <input type="number" id="transferAmountInput" placeholder="ระบุจำนวนตัวเลข (เช่น 500)" />
      </div>
      <div class="field-group">
        <label>ข้อความแนบสลิป (Note)</label>
        <input type="text" id="transferNoteInput" placeholder="เช่น ค่าขนม, จ่ายค่าเสียหาย..." />
      </div>
      <button class="btn primary full" onclick="sendTransferToBot()">
        <i data-lucide="arrow-up-right" class="icon-xs"></i> โอนเงินเข้าแชททันที
      </button>
    `;
  } else if (appName === 'stickers') {
    title.textContent = 'Stickers (Tag System)';
    const customHtml = userStickers.map(s => `
      <div class="sticker-tile" onclick="sendStickerTagToChat('${escapeHtml(s.label)}')">
        <img src="${s.image_url}" />
        <span>${escapeHtml(s.label)}</span>
        <button class="album-delete-btn" style="padding:2px 4px;" onclick="event.stopPropagation(); deleteUserSticker('${s.id}')" title="Delete">
          <i data-lucide="x" style="width:10px; height:10px;"></i>
        </button>
      </div>
    `).join('');

    const builtinHtml = BUILTIN_STICKERS.map(s => `
      <div class="sticker-tile" onclick="sendStickerTagToChat('${escapeHtml(s.label)}')">
        <img src="${s.url}" />
        <span>${escapeHtml(s.label)}</span>
      </div>
    `).join('');

    screen.innerHTML = `
      <div style="margin-bottom:12px;">
        <input type="file" id="newStickerFile" accept="image/*" hidden onchange="uploadNewSticker(event)" />
        <button class="btn secondary full sm" onclick="document.getElementById('newStickerFile').click()">
          <i data-lucide="plus" class="icon-xs"></i> อัปโหลดสติกเกอร์ของฉัน
        </button>
      </div>

      ${userStickers.length > 0 ? `<div class="section-label" style="margin-bottom:6px;">MY UPLOADED STICKERS</div><div class="sticker-grid" style="margin-bottom:14px;">${customHtml}</div>` : ''}
      <div class="section-label" style="margin-bottom:6px;">MINIMAL PRESETS</div>
      <div class="sticker-grid">${builtinHtml}</div>
    `;
  }
  refreshIcons();
}

function updateUserWalletSettings() {
  const newCurr = document.getElementById('editUserCurrencyInput').value.trim() || '$';
  const newBal = parseFloat(document.getElementById('editUserBalanceInput').value);
  if (isNaN(newBal) || newBal < 0) return showToast('กรุณาใส่ตัวเลขยอดเงินที่ถูกต้อง');

  userCurrency = newCurr;
  userWalletBalance = newBal;
  localStorage.setItem('user_wallet_currency', userCurrency);
  localStorage.setItem('user_wallet_balance', String(userWalletBalance));
  showToast('อัปเดตสกุลเงินและยอดเงินแล้ว');
  openUserPhoneApp('wallet');
}

async function sendTransferToBot() {
  const numVal = parseFloat(document.getElementById('transferAmountInput').value);
  const noteStr = document.getElementById('transferNoteInput').value.trim() || 'Transfer';
  if (isNaN(numVal) || numVal <= 0) return showToast('กรุณากรอกจำนวนเงินที่ต้องการโอน');

  if (userWalletBalance >= numVal) {
    userWalletBalance -= numVal;
    localStorage.setItem('user_wallet_balance', String(userWalletBalance));
  }

  const formattedAmt = `${userCurrency}${numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  closeModal('userPhoneModal');
  await sendRawUserAction(`[USER_TRANSFER: ${formattedAmt} | ${noteStr}]`);
}

async function uploadNewSticker(event) {
  const file = event.target.files[0];
  if (!file) return;
  const defaultName = file.name.split('.')[0].replace(/[^a-zA-Z0-9ก-๙_-]/g, '');
  const label = await appPrompt('ตั้งชื่อ Tag สติกเกอร์ (เช่น Hug, Cry, Love):', defaultName || 'Sticker', 'New Sticker Tag');
  if (!label || !label.trim()) return;

  try {
    const url = await uploadImageToSupabase(file);
    await supabaseClient.from('user_stickers').insert({
      user_id: currentUser.id,
      label: label.trim(),
      image_url: url
    });
    await loadUserStickers();
    showToast(`เพิ่มสติกเกอร์ [STICKER: ${label.trim()}] แล้ว`);
    openUserPhoneApp('stickers');
  } catch (err) {
    showToast('อัปโหลดสติกเกอร์ไม่สำเร็จ: ' + err.message);
  }
}

async function deleteUserSticker(id) {
  if (!(await appConfirm('ลบสติกเกอร์นี้ใช่ไหม?', 'Delete Sticker'))) return;
  await supabaseClient.from('user_stickers').delete().eq('id', id);
  await loadUserStickers();
  showToast('ลบสติกเกอร์แล้ว');
  openUserPhoneApp('stickers');
}

async function sendStickerTagToChat(label) {
  closeModal('userPhoneModal');
  await sendRawUserAction(`[STICKER: ${label}]`);
}

// ลบร่างข้อความรีเจน (Swipes) เก่าที่ไม่ได้เลือกทิ้งทันทีเมื่อ User พิมพ์ตอบกลับไปแล้ว
async function prunePreviousBotSwipes() {
  const lastMsg = currentMessages[currentMessages.length - 1];
  if (lastMsg && lastMsg.role === 'assistant' && Array.isArray(lastMsg.swipes) && lastMsg.swipes.length > 1) {
    const chosenText = lastMsg.content;
    lastMsg.swipes = [chosenText];
    lastMsg.swipe_index = 0;
    await supabaseClient
      .from('messages')
      .update({ swipes: [chosenText], swipe_index: 0 })
      .eq('id', lastMsg.id);
  }
}

async function sendRawUserAction(specialContent) {
  if (!deepseekApiKey) return showToast('กรุณาใส่ DeepSeek API Key ก่อน');
  await prunePreviousBotSwipes();

  if (isUnifiedPhoneMode && !isCallSubMode) {
    const { data: userMsg, error } = await supabaseClient.from('messages').insert({
      user_id: currentUser.id,
      chat_id: currentChat.id,
      role: 'user',
      content: specialContent,
      session_type: 'phone_chat',
      session_group: activeUnifiedSessionId
    }).select().single();

    if (error) return showToast(error.message);
    currentMessages.push(userMsg);
    renderMessages(false, true);
    return;
  }

  setLoading(true);
  try {
    const { data: userMsg, error } = await supabaseClient.from('messages').insert({
      user_id: currentUser.id,
      chat_id: currentChat.id,
      role: 'user',
      content: specialContent,
      session_type: 'rp'
    }).select().single();

    if (error) throw error;
    currentMessages.push(userMsg);
    renderMessages(true, true);

    const rawBotText = await requestDeepSeekCompletion(currentMessages);
    const botText = stripLegacyHudTag(rawBotText);
    processBotTransferToUser(botText);

    const { data: botMsg } = await supabaseClient.from('messages').insert({
      user_id: currentUser.id,
      chat_id: currentChat.id,
      role: 'assistant',
      content: botText,
      swipes: [botText],
      swipe_index: 0,
      session_type: 'rp'
    }).select().single();

    await supabaseClient.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', currentChat.id);
    currentMessages.push(botMsg);
    renderMessages(false, true);
    loadAllRecentChats();
    fetchDeepSeekBalance();
  } catch (err) {
    renderMessages(false, false);
    showToast('Error: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function processBotTransferToUser(botText) {
  const match = botText.match(/\[BOT_TRANSFER:\s*([^|\]]+)\|\s*([^\]]+)\]/i);
  if (match) {
    const numVal = parseFloat(match[1].replace(/[^0-9.]/g, ''));
    if (!isNaN(numVal)) {
      userWalletBalance += numVal;
      localStorage.setItem('user_wallet_balance', String(userWalletBalance));
      showToast(`ได้รับเงินโอน ${match[1].trim()} เข้ากระเป๋าแล้ว!`);
    }
  }
}

// ==========================================
// OOC PARSER & STRIPPER
// ==========================================
function parseOocFromInput(rawText) {
  const oocNotes = [];
  let cleanRoleplay = rawText
    .replace(/\(\(\s*([\s\S]*?)\s*\)\)/g, (_, inner) => {
      oocNotes.push(inner.trim());
      return '';
    })
    .replace(/\(\s*OOC\s*:?\s*([\s\S]*?)\s*\)/gi, (_, inner) => {
      oocNotes.push(inner.trim());
      return '';
    })
    .replace(/\[\s*OOC\s*:?\s*([\s\S]*?)\s*\]/gi, (_, inner) => {
      oocNotes.push(inner.trim());
      return '';
    })
    .trim();

  return {
    oocDirective: oocNotes.join(' | '),
    cleanRoleplay
  };
}

function stripOocText(text) {
  if (!text) return '';
  return text
    .replace(/\(\(\s*[\s\S]*?\s*\)\)/g, '')
    .replace(/\(\s*OOC\s*:?\s*[\s\S]*?\s*\)/gi, '')
    .replace(/\[\s*OOC\s*:?\s*[\s\S]*?\s*\]/gi, '')
    .trim();
}

function stripLegacyHudTag(text) {
  if (!text) return '';
  return text.replace(/\[HUD:[^\]]+\]/gi, '').trim();
}

// ==========================================
// CHAT RENDERING (PRESERVES SCROLL ON EXPAND/EDIT/SWIPE)
// ==========================================
function resolveStickerUrl(label) {
  const cleanLabel = label.trim().toLowerCase();
  const custom = userStickers.find(s => s.label.toLowerCase() === cleanLabel);
  if (custom) return custom.image_url;
  const builtin = BUILTIN_STICKERS.find(s => s.label.toLowerCase() === cleanLabel);
  if (builtin) return builtin.url;
  return null;
}

function renderMessages(isTyping = false, autoScroll = true) {
  updateRightSidebarCounts();
  const container = document.getElementById('chatMessages');
  const prevScrollTop = container.scrollTop;

  const activePersona = getActivePersona();
  const userAvatar = activePersona.avatar_url || 'https://via.placeholder.com/24/1f1f24/71717a?text=' + encodeURIComponent(activePersona.name[0]);
  const charAvatar = currentChar.avatar_url || 'https://via.placeholder.com/24/1f1f24/71717a?text=' + encodeURIComponent(currentChar.name[0]);

  const blocks = [];
  currentMessages.forEach((m, idx) => {
    if (m.session_type === 'phone_chat' || m.session_type === 'phone_call') {
      const groupKey = m.session_group || 'legacy_phone';
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === 'session_group' && lastBlock.groupKey === groupKey) {
        lastBlock.items.push(m);
      } else {
        blocks.push({ type: 'session_group', groupKey, items: [m] });
      }
    } else {
      blocks.push({ type: 'rp_msg', msg: m, isLastBotMsg: m.role === 'assistant' && idx === currentMessages.length - 1 });
    }
  });

  let html = blocks.map(block => {
    if (block.type === 'session_group') {
      const isExpanded = expandedPhoneSessions.has(block.groupKey) || block.groupKey === activeUnifiedSessionId;
      const lastItem = block.items[block.items.length - 1];
      const previewSender = lastItem.role === 'user' ? activePersona.name : currentChar.name;
      const previewText = stripOocText(lastItem.content).replace(/\[[^\]]+\]/g, '[Attachment/Sticker]');
      const hasCalls = block.items.some(i => i.session_type === 'phone_call');

      let prevType = null;
      const threadHtml = isExpanded ? `
        <div class="phone-session-thread">
          ${block.items.map(sm => {
            const sName = sm.role === 'user' ? activePersona.name : currentChar.name;
            let dividerHtml = '';
            if (sm.session_type === 'phone_call' && prevType !== 'phone_call') {
              dividerHtml = `<div class="call-divider-pill"><i data-lucide="phone-call" class="icon-xs"></i> Voice Call Started</div>`;
            } else if (sm.session_type === 'phone_chat' && prevType === 'phone_call') {
              dividerHtml = `<div class="call-divider-pill" style="border-color:var(--border-light); color:var(--text-muted); background:transparent;"><i data-lucide="phone-off" class="icon-xs"></i> Call Ended • Back to Texting</div>`;
            }
            prevType = sm.session_type;

            const isPureNarration = /^\*[^*]+\*$/.test(sm.content.trim());
            if (isPureNarration) {
              return dividerHtml + `<div class="hybrid-narration-line">${escapeHtml(sm.content.replace(/^\*|\*$/g, ''))}</div>`;
            }
            const isPureSticker = /^\[(USER_)?STICKER:[^\]]+\]$/i.test(sm.content.trim());
            const isVoice = sm.session_type === 'phone_call';
            return dividerHtml + `
              <div class="sms-row ${sm.role}">
                <div style="font-size:10px; color:var(--text-muted); margin-bottom:2px;">${escapeHtml(sName)} ${isVoice ? '(On Call)' : ''}</div>
                <div class="sms-bubble ${isVoice ? 'voice-call-bubble' : ''}" ${isPureSticker ? 'style="background:transparent; border:none; padding:0;"' : ''}>
                  ${sm.image_url ? `<img src="${sm.image_url}" class="msg-image" onclick="openLightbox('${sm.image_url}')" />` : ''}
                  ${formatRichContent(sm.content, sName)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : '';

      const cardTitle = hasCalls
        ? `Phone Session (Texts & Call) with ${escapeHtml(currentChar.name)}`
        : `Phone Chat with ${escapeHtml(currentChar.name)}`;

      return `
        <div class="phone-session-card">
          <div class="phone-session-header" onclick="togglePhoneSessionCard('${block.groupKey}')">
            <div style="display:flex; align-items:center; gap:8px;">
              <i data-lucide="smartphone" class="icon-sm" style="color:var(--accent);"></i>
              <span style="font-weight:600; font-size:13px;">${cardTitle}</span>
              <span class="badge">${block.items.length} entries</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <button class="msg-action-btn" onclick="event.stopPropagation(); deleteMessage('${block.items[0].id}')" title="Delete this phone session and everything after">
                <i data-lucide="trash-2" class="icon-xs"></i>
              </button>
              <span style="font-size:11.5px; color:var(--accent); font-weight:500;">
                ${isExpanded ? 'Collapse ▲' : 'Expand ▼'}
              </span>
            </div>
          </div>
          ${!isExpanded ? `<div class="phone-session-preview"><b>${escapeHtml(previewSender)}:</b> ${escapeHtml(previewText)}</div>` : ''}
          ${threadHtml}
        </div>
      `;
    }

    const m = block.msg;
    const isUser = m.role === 'user';
    const senderName = isUser ? activePersona.name : currentChar.name;
    const avatarSrc = isUser ? userAvatar : charAvatar;

    let oocBadgeHtml = '';
    let displayContent = m.content;
    if (isUser) {
      const parsedOoc = parseOocFromInput(m.content);
      if (parsedOoc.oocDirective) {
        oocBadgeHtml = `<div class="ooc-directive-pill" ${!parsedOoc.cleanRoleplay ? 'style="margin-bottom:0;"' : ''}>🎬 OOC: ${escapeHtml(parsedOoc.oocDirective)}</div>`;
        displayContent = parsedOoc.cleanRoleplay;
      }
    }

    const formattedText = formatRichContent(displayContent, senderName);
    const imgHtml = m.image_url ? `<img src="${m.image_url}" class="msg-image" onclick="openLightbox('${m.image_url}')" title="Click to enlarge" />` : '';
    const favClass = m.is_favorite ? 'favorited' : '';

    const swipes = Array.isArray(m.swipes) && m.swipes.length > 0 ? m.swipes : [m.content];
    const currentIdx = m.swipe_index || 0;
    const swipeHtml = (!isUser && swipes.length > 1) ? `
      <div class="swipe-controls">
        <button class="msg-action-btn" onclick="switchSwipe('${m.id}', -1)" ${currentIdx <= 0 ? 'disabled' : ''}>‹</button>
        <span>${currentIdx + 1}/${swipes.length}</span>
        <button class="msg-action-btn" onclick="switchSwipe('${m.id}', 1)" ${currentIdx >= swipes.length - 1 ? 'disabled' : ''}>›</button>
      </div>
    ` : '';

    const isPureSticker = /^\[(USER_)?STICKER:[^\]]+\]$/i.test(displayContent.trim());
    const isPureOoc = isUser && oocBadgeHtml && !displayContent && !imgHtml;
    const bubbleStyle = (isPureSticker || isPureOoc) ? 'style="background:transparent; padding:0;"' : '';

    return `
      <div class="msg-wrapper ${m.role}" data-msg-id="${m.id}">
        <div class="msg-header-row">
          ${!isUser ? `<img src="${avatarSrc}" class="msg-avatar" />` : ''}
          <span class="msg-sender">${escapeHtml(senderName)}</span>
          ${isUser ? `<img src="${avatarSrc}" class="msg-avatar" />` : ''}
        </div>
        <div class="msg-bubble" ${bubbleStyle}>
          ${oocBadgeHtml}
          ${imgHtml}
          ${formattedText}
        </div>
        <div class="msg-actions-bar">
          <div class="msg-actions-group">
            <button class="msg-action-btn ${favClass}" onclick="toggleFavoriteMessage('${m.id}')" title="Favorite">
              <i data-lucide="heart" class="icon-xs"></i>
            </button>
            <button class="msg-action-btn" onclick="editMessage('${m.id}')" title="Edit">
              <i data-lucide="edit-2" class="icon-xs"></i>
            </button>
            <button class="msg-action-btn" onclick="branchChatFromMessage('${m.id}')" title="Branch new chat from this point">
              <i data-lucide="git-branch" class="icon-xs"></i>
            </button>
            ${block.isLastBotMsg ? `
              <button class="msg-action-btn" onclick="continueBotMessage()" title="Continue writing">
                <i data-lucide="chevrons-right" class="icon-xs"></i>
              </button>
              <button class="msg-action-btn" onclick="openDirectionBar('continue')" title="Continue with direction">
                <i data-lucide="arrow-right-to-line" class="icon-xs"></i>
              </button>
              <button class="msg-action-btn" onclick="regenerateLast()" title="Regenerate (keeps old until you reply)">
                <i data-lucide="rotate-ccw" class="icon-xs"></i>
              </button>
              <button class="msg-action-btn" onclick="openDirectionBar('regenerate')" title="Regenerate with direction">
                <i data-lucide="sparkles" class="icon-xs"></i>
              </button>
            ` : ''}
            <button class="msg-action-btn" onclick="deleteMessage('${m.id}')" title="Delete this and all subsequent messages">
              <i data-lucide="trash-2" class="icon-xs"></i>
            </button>
          </div>
          ${swipeHtml}
        </div>
      </div>
    `;
  }).join('');

  if (isTyping && currentChar) {
    html += `
      <div class="msg-wrapper assistant">
        <div class="msg-header-row">
          <img src="${charAvatar}" class="msg-avatar" />
          <span class="msg-sender">${escapeHtml(currentChar.name)}</span>
        </div>
        <div class="typing-bubble">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  refreshIcons();

  if (autoScroll) {
    container.scrollTop = container.scrollHeight;
  } else {
    container.scrollTop = prevScrollTop;
  }
}

function formatRichContent(text, senderName = '') {
  if (!text) return '';
  const activePersona = getActivePersona();
  text = text.replace(/\{\{user\}\}/gi, activePersona.name).replace(/\{\{char\}\}/gi, currentChar ? currentChar.name : '');

  let processed = text.replace(/\[(USER_TRANSFER|BOT_TRANSFER):\s*([^|\]]+)\|\s*([^\]]+)\]/gi, (_, type, amt, note) => {
    const label = type.toUpperCase() === 'USER_TRANSFER' ? `TRANSFER TO ${currentChar ? currentChar.name.toUpperCase() : 'CHARACTER'}` : `TRANSFER FROM ${senderName.toUpperCase()}`;
    return `\n<div class="transfer-slip-card"><div class="transfer-slip-header">TRANSFER SLIP • ${escapeHtml(label)}</div><div class="transfer-slip-amount">${escapeHtml(amt.trim())}</div><div class="transfer-slip-note">${escapeHtml(note.trim())}</div></div>\n`;
  });

  processed = processed.replace(/\[USER_STICKER:\s*([^|\]]+)\|\s*([^\]]+)\]/gi, (_, label) => {
    const url = resolveStickerUrl(label);
    return url ? `\n<img src="${url}" alt="${escapeHtml(label.trim())}" class="chat-sticker-img" />\n` : '';
  });

  processed = processed.replace(/\[STICKER:\s*([^\]]+)\]/gi, (_, label) => {
    const url = resolveStickerUrl(label);
    if (url) {
      return `\n<img src="${url}" alt="${escapeHtml(label.trim())}" class="chat-sticker-img" />\n`;
    }
    return `<span class="badge">[Sticker: ${escapeHtml(label.trim())}]</span>`;
  });

  const parts = processed.split(/(```html[\s\S]*?```)/gi);
  return parts.map(part => {
    if (part.toLowerCase().startsWith('```html')) {
      const rawHtml = part.replace(/^```html\s*/i, '').replace(/```$/, '');
      return `<div class="rubii-widget-box">${sanitizeHtml(rawHtml)}</div>`;
    } else {
      const cleanedHtmlIndent = part.replace(/^[ \t]+(?=<\/?[a-zA-Z][^>]*>)/gm, '');
      if (window.marked) {
        return sanitizeHtml(marked.parse(cleanedHtmlIndent));
      }
      return escapeHtml(cleanedHtmlIndent).replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }
  }).join('');
}

async function toggleFavoriteMessage(msgId) {
  const msg = currentMessages.find(m => m.id === msgId);
  if (!msg) return;
  const newState = !msg.is_favorite;

  const { error } = await supabaseClient.from('messages').update({ is_favorite: newState }).eq('id', msgId);
  if (error) return showToast(error.message);

  msg.is_favorite = newState;
  renderMessages(false, false);
}

// ==========================================
// DIRECTION, NPC CAMEO, CONTINUE & SWIPES
// ==========================================
function openDirectionBar(mode) {
  activeDirectionMode = mode;
  const badges = {
    continue: 'Continue Direction',
    regenerate: 'Regenerate Direction',
    npc_cameo: 'NPC Cameo / Scene Event'
  };
  document.getElementById('directionModeBadge').textContent = badges[mode] || 'Direction';
  document.getElementById('directionInput').placeholder = mode === 'npc_cameo'
    ? 'สั่งตัวละครสมทบแทรกฉาก (เช่น เพื่อนสนิทเดินเข้ามาทัก / แม่โทรเข้ามา)...'
    : 'พิมพ์คำสั่งกำหนดทิศทางให้บอท...';
  document.getElementById('directionInput').value = '';
  document.getElementById('directionPromptBar').classList.remove('hidden');
  document.getElementById('directionInput').focus();
}

function openNpcCameoPrompt() {
  openDirectionBar('npc_cameo');
}

function closeDirectionBar() {
  activeDirectionMode = null;
  document.getElementById('directionPromptBar').classList.add('hidden');
}

async function executeDirectionAction() {
  const directionText = document.getElementById('directionInput').value.trim();
  const mode = activeDirectionMode;
  closeDirectionBar();
  if (!directionText) return;

  if (mode === 'continue') {
    await continueBotMessage(directionText);
  } else if (mode === 'regenerate') {
    await regenerateLast(directionText);
  } else if (mode === 'npc_cameo') {
    await triggerNpcCameoScene(directionText);
  }
}

async function triggerNpcCameoScene(cameoInstruction) {
  if (!deepseekApiKey) return showToast('กรุณาใส่ DeepSeek API Key ก่อน');
  await prunePreviousBotSwipes();
  setLoading(true);
  renderMessages(true, true);

  try {
    const npcRule = `[SCENE DIRECTOR — SUPPORTING CHARACTER CAMEO]
Introduce the following supporting character / scene interruption right now: "${cameoInstruction}".
Write the supporting character's dialogue and actions vividly alongside ${currentChar.name}'s reaction.`;

    const rawBotText = await requestDeepSeekCompletion(currentMessages, npcRule);
    const botText = stripLegacyHudTag(rawBotText);
    processBotTransferToUser(botText);

    const { data: botMsg } = await supabaseClient.from('messages').insert({
      user_id: currentUser.id,
      chat_id: currentChat.id,
      role: 'assistant',
      content: botText,
      swipes: [botText],
      swipe_index: 0,
      session_type: 'rp'
    }).select().single();

    currentMessages.push(botMsg);
    renderMessages(false, true);
    fetchDeepSeekBalance();
  } catch (err) {
    renderMessages(false, false);
    showToast('Cameo failed: ' + err.message);
  } finally {
    setLoading(false);
  }
}

async function continueBotMessage(directionInstruction = '') {
  const lastMsg = currentMessages[currentMessages.length - 1];
  if (!lastMsg || lastMsg.role !== 'assistant') return;
  if (!deepseekApiKey) return showToast('กรุณาใส่ DeepSeek API Key ก่อน');

  setLoading(true);
  renderMessages(true, true);

  try {
    const extraRule = directionInstruction
      ? `[Continue Instruction]: Continue directly from where your last message ended, following this direction: "${directionInstruction}". Do NOT repeat what you already wrote.`
      : `[Continue Instruction]: Continue writing seamlessly from where your last message ended. Do NOT repeat what you already wrote.`;

    const rawContinuation = await requestDeepSeekCompletion(currentMessages, extraRule);
    const continuationText = stripLegacyHudTag(rawContinuation);
    const combinedText = `${lastMsg.content}\n\n${continuationText}`;

    const swipes = Array.isArray(lastMsg.swipes) && lastMsg.swipes.length > 0 ? [...lastMsg.swipes] : [lastMsg.content];
    const idx = lastMsg.swipe_index || 0;
    swipes[idx] = combinedText;

    await supabaseClient.from('messages').update({ content: combinedText, swipes }).eq('id', lastMsg.id);
    lastMsg.content = combinedText;
    lastMsg.swipes = swipes;

    renderMessages(false, true);
    fetchDeepSeekBalance();
  } catch (err) {
    renderMessages(false, false);
    showToast('Continue failed: ' + err.message);
  } finally {
    setLoading(false);
  }
}

async function regenerateLast(directionInstruction = '') {
  const lastMsg = currentMessages[currentMessages.length - 1];
  if (!lastMsg || lastMsg.role !== 'assistant') return;
  if (!deepseekApiKey) return showToast('กรุณาใส่ DeepSeek API Key ก่อน');

  setLoading(true);
  const historyBeforeLast = currentMessages.slice(0, -1);
  renderMessages(true, true);

  try {
    const extraRule = directionInstruction
      ? `[Rewrite Direction]: Generate an alternative response following this specific direction: "${directionInstruction}".`
      : '';

    const rawReply = await requestDeepSeekCompletion(historyBeforeLast, extraRule);
    const newReply = stripLegacyHudTag(rawReply);
    processBotTransferToUser(newReply);

    const swipes = Array.isArray(lastMsg.swipes) && lastMsg.swipes.length > 0 ? [...lastMsg.swipes] : [lastMsg.content];
    swipes.push(newReply);
    const newIndex = swipes.length - 1;

    await supabaseClient.from('messages').update({
      content: newReply,
      swipes: swipes,
      swipe_index: newIndex
    }).eq('id', lastMsg.id);

    lastMsg.content = newReply;
    lastMsg.swipes = swipes;
    lastMsg.swipe_index = newIndex;

    renderMessages(false, true);
    fetchDeepSeekBalance();
  } catch (err) {
    renderMessages(false, false);
    showToast('Regenerate failed: ' + err.message);
  } finally {
    setLoading(false);
  }
}

async function switchSwipe(msgId, delta) {
  const msg = currentMessages.find(m => m.id === msgId);
  if (!msg || !Array.isArray(msg.swipes)) return;

  const newIdx = (msg.swipe_index || 0) + delta;
  if (newIdx < 0 || newIdx >= msg.swipes.length) return;

  const selectedContent = msg.swipes[newIdx];
  await supabaseClient.from('messages').update({
    content: selectedContent,
    swipe_index: newIdx
  }).eq('id', msgId);

  msg.content = selectedContent;
  msg.swipe_index = newIdx;
  renderMessages(false, false);
}

// ==========================================
// SEND MESSAGE & CORE API CALL (OOC RECAP + SCENE DIRECTION)
// ==========================================
function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedImageFile = file;
  document.getElementById('imagePreviewName').textContent = file.name;
  document.getElementById('imagePreviewThumb').src = URL.createObjectURL(file);
  document.getElementById('imagePreviewBar').classList.remove('hidden');
}

function clearSelectedImage() {
  selectedImageFile = null;
  document.getElementById('imageInput').value = '';
  document.getElementById('imagePreviewBar').classList.add('hidden');
}

async function uploadImageToSupabase(file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const { error } = await supabaseClient.storage.from('rp-images').upload(fileName, file);
  if (error) throw error;

  const { data } = supabaseClient.storage.from('rp-images').getPublicUrl(fileName);
  return data.publicUrl;
}

async function sendMessage() {
  const inputEl = document.getElementById('messageInput');
  const rawText = inputEl.value.trim();
  if (!rawText && !selectedImageFile) return;

  if (!deepseekApiKey) return showToast('กรุณาใส่ DeepSeek API Key ในเมนู API Settings ก่อน');

  inputEl.value = '';
  inputEl.style.height = 'auto';

  // ลบร่างข้อความรีเจน (Swipes) เก่าที่ไม่ได้เลือกทิ้งทันทีที่ User ตอบกลับ
  await prunePreviousBotSwipes();

  const { oocDirective } = parseOocFromInput(rawText);
  const oocSystemRule = oocDirective
    ? `[OOC DIRECTIVE FROM USER]: "${oocDirective}"
- If this OOC is a scene direction or time skip, execute it seamlessly in the story narration without breaking character.
- If this OOC is a question asking for a recap, status check, or behind-the-scenes clarification, answer the user's OOC question directly and helpfully inside an [OOC: ...] block!`
    : '';

  // 1. กรณีอยู่ใน Unified Phone Mode -> ช่วง Texting
  if (isUnifiedPhoneMode && !isCallSubMode) {
    try {
      let uploadedImageUrl = null;
      if (selectedImageFile) {
        uploadedImageUrl = await uploadImageToSupabase(selectedImageFile);
        clearSelectedImage();
      }

      const { data: userMsg, error } = await supabaseClient.from('messages').insert({
        user_id: currentUser.id,
        chat_id: currentChat.id,
        role: 'user',
        content: rawText || '(Sent an image)',
        image_url: uploadedImageUrl,
        session_type: 'phone_chat',
        session_group: activeUnifiedSessionId
      }).select().single();

      if (error) throw error;
      currentMessages.push(userMsg);
      renderMessages(false, true);
    } catch (err) {
      showToast('ส่งไม่สำเร็จ: ' + err.message);
    }
    return;
  }

  // 2. กรณีอยู่ใน Unified Phone Mode -> ช่วง Voice Call
  if (isUnifiedPhoneMode && isCallSubMode) {
    setLoading(true);
    try {
      const { data: userMsg, error } = await supabaseClient.from('messages').insert({
        user_id: currentUser.id,
        chat_id: currentChat.id,
        role: 'user',
        content: rawText,
        session_type: 'phone_call',
        session_group: activeUnifiedSessionId
      }).select().single();

      if (error) throw error;
      currentMessages.push(userMsg);
      renderMessages(true, true);

      const callRule = `[LIVE VOICE CALL ACTIVE — STRICTLY CONCISE SPOKEN DIALOGUE ONLY]
You just picked up a live voice call from ${getActivePersona().name} right after your text messages (Duration: ${document.getElementById('callTimerDisplay').textContent}).
- CRITICAL OVERRIDE: IGNORE any character instructions that ask for long descriptive paragraphs or date/location headers!
- Keep your reply VERY SHORT (1 to 3 spoken sentences max), natural, and conversational like a real phone call!
- You CANNOT see ${getActivePersona().name} face-to-face. You may include ONE brief audio cue in parentheses or asterisks.
${oocSystemRule}`;

      const rawBotText = await requestDeepSeekCompletion(currentMessages, callRule);
      const botText = stripLegacyHudTag(rawBotText);

      const { data: botMsg } = await supabaseClient.from('messages').insert({
        user_id: currentUser.id,
        chat_id: currentChat.id,
        role: 'assistant',
        content: botText,
        swipes: [botText],
        swipe_index: 0,
        session_type: 'phone_call',
        session_group: activeUnifiedSessionId
      }).select().single();

      await supabaseClient.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', currentChat.id);
      currentMessages.push(botMsg);
      renderMessages(false, true);
      loadAllRecentChats();
      fetchDeepSeekBalance();
    } catch (err) {
      renderMessages(false, false);
      showToast('Call error: ' + err.message);
    } finally {
      setLoading(false);
    }
    return;
  }

  // 3. โหมด In-Person RP ปกติ
  setLoading(true);
  try {
    let uploadedImageUrl = null;
    if (selectedImageFile) {
      document.getElementById('headerStatus').textContent = 'Uploading image...';
      uploadedImageUrl = await uploadImageToSupabase(selectedImageFile);
      clearSelectedImage();
    }

    const { data: userMsg, error } = await supabaseClient.from('messages').insert({
      user_id: currentUser.id,
      chat_id: currentChat.id,
      role: 'user',
      content: rawText || '(Sent an image)',
      image_url: uploadedImageUrl,
      session_type: 'rp'
    }).select().single();

    if (error) throw error;
    currentMessages.push(userMsg);
    renderMessages(true, true);

    const rawBotText = await requestDeepSeekCompletion(currentMessages, oocSystemRule);
    const botText = stripLegacyHudTag(rawBotText);
    processBotTransferToUser(botText);

    const { data: botMsg } = await supabaseClient.from('messages').insert({
      user_id: currentUser.id,
      chat_id: currentChat.id,
      role: 'assistant',
      content: botText,
      swipes: [botText],
      swipe_index: 0,
      session_type: 'rp'
    }).select().single();

    await supabaseClient.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', currentChat.id);

    currentMessages.push(botMsg);
    renderMessages(false, true);
    loadAllRecentChats();
    fetchDeepSeekBalance();
  } catch (err) {
    console.error(err);
    renderMessages(false, false);
    showToast('เกิดข้อผิดพลาด: ' + err.message);
  } finally {
    setLoading(false);
  }
}

async function requestDeepSeekCompletion(messageHistory, extraSystemRule = '') {
  document.getElementById('headerStatus').textContent = 'Typing...';
  const model = document.getElementById('modelSelect').value;
  const useRubiiHtml = document.getElementById('enableRubiiHtml').checked;
  const activeStyle = customStyles.find(s => s.id === activeStyleId);
  const activePersona = getActivePersona();

  const allStickerNames = [
    ...BUILTIN_STICKERS.map(s => s.label),
    ...userStickers.map(s => s.label)
  ].join(', ');

  // Supporting Cast (Both Character's & User's)
  let npcBlock = '';
  const charNpcs = Array.isArray(currentChar.supporting_chars) ? currentChar.supporting_chars : [];
  const userNpcs = Array.isArray(activePersona.supporting_chars) ? activePersona.supporting_chars : [];
  if (charNpcs.length > 0 || userNpcs.length > 0) {
    const cLines = charNpcs.map(n => `- [${currentChar.name}'s Side] ${n.name} (${n.role}): ${n.traits}`);
    const uLines = userNpcs.map(n => `- [${activePersona.name}'s Side] ${n.name} (${n.role}): ${n.traits}`);
    npcBlock = `\n[Supporting Cast / Known NPCs in Story]\n${[...cLines, ...uLines].join('\n')}\n`;
  }

  // Locations & Rules
  let locationsBlock = '';
  if (Array.isArray(currentChar.locations) && currentChar.locations.length > 0) {
    const locLines = currentChar.locations.map(l => `- ${l.name}: ${l.details}${l.rules ? ` [STRICT RULES/RESTRICTIONS: ${l.rules}]` : ''}`).join('\n');
    locationsBlock = `\n[Key World Locations & Area Rules — OBEY STRICTLY WHEN IN THESE PLACES]\n${locLines}\n`;
  }

  // Upcoming Phone Calendar (ดึงจาก currentChat.phone_data ประจำห้องแชทนี้)
  const pData = currentChat.phone_data || {};
  let upcomingScheduleBlock = '';
  if (Array.isArray(pData.calendar) && pData.calendar.length > 0) {
    const calItems = pData.calendar.map(c => `- ${pData.story_year || ''}-${pData.story_month || ''}-${c.day || c.date}: ${c.title} (${c.time || 'All day'}) ${c.note ? '- ' + c.note : ''}`).join('\n');
    upcomingScheduleBlock = `\n[Your Phone Calendar & Upcoming Plans (Reference naturally when talking about upcoming days)]\n${calItems}\n`;
  }

  const rubiiInstruction = useRubiiHtml
    ? `\n- [Interactive UI Widget]: When the scene naturally involves a smartphone screen, text message, letter, or status window, you MAY include a compact dark-mode HTML/CSS widget inside \`\`\`html and \`\`\` tags (inline CSS only, background #18181c, border 1px solid #2a2a32).`
    : '';

  const systemPrompt = `${currentChar.system_prompt ? currentChar.system_prompt + '\n\n' : ''}You are roleplaying as ${currentChar.name}.

[CRITICAL LORE, BIRTHDAYS & UNBREAKABLE FACTS — MUST REVIEW BEFORE EVERY REPLY]
${currentChar.important_dates || 'None specified.'}

[Character Personality & Lore]
${currentChar.personality || 'Not specified.'}
Your Financial Status / Starting Balance: ${currentChar.starting_balance || '$5,000.00'}

[Current Scenario]
${currentChar.scenario || 'Not specified.'}
${locationsBlock}${npcBlock}${upcomingScheduleBlock}
${currentChar.example_dialogue ? `[Example Dialogue]\n${currentChar.example_dialogue}\n\n` : ''}[User / Roleplay Partner Profile]
Name: ${activePersona.name}
Details: ${activePersona.description || 'Not specified.'}

[Pinned Memory / Plot Notes]
${currentChat.memory_notes || 'None.'}

[Roleplay Rules & Special Actions]
- Before generating your response, double-check [CRITICAL LORE, BIRTHDAYS & UNBREAKABLE FACTS], [Key World Locations & Area Rules], and [Your Phone Calendar] so you never contradict dates, location rules, or upcoming plans.
- Stay strictly in character as ${currentChar.name}.
- Use *asterisks* for actions/thoughts and standard text or "quotes" for spoken dialogue.
- Never speak or act on behalf of ${activePersona.name}.
- [Emojis & Stickers]: You may use natural emojis in casual messages or phone texts, and send chat stickers using [STICKER: name] (Available: ${allStickerNames}).
- [Money Transfer]: If ${activePersona.name} transfers money to you ([USER_TRANSFER: amount | note]), react naturally! If the story makes sense for YOU (${currentChar.name}) to transfer money to ${activePersona.name}, include [BOT_TRANSFER: amount | reason] on its own line (use currency "${userCurrency}" if appropriate).${rubiiInstruction}
${activeStyle && activeStyle.prompt ? '\n' + activeStyle.prompt : ''}`;

  const apiMessages = [{ role: 'system', content: systemPrompt }];

  // Sliding Window: ส่ง 16 ข้อความล่าสุด โดยตัด OOC ออกจากประวัติเก่าเพื่อไม่ให้บอทจำปนเนื้อเรื่อง
  messageHistory.slice(-16).forEach((m, idx, arr) => {
    const isLastTurn = idx === arr.length - 1;
    const contentToSend = isLastTurn ? m.content : stripOocText(m.content);
    if (!contentToSend && !m.image_url) return;

    const prefix = m.session_type === 'phone_chat' ? '[Smartphone Text] ' : (m.session_type === 'phone_call' ? '[Voice Phone Call] ' : '');
    if (m.image_url) {
      apiMessages.push({
        role: m.role,
        content: [
          { type: 'text', text: prefix + contentToSend },
          { type: 'image_url', image_url: { url: m.image_url } }
        ]
      });
    } else {
      apiMessages.push({ role: m.role, content: prefix + contentToSend });
    }
  });

  if (currentChar.jailbreak) {
    apiMessages.push({ role: 'system', content: currentChar.jailbreak });
  }
  if (extraSystemRule) {
    apiMessages.push({ role: 'system', content: extraSystemRule });
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekApiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: apiMessages,
      temperature: 1.15
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return data.choices[0].message.content;
}

// --- INLINE EDIT, CASCADE DELETE & AUTO-SUMMARY ---
function editMessage(msgId) {
  const msg = currentMessages.find(m => m.id === msgId);
  if (!msg) return;

  const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (!wrapper) return;

  const bubble = wrapper.querySelector('.msg-bubble');
  const actions = wrapper.querySelector('.msg-actions-bar');
  if (actions) actions.classList.add('hidden');
  if (!bubble) return;

  bubble.outerHTML = `
    <div class="edit-container">
      <textarea id="editInput_${msgId}" class="inline-edit-textarea" rows="4">${escapeHtml(msg.content)}</textarea>
      <div style="font-size:11.5px; color:var(--text-muted); margin-top:6px;">Edit your message</div>
      <div class="edit-footer-row">
        <button class="btn primary sm" onclick="saveEditedMessage('${msgId}')">
          <i data-lucide="check-circle" class="icon-xs"></i> Approve
        </button>
        <button class="btn secondary sm" onclick="renderMessages(false, false)">
          <i data-lucide="x-circle" class="icon-xs"></i> Cancel
        </button>
      </div>
    </div>
  `;
  refreshIcons();
  const tx = document.getElementById(`editInput_${msgId}`);
  tx.style.height = tx.scrollHeight + 'px';
  tx.focus();
}

async function saveEditedMessage(msgId) {
  const input = document.getElementById(`editInput_${msgId}`);
  if (!input) return;
  const newText = input.value.trim();
  if (!newText) return showToast('ข้อความห้ามว่าง');

  const msg = currentMessages.find(m => m.id === msgId);
  if (!msg) return;

  const swipes = Array.isArray(msg.swipes) && msg.swipes.length > 0 ? [...msg.swipes] : [newText];
  const idx = msg.swipe_index || 0;
  swipes[idx] = newText;

  const { error } = await supabaseClient.from('messages').update({ content: newText, swipes }).eq('id', msgId);
  if (error) return showToast('แก้ไขไม่สำเร็จ: ' + error.message);

  msg.content = newText;
  msg.swipes = swipes;
  renderMessages(false, false);
  showToast('แก้ไขข้อความแล้ว');
}

// Cascade Delete: ลบข้อความนี้และข้อความทั้งหมดที่อยู่ต่อจากนั้นออกจาก Supabase และหน้าจอถาวร
async function deleteMessage(msgId) {
  const targetIdx = currentMessages.findIndex(m => m.id === msgId);
  if (targetIdx === -1) return;

  const msgsToDelete = currentMessages.slice(targetIdx);
  const count = msgsToDelete.length;
  const confirmText = count > 1
    ? `ลบข้อความนี้และข้อความทั้งหมดที่อยู่ต่อจากนั้นรวม ${count} ข้อความแบบถาวรใช่ไหม? (AI จะไม่เห็นข้อความเหล่านี้อีก)`
    : 'ลบข้อความนี้แบบถาวรใช่ไหม?';

  if (!(await appConfirm(confirmText, 'Cascade Delete Messages'))) return;

  const idsToDelete = msgsToDelete.map(m => m.id);
  const { error } = await supabaseClient.from('messages').delete().in('id', idsToDelete);
  if (error) return showToast('ลบไม่สำเร็จ: ' + error.message);

  currentMessages = currentMessages.slice(0, targetIdx);
  renderMessages(false, false);
  showToast(`ลบถาวรเรียบร้อย (${count} ข้อความ)`);
}

async function saveMemory() {
  if (!currentChat) return;
  const notes = document.getElementById('memoryInput').value;
  await supabaseClient.from('chats').update({ memory_notes: notes, updated_at: new Date().toISOString() }).eq('id', currentChat.id);
  currentChat.memory_notes = notes;
  showToast('บันทึกความจำเรียบร้อย');
}

async function autoSummarizeMemory() {
  if (!currentChat || currentMessages.length === 0) return showToast('ยังไม่มีข้อความในแชทให้สรุป');
  if (!deepseekApiKey) return showToast('กรุณาใส่ DeepSeek API Key ก่อน');

  const btn = document.getElementById('btnAutoSummary');
  const oldHtml = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Summarizing...';

  try {
    const existingMemory = document.getElementById('memoryInput').value.trim();
    const recentMsgs = currentMessages.slice(-30).map(m => {
      const clean = stripOocText(m.content);
      if (!clean) return null;
      const speaker = m.role === 'user' ? getActivePersona().name : currentChar.name;
      return `${speaker}: ${clean}`;
    }).filter(Boolean).join('\n');

    const prompt = `You are a story archivist. Update the Pinned Memory summary for an ongoing roleplay between ${currentChar.name} and ${getActivePersona().name}.

[Existing Memory]
${existingMemory || 'None yet.'}

[Recent Dialogue to Merge]
${recentMsgs}

[Instructions]
- Merge the existing memory with key plot points, relationship shifts, promises, upcoming plans, items/money transferred, and current date/location from the recent dialogue.
- Output ONLY concise bullet points (max 150-200 words). No intro or outro text.
- Write in the primary language used in the roleplay.`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekApiKey}` },
      body: JSON.stringify({ model: 'deepseek-flash', messages: [{ role: 'user', content: prompt }], temperature: 0.5 })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const summaryText = data.choices[0].message.content.trim();
    document.getElementById('memoryInput').value = summaryText;

    await supabaseClient.from('chats').update({ memory_notes: summaryText, updated_at: new Date().toISOString() }).eq('id', currentChat.id);
    currentChat.memory_notes = summaryText;

    showToast('สรุปและบันทึกความจำเรียบร้อย!');
    fetchDeepSeekBalance();
  } catch (err) {
    showToast('สรุปความจำไม่สำเร็จ: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldHtml;
    refreshIcons();
  }
}

// ==========================================
// CHARACTER'S SMARTPHONE OS (PER-CHAT ISOLATED + REAL PHOTOS GUARANTEED)
// ==========================================
function getActivePhoneSnapshot() {
  if (!currentChat) return {};
  if (viewingHistoryIndex >= 0 && Array.isArray(currentChat.phone_history) && currentChat.phone_history[viewingHistoryIndex]) {
    return currentChat.phone_history[viewingHistoryIndex].data;
  }
  return currentChat.phone_data || {};
}

function applyDynamicPhoneTheme(phoneData) {
  const frame = document.getElementById('charPhoneFrame');
  const palette = phoneData.theme_palette || {};
  frame.style.setProperty('--p-bg', palette.bg_color || '#111114');
  frame.style.setProperty('--p-card', palette.card_color || '#1a1a20');
  frame.style.setProperty('--p-border', palette.border_color || '#2c2c35');
  frame.style.setProperty('--p-text', palette.text_color || '#f4f4f5');
  frame.style.setProperty('--p-muted', palette.muted_color || '#8e8e98');
  frame.style.setProperty('--p-accent', palette.accent_color || '#8b5cf6');
  frame.style.setProperty('--p-notif-bg', palette.notif_bg || '#c2410c');
  frame.style.setProperty('--p-notif-text', palette.notif_text || '#ffffff');
}

function setPhoneLoading(show, title = 'Syncing Device...', sub = 'Analyzing character vibe, timeline, and apps') {
  const overlay = document.getElementById('phoneLoadingOverlay');
  if (show) {
    document.getElementById('phoneLoadingTitle').textContent = title;
    document.getElementById('phoneLoadingSub').textContent = sub;
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

async function openPhoneModal() {
  if (!currentChar || !currentChat) return;
  viewingHistoryIndex = -1;
  isVaultUnlocked = false;
  document.getElementById('phoneOwnerLabel').textContent = `${currentChar.name}'s Phone`;
  document.getElementById('phoneClock').textContent = new Date().toTimeString().slice(0, 5);

  enteredPasscode = '';
  isPhoneUnlocked = false;
  openModal('phoneModal');

  const data = currentChat.phone_data || {};
  applyDynamicPhoneTheme(data);

  const hasData = data.chats || data.calendar || data.shopping;
  if (!hasData) {
    await generatePhoneContent(false);
  } else {
    setPhoneLoading(true, `Connecting to ${currentChar.name}'s Device...`, 'Loading session-isolated device data');
    setTimeout(() => {
      setPhoneLoading(false);
      renderPhoneLockscreen();
    }, 500);
  }
}

function getEffectivePasscode() {
  if (currentChar.phone_passcode && currentChar.phone_passcode.length === 4) {
    return currentChar.phone_passcode;
  }
  const aiPass = getActivePhoneSnapshot()?.passcode;
  if (aiPass && String(aiPass).length === 4) {
    return String(aiPass);
  }
  return '0136';
}

function getEffectiveHint() {
  if (currentChar.phone_hint) return currentChar.phone_hint;
  const aiHint = getActivePhoneSnapshot()?.passcode_hint;
  if (aiHint) return aiHint;
  return `Passcode: ${getEffectivePasscode().split('').join(' - ')}`;
}

function renderPhoneLockscreen() {
  document.getElementById('phoneNavBar').classList.add('hidden');
  const screen = document.getElementById('phoneScreen');
  const snap = getActivePhoneSnapshot();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;
  const storyDateLabel = snap.story_date_label || now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const dotsHtml = [0, 1, 2, 3].map(i => `<div class="passcode-dot ${i < enteredPasscode.length ? 'filled' : ''}"></div>`).join('');

  screen.innerHTML = `
    <div class="lockscreen-wrap">
      <div class="lock-notif-banner">
        <div class="lock-notif-icon"><i data-lucide="bell" class="icon-sm"></i></div>
        <div style="flex:1; overflow:hidden;">
          <div style="font-size:12px; font-weight:700;">${escapeHtml(currentChar.name)}'s Passcode</div>
          <div style="font-size:12px; opacity:0.95; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(getEffectiveHint())}</div>
        </div>
      </div>

      <div class="lock-clock-box">
        <div class="lock-date">${escapeHtml(storyDateLabel)}</div>
        <div class="lock-time">${timeStr}</div>
      </div>

      <div class="passcode-dots">${dotsHtml}</div>

      <div class="keypad-grid">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="keypad-btn" onclick="pressPasscodeDigit('${n}')">${n}</button>`).join('')}
        <button class="keypad-text-btn" onclick="quickUnlockPhone()" title="Quick Unlock">Quick</button>
        <button class="keypad-btn" onclick="pressPasscodeDigit('0')">0</button>
        <button class="keypad-text-btn" onclick="deletePasscodeDigit()">Delete</button>
      </div>
    </div>
  `;
  refreshIcons();
}

function pressPasscodeDigit(digit) {
  if (enteredPasscode.length >= 4) return;
  enteredPasscode += digit;
  renderPhoneLockscreen();

  if (enteredPasscode.length === 4) {
    const target = getEffectivePasscode();
    if (enteredPasscode === target) {
      isPhoneUnlocked = true;
      setTimeout(() => renderPhoneHome(), 180);
    } else {
      document.querySelectorAll('.passcode-dot').forEach(d => d.classList.add('error'));
      showToast('Incorrect Passcode');
      setTimeout(() => {
        enteredPasscode = '';
        renderPhoneLockscreen();
      }, 450);
    }
  }
}

function deletePasscodeDigit() {
  enteredPasscode = enteredPasscode.slice(0, -1);
  renderPhoneLockscreen();
}

function quickUnlockPhone() {
  isPhoneUnlocked = true;
  renderPhoneHome();
}

function renderPhoneHome() {
  if (!isPhoneUnlocked) return renderPhoneLockscreen();
  document.getElementById('phoneNavBar').classList.add('hidden');
  const screen = document.getElementById('phoneScreen');
  const snap = getActivePhoneSnapshot();
  applyDynamicPhoneTheme(snap);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning,' : (hour < 18 ? 'Good afternoon,' : 'Good evening,');
  const dateLabel = snap.story_date_label || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const historyBadge = viewingHistoryIndex >= 0
    ? `<div style="font-size:10px; background:var(--p-accent); color:#fff; padding:2px 8px; border-radius:99px; display:inline-block; margin-bottom:6px;">Viewing Saved Snapshot #${viewingHistoryIndex + 1}</div>`
    : '';

  screen.innerHTML = `
    <div>
      <div class="home-greeting-banner">
        ${historyBadge}
        <div style="font-size:12px; opacity:0.8; margin-bottom:2px;">${greeting}</div>
        <div style="font-size:18px; font-weight:700; margin-bottom:8px;">${escapeHtml(currentChar.name)}</div>
        <div style="font-size:11.5px; opacity:0.85; text-align:right;">${escapeHtml(dateLabel)}</div>
      </div>

      <div class="app-grid-9">
        <button class="app-icon-btn" onclick="openPhoneApp('messages')">
          <div class="app-icon-box" style="background:#a8a29e;"><i data-lucide="message-square"></i></div>
          <span class="app-icon-label">Messages</span>
        </button>

        <button class="app-icon-btn" onclick="openPhoneApp('gallery')">
          <div class="app-icon-box" style="background:#d97757;"><i data-lucide="image"></i></div>
          <span class="app-icon-label">Gallery</span>
        </button>

        <button class="app-icon-btn" onclick="openPhoneApp('calendar')">
          <div class="app-icon-box" style="background:#ca8a04;"><i data-lucide="calendar"></i></div>
          <span class="app-icon-label">Calendar</span>
        </button>

        <button class="app-icon-btn" onclick="openPhoneApp('todo')">
          <div class="app-icon-box" style="background:#e11d48;"><i data-lucide="check-square"></i></div>
          <span class="app-icon-label">To-Do</span>
        </button>

        <button class="app-icon-btn" onclick="openPhoneApp('maps')">
          <div class="app-icon-box" style="background:#eab308;"><i data-lucide="map-pin"></i></div>
          <span class="app-icon-label">Maps</span>
        </button>

        <button class="app-icon-btn" onclick="openPhoneApp('browser')">
          <div class="app-icon-box" style="background:#64748b;"><i data-lucide="globe"></i></div>
          <span class="app-icon-label">Browser</span>
        </button>

        <button class="app-icon-btn" onclick="openPhoneApp('bank')">
          <div class="app-icon-box" style="background:#16a34a;"><i data-lucide="wallet"></i></div>
          <span class="app-icon-label">Banking</span>
        </button>

        <button class="app-icon-btn" onclick="openPhoneApp('music')">
          <div class="app-icon-box" style="background:#6366f1;"><i data-lucide="music"></i></div>
          <span class="app-icon-label">Music</span>
        </button>

        <button class="app-icon-btn" onclick="openPhoneApp('shopping')">
          <div class="app-icon-box" style="background:#ea580c;"><i data-lucide="shopping-bag"></i></div>
          <span class="app-icon-label">Shopping</span>
        </button>

        <button class="app-icon-btn" onclick="openPhoneApp('vault')">
          <div class="app-icon-box" style="background:#334155;"><i data-lucide="lock"></i></div>
          <span class="app-icon-label">Vault & Voice</span>
        </button>
      </div>
    </div>
  `;
  refreshIcons();
}

function resolveGalleryPhotoUrl(photoObj, forceAi = false) {
  if (forceAi) {
    const promptText = encodeURIComponent((photoObj.visual_desc || photoObj.search_keyword || 'candid photo') + ', realistic 35mm');
    return `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){promptText}?width=600&height=400&nologo=true`;
  }

  if (photoObj.cached_real_url && photoObj.cached_real_url.includes('picsum.photos')) {
    return photoObj.cached_real_url;
  }

  const seed = encodeURIComponent((photoObj.search_keyword || photoObj.caption || 'photo').trim().toLowerCase());
  const reliablePhotoUrl = `[https://picsum.photos/seed/$](https://picsum.photos/seed/$){seed}/600/400`;
  photoObj.cached_real_url = reliablePhotoUrl;
  return reliablePhotoUrl;
}

function openPhoneApp(appName) {
  const nav = document.getElementById('phoneNavBar');
  const title = document.getElementById('phoneAppTitle');
  const screen = document.getElementById('phoneScreen');
  const data = getActivePhoneSnapshot();
  const activePersona = getActivePersona();

  nav.classList.remove('hidden');

  if (appName === 'messages') {
    title.textContent = 'Messages';
    const npcChats = data.chats || [];
    const liveUserPhoneMsgs = currentMessages.filter(m => m.session_type === 'phone_chat');
    let liveThreadCard = '';
    if (liveUserPhoneMsgs.length > 0) {
      const lastLive = liveUserPhoneMsgs[liveUserPhoneMsgs.length - 1];
      liveThreadCard = `
        <div class="phone-list-item" style="border-color: var(--p-accent);" onclick="openLiveUserThreadInCharPhone()">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <strong style="font-size:13px; color:var(--p-accent);">${escapeHtml(activePersona.name)} (You)</strong>
            <span style="font-size:10px; background:var(--p-accent); color:#fff; padding:1px 6px; border-radius:4px;">Synced</span>
          </div>
          <div style="font-size:12px; color:var(--p-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(stripOocText(lastLive.content))}</div>
        </div>
      `;
    }

    const npcHtml = npcChats.map((c, idx) => `
      <div class="phone-list-item" onclick="openPhoneChatThread(${idx})">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <strong style="font-size:13px;">${escapeHtml(c.contact)}</strong>
          <span style="font-size:11px; color:var(--p-muted);">${escapeHtml(c.time || '')}</span>
        </div>
        <div style="font-size:12px; color:var(--p-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(c.last_msg)}</div>
      </div>
    `).join('');

    screen.innerHTML = (liveThreadCard || npcHtml) ? (liveThreadCard + npcHtml) : '<p class="hint">No messages found.</p>';
  }

  else if (appName === 'gallery') {
    title.textContent = 'Gallery';
    const photos = data.gallery || [];
    const toggleHeader = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:var(--p-card); padding:8px 10px; border-radius:8px; border:1px solid var(--p-border);">
        <span style="font-size:11px; font-weight:600;">Source: ${galleryUseAiMode ? 'AI Image Gen' : 'Real Photos'}</span>
        <button class="btn secondary sm" style="padding:4px 8px; font-size:11px;" onclick="toggleGallerySourceMode()">
          Switch to ${galleryUseAiMode ? 'Real Photos' : 'AI Gen'}
        </button>
      </div>
    `;

    if (photos.length === 0) {
      screen.innerHTML = toggleHeader + '<p class="hint">No photos in gallery.</p>';
      return;
    }

    let updatedCache = false;
    const cardsHtml = photos.map((p, idx) => {
      const oldUrl = p.cached_real_url || '';
      const imgUrl = resolveGalleryPhotoUrl(p, galleryUseAiMode);
      if (oldUrl !== p.cached_real_url) updatedCache = true;
      const fallbackUrl = `[https://picsum.photos/seed/fallback_$](https://picsum.photos/seed/fallback_$){idx}_${Date.now()}/600/400`;

      return `
        <div class="gallery-memory-card">
          <img src="${imgUrl}" class="gallery-real-img" onclick="openLightbox(this.src)" onerror="this.onerror=null; this.src='${fallbackUrl}';" />
          <div style="font-size:12.5px; font-weight:600; margin-bottom:2px;">${escapeHtml(p.caption)}</div>
          <div style="font-size:11px; color:var(--p-muted); margin-bottom:4px;">${escapeHtml(p.location || '')} • ${escapeHtml(p.taken_at || '')}</div>
          <div style="font-size:11px; opacity:0.75; line-height:1.4;">${escapeHtml(p.visual_desc || '')}</div>
        </div>
      `;
    }).join('');

    if (updatedCache && viewingHistoryIndex === -1 && currentChat) {
      supabaseClient.from('chats').update({ phone_data: currentChat.phone_data }).eq('id', currentChat.id);
    }

    screen.innerHTML = toggleHeader + cardsHtml;
  }

  else if (appName === 'calendar') {
    title.textContent = 'Calendar';
    renderMonthlyCalendarView();
  }

  else if (appName === 'todo') {
    title.textContent = 'To-Do & Notes';
    const todos = data.todos || [];
    if (todos.length === 0) { screen.innerHTML = '<p class="hint">No tasks or notes.</p>'; return; }
    screen.innerHTML = todos.map(t => `
      <div class="phone-list-item" style="cursor:default; display:flex; align-items:flex-start; gap:10px;">
        <i data-lucide="${t.done ? 'check-circle-2' : 'circle'}" class="icon-sm" style="color:var(--p-accent); margin-top:2px;"></i>
        <div style="flex:1;">
          <div style="font-size:13px; font-weight:500; ${t.done ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHtml(t.task)}</div>
          ${t.due ? `<div style="font-size:11px; color:var(--p-muted); margin-top:2px;">Due: ${escapeHtml(t.due)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  else if (appName === 'maps') {
    title.textContent = 'Maps & Timeline';
    const places = data.maps || [];
    if (places.length === 0) { screen.innerHTML = '<p class="hint">No location history.</p>'; return; }
    screen.innerHTML = places.map(m => `
      <div class="phone-list-item" style="cursor:default;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:13px;">${escapeHtml(m.place)}</strong>
          <span style="font-size:11px; color:var(--p-accent);">${escapeHtml(m.time || '')}</span>
        </div>
        <div style="font-size:12px; color:var(--p-muted); margin-top:4px;">${escapeHtml(m.note || '')}</div>
      </div>
    `).join('');
  }

  else if (appName === 'browser') {
    title.textContent = 'Browser History';
    const searches = data.browser || [];
    if (searches.length === 0) { screen.innerHTML = '<p class="hint">No search history.</p>'; return; }
    screen.innerHTML = searches.map(b => `
      <div class="phone-list-item" style="cursor:default;">
        <div style="font-size:13px; font-weight:600; color:var(--p-accent);">🔍 ${escapeHtml(b.query)}</div>
        <div style="font-size:11px; color:var(--p-muted); margin-top:3px;">${escapeHtml(b.time || '')} — ${escapeHtml(b.visited_site || '')}</div>
      </div>
    `).join('');
  }

  else if (appName === 'bank') {
    title.textContent = 'Banking';
    const bank = data.bank || { balance: currentChar.starting_balance || '$5,000.00', transactions: [] };
    const txHtml = (bank.transactions || []).map(t => `
      <div class="phone-list-item" style="cursor:default; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:12.5px; font-weight:500;">${escapeHtml(t.title)}</div>
          <div style="font-size:11px; color:var(--p-muted);">${escapeHtml(t.datetime || t.date || '')}</div>
        </div>
        <div style="font-weight:700; font-size:12.5px; color:${String(t.amount).startsWith('-') ? '#ef4444' : '#10b981'};">
          ${escapeHtml(String(t.amount))}
        </div>
      </div>
    `).join('');

    screen.innerHTML = `
      <div class="bank-card">
        <div style="font-size:10px; color:var(--p-muted); letter-spacing:0.06em;">AVAILABLE BALANCE</div>
        <div style="font-size:22px; font-weight:700; margin:6px 0;">${escapeHtml(String(bank.balance || currentChar.starting_balance))}</div>
        <div style="font-size:11px; color:var(--p-muted);">${escapeHtml(currentChar.name)}</div>
      </div>
      <div class="section-label" style="margin-bottom:8px; color:var(--p-muted);">RECENT TRANSACTIONS</div>
      ${txHtml}
    `;
  }

  else if (appName === 'music') {
    title.textContent = 'Music';
    const music = data.music || {};
    const tracks = music.playlist || [];
    screen.innerHTML = `
      <div class="bank-card" style="border-left: 3px solid var(--p-accent);">
        <div style="font-size:10px; color:var(--p-accent); font-weight:700;">NOW PLAYING</div>
        <div style="font-size:15px; font-weight:700; margin:4px 0;">${escapeHtml(music.now_playing || 'Unknown Track')}</div>
        <div style="font-size:12px; color:var(--p-muted);">${escapeHtml(music.artist || '')}</div>
        ${music.lyric_mood ? `<div style="font-size:11.5px; font-style:italic; margin-top:8px; opacity:0.85;">"${escapeHtml(music.lyric_mood)}"</div>` : ''}
      </div>
      <div class="section-label" style="margin-bottom:8px; color:var(--p-muted);">PLAYLIST</div>
      ${tracks.map(tr => `<div class="phone-list-item" style="cursor:default;"><div style="font-size:12.5px; font-weight:600;">${escapeHtml(tr.title)}</div><div style="font-size:11px; color:var(--p-muted);">${escapeHtml(tr.artist)}</div></div>`).join('')}
    `;
  }

  else if (appName === 'shopping') {
    title.textContent = 'Shopping Orders';
    const orders = data.shopping || [];
    if (orders.length === 0) { screen.innerHTML = '<p class="hint">No recent orders.</p>'; return; }
    screen.innerHTML = orders.map(o => `
      <div class="phone-list-item" style="cursor:default;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <strong style="font-size:13px;">${escapeHtml(o.item)}</strong>
          <span style="font-weight:700; font-size:12.5px; color:var(--p-accent); white-space:nowrap;">${escapeHtml(String(o.price))}</span>
        </div>
        <div style="font-size:11.5px; color:var(--p-muted); margin-top:4px;">${escapeHtml(o.status || 'Delivered')} • ${escapeHtml(o.ordered_at || '')}</div>
        ${o.reason ? `<div style="font-size:11.5px; margin-top:4px; opacity:0.85;">Note: ${escapeHtml(o.reason)}</div>` : ''}
      </div>
    `).join('');
  }

  else if (appName === 'vault') {
    title.textContent = 'Vault & Voice Memos';
    renderVaultAndVoiceApp();
  }

  refreshIcons();
}

function renderVaultAndVoiceApp() {
  const screen = document.getElementById('phoneScreen');
  const data = getActivePhoneSnapshot();
  const memos = data.voice_memos || [];
  const secrets = data.secret_vault || [];

  const memosHtml = memos.length > 0
    ? memos.map((vm, i) => `
        <div class="phone-list-item" style="cursor:default;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="font-size:12.5px; color:var(--p-accent);">🎙️ ${escapeHtml(vm.title || `Voice Memo #${i + 1}`)}</strong>
            <span style="font-size:11px; font-family:monospace; color:var(--p-muted);">${escapeHtml(vm.duration || '00:24')}</span>
          </div>
          <div style="font-size:12px; font-style:italic; line-height:1.45; margin-top:4px;">"${escapeHtml(vm.transcript || '')}"</div>
          <div style="font-size:10.5px; color:var(--p-muted); margin-top:4px;">${escapeHtml(vm.recorded_at || '')}</div>
        </div>
      `).join('')
    : '<div class="hint" style="margin-bottom:12px;">No voice recordings found.</div>';

  const vaultSection = isVaultUnlocked
    ? (secrets.length > 0
        ? secrets.map(s => `
            <div class="phone-list-item" style="cursor:default; border-left: 3px solid #ef4444;">
              <div style="font-size:11px; font-weight:700; color:#ef4444; text-transform:uppercase;">${escapeHtml(s.type || 'UNSENT DRAFT / SECRET')}</div>
              <div style="font-size:12.5px; margin-top:4px; line-height:1.5; white-space:pre-wrap;">${escapeHtml(s.content)}</div>
            </div>
          `).join('')
        : '<div class="hint">Vault is empty.</div>')
    : `
      <div class="bank-card" style="text-align:center;">
        <i data-lucide="lock" class="icon-md" style="color:var(--p-accent); margin-bottom:6px;"></i>
        <div style="font-size:13px; font-weight:600; margin-bottom:4px;">Locked Folder (Unsent Drafts & Secrets)</div>
        <div class="hint" style="margin-bottom:10px;">Enter 4-digit device passcode to unlock</div>
        <div style="display:flex; gap:6px; justify-content:center;">
          <input type="password" id="vaultPinInput" maxlength="4" placeholder="••••" style="width:90px; text-align:center; letter-spacing:4px;" />
          <button class="btn primary sm" onclick="unlockSecretVault()">Unlock</button>
        </div>
      </div>
    `;

  screen.innerHTML = `
    <div class="section-label" style="margin-bottom:8px; color:var(--p-muted);">VOICE MEMOS</div>
    ${memosHtml}
    <div class="section-label" style="margin:14px 0 8px; color:var(--p-muted);">PRIVATE VAULT</div>
    ${vaultSection}
  `;
  refreshIcons();
}

function unlockSecretVault() {
  const pin = document.getElementById('vaultPinInput')?.value.trim();
  if (pin === getEffectivePasscode()) {
    isVaultUnlocked = true;
    showToast('Secret Vault Unlocked!');
    renderVaultAndVoiceApp();
  } else {
    showToast('Incorrect Passcode');
  }
}

function toggleGallerySourceMode() {
  galleryUseAiMode = !galleryUseAiMode;
  openPhoneApp('gallery');
}

// ==========================================
// MONTHLY CALENDAR GRID
// ==========================================
function renderMonthlyCalendarView() {
  const screen = document.getElementById('phoneScreen');
  const snap = getActivePhoneSnapshot();
  const events = Array.isArray(snap.calendar) ? snap.calendar : [];

  const year = parseInt(snap.story_year) || 2024;
  const month = parseInt(snap.story_month) || 11;
  const storyDay = parseInt(snap.story_day) || 1;

  if (!selectedCalDay) {
    selectedCalDay = events.length > 0 && events[0].day ? parseInt(events[0].day) : storyDay;
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  let cellsHtml = '';
  for (let i = 0; i < firstDayOfWeek; i++) {
    cellsHtml += `<div></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const hasEvent = events.some(ev => parseInt(ev.day) === d);
    const isSelected = d === selectedCalDay;
    const isStoryToday = d === storyDay;
    cellsHtml += `
      <div class="cal-day-cell ${isSelected ? 'selected' : ''} ${isStoryToday ? 'today' : ''}" onclick="selectCalendarDay(${d})">
        <span>${d}</span>
        ${hasEvent ? '<div class="cal-event-dot"></div>' : ''}
      </div>
    `;
  }

  const dayEvents = events.filter(ev => parseInt(ev.day) === selectedCalDay);
  const detailsHtml = dayEvents.length > 0
    ? dayEvents.map(ev => `
        <div class="phone-list-item" style="cursor:default; border-left: 3px solid var(--p-accent);">
          <div style="font-size:11px; font-weight:700; color:var(--p-accent);">${monthNames[month - 1]} ${selectedCalDay}, ${year} • ${escapeHtml(ev.time || 'All Day')}</div>
          <div style="font-size:13.5px; font-weight:600; margin:3px 0;">${escapeHtml(ev.title)}</div>
          ${ev.note ? `<div style="font-size:12px; color:var(--p-muted);">${escapeHtml(ev.note)}</div>` : ''}
        </div>
      `).join('')
    : `<div class="hint" style="text-align:center; padding:16px 0;">No scheduled events on ${monthNames[month - 1]} ${selectedCalDay}</div>`;

  screen.innerHTML = `
    <div class="cal-header-bar">
      <strong style="font-size:14px;">${monthNames[month - 1]} ${year}</strong>
      <button class="btn secondary sm" style="padding:4px 8px; font-size:11px;" onclick="addCustomCalendarEvent()">
        <i data-lucide="plus" class="icon-xs"></i> Add Event
      </button>
    </div>

    <div class="cal-weekdays">
      <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
    </div>

    <div class="cal-days-grid">
      ${cellsHtml}
    </div>

    <div class="section-label" style="margin-bottom:8px; color:var(--p-muted);">SCHEDULE FOR ${monthNames[month - 1].toUpperCase()} ${selectedCalDay}</div>
    ${detailsHtml}
  `;
  refreshIcons();
}

function selectCalendarDay(dayNum) {
  selectedCalDay = dayNum;
  renderMonthlyCalendarView();
}

async function addCustomCalendarEvent() {
  const title = await appPrompt(`เพิ่มนัดหมายวันที่ ${selectedCalDay}:`, '', 'New Calendar Event');
  if (!title || !title.trim()) return;
  const time = await appPrompt('เวลา (เช่น 14:30):', '15:00', 'Event Time') || 'All Day';

  if (!currentChat.phone_data) currentChat.phone_data = {};
  if (!Array.isArray(currentChat.phone_data.calendar)) currentChat.phone_data.calendar = [];

  currentChat.phone_data.calendar.push({
    day: selectedCalDay,
    time: time.trim(),
    title: title.trim(),
    note: 'Added manually'
  });

  await supabaseClient.from('chats').update({ phone_data: currentChat.phone_data }).eq('id', currentChat.id);
  showToast('เพิ่มลงปฏิทินของห้องแชทนี้เรียบร้อย');
  renderMonthlyCalendarView();
}

// ==========================================
// PHONE SNAPSHOTS HISTORY (PER-CHAT ISOLATED)
// ==========================================
function openPhoneHistoryView() {
  if (!isPhoneUnlocked) return showToast('กรุณาปลดล็อกหน้าจอก่อน');
  const nav = document.getElementById('phoneNavBar');
  const title = document.getElementById('phoneAppTitle');
  const screen = document.getElementById('phoneScreen');

  nav.classList.remove('hidden');
  title.textContent = 'Session Snapshots';

  const history = Array.isArray(currentChat.phone_history) ? currentChat.phone_history : [];
  const currentCard = `
    <div class="phone-list-item" style="${viewingHistoryIndex === -1 ? 'border-color: var(--p-accent);' : ''}" onclick="loadPhoneSnapshot(-1)">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="font-size:13px;">Current Active Sync</strong>
        <span style="font-size:10px; background:var(--p-accent); color:#fff; padding:2px 6px; border-radius:4px;">Latest</span>
      </div>
      <div style="font-size:11.5px; color:var(--p-muted); margin-top:4px;">${escapeHtml(currentChat.phone_data?.story_date_label || 'Active state')}</div>
    </div>
  `;

  const historyHtml = history.map((item, idx) => `
    <div class="phone-list-item" style="${viewingHistoryIndex === idx ? 'border-color: var(--p-accent);' : ''}" onclick="loadPhoneSnapshot(${idx})">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="font-size:12.5px;">Snapshot #${history.length - idx}</strong>
        <button class="msg-action-btn" style="color:#ef4444;" onclick="event.stopPropagation(); deletePhoneSnapshot(${idx})" title="Delete Snapshot">
          <i data-lucide="trash-2" class="icon-xs"></i>
        </button>
      </div>
      <div style="font-size:11px; color:var(--p-muted); margin-top:3px;">${escapeHtml(item.saved_at || '')} • ${escapeHtml(item.data?.story_date_label || '')}</div>
    </div>
  `).join('');

  screen.innerHTML = `
    <p class="hint" style="margin-bottom:10px;">ประวัติข้อมูลมือถือเฉพาะในห้องแชท "${escapeHtml(currentChat.title)}"</p>
    ${currentCard}
    ${historyHtml || '<div class="hint" style="text-align:center; margin-top:16px;">ยังไม่มีประวัติเซฟเก่า</div>'}
  `;
  refreshIcons();
}

function loadPhoneSnapshot(idx) {
  viewingHistoryIndex = idx;
  selectedCalDay = null;
  renderPhoneHome();
  showToast(idx === -1 ? 'กลับมาที่ข้อมูลปัจจุบันแล้ว' : 'โหลดข้อมูลย้อนหลังแล้ว');
}

async function deletePhoneSnapshot(idx) {
  if (!(await appConfirm('ลบประวัติการซิงค์มือถือรอบนี้ทิ้งใช่ไหม?', 'Delete Snapshot'))) return;
  const history = Array.isArray(currentChat.phone_history) ? [...currentChat.phone_history] : [];
  history.splice(idx, 1);

  await supabaseClient.from('chats').update({ phone_history: history }).eq('id', currentChat.id);
  currentChat.phone_history = history;
  if (viewingHistoryIndex === idx) viewingHistoryIndex = -1;
  showToast('ลบประวัติเรียบร้อย');
  openPhoneHistoryView();
}

function openLiveUserThreadInCharPhone() {
  const activePersona = getActivePersona();
  document.getElementById('phoneAppTitle').textContent = activePersona.name;
  const screen = document.getElementById('phoneScreen');
  const liveMsgs = currentMessages.filter(m => m.session_type === 'phone_chat');

  const msgsHtml = liveMsgs.map(m => {
    const isNarration = /^\*[^*]+\*$/.test(m.content.trim());
    if (isNarration) {
      return `<div class="hybrid-narration-line">${escapeHtml(m.content.replace(/^\*|\*$/g, ''))}</div>`;
    }
    return `
      <div class="phone-chat-bubble ${m.role === 'assistant' ? 'outgoing' : 'incoming'}">
        ${formatRichContent(m.content, m.role === 'user' ? activePersona.name : currentChar.name)}
      </div>
    `;
  }).join('');

  screen.innerHTML = `<button class="btn ghost sm" style="margin-bottom: 12px; color:var(--p-text); border-color:var(--p-border);" onclick="openPhoneApp('messages')">← Back</button><div style="display:flex; flex-direction:column;">${msgsHtml}</div>`;
}

function openPhoneChatThread(index) {
  const snap = getActivePhoneSnapshot();
  const chat = snap.chats[index];
  if (!chat) return;
  document.getElementById('phoneAppTitle').textContent = chat.contact;
  const screen = document.getElementById('phoneScreen');
  const msgsHtml = (chat.messages || []).map(m => `
    <div class="phone-chat-bubble ${m.from === 'me' ? 'outgoing' : 'incoming'}">
      <div>${escapeHtml(m.text)}</div>
      ${m.time ? `<div style="font-size:9.5px; opacity:0.65; margin-top:3px; text-align:right;">${escapeHtml(m.time)}</div>` : ''}
    </div>
  `).join('');
  screen.innerHTML = `<button class="btn ghost sm" style="margin-bottom: 12px; color:var(--p-text); border-color:var(--p-border);" onclick="openPhoneApp('messages')">← Back</button><div style="display:flex; flex-direction:column;">${msgsHtml}</div>`;
}

// สร้างข้อมูลมือถือ 10 แอป + ซิงค์รูปจริง + บันทึกลง currentChat (แยกตามห้องแชท!)
async function generatePhoneContent(isManualResync = true) {
  if (!deepseekApiKey) return showToast('กรุณาใส่ DeepSeek API Key ก่อน');
  const btn = document.getElementById('btnGeneratePhone');
  btn.disabled = true;
  setPhoneLoading(true, `Syncing ${currentChar.name}'s Device...`, 'Generating session-specific apps, theme palette, and real gallery photos');

  try {
    const activePersona = getActivePersona();
    const recentHistory = currentMessages.slice(-14).map(m => `${m.role}: ${stripOocText(m.content)}`).join('\n');
    const customPassRule = currentChar.phone_passcode
      ? `Use this exact 4-digit passcode: "${currentChar.phone_passcode}".`
      : `Create a meaningful 4-digit passcode based on the character's lore or birthday.`;

    const npcListStr = Array.isArray(currentChar.supporting_chars) && currentChar.supporting_chars.length > 0
      ? currentChar.supporting_chars.map(n => `${n.name} (${n.role})`).join(', ')
      : 'None specified';

    const prompt = `Generate realistic, cross-consistent smartphone data for the character "${currentChar.name}" in this specific roleplay timeline.

[Character Lore & Setting]
Personality & Occupation/School: ${currentChar.personality || 'Not specified'}
Important Dates & Story Timeline Year/Month: ${currentChar.important_dates || 'None'}
Supporting Cast / NPCs: ${npcListStr}
Scenario / Current Scene: ${currentChar.scenario || 'Not specified'}
Lore Starting Balance: ${currentChar.starting_balance || '$5,000.00'}
Roleplay Partner: ${activePersona.name}

[Recent Roleplay Context]
${recentHistory}

[STRICT RULES — FOLLOW EVERY SINGLE ONE]
1. SYSTEM LANGUAGE = ENGLISH ONLY: Write ALL UI labels, messages, notes, calendar events, browser searches, voice memos, and secrets in natural ENGLISH regardless of the character's nationality! (Romanized local names like "Hongdae", "Tteokbokki", or "Gangnam" are allowed for flavor, NEVER Korean/Japanese/Chinese characters).
2. DYNAMIC VIBE PALETTE: Generate a custom hex color palette in "theme_palette" matching the character's personality. Ensure high contrast between bg_color and text_color!
3. STORY-ACCURATE CALENDAR: Extract the exact year, month (1-12), and current day from the story/lore. Populate "calendar" with realistic events on specific day numbers (1-31) matching their life AND upcoming plans discussed in the roleplay!
4. CROSS-APP CONSISTENCY: Use supporting cast NPCs in Messages/Calendar when appropriate. Match timestamps and amounts across Messages, Shopping, and Banking (use varied minute timestamps like 16:04, 19:18).
5. GALLERY KEYWORDS: Provide a simple 2-word English object/scene "search_keyword" (e.g., "ice rink", "coffee cup", "night street", "snowy city") plus "visual_desc".
6. SECRET VAULT & VOICE MEMOS: Populate "voice_memos" (1-2 candid audio recordings) and "secret_vault" (unsent text drafts to ${activePersona.name} or deep lore secrets).
7. PASSCODE: ${customPassRule}

Output valid JSON ONLY matching this exact schema:
{
  "story_year": 2024,
  "story_month": 11,
  "story_day": 14,
  "story_date_label": "Thursday, November 14, 2024",
  "passcode": "0136",
  "passcode_hint": "Short clue in English",
  "theme_palette": {
    "bg_color": "#141418",
    "card_color": "#1e1e24",
    "border_color": "#2e2e38",
    "text_color": "#f4f4f5",
    "muted_color": "#9ca3af",
    "accent_color": "#8b5cf6",
    "notif_bg": "#c2410c",
    "notif_text": "#ffffff"
  },
  "chats": [
    {
      "contact": "NPC or Lore Contact",
      "time": "16:04",
      "last_msg": "Preview text",
      "messages": [
        { "from": "them", "text": "Message text", "time": "16:04" },
        { "from": "me", "text": "Reply text", "time": "16:06" }
      ]
    }
  ],
  "gallery": [
    { "search_keyword": "night street", "visual_desc": "Detailed photo description", "caption": "Short caption", "location": "Neighborhood", "taken_at": "Yesterday 18:42" }
  ],
  "calendar": [
    { "day": 14, "time": "10:30", "title": "Event today", "note": "Details" },
    { "day": 18, "time": "15:00", "title": "Upcoming plan", "note": "Details" }
  ],
  "todos": [
    { "task": "Task item", "due": "Tomorrow", "done": false }
  ],
  "maps": [
    { "place": "Place name", "time": "Today 15:12", "note": "Reason" }
  ],
  "browser": [
    { "query": "Search query in English", "time": "23:14", "visited_site": "Naver / Google" }
  ],
  "bank": {
    "balance": "Formatted balance matching setting currency",
    "transactions": [
      { "title": "Transfer or Shop", "datetime": "Today 16:07", "amount": "+₩50,000" }
    ]
  },
  "music": {
    "now_playing": "Song Title",
    "artist": "Artist Name",
    "lyric_mood": "Short lyric line",
    "playlist": [
      { "title": "Track 1", "artist": "Artist 1" }
    ]
  },
  "shopping": [
    { "item": "Item name", "price": "₩18,500", "status": "Shipped", "ordered_at": "Today 19:18", "reason": "Reason" }
  ],
  "voice_memos": [
    { "title": "Late night recording", "duration": "00:38", "transcript": "Spoken words & vocal tone description", "recorded_at": "Yesterday 01:14" }
  ],
  "secret_vault": [
    { "type": "UNSENT MESSAGE TO ${activePersona.name.toUpperCase()}", "content": "Drafted text they deleted before sending" },
    { "type": "HIDDEN LORE SECRET", "content": "Confidential note or secret" }
  ]
}`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekApiKey}` },
      body: JSON.stringify({ model: 'deepseek-flash', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 1.0 })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const rawJson = data.choices[0].message.content.replace(/```json|```/gi, '').trim();
    const parsedPhoneData = JSON.parse(rawJson);

    if (Array.isArray(parsedPhoneData.gallery)) {
      parsedPhoneData.gallery.forEach((p) => {
        resolveGalleryPhotoUrl(p, galleryUseAiMode);
      });
    }

    const oldHistory = Array.isArray(currentChat.phone_history) ? [...currentChat.phone_history] : [];
    if (currentChat.phone_data && Object.keys(currentChat.phone_data).length > 0) {
      oldHistory.unshift({
        saved_at: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        data: currentChat.phone_data
      });
      if (oldHistory.length > 15) oldHistory.pop();
    }

    await supabaseClient.from('chats').update({
      phone_data: parsedPhoneData,
      phone_history: oldHistory
    }).eq('id', currentChat.id);

    currentChat.phone_data = parsedPhoneData;
    currentChat.phone_history = oldHistory;
    viewingHistoryIndex = -1;
    selectedCalDay = null;
    isVaultUnlocked = false;
    applyDynamicPhoneTheme(parsedPhoneData);

    setPhoneLoading(false);
    if (isManualResync && isPhoneUnlocked) {
      renderPhoneHome();
      showToast('Synced device for this chat session!');
    } else {
      enteredPasscode = '';
      isPhoneUnlocked = false;
      renderPhoneLockscreen();
    }
    fetchDeepSeekBalance();
  } catch (err) {
    setPhoneLoading(false);
    showToast('Sync failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="refresh-cw" class="icon-xs"></i> Sync Latest Timeline';
    refreshIcons();
  }
}

// --- UTILITIES ---
function setLoading(isLoading) {
  document.getElementById('btnSend').disabled = isLoading;
  document.getElementById('btnContinue').disabled = isLoading;
  document.getElementById('btnTriggerPhoneReply').disabled = isLoading;
  document.getElementById('messageInput').disabled = isLoading;
  document.getElementById('headerStatus').textContent = isLoading ? 'Typing...' : 'Ready';
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); refreshIcons(); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function toggleSidebar(side) {
  if (side === 'left') document.getElementById('sidebarLeft').classList.toggle('open');
  if (side === 'right') document.getElementById('sidebarRight').classList.toggle('open');
}

function setupTextareaAutoResize() {
  const tx = document.getElementById('messageInput');
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