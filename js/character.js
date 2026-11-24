// ==========================================
// 3. CHARACTERS HUB, 6-TAB STUDIO, AUTO-SAVE, BACKUP & XML PREVIEW
// ==========================================

function getCharacterSummaryPreview(c) {
  return c.basic_info || c.personality_trauma || c.personality || c.scenario || 'No description provided.';
}

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
  const filtered = characters.filter(c => {
    const blob = `${c.name} ${c.basic_info || ''} ${c.personality_trauma || ''} ${c.personality || ''}`.toLowerCase();
    return blob.includes(query);
  });

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
      <div class="hub-card-desc">${escapeHtml(getCharacterSummaryPreview(c))}</div>
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
    saveCharDraftToLocal();
    showToast('อัปโหลดรูปโปรไฟล์ตัวละครเรียบร้อย');
  } catch (err) {
    showToast('อัปโหลดไม่สำเร็จ: ' + err.message);
  }
}

// ==========================================
// LOREBOOK / SUPPORTING CHARACTERS EDITOR
// ==========================================
function renderNpcEditorList() {
  const container = document.getElementById('npcEditorList');
  if (tempNpcList.length === 0) {
    container.innerHTML = '<div class="hint">ยังไม่มีข้อมูลใน Lorebook กดปุ่มด้านล่างเพื่อเพิ่มตัวละครรอง ครอบครัว แฟนเก่า หรือความลับ</div>';
    return;
  }
  container.innerHTML = tempNpcList.map((npc, idx) => {
    const isAlways = npc.always_active !== undefined ? npc.always_active : !npc.keywords;
    const bodyText = npc.content || npc.traits || '';
    return `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <input type="text" id="npcName_${idx}" value="${escapeHtml(npc.name || '')}" placeholder="ชื่อหัวข้อ / ตัวละคร (เช่น Song Siqi, Chen Jiahao, Cracked Wristwatch)" />
          <input type="text" id="npcRole_${idx}" value="${escapeHtml(npc.role || '')}" placeholder="สถานะ (เช่น Ex-Girlfriend, Best Friend, Secret)" />
          <button class="btn danger sm" onclick="removeNpcRow(${idx})" title="Remove">
            <i data-lucide="trash-2" class="icon-xs"></i>
          </button>
        </div>
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
          <input type="text" id="npcKeywords_${idx}" value="${escapeHtml(npc.keywords || '')}" placeholder="Keywords คั่นด้วยลูกน้ำ (เช่น Siqi, ex, 思琪, แฟนเก่า)" style="flex:1; min-width:200px;" />
          <label class="checkbox-label" style="margin:0; font-size:12px; white-space:nowrap;">
            <input type="checkbox" id="npcAlways_${idx}" ${isAlways ? 'checked' : ''} />
            <span>Always Active (จำตลอด)</span>
          </label>
        </div>
        <textarea id="npcContent_${idx}" rows="3" placeholder="รายละเอียดรูปร่าง นิสัย ประวัติ และปฏิกิริยาที่ตัวละครหลักมีต่อสิ่งนี้ (ลากขยายความสูงได้)...">${escapeHtml(bodyText)}</textarea>
      </div>
    `;
  }).join('');
  refreshIcons();
}

function syncNpcsFromInputs() {
  tempNpcList = tempNpcList.map((npc, idx) => ({
    name: document.getElementById(`npcName_${idx}`)?.value.trim() || '',
    role: document.getElementById(`npcRole_${idx}`)?.value.trim() || '',
    keywords: document.getElementById(`npcKeywords_${idx}`)?.value.trim() || '',
    always_active: document.getElementById(`npcAlways_${idx}`)?.checked || false,
    content: document.getElementById(`npcContent_${idx}`)?.value.trim() || ''
  })).filter(n => n.name);
}

function addNewNpcRow() {
  syncNpcsFromInputs();
  tempNpcList.push({ name: '', role: '', keywords: '', always_active: false, content: '' });
  renderNpcEditorList();
  saveCharDraftToLocal();
}

function removeNpcRow(idx) {
  syncNpcsFromInputs();
  tempNpcList.splice(idx, 1);
  renderNpcEditorList();
  saveCharDraftToLocal();
}

