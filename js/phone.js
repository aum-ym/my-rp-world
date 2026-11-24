// ==========================================
// 5. UNIFIED PHONE MODE, MY PHONE & CHARACTER SMARTPHONE OS
// ==========================================

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
    title.textContent = 'Wallet & History';
    const history = getUserWalletHistory();
    const historyHtml = history.length > 0
      ? history.map(tx => `
          <div class="phone-list-item" style="cursor:default; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="overflow:hidden; padding-right:8px;">
              <div style="font-size:12.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(tx.title)}</div>
              <div style="font-size:10.5px; color:var(--text-muted);">${escapeHtml(tx.note || '')} • ${escapeHtml(tx.time || '')}</div>
            </div>
            <div style="font-weight:700; font-size:12.5px; white-space:nowrap; color:${tx.type === 'in' ? '#34d399' : '#f43f5e'};">
              ${tx.type === 'in' ? '+' : '-'}${escapeHtml(tx.amount)}
            </div>
          </div>
        `).join('')
      : '<div class="hint" style="text-align:center; padding:12px 0;">ยังไม่มีประวัติการโอนเข้า-ออก</div>';

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
      <button class="btn primary full" style="margin-bottom:16px;" onclick="sendTransferToBot()">
        <i data-lucide="arrow-up-right" class="icon-xs"></i> โอนเงินเข้าแชททันที
      </button>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div class="section-label" style="margin:0;">TRANSACTION HISTORY</div>
        ${history.length > 0 ? `<button class="msg-action-btn" style="font-size:10.5px;" onclick="clearUserWalletHistory()">Clear</button>` : ''}
      </div>
      ${historyHtml}
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

function getUserWalletHistoryKey() {
  return `user_wallet_tx_${currentChat ? currentChat.id : 'global'}`;
}

function getUserWalletHistory() {
  try {
    return JSON.parse(localStorage.getItem(getUserWalletHistoryKey()) || '[]');
  } catch {
    return [];
  }
}

function addUserWalletTransaction(type, title, amount, note) {
  const list = getUserWalletHistory();
  list.unshift({
    type, // 'in' หรือ 'out'
    title,
    amount,
    note,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  if (list.length > 40) list.pop();
  localStorage.setItem(getUserWalletHistoryKey(), JSON.stringify(list));
}

function clearUserWalletHistory() {
  localStorage.removeItem(getUserWalletHistoryKey());
  openUserPhoneApp('wallet');
  showToast('ล้างประวัติการเงินแล้ว');
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
  addUserWalletTransaction('out', `To ${currentChar.name}`, formattedAmt, noteStr);

  closeModal('userPhoneModal');
  await sendRawUserAction(`[USER_TRANSFER: ${formattedAmt} | ${currentChar.name} | ${noteStr}]`);
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
  const regex = /\[BOT_TRANSFER:\s*([^|\]]+)\|\s*([^|\]]+)(?:\|\s*([^\]]+))?\]/gi;
  const activePersonaName = getActivePersona().name.toLowerCase();
  let match;

  while ((match = regex.exec(botText)) !== null) {
    const rawAmt = match[1].trim();
    const part2 = match[2].trim();
    const part3 = match[3] ? match[3].trim() : null;

    // ถ้าระบุ 3 ส่วน part2 คือชื่อผู้รับ, ถ้าระบุ 2 ส่วนแบบเก่าถือว่าโอนให้ User
    const recipient = part3 !== null ? part2 : activePersonaName;
    const note = part3 !== null ? part3 : part2;
    const recLower = recipient.toLowerCase();

    const isForUser =
      recLower === activePersonaName ||
      recLower.includes(activePersonaName) ||
      activePersonaName.includes(recLower) ||
      recLower === 'user' ||
      recLower === 'you' ||
      recLower === 'me' ||
      recLower === '{{user}}';

    if (isForUser) {
      const numVal = parseFloat(rawAmt.replace(/[^0-9.]/g, ''));
      if (!isNaN(numVal)) {
        userWalletBalance += numVal;
        localStorage.setItem('user_wallet_balance', String(userWalletBalance));
        addUserWalletTransaction('in', `From ${currentChar.name}`, rawAmt, note);
        showToast(`ได้รับเงินโอน ${rawAmt} เข้ากระเป๋าแล้ว!`);
      }
    }
  }
}

