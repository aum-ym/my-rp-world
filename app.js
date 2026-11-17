// --- STATE MANAGEMENT ---
let supabaseClient = null;
let characters = [];
let currentChar = null;
let currentChat = null;
let currentMessages = [];
let userPersona = { name: 'User', persona: '' };
let selectedImageFile = null;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  loadLocalSettings();
  setupTextareaAutoResize();
  
  // นับจำนวนตัวอักษรใน User Persona แบบเรียลไทม์
  document.getElementById('personaDesc').addEventListener('input', (e) => {
    document.getElementById('personaCharCount').textContent = `${e.target.value.length.toLocaleString()} chars`;
  });

  // กด Enter เพื่อส่ง (Shift + Enter เพื่อขึ้นบรรทัดใหม่)
  document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});

function loadLocalSettings() {
  const dsKey = localStorage.getItem('ds_api_key') || '';
  const sbUrl = localStorage.getItem('sb_url') || '';
  const sbKey = localStorage.getItem('sb_key') || '';

  document.getElementById('cfgDeepseekKey').value = dsKey;
  document.getElementById('cfgSupabaseUrl').value = sbUrl;
  document.getElementById('cfgSupabaseKey').value = sbKey;

  if (sbUrl && sbKey) {
    initSupabase(sbUrl, sbKey);
  } else {
    document.getElementById('charList').innerHTML = '<div class="empty-hint">กรุณาตั้งค่า API Keys ก่อนเริ่มใช้งาน</div>';
  }
}

function saveSettings() {
  const dsKey = document.getElementById('cfgDeepseekKey').value.trim();
  const sbUrl = document.getElementById('cfgSupabaseUrl').value.trim();
  const sbKey = document.getElementById('cfgSupabaseKey').value.trim();

  if (!dsKey || !sbUrl || !sbKey) {
    alert('กรอกข้อมูลให้ครบทั้ง 3 ช่องก่อนนะ!');
    return;
  }

  localStorage.setItem('ds_api_key', dsKey);
  localStorage.setItem('sb_url', sbUrl);
  localStorage.setItem('sb_key', sbKey);

  closeModal('settingsModal');
  initSupabase(sbUrl, sbKey);
}

async function initSupabase(url, key) {
  try {
    supabaseClient = window.supabase.createClient(url, key);
    await loadUserPersona();
    await loadCharacters();
  } catch (err) {
    console.error(err);
    alert('เชื่อมต่อ Supabase ไม่สำเร็จ เช็ก URL กับ Key อีกทีนะ: ' + err.message);
  }
}

// --- USER PERSONA ---
async function loadUserPersona() {
  const { data } = await supabaseClient.from('user_profiles').select('*').eq('id', 'default_user').single();
  if (data) {
    userPersona = { name: data.name || 'User', persona: data.persona || '' };
  }
}

function openPersonaModal() {
  document.getElementById('personaName').value = userPersona.name;
  document.getElementById('personaDesc').value = userPersona.persona;
  document.getElementById('personaCharCount').textContent = `${userPersona.persona.length.toLocaleString()} chars`;
  openModal('personaModal');
}

async function savePersona() {
  if (!supabaseClient) return alert('กรุณาเชื่อมต่อ Supabase ใน ⚙️ API Keys ก่อน');
  const name = document.getElementById('personaName').value.trim() || 'User';
  const persona = document.getElementById('personaDesc').value;

  const { error } = await supabaseClient.from('user_profiles').upsert({
    id: 'default_user',
    name,
    persona,
    updated_at: new Date().toISOString()
  });

  if (error) return alert('เซฟไม่สำเร็จ: ' + error.message);
  userPersona = { name, persona };
  closeModal('personaModal');
  alert('บันทึก User Persona ลง Cloud เรียบร้อย!');
}

// --- CHARACTERS CRUD ---
async function loadCharacters() {
  const { data, error } = await supabaseClient.from('characters').select('*').order('created_at', { ascending: false });
  if (error) return console.error(error);

  characters = data || [];
  renderCharList();
}

