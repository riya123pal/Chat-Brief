/**
 * ChatBrief - Modern Frontend Application Controller
 * Handles drag & drop, sample chats, analysis API, re-summarization,
 * dynamic tabs, interactive action items, copy & export formats.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Application State
  const state = {
    selectedLength: 'medium',
    currentChatData: null,
    apiKey: localStorage.getItem('chatbrief_gemini_key') || '',
    model: localStorage.getItem('chatbrief_gemini_model') || 'gemini-2.5-flash',
    filterText: '',
  };

  // DOM Elements - Navigation & Modal
  const engineDot = document.getElementById('engineDot');
  const engineLabel = document.getElementById('engineLabel');
  const btnOpenApiModal = document.getElementById('btnOpenApiModal');
  const apiModal = document.getElementById('apiModal');
  const btnCloseApiModal = document.getElementById('btnCloseApiModal');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleApiKeyVis = document.getElementById('toggleApiKeyVis');
  const modelSelect = document.getElementById('modelSelect');
  const btnTestKey = document.getElementById('btnTestKey');
  const btnSaveKey = document.getElementById('btnSaveKey');
  const btnClearKey = document.getElementById('btnClearKey');
  const keyValidationFeedback = document.getElementById('keyValidationFeedback');
  const btnResetChat = document.getElementById('btnResetChat');

  // DOM Elements - Sections
  const uploadSection = document.getElementById('uploadSection');
  const loadingSection = document.getElementById('loadingSection');
  const resultsSection = document.getElementById('resultsSection');
  const loadingStatusTitle = document.getElementById('loadingStatusTitle');
  const loadingStatusDesc = document.getElementById('loadingStatusDesc');

  // DOM Elements - Upload & Dropzone
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const lengthButtons = document.querySelectorAll('.length-btn');
  const btnSampleSprint = document.getElementById('btnSampleSprint');
  const btnSampleVacation = document.getElementById('btnSampleVacation');
  const btnTogglePaste = document.getElementById('btnTogglePaste');
  const pasteContainer = document.getElementById('pasteContainer');
  const btnClosePaste = document.getElementById('btnClosePaste');
  const rawTextarea = document.getElementById('rawTextarea');
  const btnSubmitPaste = document.getElementById('btnSubmitPaste');

  // DOM Elements - Dashboard Header & Actions
  const resFileName = document.getElementById('resFileName');
  const resEngineBadge = document.getElementById('resEngineBadge');
  const resToneBadge = document.getElementById('resToneBadge');
  const resDateSpan = document.getElementById('resDateSpan');
  const resParticipantCount = document.getElementById('resParticipantCount');
  const resMessageCount = document.getElementById('resMessageCount');
  const resPeakHour = document.getElementById('resPeakHour');
  const resLengthButtons = document.querySelectorAll('.res-length-btn');
  const btnCopySummary = document.getElementById('btnCopySummary');
  const copyBtnText = document.getElementById('copyBtnText');
  const btnDownloadDropdown = document.getElementById('btnDownloadDropdown');
  const downloadMenu = document.getElementById('downloadMenu');
  const dlMarkdown = document.getElementById('dlMarkdown');
  const dlText = document.getElementById('dlText');
  const dlJson = document.getElementById('dlJson');
  const dlPrint = document.getElementById('dlPrint');
  const btnCopyActionChecklist = document.getElementById('btnCopyActionChecklist');

  // DOM Elements - KPIs
  const kpiMessages = document.getElementById('kpiMessages');
  const kpiDecisions = document.getElementById('kpiDecisions');
  const kpiActions = document.getElementById('kpiActions');
  const kpiUnanswered = document.getElementById('kpiUnanswered');
  const kpiMembers = document.getElementById('kpiMembers');

  // DOM Elements - Tabs & Content
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const summaryNarrative = document.getElementById('summaryNarrative');
  const badgeSummaryLength = document.getElementById('badgeSummaryLength');
  const highlightsList = document.getElementById('highlightsList');
  const topicsGrid = document.getElementById('topicsGrid');
  const decisionsList = document.getElementById('decisionsList');
  const promisesList = document.getElementById('promisesList');
  const plansList = document.getElementById('plansList');
  const actionsList = document.getElementById('actionsList');
  const questionsList = document.getElementById('questionsList');
  const timelineContainer = document.getElementById('timelineContainer');
  const participantsList = document.getElementById('participantsList');
  const rawMessagesContainer = document.getElementById('rawMessagesContainer');
  const filterMsgInput = document.getElementById('filterMsgInput');

  // Badges counts
  const countDecisionsBadge = document.getElementById('countDecisionsBadge');
  const countPromisesBadge = document.getElementById('countPromisesBadge');
  const countPlansBadge = document.getElementById('countPlansBadge');
  const countQuestionsBadge = document.getElementById('countQuestionsBadge');

  // Toast
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  // --- INITIALIZATION ---
  function updateEngineUI() {
    if (state.apiKey) {
      engineDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      engineLabel.textContent = state.model.includes('2.5') ? 'Gemini 2.5 Flash' : 'Gemini AI';
      engineLabel.className = 'text-emerald-400 font-semibold';
    } else {
      engineDot.className = 'w-2 h-2 rounded-full bg-slate-400';
      engineLabel.textContent = 'Local NLP Engine';
      engineLabel.className = 'text-slate-300';
    }
    apiKeyInput.value = state.apiKey;
    modelSelect.value = state.model;
  }
  updateEngineUI();

  // --- TOAST HELPER ---
  function showToast(message, isError = false) {
    toastMsg.textContent = message;
    toast.className = `fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-2xl ${
      isError ? 'bg-rose-950 border-rose-800 text-rose-200' : 'bg-slate-900 border-slate-700 text-white'
    } shadow-2xl text-xs font-medium border`;
    setTimeout(() => {
      toast.className = 'fixed bottom-6 right-6 z-50 transform translate-y-20 opacity-0 transition-all duration-300 pointer-events-none flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-xs font-medium text-white';
    }, 3200);
  }

  // --- API MODAL HANDLERS ---
  btnOpenApiModal.addEventListener('click', () => {
    apiModal.classList.remove('hidden');
    keyValidationFeedback.classList.add('hidden');
    if (window.lucide) lucide.createIcons();
  });

  btnCloseApiModal.addEventListener('click', () => {
    apiModal.classList.add('hidden');
  });

  apiModal.addEventListener('click', (e) => {
    if (e.target === apiModal) apiModal.classList.add('hidden');
  });

  toggleApiKeyVis.addEventListener('click', () => {
    const isPw = apiKeyInput.type === 'password';
    apiKeyInput.type = isPw ? 'text' : 'password';
  });

  btnSaveKey.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value;
    state.apiKey = key;
    state.model = model;
    if (key) {
      localStorage.setItem('chatbrief_gemini_key', key);
    } else {
      localStorage.removeItem('chatbrief_gemini_key');
    }
    localStorage.setItem('chatbrief_gemini_model', model);
    updateEngineUI();
    apiModal.classList.add('hidden');
    showToast(key ? 'Gemini AI configured successfully!' : 'Switched to Local NLP Engine');
  });

  btnClearKey.addEventListener('click', () => {
    state.apiKey = '';
    localStorage.removeItem('chatbrief_gemini_key');
    apiKeyInput.value = '';
    updateEngineUI();
    apiModal.classList.add('hidden');
    showToast('Key cleared. ChatBrief using Local NLP Engine.');
  });

  btnTestKey.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      keyValidationFeedback.className = 'p-3 rounded-xl text-xs bg-rose-950/80 border border-rose-800 text-rose-300';
      keyValidationFeedback.textContent = 'Please enter an API key first.';
      keyValidationFeedback.classList.remove('hidden');
      return;
    }

    btnTestKey.disabled = true;
    btnTestKey.textContent = 'Testing...';
    try {
      const res = await fetch('/api/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });
      const data = await res.json();
      if (data.valid) {
        keyValidationFeedback.className = 'p-3 rounded-xl text-xs bg-emerald-950/80 border border-emerald-800 text-emerald-300';
        keyValidationFeedback.textContent = '✓ ' + data.message;
      } else {
        keyValidationFeedback.className = 'p-3 rounded-xl text-xs bg-rose-950/80 border border-rose-800 text-rose-300';
        keyValidationFeedback.textContent = '✗ ' + (data.error || 'Failed to authenticate key.');
      }
    } catch (err) {
      keyValidationFeedback.className = 'p-3 rounded-xl text-xs bg-rose-950/80 border border-rose-800 text-rose-300';
      keyValidationFeedback.textContent = '✗ Network error testing key: ' + err.message;
    } finally {
      btnTestKey.disabled = false;
      btnTestKey.textContent = 'Test Connection';
      keyValidationFeedback.classList.remove('hidden');
    }
  });

  // --- SUMMARY LENGTH TOGGLES ---
  function setLength(length) {
    state.selectedLength = length;
    lengthButtons.forEach(btn => {
      const active = btn.dataset.length === length;
      btn.className = active
        ? 'length-btn active-length-btn px-4 py-1.5 rounded-lg text-xs font-semibold transition-all bg-brand-500 text-white shadow-md shadow-brand-500/20'
        : 'length-btn px-4 py-1.5 rounded-lg text-xs font-medium transition-all text-slate-400 hover:text-white';
    });

    resLengthButtons.forEach(btn => {
      const active = btn.dataset.resLength === length;
      btn.className = active
        ? 'res-length-btn px-3 py-1 rounded-lg text-xs font-semibold bg-brand-500 text-white shadow-sm transition-all'
        : 'res-length-btn px-3 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-all';
    });

    if (badgeSummaryLength) {
      badgeSummaryLength.textContent = `${length.toUpperCase()} DETAIL`;
    }
  }

  lengthButtons.forEach(btn => {
    btn.addEventListener('click', () => setLength(btn.dataset.length));
  });

  resLengthButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const newLen = btn.dataset.resLength;
      if (newLen === state.selectedLength) return;
      setLength(newLen);
      await triggerResummarize();
    });
  });

  // --- DROPZONE & FILE INPUT ---
  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-active');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  });

  // --- PASTE RAW TEXT ACCORDION ---
  btnTogglePaste.addEventListener('click', () => {
    pasteContainer.classList.toggle('hidden');
    if (!pasteContainer.classList.contains('hidden')) {
      rawTextarea.focus();
    }
  });

  btnClosePaste.addEventListener('click', () => {
    pasteContainer.classList.add('hidden');
  });

  btnSubmitPaste.addEventListener('click', () => {
    const text = rawTextarea.value.trim();
    if (!text) {
      showToast('Please paste some WhatsApp messages first.', true);
      return;
    }
    analyzePayload({ raw_text: text, filename: 'pasted_chat.txt' });
  });

  // --- SAMPLE CHATS ---
  btnSampleSprint.addEventListener('click', () => loadSample('startup_product_launch'));
  btnSampleVacation.addEventListener('click', () => loadSample('weekend_roadtrip_planning'));

  async function loadSample(sampleId) {
    showLoading(true, 'Loading sample conversation...', 'Fetching pre-configured realistic WhatsApp chat...');
    try {
      const res = await fetch(`/api/sample/${sampleId}`);
      if (!res.ok) throw new Error('Failed to load sample');
      const data = await res.json();
      await analyzePayload({ raw_text: data.content, filename: data.filename });
    } catch (err) {
      showLoading(false);
      showToast(err.message, true);
    }
  }

  // --- FILE PROCESSING ---
  function processFile(file) {
    if (!file.name.endsWith('.txt')) {
      showToast('Please upload a valid .txt file exported from WhatsApp.', true);
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('length', state.selectedLength);
    if (state.apiKey) formData.append('apiKey', state.apiKey);
    if (state.model) formData.append('model', state.model);

    analyzeFormData(formData);
  }

  // --- ANALYSIS DISPATCHERS ---
  async function analyzeFormData(formData) {
    showLoading(true, 'Analyzing WhatsApp Export...', 'Parsing timestamps, senders, and structuring conversation intelligence...');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed.');
      renderResults(data);
    } catch (err) {
      showLoading(false);
      showToast(err.message, true);
    }
  }

  async function analyzePayload(payload) {
    showLoading(true, 'Analyzing WhatsApp Chat...', 'Extracting core topics, decisions, actions, and milestones...');
    try {
      payload.length = state.selectedLength;
      if (state.apiKey) payload.apiKey = state.apiKey;
      if (state.model) payload.model = state.model;

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed.');
      renderResults(data);
    } catch (err) {
      showLoading(false);
      showToast(err.message, true);
    }
  }

  async function triggerResummarize() {
    if (!state.currentChatData) return;
    showToast(`Generating ${state.selectedLength} summary...`);
    try {
      const res = await fetch('/api/resummarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: state.currentChatData.messages,
          stats: state.currentChatData.stats,
          length: state.selectedLength,
          apiKey: state.apiKey,
          model: state.model,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Resummarize failed.');
      state.currentChatData.summary = data.summary;
      populateSummaryTab(data.summary);
      populateDecisionsTab(data.summary);
      populateActionsTab(data.summary);
      populateQuestionsTab(data.summary);
      populateTimelineTab(data.summary);
      showToast(`Updated to ${state.selectedLength} summary!`);
    } catch (err) {
      showToast(err.message, true);
    }
  }

  // --- LOADING STATE TOGGLE ---
  function showLoading(show, title = '', desc = '') {
    if (show) {
      uploadSection.classList.add('hidden');
      resultsSection.classList.add('hidden');
      loadingSection.classList.remove('hidden');
      if (title) loadingStatusTitle.textContent = title;
      if (desc) loadingStatusDesc.textContent = desc;
    } else {
      loadingSection.classList.add('hidden');
      if (!state.currentChatData) {
        uploadSection.classList.remove('hidden');
      }
    }
  }

  // --- RESET CHAT ---
  btnResetChat.addEventListener('click', () => {
    state.currentChatData = null;
    fileInput.value = '';
    rawTextarea.value = '';
    resultsSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    btnResetChat.classList.add('hidden');
    btnResetChat.classList.remove('flex');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // --- RENDER COMPLETE DASHBOARD ---
  function renderResults(data) {
    state.currentChatData = data;
    showLoading(false);

    uploadSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    btnResetChat.classList.remove('hidden');
    btnResetChat.classList.add('flex');

    const stats = data.stats || {};
    const summary = data.summary || {};

    // Header values
    resFileName.querySelector('span').textContent = data.filename || 'Chat Export';
    resEngineBadge.textContent = summary.engine || (state.apiKey ? 'Gemini AI' : 'Local NLP');
    resToneBadge.textContent = `Tone: ${summary.tone_and_sentiment || 'Collaborative'}`;
    resDateSpan.textContent = `${stats.first_date || 'Start'} - ${stats.last_date || 'End'}`;
    resParticipantCount.textContent = `${stats.unique_participants || 0} Participants`;
    resMessageCount.textContent = `${stats.total_messages || 0} Messages`;
    resPeakHour.textContent = `Peak: ${stats.peak_hour || '12:00 PM'}`;

    // KPIs
    kpiMessages.textContent = stats.total_messages || 0;
    kpiDecisions.textContent = (summary.decisions || []).length;
    kpiActions.textContent = (summary.action_items || []).length;
    kpiUnanswered.textContent = (summary.unanswered_questions || []).length;
    kpiMembers.textContent = stats.unique_participants || 0;

    // Populate each tab
    populateSummaryTab(summary);
    populateDecisionsTab(summary);
    populateActionsTab(summary);
    populateQuestionsTab(summary);
    populateTimelineTab(summary);
    populateParticipantsTab(stats, data.messages);

    // Re-bind Lucide icons
    if (window.lucide) lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- TAB 1: SUMMARY & TOPICS ---
  function populateSummaryTab(summary) {
    summaryNarrative.innerHTML = (summary.summary || 'No summary available.')
      .split('\n\n')
      .map(p => `<p class="leading-relaxed text-slate-200">${escapeHtml(p)}</p>`)
      .join('');

    // Key Highlights
    highlightsList.innerHTML = '';
    const highlights = summary.key_highlights || [];
    if (highlights.length === 0) {
      highlightsList.innerHTML = `<li class="text-xs text-slate-500 italic">No key highlights extracted.</li>`;
    } else {
      highlights.forEach(h => {
        const li = document.createElement('li');
        li.className = 'text-xs text-slate-300 flex items-start gap-2';
        li.innerHTML = `
          <i data-lucide="check" class="w-3.5 h-3.5 text-brand-400 mt-0.5 flex-shrink-0"></i>
          <span>${escapeHtml(h)}</span>
        `;
        highlightsList.appendChild(li);
      });
    }

    // Topics Grid
    topicsGrid.innerHTML = '';
    const topics = summary.main_topics || [];
    if (topics.length === 0) {
      topicsGrid.innerHTML = `<p class="text-xs text-slate-500 col-span-full italic">No major topics detected.</p>`;
    } else {
      topics.forEach((t, idx) => {
        const card = document.createElement('div');
        card.className = 'p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-brand-500/30 transition-all flex flex-col justify-between';
        
        const contributors = (t.key_contributors || [])
          .map(c => `<span class="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 border border-slate-700">${escapeHtml(c)}</span>`)
          .join('');

        card.innerHTML = `
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md">
                Topic #${idx + 1}
              </span>
            </div>
            <h4 class="text-sm font-semibold text-white mb-1.5">${escapeHtml(t.topic)}</h4>
            <p class="text-xs text-slate-400 leading-relaxed mb-3">${escapeHtml(t.description)}</p>
          </div>
          <div class="pt-2 border-t border-slate-800/60 flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] text-slate-500 font-medium">Involved:</span>
            ${contributors || '<span class="text-[10px] text-slate-500 italic">Group</span>'}
          </div>
        `;
        topicsGrid.appendChild(card);
      });
    }
  }

  // --- TAB 2: DECISIONS & COMMITMENTS ---
  function populateDecisionsTab(summary) {
    const decisions = summary.decisions || [];
    const promises = summary.promises_and_commitments || [];
    const plans = summary.upcoming_plans || [];

    countDecisionsBadge.textContent = decisions.length;
    countPromisesBadge.textContent = promises.length;
    countPlansBadge.textContent = plans.length;

    // Decisions List
    decisionsList.innerHTML = '';
    if (decisions.length === 0) {
      decisionsList.innerHTML = `<p class="text-xs text-slate-500 italic">No formal decisions identified.</p>`;
    } else {
      decisions.forEach(d => {
        const item = document.createElement('div');
        item.className = 'p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/30 transition-all';
        item.innerHTML = `
          <div class="flex items-start justify-between gap-3 mb-1.5">
            <h5 class="text-xs font-semibold text-white leading-snug">${escapeHtml(d.decision)}</h5>
            <span class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 whitespace-nowrap">
              ${escapeHtml(d.made_by || 'Consensus')}
            </span>
          </div>
          ${d.context ? `<p class="text-[11px] text-slate-400 italic">${escapeHtml(d.context)}</p>` : ''}
        `;
        decisionsList.appendChild(item);
      });
    }

    // Promises List
    promisesList.innerHTML = '';
    if (promises.length === 0) {
      promisesList.innerHTML = `<p class="text-xs text-slate-500 italic">No personal promises or commitments found.</p>`;
    } else {
      promises.forEach(p => {
        const item = document.createElement('div');
        item.className = 'p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/30 transition-all';
        item.innerHTML = `
          <div class="flex items-start justify-between gap-3 mb-1.5">
            <h5 class="text-xs font-semibold text-white leading-snug">${escapeHtml(p.promise)}</h5>
            <span class="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-[10px] font-semibold border border-cyan-500/20 whitespace-nowrap">
              ${escapeHtml(p.promised_by || 'Participant')}
            </span>
          </div>
          <p class="text-[11px] text-slate-400">Promised to: <strong class="text-slate-300">${escapeHtml(p.promised_to || 'Group')}</strong></p>
        `;
        promisesList.appendChild(item);
      });
    }

    // Plans List
    plansList.innerHTML = '';
    if (plans.length === 0) {
      plansList.innerHTML = `<p class="text-xs text-slate-500 col-span-full italic">No scheduled upcoming plans found.</p>`;
    } else {
      plans.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3';
        item.innerHTML = `
          <div>
            <h5 class="text-xs font-semibold text-white mb-1">${escapeHtml(pl.plan)}</h5>
            <span class="text-[11px] text-slate-400 flex items-center gap-1">
              <i data-lucide="clock" class="w-3 h-3 text-teal-400"></i> ${escapeHtml(pl.date_time || 'TBD')}
            </span>
          </div>
        `;
        plansList.appendChild(item);
      });
    }
  }

  // --- TAB 3: ACTION ITEMS ---
  function populateActionsTab(summary) {
    const actions = summary.action_items || [];
    actionsList.innerHTML = '';

    if (actions.length === 0) {
      actionsList.innerHTML = `<p class="text-xs text-slate-500 italic">No action items or delegated tasks detected.</p>`;
      return;
    }

    actions.forEach((a, i) => {
      const card = document.createElement('div');
      card.className = 'p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-brand-500/30 transition-all flex items-start gap-3.5';

      card.innerHTML = `
        <label class="relative flex items-center mt-1 cursor-pointer">
          <input type="checkbox" class="task-checkbox peer w-4 h-4 rounded bg-slate-900 border-slate-700 text-brand-500 focus:ring-brand-500 focus:ring-offset-0">
        </label>
        <div class="flex-1">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
            <span class="text-xs font-semibold text-white tracking-wide leading-snug">${escapeHtml(a.task)}</span>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 text-[11px] font-semibold border border-brand-500/20 flex items-center gap-1">
                <i data-lucide="user" class="w-3 h-3"></i> ${escapeHtml(a.assignee || 'Unassigned')}
              </span>
              <span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700 flex items-center gap-1">
                <i data-lucide="calendar" class="w-3 h-3"></i> ${escapeHtml(a.deadline || 'Pending')}
              </span>
            </div>
          </div>
        </div>
      `;
      actionsList.appendChild(card);
    });
  }

  // Copy Action Checklist helper
  btnCopyActionChecklist.addEventListener('click', () => {
    if (!state.currentChatData || !state.currentChatData.summary) return;
    const actions = state.currentChatData.summary.action_items || [];
    if (actions.length === 0) {
      showToast('No action items to copy.', true);
      return;
    }
    const text = actions.map(a => `- [ ] ${a.task} (Assignee: ${a.assignee || 'Unassigned'}, Due: ${a.deadline || 'TBD'})`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      showToast('Action item checklist copied to clipboard!');
    });
  });

  // --- TAB 4: UNANSWERED QUESTIONS ---
  function populateQuestionsTab(summary) {
    const questions = summary.unanswered_questions || [];
    countQuestionsBadge.textContent = questions.length;
    questionsList.innerHTML = '';

    if (questions.length === 0) {
      questionsList.innerHTML = `<p class="text-xs text-slate-500 italic">No unanswered questions detected. The conversation resolved all inquiries smoothly!</p>`;
      return;
    }

    questions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-rose-500/30 transition-all flex items-start justify-between gap-3';
      card.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="p-2 rounded-xl bg-rose-500/10 text-rose-400 mt-0.5">
            <i data-lucide="help-circle" class="w-4 h-4"></i>
          </div>
          <div>
            <h5 class="text-xs font-semibold text-white mb-1.5 leading-snug">${escapeHtml(q.question)}</h5>
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-slate-400">Asked by: <strong class="text-slate-300">${escapeHtml(q.asked_by || 'Participant')}</strong></span>
            </div>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-semibold border border-rose-500/20 whitespace-nowrap">
          ${escapeHtml(q.status || 'Unanswered')}
        </span>
      `;
      questionsList.appendChild(card);
    });
  }

  // --- TAB 5: TIMELINE ---
  function populateTimelineTab(summary) {
    const timeline = summary.timeline || [];
    timelineContainer.innerHTML = '';

    if (timeline.length === 0) {
      timelineContainer.innerHTML = `<p class="text-xs text-slate-500 italic">No milestone timeline points recorded.</p>`;
      return;
    }

    timeline.forEach(t => {
      const item = document.createElement('div');
      item.className = 'relative flex items-start gap-4';

      item.innerHTML = `
        <div class="absolute -left-[30px] top-1.5 w-3.5 h-3.5 rounded-full bg-brand-500 border-2 border-slate-950 shadow-md shadow-brand-500/40"></div>
        <div class="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex-1 hover:border-brand-500/30 transition-all">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400 text-[10px] font-semibold border border-brand-500/20">
              ${escapeHtml(t.time || 'Milestone')}
            </span>
            ${t.participants && t.participants.length ? `
              <span class="text-[10px] text-slate-400">With: ${escapeHtml(t.participants.join(', '))}</span>
            ` : ''}
          </div>
          <p class="text-xs text-slate-200 leading-relaxed font-medium">${escapeHtml(t.event)}</p>
        </div>
      `;
      timelineContainer.appendChild(item);
    });
  }

  // --- TAB 6: PARTICIPANTS & CHAT LOGS ---
  function populateParticipantsTab(stats, messages) {
    // Participant Activity
    participantsList.innerHTML = '';
    const participants = stats.participants || [];
    const maxMessages = participants.length > 0 ? participants[0].messages : 1;

    participants.forEach(p => {
      const row = document.createElement('div');
      row.className = 'p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80';
      row.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-emerald-700 flex items-center justify-center text-xs font-bold text-white uppercase">
              ${escapeHtml(p.name.charAt(0))}
            </div>
            <span class="text-xs font-semibold text-white">${escapeHtml(p.name)}</span>
          </div>
          <div class="text-right">
            <span class="text-xs font-bold text-brand-400">${p.messages} msgs</span>
            <span class="text-[11px] text-slate-400 ml-1.5">(${p.words} words • ${p.percent}%)</span>
          </div>
        </div>
        <div class="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
          <div class="bg-gradient-to-r from-brand-500 to-emerald-400 h-full rounded-full" style="width: ${p.percent}%"></div>
        </div>
      `;
      participantsList.appendChild(row);
    });

    // Render Raw Messages
    renderRawMessages(messages || []);
  }

  function renderRawMessages(messages) {
    rawMessagesContainer.innerHTML = '';
    const query = state.filterText.toLowerCase();

    const filtered = messages.filter(m => {
      if (!query) return true;
      return (m.sender && m.sender.toLowerCase().includes(query)) ||
             (m.text && m.text.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      rawMessagesContainer.innerHTML = `<p class="text-xs text-slate-500 italic p-3">No messages match your search.</p>`;
      return;
    }

    filtered.forEach(m => {
      const div = document.createElement('div');
      if (m.is_system) {
        div.className = 'text-[11px] text-slate-500 text-center py-1 italic';
        div.textContent = `${m.date ? `[${m.date} ${m.time}] ` : ''}${m.text}`;
      } else {
        div.className = 'p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/60 text-xs flex items-start gap-2.5';
        div.innerHTML = `
          <div class="w-6 h-6 rounded-md bg-slate-800 text-[10px] font-bold text-brand-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            ${escapeHtml((m.sender || '?').charAt(0))}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-0.5">
              <span class="font-semibold text-slate-200 text-[11px]">${escapeHtml(m.sender)}</span>
              <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(m.date || '')} ${escapeHtml(m.time || '')}</span>
            </div>
            <p class="text-slate-300 text-xs whitespace-pre-line leading-relaxed ${m.is_media ? 'italic text-brand-300' : ''}">
              ${escapeHtml(m.text)}
            </p>
          </div>
        `;
      }
      rawMessagesContainer.appendChild(div);
    });
  }

  filterMsgInput.addEventListener('input', (e) => {
    state.filterText = e.target.value.trim();
    if (state.currentChatData && state.currentChatData.messages) {
      renderRawMessages(state.currentChatData.messages);
    }
  });

  // --- TAB SWITCHING ---
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      tabButtons.forEach(b => {
        b.className = 'tab-btn px-4 py-2 text-xs font-medium rounded-t-xl text-slate-400 hover:text-slate-200 flex items-center gap-2 whitespace-nowrap';
      });
      btn.className = 'tab-btn active-tab px-4 py-2 text-xs font-semibold rounded-t-xl text-brand-400 border-b-2 border-brand-400 flex items-center gap-2 whitespace-nowrap';

      tabPanes.forEach(pane => {
        if (pane.id === tabId) {
          pane.classList.remove('hidden');
        } else {
          pane.classList.add('hidden');
        }
      });

      if (window.lucide) lucide.createIcons();
    });
  });

  // --- COPY & DOWNLOAD EXPORT HANDLERS ---
  function buildExportMarkdown(data) {
    const s = data.summary || {};
    const stats = data.stats || {};
    let md = `# ChatBrief Summary — ${data.filename || 'WhatsApp Chat'}\n\n`;
    md += `**Date Range:** ${stats.first_date || 'N/A'} - ${stats.last_date || 'N/A'}\n`;
    md += `**Total Messages:** ${stats.total_messages || 0} | **Participants:** ${stats.unique_participants || 0}\n`;
    md += `**Tone:** ${s.tone_and_sentiment || 'Collaborative'}\n\n`;

    md += `## Executive Summary\n${s.summary || 'N/A'}\n\n`;

    if (s.key_highlights && s.key_highlights.length) {
      md += `### Key Highlights\n`;
      s.key_highlights.forEach(h => md += `- ${h}\n`);
      md += `\n`;
    }

    if (s.main_topics && s.main_topics.length) {
      md += `## Main Topics\n`;
      s.main_topics.forEach(t => {
        md += `### ${t.topic}\n${t.description}\n*Contributors:* ${(t.key_contributors || []).join(', ')}\n\n`;
      });
    }

    if (s.decisions && s.decisions.length) {
      md += `## Decisions Finalized\n`;
      s.decisions.forEach(d => md += `- **${d.decision}** (By: ${d.made_by || 'Team'})\n`);
      md += `\n`;
    }

    if (s.action_items && s.action_items.length) {
      md += `## Action Items & Responsibilities\n`;
      s.action_items.forEach(a => md += `- [ ] **${a.task}** — Assignee: @${a.assignee || 'Unassigned'}, Due: ${a.deadline || 'TBD'}\n`);
      md += `\n`;
    }

    if (s.unanswered_questions && s.unanswered_questions.length) {
      md += `## Unanswered Questions\n`;
      s.unanswered_questions.forEach(q => md += `- [?] **${q.question}** (Asked by: ${q.asked_by || 'Unknown'})\n`);
      md += `\n`;
    }

    if (s.timeline && s.timeline.length) {
      md += `## Chronological Timeline\n`;
      s.timeline.forEach(t => md += `- **${t.time}**: ${t.event}\n`);
      md += `\n`;
    }

    md += `---\n*Generated by ChatBrief Intelligence Engine*\n`;
    return md;
  }

  btnCopySummary.addEventListener('click', () => {
    if (!state.currentChatData) return;
    const md = buildExportMarkdown(state.currentChatData);
    navigator.clipboard.writeText(md).then(() => {
      copyBtnText.textContent = 'Copied!';
      showToast('Summary copied in rich Markdown format!');
      setTimeout(() => { copyBtnText.textContent = 'Copy'; }, 2000);
    });
  });

  btnDownloadDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadMenu.classList.toggle('hidden');
    if (window.lucide) lucide.createIcons();
  });

  document.addEventListener('click', () => {
    downloadMenu.classList.add('hidden');
  });

  function downloadFile(filename, text, mimeType = 'text/plain') {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`);
  }

  dlMarkdown.addEventListener('click', () => {
    if (!state.currentChatData) return;
    const md = buildExportMarkdown(state.currentChatData);
    downloadFile(`ChatBrief_Summary_${Date.now()}.md`, md, 'text/markdown');
  });

  dlText.addEventListener('click', () => {
    if (!state.currentChatData) return;
    const md = buildExportMarkdown(state.currentChatData);
    downloadFile(`ChatBrief_Summary_${Date.now()}.txt`, md, 'text/plain');
  });

  dlJson.addEventListener('click', () => {
    if (!state.currentChatData) return;
    const jsonStr = JSON.stringify(state.currentChatData, null, 2);
    downloadFile(`ChatBrief_Export_${Date.now()}.json`, jsonStr, 'application/json');
  });

  dlPrint.addEventListener('click', () => {
    window.print();
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
