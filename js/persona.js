// ==========================================
// 2. PERSONA LIBRARY & USER'S SUPPORTING CAST
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
    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:10px;">
      <div style="display:flex; gap:6px; margin-bottom:6px;">
        <input type="text" id="userNpcName_${idx}" value="${escapeHtml(npc.name || '')}" placeholder="ชื่อ (เช่น พี่ชาย, เพื่อนสนิท)" style="padding:6px 8px; font-size:12px;" />
        <input type="text" id="userNpcRole_${idx}" value="${escapeHtml(npc.role || '')}" placeholder="ความสัมพันธ์" style="padding:6px 8px; font-size:12px;" />
        <button class="btn danger sm" style="padding:4px 8px;" onclick="removeUserNpcRow(${idx})"><i data-lucide="trash-2" class="icon-xs"></i></button>
      </div>
      <textarea id="userNpcTraits_${idx}" rows="2" placeholder="นิสัยหรือรายละเอียดตัวละครเสริมฝั่งเรา (ลากขยายได้)..." style="padding:6px 8px; font-size:12px;">${escapeHtml(npc.traits || '')}</textarea>
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