function renderCharList() {
  const listEl = document.getElementById('charList');
  if (characters.length === 0) {
    listEl.innerHTML = '<div class="empty-hint">ยังไม่มีตัวละคร กด + New Character เลย!</div>';
    return;
  }

  listEl.innerHTML = characters.map(c => `
    <div class="char-item ${currentChar && currentChar.id === c.id ? 'active' : ''}" onclick="selectCharacter('${c.id}')">
      <img src="${c.avatar_url || 'https://via.placeholder.com/40/27272a/a1a1aa?text=' + c.name[0]}" class="avatar-sm" />
      <div style="overflow:hidden;">
        <div style="font-weight:600; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${escapeHtml(c.name)}</div>
      </div>
    </div>
  `).join('');
}

function openCharModal(isEdit = false) {
  if (isEdit && currentChar) {
    document.getElementById('charModalTitle').textContent = '✏️ Edit Character';
    document.getElementById('editCharId').value = currentChar.id;
    document.getElementById('charName').value = currentChar.name;
    document.getElementById('charAvatar').value = currentChar.avatar_url || '';
    document.getElementById('charPersonality').value = currentChar.personality || '';
    document.getElementById('charScenario').value = currentChar.scenario || '';
    document.getElementById('charFirstMsg').value = currentChar.first_message || '';
    document.getElementById('charHtmlBio').value = currentChar.html_bio || '';
    document.getElementById('btnDeleteChar').classList.remove('hidden');
  } else {
    document.getElementById('charModalTitle').textContent = '+ Create Character';
    document.getElementById('editCharId').value = '';
    document.getElementById('charName').value = '';
    document.getElementById('charAvatar').value = '';
    document.getElementById('charPersonality').value = '';
    document.getElementById('charScenario').value = '';
    document.getElementById('charFirstMsg').value = '';
    document.getElementById('charHtmlBio').value = '';
    document.getElementById('btnDeleteChar').classList.add('hidden');
  }
  openModal('charModal');
}

async function saveCharacter() {
  if (!supabaseClient) return alert('กรุณาตั้งค่า Supabase ก่อน');
  const id = document.getElementById('editCharId').value;
  const payload = {
    name: document.getElementById('charName').value.trim(),
    avatar_url: document.getElementById('charAvatar').value.trim(),
    personality: document.getElementById('charPersonality').value.trim(),
    scenario: document.getElementById('charScenario').value.trim(),
    first_message: document.getElementById('charFirstMsg').value.trim(),
    html_bio: document.getElementById('charHtmlBio').value
  };

  if (!payload.name || !payload.first_message) {
    return alert('ต้องใส่ชื่อตัวละคร และ First Message อย่างน้อยนะ!');
  }

  if (id) {
    const { data, error } = await supabaseClient.from('characters').update(payload).eq('id', id).select().single();
    if (error) return alert(error.message);
    currentChar = data;
  } else {
    const { data, error } = await supabaseClient.from('characters').insert(payload).select().single();
    if (error) return alert(error.message);
    currentChar = data;
  }

  closeModal('charModal');
  await loadCharacters();
  selectCharacter(currentChar.id);
}

async function deleteCharacter() {
  if (!currentChar || !confirm(`แน่ใจนะว่าจะลบ "${currentChar.name}" และแชททั้งหมดทิ้ง?`)) return;
  await supabaseClient.from('characters').delete().eq('id', currentChar.id);
  currentChar = null;
  currentChat = null;
  closeModal('charModal');
  await loadCharacters();
  location.reload();
}

function openBioModal() {
  if (!currentChar) return;
  document.getElementById('bioModalTitle').textContent = `${currentChar.name} — Profile`;
  const container = document.getElementById('bioRenderContainer');
  container.innerHTML = currentChar.html_bio || '<p style="color:#9ca3af;">ผู้สร้างยังไม่ได้ใส่โค้ด HTML Profile สำหรับตัวละครนี้</p>';
  openModal('bioModal');
}

