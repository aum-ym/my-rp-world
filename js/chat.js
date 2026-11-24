// ==========================================
// 4. CHAT SESSIONS, RENDERING, OOC, SWIPES & DEEPSEEK XML ENGINE
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
  document.getElementById('rightCharBioPreview').textContent = getCharacterSummaryPreview(currentChar);
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
// ALBUM, FAVORITES & EXPORT
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
  showToast('สำรองข้อมูลตัวละครและห้องแชท (.json) เรียบร้อย');
}

// ==========================================
// OOC PARSER & RICH CONTENT FORMATTER
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
// SEND MESSAGE & CORE API CALL (XML + CONTEXT CACHE + KEYWORD LOREBOOK)
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

async function sendMessage() {
  const inputEl = document.getElementById('messageInput');
  const rawText = inputEl.value.trim();
  if (!rawText && !selectedImageFile) return;

  if (!deepseekApiKey) return showToast('กรุณาใส่ DeepSeek API Key ในเมนู API Settings ก่อน');

  inputEl.value = '';
  inputEl.style.height = 'auto';

  await prunePreviousBotSwipes();

  const { oocDirective } = parseOocFromInput(rawText);
  const oocSystemRule = oocDirective
    ? `[OOC DIRECTIVE FROM USER]: "${oocDirective}"
- If this OOC is a scene direction or time skip, execute it seamlessly in the story narration without breaking character.
- If this OOC is a question asking for a recap, status check, or behind-the-scenes clarification, answer the user's OOC question directly and helpfully inside an [OOC: ...] block!`
    : '';

  // 1. Unified Phone Mode -> Texting
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

  // 2. Unified Phone Mode -> Voice Call
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

function matchesLoreKeywords(entry, scanBlob) {
  if (entry.always_active) return true;
  if (!entry.keywords || !entry.keywords.trim()) return true;
  const kwList = entry.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  if (kwList.length === 0) return true;
  return kwList.some(kw => scanBlob.includes(kw));
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

  // 1. <character_profile> (อยู่บนสุดเสมอ เพื่อรักษา DeepSeek Context Cache)
  const personalityBlock = currentChar.personality_trauma || currentChar.personality || 'Not specified.';
  const characterProfileXml = `<character_profile>
Name: ${currentChar.name}
Financial Status / Starting Balance: ${currentChar.starting_balance || '$5,000.00'}

### Basic Information
${currentChar.basic_info || 'Not specified.'}

### Physical Appearance & Style
${currentChar.appearance_style || 'Not specified.'}

### Personality, Trauma & Triggers (STRICTLY INTERNALIZED — DO NOT REVEAL SECRETS UNLESS TRIGGERED)
${personalityBlock}

### Speech & Dynamics
${currentChar.speech_dynamics || 'Not specified.'}

### Assets & Everyday Carry (EDC)
${currentChar.assets_items || 'Not specified.'}
${currentChar.example_dialogue ? `\n### Example Dialogue\n${currentChar.example_dialogue}` : ''}
</character_profile>`;

  // 2. <world_context>
  const worldSettingText = currentChar.world_setting || currentChar.important_dates || 'Not specified.';
  const worldContextXml = `<world_context>
### Setting & Cultural Context
${worldSettingText}

### Initial Relationship with ${activePersona.name}
${currentChar.user_relationship || 'Not specified.'}

### Current Opening Scenario
${currentChar.scenario || 'Not specified.'}

### Roleplay Partner (${activePersona.name})
${activePersona.description || 'Not specified.'}
</world_context>`;

  // สแกนหา Keyword ใน 5 ข้อความล่าสุด + Scenario
  const recentScanBlob = (
    (currentChar.scenario || '') + ' ' +
    messageHistory.slice(-5).map(m => m.content).join(' ')
  ).toLowerCase();

  // 3. <active_locations>
  const allLocs = Array.isArray(currentChar.locations) ? currentChar.locations : [];
  const triggeredLocs = allLocs.filter(l => matchesLoreKeywords(l, recentScanBlob));
  const activeLocationsXml = triggeredLocs.length > 0
    ? `\n<active_locations>\n${triggeredLocs.map(l => `### ${l.name}\n#### Vibe & Atmosphere\n${l.details || 'Standard'}\n\n#### Strict Rules\n${l.rules || 'None'}`).join('\n\n')}\n</active_locations>\n`
    : '';

  // 4. <relevant_lore>
  const charNpcs = Array.isArray(currentChar.supporting_chars) ? currentChar.supporting_chars : [];
  const triggeredCharNpcs = charNpcs.filter(n => matchesLoreKeywords(n, recentScanBlob));
  const userNpcs = Array.isArray(activePersona.supporting_chars) ? activePersona.supporting_chars : [];

  const loreEntries = [
    ...triggeredCharNpcs.map(n => `### ${n.name} (${n.role || 'Lore Entry'})\n${n.content || n.traits || ''}`),
    ...userNpcs.map(n => `### ${n.name} (${activePersona.name}'s ${n.role || 'Ally'})\n${n.traits || ''}`)
  ];
  const relevantLoreXml = loreEntries.length > 0
    ? `\n<relevant_lore>\n${loreEntries.join('\n\n')}\n</relevant_lore>\n`
    : '';

  // Upcoming Phone Calendar
  const pData = currentChat.phone_data || {};
  let upcomingScheduleBlock = '';
  if (Array.isArray(pData.calendar) && pData.calendar.length > 0) {
    const calItems = pData.calendar.map(c => `- ${pData.story_year || ''}-${pData.story_month || ''}-${c.day || c.date}: ${c.title} (${c.time || 'All day'}) ${c.note ? '- ' + c.note : ''}`).join('\n');
    upcomingScheduleBlock = `\n<phone_calendar>\n${calItems}\n</phone_calendar>\n`;
  }

  const rubiiInstruction = useRubiiHtml
    ? `\n- [Interactive UI Widget]: When the scene naturally involves a smartphone screen, text message, letter, or status window, you MAY include a compact dark-mode HTML/CSS widget inside \`\`\`html and \`\`\` tags (inline CSS only, background #18181c, border 1px solid #2a2a32).`
    : '';

  const systemPrompt = `${currentChar.system_prompt ? currentChar.system_prompt + '\n\n' : ''}You are roleplaying as ${currentChar.name}.

${characterProfileXml}

${worldContextXml}
${activeLocationsXml}${relevantLoreXml}${upcomingScheduleBlock}
<pinned_memory>
${currentChat.memory_notes || 'None.'}
</pinned_memory>

<roleplay_rules>
- Obey all facts in <character_profile>, <world_context>, and <active_locations> without contradicting dates, trauma triggers, or location rules.
- Stay strictly in character as ${currentChar.name}. Never speak or act on behalf of ${activePersona.name}.
- Use *asterisks* for actions/thoughts and standard text or "quotes" for spoken dialogue.
- [Emojis & Stickers]: You may use natural emojis in casual messages or phone texts, and send chat stickers using [STICKER: name] (Available: ${allStickerNames}).
- [Money Transfer]: If ${activePersona.name} transfers money to you ([USER_TRANSFER: amount | note]), react naturally! If the story makes sense for YOU (${currentChar.name}) to transfer money to ${activePersona.name}, include [BOT_TRANSFER: amount | reason] on its own line (use currency "${userCurrency}" if appropriate).${rubiiInstruction}
${activeStyle && activeStyle.prompt ? '- ' + activeStyle.prompt : ''}
</roleplay_rules>`;

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

// ==========================================
// INLINE EDIT, CASCADE DELETE & AUTO-SUMMARY
// ==========================================
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