// ==========================================
// LOCATIONS & RULES EDITOR
// ==========================================
function renderLocationEditorList() {
  const container = document.getElementById('locationEditorList');
  if (tempLocationList.length === 0) {
    container.innerHTML = '<div class="hint">ยังไม่มีสถานที่ในเรื่อง กดปุ่มด้านล่างเพื่อเพิ่มสถานที่และกฎเหล็ก</div>';
    return;
  }
  container.innerHTML = tempLocationList.map((loc, idx) => {
    const isAlways = loc.always_active !== undefined ? loc.always_active : !loc.keywords;
    return `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <input type="text" id="locName_${idx}" value="${escapeHtml(loc.name || '')}" placeholder="ชื่อสถานที่ (เช่น NTU Mechanical Engineering Workshop, Yuze's Condo)" />
          <button class="btn danger sm" onclick="removeLocationRow(${idx})" title="Remove">
            <i data-lucide="trash-2" class="icon-xs"></i>
          </button>
        </div>
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
          <input type="text" id="locKeywords_${idx}" value="${escapeHtml(loc.keywords || '')}" placeholder="Keywords คั่นด้วยลูกน้ำ (เช่น workshop, lab, โรงฝึก, ช็อป)" style="flex:1; min-width:200px;" />
          <label class="checkbox-label" style="margin:0; font-size:12px; white-space:nowrap;">
            <input type="checkbox" id="locAlways_${idx}" ${isAlways ? 'checked' : ''} />
            <span>Always Active (จำตลอด)</span>
          </label>
        </div>
        <textarea id="locDetails_${idx}" rows="2" placeholder="บรรยากาศ กลิ่น เสียง ลักษณะพื้นที่ (Vibe)..." style="margin-bottom:8px;">${escapeHtml(loc.details || '')}</textarea>
        <textarea id="locRules_${idx}" rows="2" placeholder="กฎเหล็ก / ข้อห้ามของสถานที่นี้ (Rules — บอทจะเอาไปใช้ดุหรือเตือน {{user}})...">${escapeHtml(loc.rules || '')}</textarea>
      </div>
    `;
  }).join('');
  refreshIcons();
}

function syncLocationsFromInputs() {
  tempLocationList = tempLocationList.map((loc, idx) => ({
    name: document.getElementById(`locName_${idx}`)?.value.trim() || '',
    keywords: document.getElementById(`locKeywords_${idx}`)?.value.trim() || '',
    always_active: document.getElementById(`locAlways_${idx}`)?.checked || false,
    details: document.getElementById(`locDetails_${idx}`)?.value.trim() || '',
    rules: document.getElementById(`locRules_${idx}`)?.value.trim() || ''
  })).filter(l => l.name);
}

function addNewLocationRow() {
  syncLocationsFromInputs();
  tempLocationList.push({ name: '', keywords: '', always_active: false, details: '', rules: '' });
  renderLocationEditorList();
  saveCharDraftToLocal();
}

function removeLocationRow(idx) {
  syncLocationsFromInputs();
  tempLocationList.splice(idx, 1);
  renderLocationEditorList();
  saveCharDraftToLocal();
}

// ==========================================
// DRAFT AUTO-SAVE, FORM POPULATION & SUPABASE SAVE
// ==========================================
function getCharDraftStorageKey(charId = '') {
  return `nexusrp_char_draft_${charId || 'new'}`;
}