// --- CHAT & MESSAGES ---
async function selectCharacter(charId) {
  currentChar = characters.find(c => c.id === charId);
  if (!currentChar) return;

  // อัปเดต UI Header & ปุ่มต่าง ๆ
  document.getElementById('headerCharName').textContent = currentChar.name;
  document.getElementById('headerAvatar').src = currentChar.avatar_url || 'https://via.placeholder.com/40/27272a/a1a1aa?text=' + currentChar.name[0];
  ['btnViewBio', 'btnEditChar', 'btnAttach', 'messageInput', 'btnSend', 'memoryInput', 'btnSaveMemory', 'btnResetChat'].forEach(id => {
    document.getElementById(id).disabled = false;
  });

  renderCharList();
  if (window.innerWidth <= 900) document.getElementById('sidebarLeft').classList.remove('open');

  // ดึงห้องแชทของตัวละครนี้ (ถ้าไม่มีให้สร้างใหม่)
  let { data: chat } = await supabaseClient.from('chats').select('*').eq('character_id', charId).single();
  if (!chat) {
    const { data: newChat } = await supabaseClient.from('chats').insert({ character_id: charId }).select().single();
    chat = newChat;
  }
  currentChat = chat;
  document.getElementById('memoryInput').value = currentChat.memory_notes || '';

  // ดึงข้อความทั้งหมด
  const { data: msgs } = await supabaseClient.from('messages').select('*').eq('chat_id', currentChat.id).order('created_at', { ascending: true });
  
  if (!msgs || msgs.length === 0) {
    // ใส่ First Message อัตโนมัติ
    const { data: firstMsg } = await supabaseClient.from('messages').insert({
      chat_id: currentChat.id,
      role: 'assistant',
      content: currentChar.first_message
    }).select().single();
    currentMessages = [firstMsg];
  } else {
    currentMessages = msgs;
  }

  renderMessages();
}