// ==========================================
// CHARACTER'S SMARTPHONE OS (PER-CHAT ISOLATED + 10 APPS)
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
    return `https://image.pollinations.ai/prompt/${promptText}?width=600&height=400&nologo=true`;
  }

  if (photoObj.cached_real_url && photoObj.cached_real_url.includes('picsum.photos')) {
    return photoObj.cached_real_url;
  }

  const seed = encodeURIComponent((photoObj.search_keyword || photoObj.caption || 'photo').trim().toLowerCase());
  const reliablePhotoUrl = `https://picsum.photos/seed/${seed}/600/400`;
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
      const fallbackUrl = `https://picsum.photos/seed/fallback_${idx}_${Date.now()}/600/400`;

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

// ==========================================
// GENERATE PHONE CONTENT VIA DEEPSEEK
// ==========================================
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

    const charSummaryForPhone = [
      currentChar.basic_info,
      currentChar.personality_trauma || currentChar.personality,
      currentChar.assets_items
    ].filter(Boolean).join('\n');

    const prompt = `Generate realistic, cross-consistent smartphone data for the character "${currentChar.name}" in this specific roleplay timeline.

[Character Lore & Setting]
${charSummaryForPhone || 'Not specified'}
World & Dates: ${currentChar.world_setting || currentChar.important_dates || 'None'}
Supporting Cast / NPCs: ${npcListStr}
Scenario / Current Scene: ${currentChar.scenario || 'Not specified'}
Lore Starting Balance: ${currentChar.starting_balance || '$5,000.00'}
Roleplay Partner: ${activePersona.name}

[Recent Roleplay Context]
${recentHistory}

[STRICT RULES — FOLLOW EVERY SINGLE ONE]
1. SYSTEM LANGUAGE = ENGLISH ONLY: Write ALL UI labels, messages, notes, calendar events, browser searches, voice memos, and secrets in natural ENGLISH regardless of the character's nationality! (Romanized local names like "Gongguan", "Tteokbokki", or "Taipei" are allowed for flavor, NEVER Korean/Japanese/Chinese characters).
2. DYNAMIC VIBE PALETTE: Generate a custom hex color palette in "theme_palette" matching the character's personality. Ensure high contrast between bg_color and text_color!
3. STORY-ACCURATE CALENDAR: Extract the exact year, month (1-12), and current day from the story/lore. Populate "calendar" with realistic events on specific day numbers (1-31) matching their life AND upcoming plans discussed in the roleplay!
4. CROSS-APP CONSISTENCY: Use supporting cast NPCs in Messages/Calendar when appropriate. Match timestamps and amounts across Messages, Shopping, and Banking (use varied minute timestamps like 16:04, 19:18).
5. GALLERY KEYWORDS: Provide a simple 2-word English object/scene "search_keyword" (e.g., "motorcycle night", "coffee cup", "rainy street", "workshop tools") plus "visual_desc".
6. SECRET VAULT & VOICE MEMOS: Populate "voice_memos" (1-2 candid audio recordings) and "secret_vault" (unsent text drafts to ${activePersona.name} or deep lore secrets).
7. PASSCODE: ${customPassRule}

Output valid JSON ONLY matching this exact schema:
{
  "story_year": 2024,
  "story_month": 11,
  "story_day": 14,
  "story_date_label": "Thursday, November 14, 2024",
  "passcode": "1114",
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
    { "query": "Search query in English", "time": "23:14", "visited_site": "Google" }
  ],
  "bank": {
    "balance": "Formatted balance matching setting currency",
    "transactions": [
      { "title": "Transfer or Shop", "datetime": "Today 16:07", "amount": "-$25.00" }
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
    { "item": "Item name", "price": "$45.00", "status": "Shipped", "ordered_at": "Today 19:18", "reason": "Reason" }
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