function collectCharacterFormPayload() {
  const rawPasscode = document.getElementById('charPhonePasscode').value.replace(/[^0-9]/g, '').slice(0, 4);
  syncNpcsFromInputs();
  syncLocationsFromInputs();

  return {
    user_id: currentUser ? currentUser.id : null,
    name: document.getElementById('charName').value.trim(),
    avatar_url: document.getElementById('charAvatar').value.trim(),
    basic_info: document.getElementById('charBasicInfo').value.trim(),
    appearance_style: document.getElementById('charAppearanceStyle').value.trim(),
    personality_trauma: document.getElementById('charPersonalityTrauma').value.trim(),
    speech_dynamics: document.getElementById('charSpeechDynamics').value.trim(),
    assets_items: document.getElementById('charAssetsItems').value.trim(),
    world_setting: document.getElementById('charWorldSetting').value.trim(),
    user_relationship: document.getElementById('charUserRelationship').value.trim(),
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
}

function populateCharacterFormFromData(dataObj) {
  document.getElementById('charName').value = dataObj.name || '';
  document.getElementById('charAvatar').value = dataObj.avatar_url || '';
  document.getElementById('charAvatarPreview').src = dataObj.avatar_url || 'https://via.placeholder.com/56/1f1f24/71717a?text=' + encodeURIComponent((dataObj.name || 'C')[0]);

  document.getElementById('charBasicInfo').value = dataObj.basic_info || '';
  document.getElementById('charAppearanceStyle').value = dataObj.appearance_style || '';
  document.getElementById('charPersonalityTrauma').value = dataObj.personality_trauma || dataObj.personality || '';
  document.getElementById('charSpeechDynamics').value = dataObj.speech_dynamics || '';
  document.getElementById('charAssetsItems').value = dataObj.assets_items || '';

  document.getElementById('charWorldSetting').value = dataObj.world_setting || dataObj.important_dates || '';
  document.getElementById('charUserRelationship').value = dataObj.user_relationship || '';
  document.getElementById('charScenario').value = dataObj.scenario || '';
  document.getElementById('charFirstMsg').value = dataObj.first_message || '';

  document.getElementById('charSystemPrompt').value = dataObj.system_prompt || '';
  document.getElementById('charExampleDialogue').value = dataObj.example_dialogue || '';
  document.getElementById('charJailbreak').value = dataObj.jailbreak || '';
  document.getElementById('charHtmlBio').value = dataObj.html_bio || '';
  document.getElementById('charPhonePasscode').value = dataObj.phone_passcode || '';
  document.getElementById('charStartingBalance').value = dataObj.starting_balance || '$5,000.00';
  document.getElementById('charPhoneHint').value = dataObj.phone_hint || '';

  tempNpcList = Array.isArray(dataObj.supporting_chars) ? JSON.parse(JSON.stringify(dataObj.supporting_chars)) : [];
  tempLocationList = Array.isArray(dataObj.locations) ? JSON.parse(JSON.stringify(dataObj.locations)) : [];
  renderNpcEditorList();
  renderLocationEditorList();
}

function saveCharDraftToLocal() {
  const modal = document.getElementById('charModal');
  if (!modal || modal.classList.contains('hidden')) return;
  const id = document.getElementById('editCharId').value || '';
  const draftData = collectCharacterFormPayload();
  localStorage.setItem(getCharDraftStorageKey(id), JSON.stringify(draftData));
}

function openCharModal(isEdit = false) {
  switchCharTab('core', document.querySelector('.tab-btn'));

  if (isEdit && currentChar) {
    document.getElementById('charModalTitle').textContent = `Configure — ${currentChar.name}`;
    document.getElementById('editCharId').value = currentChar.id;
    document.getElementById('btnDeleteChar').classList.remove('hidden');

    const savedDraft = localStorage.getItem(getCharDraftStorageKey(currentChar.id));
    if (savedDraft) {
      try {
        populateCharacterFormFromData(JSON.parse(savedDraft));
        showToast('กู้คืนร่างข้อมูลที่ยังไม่ได้บันทึกจากเครื่องให้แล้ว');
      } catch {
        populateCharacterFormFromData(currentChar);
      }
    } else {
      populateCharacterFormFromData(currentChar);
    }
  } else {
    document.getElementById('charModalTitle').textContent = 'Create New Character';
    document.getElementById('editCharId').value = '';
    document.getElementById('btnDeleteChar').classList.add('hidden');

    const savedNewDraft = localStorage.getItem(getCharDraftStorageKey(''));
    if (savedNewDraft) {
      try {
        populateCharacterFormFromData(JSON.parse(savedNewDraft));
        showToast('กู้คืนร่างตัวละครใหม่ที่พิมพ์ค้างไว้ให้แล้ว');
      } catch {
        populateCharacterFormFromData({});
      }
    } else {
      populateCharacterFormFromData({});
    }
  }
  openModal('charModal');
}

async function saveCharacter() {
  const id = document.getElementById('editCharId').value;
  const payload = collectCharacterFormPayload();

  if (!payload.name || !payload.first_message) {
    return showToast('ต้องกรอก Character Name (แท็บ 1) และ First Message (แท็บ 2) ก่อนนะ');
  }

  if (id) {
    const { data, error } = await supabaseClient.from('characters').update(payload).eq('id', id).select().single();
    if (error) return showToast(error.message);
    currentChar = data;
    localStorage.removeItem(getCharDraftStorageKey(id));
  } else {
    const { data, error } = await supabaseClient.from('characters').insert(payload).select().single();
    if (error) return showToast(error.message);
    currentChar = data;
    localStorage.removeItem(getCharDraftStorageKey(''));
  }

  closeModal('charModal');
  showToast('บันทึกข้อมูลลง Supabase และล้างร่างชั่วคราวเรียบร้อย');
  await loadCharacters();
  await loadAllRecentChats();
  startOrResumeCharacter(currentChar.id);
}

async function deleteCharacter() {
  if (!currentChar || !(await appConfirm(`ลบ "${currentChar.name}" และห้องแชททั้งหมดทิ้งใช่ไหม?`, 'Delete Character'))) return;
  localStorage.removeItem(getCharDraftStorageKey(currentChar.id));
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
// SINGLE CHARACTER BACKUP (.JSON) & XML PREVIEW
// ==========================================
function exportSingleCharacterJson() {
  const data = collectCharacterFormPayload();
  const charName = data.name || (currentChar ? currentChar.name : 'character');
  const exportPayload = {
    schema: 'NexusRP_Character_v2',
    exported_at: new Date().toISOString(),
    character: data
  };
  downloadTextFile(`${charName}_profile.json`, JSON.stringify(exportPayload, null, 2), 'application/json');
  showToast(`สำรองข้อมูล "${charName}" (.json) เรียบร้อย`);
}

function importCharacterJsonToForm(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const charData = parsed.character || parsed;
      populateCharacterFormFromData(charData);
      saveCharDraftToLocal();
      showToast(`นำเข้าข้อมูล "${charData.name || 'Character'}" ลงฟอร์มแล้ว (อย่าลืมกด Save Character)`);
    } catch (err) {
      showToast('ไฟล์ JSON ไม่ถูกต้อง: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function previewCompiledCharacterXml() {
  const c = collectCharacterFormPayload();
  const activePersona = getActivePersona();
  const charName = c.name || '{{char}}';

  const characterProfileXml = `<character_profile>
Name: ${charName}
Financial Status / Starting Balance: ${c.starting_balance || '$5,000.00'}

### Basic Information
${c.basic_info || 'Not specified.'}

### Physical Appearance & Style
${c.appearance_style || 'Not specified.'}

### Personality, Trauma & Triggers (STRICTLY INTERNALIZED — DO NOT REVEAL SECRETS UNLESS TRIGGERED)
${c.personality_trauma || 'Not specified.'}

### Speech & Dynamics
${c.speech_dynamics || 'Not specified.'}

### Assets & Everyday Carry (EDC)
${c.assets_items || 'Not specified.'}${c.example_dialogue ? `\n\n### Example Dialogue\n${c.example_dialogue}` : ''}
</character_profile>`;

  const worldContextXml = `<world_context>
### Setting & Cultural Context
${c.world_setting || 'Not specified.'}

### Initial Relationship with ${activePersona.name}
${c.user_relationship || 'Not specified.'}

### Current Opening Scenario
${c.scenario || 'Not specified.'}

### Roleplay Partner (${activePersona.name})
${activePersona.description || 'Not specified.'}
</world_context>`;

  const locsXml = c.locations.length > 0
    ? `\n<active_locations_pool count="${c.locations.length}">\n${c.locations.map(l => `### ${l.name} [${l.always_active ? 'ALWAYS ACTIVE' : `Keywords: ${l.keywords || 'Any'}`}]\n- Vibe: ${l.details || 'Standard'}\n- STRICT RULES: ${l.rules || 'None'}`).join('\n\n')}\n</active_locations_pool>`
    : '';

  const loreXml = c.supporting_chars.length > 0
    ? `\n<relevant_lore_pool count="${c.supporting_chars.length}">\n${c.supporting_chars.map(n => `### ${n.name} (${n.role || 'Lore'}) [${n.always_active ? 'ALWAYS ACTIVE' : `Keywords: ${n.keywords || 'Any'}`}]\n${n.content || ''}`).join('\n\n')}\n</relevant_lore_pool>`
    : '';

  const fullPreview = `${c.system_prompt ? `[Custom System Prompt]\n${c.system_prompt}\n\n` : ''}${characterProfileXml}\n\n${worldContextXml}${locsXml}${loreXml}${c.jailbreak ? `\n\n[Jailbreak / Post-History]\n${c.jailbreak}` : ''}`;

  const approxTokens = Math.ceil(fullPreview.length / 3.5);
  document.getElementById('xmlPreviewContent').textContent = fullPreview;
  document.getElementById('xmlTokenEstimate').textContent = `Total: ${fullPreview.length.toLocaleString()} chars (~${approxTokens.toLocaleString()} tokens)`;
  openModal('xmlPreviewModal');
}

function copyCompiledXml() {
  const text = document.getElementById('xmlPreviewContent').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('คัดลอก Compiled XML ลงคลิปบอร์ดแล้ว'));
}