function renderMessages() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = currentMessages.map((m, idx) => {
    const isUser = m.role === 'user';
    const senderName = isUser ? userPersona.name : currentChar.name;
    const formattedText = formatRoleplayText(m.content);
    const imgHtml = m.image_url ? `<img src="${m.image_url}" class="msg-image" />` : '';

    return `
      <div class="msg-wrapper ${m.role}">
        <div class="msg-sender">${escapeHtml(senderName)}</div>
        <div class="msg-bubble">${imgHtml}${formattedText}</div>
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="editMessage('${m.id}')">✏️ Edit</button>
          ${!isUser && idx === currentMessages.length - 1 ? `<button class="msg-action-btn" onclick="regenerateLast()">🔄 Regenerate</button>` : ''}
          <button class="msg-action-btn" onclick="deleteMessage('${m.id}')">🗑️ Delete</button>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

// แปลง *action* ให้เป็นตัวเอียงสีม่วงอ่อนอ่านง่ายแบบเว็บโรลเพลย์
function formatRoleplayText(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/\*([^*]+)\*/g, '<em>*$1*</em>');
  return safe;
}

async function saveMemory() {
  if (!currentChat) return;
  const notes = document.getElementById('memoryInput').value;
  await supabaseClient.from('chats').update({ memory_notes: notes, updated_at: new Date().toISOString() }).eq('id', currentChat.id);
  currentChat.memory_notes = notes;
  alert('บันทึกความจำลง Cloud แล้ว!');
}

// --- IMAGE UPLOAD ---
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
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const { error } = await supabaseClient.storage.from('rp-images').upload(fileName, file);
  if (error) throw error;

  const { data } = supabaseClient.storage.from('rp-images').getPublicUrl(fileName);
  return data.publicUrl;
}

// --- SEND & DEEPSEEK API ---
async function sendMessage() {
  const inputEl = document.getElementById('messageInput');
  const text = inputEl.value.trim();
  if (!text && !selectedImageFile) return;

  const dsKey = localStorage.getItem('ds_api_key');
  if (!dsKey) return alert('กรุณาใส่ DeepSeek API Key ก่อน!');

  inputEl.value = '';
  inputEl.style.height = 'auto';
  setLoading(true);

  try {
    let uploadedImageUrl = null;
    if (selectedImageFile) {
      document.getElementById('headerStatus').textContent = 'Uploading image...';
      uploadedImageUrl = await uploadImageToSupabase(selectedImageFile);
      clearSelectedImage();
    }

    // 1. บันทึกข้อความฝั่ง User ลง Supabase
    const { data: userMsg } = await supabaseClient.from('messages').insert({
      chat_id: currentChat.id,
      role: 'user',
      content: text || '(Sent an image)',
      image_url: uploadedImageUrl
    }).select().single();

    currentMessages.push(userMsg);
    renderMessages();

    // 2. เรียก DeepSeek API
    await fetchBotReply(dsKey);

  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาด: ' + err.message);
  } finally {
    setLoading(false);
  }
}

async function fetchBotReply(dsKey) {
  document.getElementById('headerStatus').textContent = `${currentChar.name} is typing...`;
  const model = document.getElementById('modelSelect').value;

  // สร้าง System Prompt รวม Persona + Character + Pinned Memory
  const systemPrompt = `You are roleplaying as ${currentChar.name}.
[Character Personality & Lore]
${currentChar.personality || 'Not specified.'}

[Current Scenario]
${currentChar.scenario || 'Not specified.'}

[User / Roleplay Partner Profile]
Name: ${userPersona.name}
Details: ${userPersona.persona || 'Not specified.'}

[Important Pinned Memory / Plot Notes]
${currentChat.memory_notes || 'None.'}

[Roleplay Rules]
- Stay strictly in character as ${currentChar.name}.
- Write immersive, descriptive responses using *asterisks* for actions/thoughts and "quotes" for spoken dialogue.
- Never speak or act on behalf of ${userPersona.name}.`;

  // จัดรูปแบบประวัติแชทส่งให้ API
  const apiMessages = [{ role: 'system', content: systemPrompt }];
  
  currentMessages.forEach(m => {
    if (m.image_url) {
      // ส่งรูปแบบ Multimodal (รองรับรูปภาพ)
      apiMessages.push({
        role: m.role,
        content: [
          { type: 'text', text: m.content },
          { type: 'image_url', image_url: { url: m.image_url } }
        ]
      });
    } else {
      apiMessages.push({ role: m.role, content: m.content });
    }
  });

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dsKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: apiMessages,
      temperature: 1.1
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const botText = data.choices[0].message.content;

  // บันทึกคำตอบของบอทลง Supabase
  const { data: botMsg } = await supabaseClient.from('messages').insert({
    chat_id: currentChat.id,
    role: 'assistant',
    content: botText
  }).select().single();

  currentMessages.push(botMsg);
  renderMessages();
}

// --- MESSAGE ACTIONS (EDIT / REGENERATE / DELETE) ---
async function editMessage(msgId) {
  const msg = currentMessages.find(m => m.id === msgId);
  if (!msg) return;
  const newText = prompt('Edit message:', msg.content);
  if (newText === null || newText.trim() === '') return;

  await supabaseClient.from('messages').update({ content: newText }).eq('id', msgId);
  msg.content = newText;
  renderMessages();
}

async function deleteMessage(msgId) {
  if (!confirm('ลบข้อความนี้ใช่ไหม?')) return;
  await supabaseClient.from('messages').delete().eq('id', msgId);
  currentMessages = currentMessages.filter(m => m.id !== msgId);
  renderMessages();
}

async function regenerateLast() {
  const lastMsg = currentMessages[currentMessages.length - 1];
  if (!lastMsg || lastMsg.role !== 'assistant') return;

  const dsKey = localStorage.getItem('ds_api_key');
  setLoading(true);
  try {
    await supabaseClient.from('messages').delete().eq('id', lastMsg.id);
    currentMessages.pop();
    renderMessages();
    await fetchBotReply(dsKey);
  } catch (err) {
    alert('Regenerate failed: ' + err.message);
  } finally {
    setLoading(false);
  }
}

async function resetCurrentChat() {
  if (!currentChat || !confirm('ล้างประวัติแชททั้งหมดของตัวละครนี้เพื่อเริ่มใหม่ใช่ไหม?')) return;
  await supabaseClient.from('messages').delete().eq('chat_id', currentChat.id);
  selectCharacter(currentChar.id);
}

// --- UTILITIES ---
function setLoading(isLoading) {
  document.getElementById('btnSend').disabled = isLoading;
  document.getElementById('messageInput').disabled = isLoading;
  document.getElementById('headerStatus').textContent = isLoading ? 'Thinking...' : 'Ready';
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
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
function openSettingsModal() { openModal('settingsModal'); }

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
