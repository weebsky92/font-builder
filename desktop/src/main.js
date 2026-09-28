import './style.css';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open, save } from '@tauri-apps/plugin-dialog';
import { translations } from './i18n.js';

const savedLang = localStorage.getItem('fontbuilder.lang');
const detectedLang = navigator.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en';

const state = {
  step: 1,
  paths: [],
  analysis: null,
  build: null,
  buildDir: null,
  glyphAudit: null,
  glyphPreview: null,
  glyphSelected: null,
  glyphRecipes: {},
  repairedOutputs: [],
  repairedZip: null,
  glyphAuditError: null,
  replaceOnNextAdd: false,
  fontTools: null,
  fontToolsSelected: 0,
  fontToolsTab: 'preview',
  fontToolsFace: null,
  fontToolsCharmapLimit: 800,
  fontToolsConversion: null,
  lang: savedLang || detectedLang,
  settings: {
    close_to_tray: false,
    launch_at_startup: false,
    clean_temp_on_start: true,
    build_mode: 'auto'
  }
};

const $ = (id) => document.getElementById(id);

function t(key) {
  return translations[state.lang]?.[key] ?? translations.en[key] ?? key;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function basename(path) {
  return String(path).split(/[\\/]/).pop() || 'file';
}

function ext(path) {
  const name = basename(path);
  const pos = name.lastIndexOf('.');
  return pos >= 0 ? name.slice(pos + 1).toLowerCase() : '';
}

function modeLabel(mode) {
  if (mode === 'true-variable') return t('analysis.smooth');
  if (mode === 'discrete-variable') return t('analysis.discrete');
  return t('analysis.unsupported');
}

function setLanguage(lang) {
  if (!translations[lang]) return;
  state.lang = lang;
  localStorage.setItem('fontbuilder.lang', lang);
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  render();
  if (!$('glyph-modal').classList.contains('hidden')) renderGlyphLab();
  if (!$('font-tools-modal').classList.contains('hidden')) renderFontTools();
}

function showOverlay(key) {
  $('overlay-text').textContent = t(key);
  $('overlay').classList.remove('hidden');
}

function hideOverlay() {
  $('overlay').classList.add('hidden');
}

function setStep(step) {
  state.step = step;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $({1:'view-input',2:'view-analysis',3:'view-result'}[step]).classList.add('active');

  document.querySelectorAll('.step-tab').forEach(tab => {
    const n = Number(tab.dataset.step);
    tab.classList.toggle('active', n === step);
    tab.classList.toggle('done', n < step);
  });
}

function renderInput() {
  const box = $('input-summary');

  if (!state.paths.length) {
    box.className = 'input-summary empty';
    box.innerHTML = '<span>' + esc(t('input.empty')) + '</span>';
  } else {
    const preview = state.paths.slice(0, 3);
    const extra = state.paths.length - preview.length;

    box.className = 'input-summary';
    box.innerHTML = `
      <div class="input-count">
        <strong>${state.paths.length}</strong>
        <span>${esc(t('input.items'))}</span>
      </div>
      <div class="input-paths">
        ${preview.map(p => '<code>' + esc(p) + '</code>').join('')}
        ${extra > 0 ? '<small>+' + extra + ' ' + esc(t('input.more')) + '</small>' : ''}
      </div>
    `;
  }

  $('analyze').disabled = !state.paths.length;
}

function analysisData() {
  return state.analysis?.families?.[0] || null;
}

function variableEligibility(family) {
  const families = state.analysis?.families || [];
  if (families.length !== 1) {
    return { ok: false, reason: t('analysis.oneFamilyRequired') };
  }

  const fonts = family?.fonts || [];
  if (fonts.length < 2) {
    return { ok: false, reason: t('analysis.needTwoMasters') };
  }
  if (family?.build_mode === 'unsupported-source-outline') {
    return { ok: false, reason: t('analysis.unsupportedVariable') };
  }
  return { ok: true, reason: '' };
}

function glyphFamily() {
  const families = state.glyphAudit?.families || [];
  return families.length === 1 ? families[0] : null;
}

function fontCountLabel(count) {
  if (state.lang !== 'pl') return count === 1 ? '1 font file' : count + ' font files';
  if (count === 1) return '1 plik czcionki';
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
    return count + ' pliki czcionki';
  }
  return count + ' plików czcionki';
}

function renderGlyphSummaryBar() {
  const family = glyphFamily();
  if (!family) return '';

  if (family.complete) {
    return `
      <div class="glyph-audit-bar complete">
        <div>
          <span class="glyph-audit-icon">✓</span>
          <div>
            <strong>${esc(t('analysis.polishComplete'))}</strong>
            <small>Ą Ć Ę Ł Ń Ó Ś Ź Ż · ą ć ę ł ń ó ś ź ż</small>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="glyph-audit-bar warning">
      <div>
        <span class="glyph-audit-icon">${family.missing_count}</span>
        <div>
          <strong>${esc(t('analysis.polishMissing'))}: ${family.missing_count}</strong>
          <small>Ą Ć Ę Ł Ń Ó Ś Ź Ż · ą ć ę ł ń ó ś ź ż</small>
        </div>
      </div>
      <button id="open-glyph-lab" class="glyph-lab-btn">${esc(t('analysis.openGlyphLab'))}</button>
    </div>
  `;
}

function renderAnalysis() {
  const families = state.analysis?.families || [];
  const family = analysisData();

  if (!family) return;

  if (families.length !== 1) {
    $('analysis-content').innerHTML = `
      <div class="stage-head">
        <div>
          <span class="status-pill warning">! ${esc(t('analysis.multipleFamilies'))}</span>
          <h2>${esc(t('analysis.chooseOneFamily'))}</h2>
        </div>
      </div>
      <div class="multi-family-list">
        ${families.map(item => `
          <div>
            <strong>${esc(item.family)}</strong>
            <span>${esc(fontCountLabel((item.fonts || []).length))}</span>
          </div>
        `).join('')}
      </div>
      <div class="stage-note">${esc(t('analysis.multipleFamiliesNote'))}</div>
    `;

    $('font-tools-action').disabled = true;
    $('font-tools-action').title = t('analysis.oneFamilyRequired');
    $('glyph-action').disabled = true;
    $('glyph-action').title = t('analysis.oneFamilyRequired');
    $('build').disabled = true;
    $('build').title = t('analysis.oneFamilyRequired');
    return;
  }

  const fonts = family.fonts || [];
  const weights = [...new Set(fonts.map(f => Number(f.weight)).filter(Number.isFinite))].sort((a,b) => a-b);
  const italics = fonts.filter(f => f.italic).length;
  const romans = fonts.length - italics;
  const glyphs = glyphFamily();
  const eligibility = variableEligibility(family);

  const glyphKnown = !!glyphs;
  const glyphComplete = glyphs?.complete === true;
  const glyphMissing = glyphKnown ? Number(glyphs.missing_count || 0) : null;
  const glyphRepairSupported = glyphKnown && glyphs.repair_supported !== false;
  const canRepairGlyphs = glyphKnown && !glyphComplete && glyphRepairSupported;

  let polishValue = t('analysis.polishUnknown');
  let polishSub = state.glyphAuditError ? t('analysis.auditFailedShort') : t('analysis.auditPending');
  let polishClass = 'unknown';

  if (glyphKnown && glyphComplete) {
    polishValue = t('analysis.polishCompleteShort');
    polishSub = '18 / 18';
    polishClass = 'ok';
  } else if (glyphKnown) {
    polishValue = t('analysis.polishMissingShort');
    polishSub = glyphMissing + ' / 18';
    polishClass = 'warning';
  }

  let recommendation;
  if (!glyphKnown) {
    recommendation = t('analysis.recommendAuditUnavailable');
  } else if (fonts.length < 2 && glyphComplete) {
    recommendation = t('analysis.recommendSingleComplete');
  } else if (fonts.length < 2) {
    recommendation = t('analysis.recommendSingleMissing');
  } else if (!glyphComplete && eligibility.ok) {
    recommendation = t('analysis.recommendRepairThenVariable');
  } else if (glyphComplete && eligibility.ok) {
    recommendation = t('analysis.recommendVariableReady');
  } else if (!glyphComplete) {
    recommendation = t('analysis.recommendRepairOnly');
  } else {
    recommendation = eligibility.reason;
  }

  const repairedOutputs = state.repairedOutputs || [];
  const repairedZip = state.repairedZip;
  const repairedMulti = repairedOutputs.length > 1;

  const repairedBox = repairedOutputs.length ? `
    <div class="static-export-bar ${repairedMulti ? 'family-export' : ''}">
      <div class="static-export-copy">
        <strong>✓ ${esc(repairedMulti ? t('analysis.repairedFamilyReady') : t('analysis.repairedReady'))}</strong>
        <small>${
          repairedMulti
            ? esc(t('analysis.recipeAppliedFamily') + ' ' + repairedOutputs.length)
            : esc(basename(repairedOutputs[0]))
        }</small>
      </div>

      <div class="static-export-actions">
        ${
          repairedMulti
            ? `
              <select id="repaired-variant-select" aria-label="${esc(t('analysis.selectVariant'))}">
                ${repairedOutputs.map((path, index) => `
                  <option value="${index}">${esc(basename(path))}</option>
                `).join('')}
              </select>
              <button id="save-repaired-selected" class="secondary">${esc(t('analysis.saveSelectedVariant'))}</button>
              <button id="save-repaired-pack">${esc(t('analysis.saveRepairedPack'))}</button>
            `
            : `<button id="save-repaired-static">${esc(t('analysis.saveRepaired'))}</button>`
        }
      </div>
    </div>
  ` : '';

  $('analysis-content').innerHTML = `
    <div class="stage-head">
      <div>
        <span class="status-pill success">✓ ${esc(t('analysis.reviewed'))}</span>
        <h2>${esc(family.family)}</h2>
      </div>
      <div class="subtle">${esc(t('analysis.ignored'))}: <strong>${state.analysis?.ignored?.length || 0}</strong></div>
    </div>

    <div class="analysis-summary-grid">
      <div class="analysis-status-card">
        <span>${esc(t('analysis.fontFiles'))}</span>
        <strong>${esc(fontCountLabel(fonts.length))}</strong>
        <small>${esc(weights.join(' · ') || '—')} · ${romans} roman · ${italics} italic</small>
      </div>

      <div class="analysis-status-card ${polishClass}">
        <span>${esc(t('analysis.polishChars'))}</span>
        <strong>${esc(polishValue)}</strong>
        <small>${esc(polishSub)}</small>
      </div>

      <div class="analysis-status-card ${eligibility.ok ? 'ok' : 'disabled'}">
        <span>VARIABLE FONT</span>
        <strong>${esc(eligibility.ok ? t('analysis.available') : t('analysis.unavailable'))}</strong>
        <small>${esc(eligibility.ok ? modeLabel(family.build_mode) : eligibility.reason)}</small>
      </div>
    </div>

    <div class="recommendation-bar">
      <span>${esc(t('analysis.recommendedPath'))}</span>
      <strong>${esc(recommendation)}</strong>
    </div>

    ${repairedBox}
  `;

  $('save-repaired-static')?.addEventListener('click', () => {
    const path = repairedOutputs[0];
    if (path) saveOutput(path, ext(path));
  });

  $('save-repaired-pack')?.addEventListener('click', () => {
    if (repairedZip) saveOutput(repairedZip, 'zip');
  });

  $('save-repaired-selected')?.addEventListener('click', () => {
    const select = $('repaired-variant-select');
    const path = repairedOutputs[Number(select?.value || 0)];
    if (path) saveOutput(path, ext(path));
  });

  $('font-tools-action').disabled = false;
  $('font-tools-action').title = '';
  $('glyph-action').disabled = !canRepairGlyphs;
  $('glyph-action').title = canRepairGlyphs
    ? ''
    : (glyphComplete ? t('analysis.polishAlreadyComplete') : (glyphKnown ? t('analysis.glyphRepairUnavailable') : t('analysis.polishUnknown')));

  $('build').disabled = !eligibility.ok;
  $('build').title = eligibility.ok ? '' : eligibility.reason;
}

function collectOutputs() {
  const result = state.build?.results?.[0];
  if (!result) return [];

  const outputs = [];
  if (result.zip) outputs.push({ type: 'zip', path: result.zip });

  for (const path of result.produced || []) {
    const e = ext(path);
    if (['ttf','otf','woff','woff2','css'].includes(e)) {
      outputs.push({ type: e, path });
    }
  }

  return outputs;
}

function renderResult() {
  const result = state.build?.results?.[0];
  if (!result) return;

  const outputs = collectOutputs();

  $('result-content').innerHTML = `
    <div class="result-hero">
      <div class="success-icon">✓</div>
      <div>
        <span class="status-pill success">${esc(t('result.title'))}</span>
        <h2>${esc(result.family)}</h2>
        <p>${esc(t('result.subtitle'))}</p>
      </div>
    </div>

    <div class="result-meta">
      <div><span>${esc(t('result.mode'))}</span><strong>${esc(modeLabel(result.mode))}</strong></div>
      <div><span>${esc(t('result.available'))}</span><strong>${outputs.length}</strong></div>
    </div>

    <div class="download-grid">
      ${outputs.map(item => `
        <button class="download-card ${item.type === 'zip' ? 'primary' : ''}" data-save-path="${esc(item.path)}" data-save-type="${esc(item.type)}">
          <span>${esc(t('format.' + item.type))}</span>
          <small>${esc(basename(item.path))}</small>
        </button>
      `).join('')}
    </div>

    <p class="save-hint">${esc(t('result.saveHint'))}</p>
    <div id="save-message" class="save-message"></div>
  `;

  document.querySelectorAll('[data-save-path]').forEach(button => {
    button.addEventListener('click', () => saveOutput(button.dataset.savePath, button.dataset.saveType));
  });
}

function render() {
  renderInput();
  if (state.step === 2) renderAnalysis();
  if (state.step === 3) renderResult();
  setStep(state.step);
}

function resetAll() {
  state.step = 1;
  state.replaceOnNextAdd = false;
  state.paths = [];
  state.analysis = null;
  state.build = null;
  state.buildDir = null;
  state.glyphAudit = null;
  state.glyphPreview = null;
  state.glyphSelected = null;
  state.glyphRecipes = {};
  state.repairedOutputs = [];
  state.repairedZip = null;
  state.glyphAuditError = null;
  releaseToolFace();
  state.fontTools = null;
  state.fontToolsSelected = 0;
  state.fontToolsTab = 'preview';
  state.fontToolsCharmapLimit = 800;
  state.fontToolsConversion = null;
  render();
}

function addPaths(paths) {
  if (state.replaceOnNextAdd) {
    state.paths = [];
  }

  for (const p of paths || []) {
    if (!state.paths.includes(p)) state.paths.push(p);
  }

  state.replaceOnNextAdd = false;
  state.analysis = null;
  state.build = null;
  state.buildDir = null;
  state.glyphAudit = null;
  state.glyphPreview = null;
  state.glyphSelected = null;
  state.glyphRecipes = {};
  state.repairedOutputs = [];
  state.repairedZip = null;
  state.glyphAuditError = null;
  releaseToolFace();
  state.fontTools = null;
  state.fontToolsSelected = 0;
  state.fontToolsTab = 'preview';
  state.fontToolsCharmapLimit = 800;
  state.fontToolsConversion = null;
  state.step = 1;
  render();
}

async function runAnalysis() {
  state.analysis = await invoke('run_engine', { args: ['analyze', ...state.paths] });
  try {
    state.glyphAudit = await invoke('run_engine', { args: ['glyph-audit', ...state.paths] });
    state.glyphAuditError = null;
  } catch (error) {
    console.warn('Glyph audit unavailable', error);
    state.glyphAudit = null;
    state.glyphAuditError = String(error);
  }
}

async function analyze() {
  showOverlay('loading.analyze');

  try {
    await runAnalysis();
    state.step = 2;
    render();
  } catch (error) {
    alert(t('error.title') + '\n\n' + String(error));
  } finally {
    hideOverlay();
  }
}

async function build() {
  const eligibility = variableEligibility(analysisData());
  if (!eligibility.ok) {
    alert(t('analysis.variableUnavailable') + '\n\n' + eligibility.reason);
    return;
  }

  showOverlay('loading.build');

  try {
    state.buildDir = await invoke('create_build_dir');
    state.build = await invoke('run_engine', {
      args: [
        'build',
        ...state.paths,
        '-o', state.buildDir,
        '--mode', state.settings.build_mode || 'auto',
        '--formats', 'ttf,otf,woff,woff2,css,zip'
      ]
    });
    state.step = 3;
    render();
  } catch (error) {
    alert(t('error.title') + '\n\n' + String(error));
  } finally {
    hideOverlay();
  }
}

async function saveOutput(source, type) {
  const extension = ext(source);
  const target = await save({
    defaultPath: basename(source),
    filters: [{ name: String(type).toUpperCase(), extensions: extension ? [extension] : [] }]
  });

  if (!target) return;

  const message = $('save-message');

  try {
    await invoke('copy_output_file', { source, destination: target });
    if (message) {
      message.textContent = t('result.saved') + ': ' + target;
      message.className = 'save-message success';
    }
  } catch (error) {
    if (message) {
      message.textContent = t('result.saveError') + ' ' + String(error);
      message.className = 'save-message error';
    } else {
      alert(t('result.saveError') + '\n\n' + String(error));
    }
  }
}

function fillSettings() {
  $('setting-tray').checked = !!state.settings.close_to_tray;
  $('setting-autostart').checked = !!state.settings.launch_at_startup;
  $('setting-cleanup').checked = !!state.settings.clean_temp_on_start;
  $('setting-mode').value = state.settings.build_mode || 'auto';
  $('settings-message').textContent = '';
}

function openSettings() {
  fillSettings();
  $('settings-modal').classList.remove('hidden');
  $('settings-modal').setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  $('settings-modal').classList.add('hidden');
  $('settings-modal').setAttribute('aria-hidden', 'true');
}

async function loadSettings() {
  try {
    const settings = await invoke('get_desktop_settings');
    state.settings = { ...state.settings, ...settings };
  } catch (error) {
    console.warn('Could not load desktop settings', error);
  }
}

async function saveSettings() {
  const next = {
    close_to_tray: $('setting-tray').checked,
    launch_at_startup: $('setting-autostart').checked,
    clean_temp_on_start: $('setting-cleanup').checked,
    build_mode: $('setting-mode').value
  };

  const message = $('settings-message');

  try {
    state.settings = await invoke('set_desktop_settings', { settings: next });
    message.textContent = t('settings.saved');
    message.className = 'settings-message success';
    render();
  } catch (error) {
    message.textContent = t('settings.error') + ' ' + String(error);
    message.className = 'settings-message error';
  }
}

function selectedToolFont() {
  return state.fontTools?.fonts?.[state.fontToolsSelected] || null;
}

function releaseToolFace() {
  if (state.fontToolsFace) {
    try { document.fonts.delete(state.fontToolsFace); } catch (_) {}
    state.fontToolsFace = null;
  }
}

async function loadToolFontFace() {
  const item = selectedToolFont();
  if (!item?.preview_path) return;

  releaseToolFace();

  try {
    const bytes = await invoke('read_temp_file', { source: item.preview_path });
    const data = new Uint8Array(bytes);
    const faceName = 'FontBuilderPreview_' + Date.now();
    const face = new FontFace(faceName, data.buffer);
    await face.load();
    document.fonts.add(face);
    state.fontToolsFace = face;

    const canvas = $('tools-preview-canvas');
    if (canvas) canvas.style.fontFamily = '"' + faceName + '"';
  } catch (error) {
    console.warn('Font preview load failed', error);
    const canvas = $('tools-preview-canvas');
    if (canvas) canvas.style.fontFamily = 'inherit';
  }
}

function toolFamilyName() {
  return state.fontTools?.fonts?.[0]?.family || analysisData()?.family || '';
}

function renderToolVariantSelect() {
  const select = $('tools-variant');
  const fonts = state.fontTools?.fonts || [];
  if (!select) return;

  select.innerHTML = fonts.map((font, index) => {
    const label = [
      font.style || font.file_name,
      font.weight ? String(font.weight) : '',
      font.italic ? 'italic' : ''
    ].filter(Boolean).join(' · ');
    return '<option value="' + index + '">' + esc(label) + '</option>';
  }).join('');
  select.value = String(Math.min(state.fontToolsSelected, Math.max(0, fonts.length - 1)));
}

function renderPreviewTool() {
  const item = selectedToolFont();
  if (!item) return;

  const canvas = $('tools-preview-canvas');
  const input = $('tools-preview-text');
  const slider = $('tools-preview-size');
  const value = $('tools-preview-size-value');

  if (canvas && input && !canvas.dataset.initialized) {
    canvas.textContent = input.value;
    canvas.dataset.initialized = '1';
  }

  if (canvas && slider) canvas.style.fontSize = slider.value + 'px';
  if (value && slider) value.textContent = slider.value + ' px';

  if (state.fontToolsFace && canvas) {
    canvas.style.fontFamily = '"' + state.fontToolsFace.family + '"';
  }
}

function filteredToolCharacters() {
  const item = selectedToolFont();
  if (!item) return [];
  const query = ($('tools-charmap-search')?.value || '').trim().toLowerCase();

  if (!query) return item.characters || [];

  return (item.characters || []).filter(entry => {
    const hay = [
      entry.char,
      entry.unicode,
      entry.glyph,
      String(entry.codepoint)
    ].join(' ').toLowerCase();
    return hay.includes(query);
  });
}

function renderCharmapTool() {
  const all = filteredToolCharacters();
  const limit = Math.max(100, state.fontToolsCharmapLimit || 800);
  const shown = all.slice(0, limit);
  const grid = $('tools-charmap-grid');
  const count = $('tools-charmap-count');
  const more = $('tools-charmap-more');

  if (count) count.textContent = shown.length + ' / ' + all.length;

  if (grid) {
    grid.innerHTML = shown.map(entry => {
      let display = entry.char || '·';
      if (/^\s$/u.test(display)) display = '␠';
      if (entry.codepoint < 32 || (entry.codepoint >= 127 && entry.codepoint <= 159)) display = '·';
      return `
        <div class="tool-char-cell" title="${esc(entry.glyph)}">
          <strong>${esc(display)}</strong>
          <span>${esc(entry.unicode)}</span>
          <small>${esc(entry.glyph)}</small>
        </div>
      `;
    }).join('');
  }

  if (more) {
    more.classList.toggle('hidden', shown.length >= all.length);
  }
}

function issueHtml(issue) {
  const level = issue?.level || 'info';
  const icon = level === 'ok' ? '✓' : level === 'error' ? '!' : level === 'warning' ? '!' : 'i';
  const key = 'tools.issue.' + (issue.code || '');
  const translated = t(key);
  const message = translated === key ? (issue.message || '') : translated;
  return `
    <div class="tool-issue ${esc(level)}">
      <span>${icon}</span>
      <div>
        <strong>${esc(issue.code || level)}</strong>
        <small>${esc(message)}</small>
      </div>
    </div>
  `;
}

function renderHealthTool() {
  const item = selectedToolFont();
  if (!item) return;

  const familyIssues = state.fontTools?.family_health || [];
  const fontIssues = item.health || [];
  const all = [...familyIssues, ...fontIssues];
  const errors = all.filter(x => x.level === 'error').length;
  const warnings = all.filter(x => x.level === 'warning').length;

  const summary = $('tools-health-summary');
  if (summary) {
    summary.innerHTML = `
      <div><span>${esc(t('tools.glyphCount'))}</span><strong>${item.glyph_count}</strong></div>
      <div><span>UPM</span><strong>${item.upm}</strong></div>
      <div><span>${esc(t('tools.errors'))}</span><strong>${errors}</strong></div>
      <div><span>${esc(t('tools.warnings'))}</span><strong>${warnings}</strong></div>
    `;
  }

  $('tools-family-health').innerHTML = familyIssues.map(issueHtml).join('');
  $('tools-font-health').innerHTML = fontIssues.map(issueHtml).join('');
}

function renderMetadataTool() {
  const item = selectedToolFont();
  if (!item) return;
  const names = item.names || {};

  $('meta-family').value = names.family || '';
  $('meta-style').value = names.style || '';
  $('meta-full-name').value = names.full_name || '';
  $('meta-postscript').value = names.postscript || '';
  $('meta-version').value = names.version || '';
}

function renderConvertResult() {
  const result = state.fontToolsConversion;
  const box = $('tools-convert-result');
  if (!box) return;

  if (!result) {
    box.innerHTML = '';
    return;
  }

  box.innerHTML = `
    <div class="tool-convert-success">
      <div>
        <strong>✓ ${esc(t('tools.convertDone'))}</strong>
        <small>${result.count} ${esc(t('tools.filesReady'))}</small>
      </div>
      <button id="tools-download-convert-zip">${esc(t('tools.downloadZip'))}</button>
    </div>
    <div class="tool-convert-files">
      ${(result.outputs || []).map(path => `
        <button class="secondary" data-tool-convert-path="${esc(path)}">${esc(basename(path))}</button>
      `).join('')}
    </div>
  `;

  $('tools-download-convert-zip')?.addEventListener('click', () => saveOutput(result.zip, 'zip'));
  document.querySelectorAll('[data-tool-convert-path]').forEach(button => {
    button.addEventListener('click', () => {
      const path = button.dataset.toolConvertPath;
      saveOutput(path, ext(path));
    });
  });
}

function renderFontTools() {
  if (!state.fontTools) return;

  $('tools-family').textContent = toolFamilyName();
  renderToolVariantSelect();

  document.querySelectorAll('.tool-nav-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.toolTab === state.fontToolsTab);
  });
  document.querySelectorAll('.tool-pane').forEach(pane => pane.classList.remove('active'));
  $('tools-tab-' + state.fontToolsTab)?.classList.add('active');

  if (state.fontToolsTab === 'preview') renderPreviewTool();
  if (state.fontToolsTab === 'charmap') renderCharmapTool();
  if (state.fontToolsTab === 'health') renderHealthTool();
  if (state.fontToolsTab === 'metadata') renderMetadataTool();
  if (state.fontToolsTab === 'convert') renderConvertResult();
}

async function openFontTools() {
  if ((state.analysis?.families || []).length !== 1) return;

  showOverlay('loading.fontTools');
  try {
    const output = await invoke('create_build_dir');
    const response = await invoke('run_engine', {
      args: ['font-tools', '-o', output, ...state.paths]
    });

    state.fontTools = response.tools;
    state.fontToolsSelected = 0;
    state.fontToolsTab = 'preview';
    state.fontToolsCharmapLimit = 800;
    state.fontToolsConversion = null;

    $('font-tools-modal').classList.remove('hidden');
    $('font-tools-modal').setAttribute('aria-hidden', 'false');
    renderFontTools();
    await loadToolFontFace();
    renderPreviewTool();
  } catch (error) {
    alert(t('error.title') + '\n\n' + String(error));
  } finally {
    hideOverlay();
  }
}

function closeFontTools() {
  $('font-tools-modal').classList.add('hidden');
  $('font-tools-modal').setAttribute('aria-hidden', 'true');
}

async function selectToolVariant(index) {
  state.fontToolsSelected = Math.max(0, Number(index) || 0);
  state.fontToolsCharmapLimit = 800;
  renderFontTools();
  await loadToolFontFace();
  renderPreviewTool();
}

function switchToolTab(tab) {
  state.fontToolsTab = tab;
  renderFontTools();
}

async function saveToolMetadata() {
  const item = selectedToolFont();
  if (!item) return;

  showOverlay('loading.metadata');
  const message = $('tools-metadata-message');

  try {
    const output = await invoke('create_build_dir');
    const metadata = {
      family: $('meta-family').value.trim(),
      style: $('meta-style').value.trim(),
      full_name: $('meta-full-name').value.trim(),
      postscript: $('meta-postscript').value.trim(),
      version: $('meta-version').value.trim()
    };

    const response = await invoke('run_engine', {
      args: [
        'metadata-update',
        '-o', output,
        '--index', String(item.index),
        '--metadata-json', JSON.stringify(metadata),
        ...state.paths
      ]
    });

    message.textContent = t('tools.metadataDone');
    message.className = 'tool-message success';
    await saveOutput(response.result.output, ext(response.result.output));
  } catch (error) {
    message.textContent = t('tools.metadataError') + ' ' + String(error);
    message.className = 'tool-message error';
  } finally {
    hideOverlay();
  }
}

async function runToolConvert() {
  const formats = [];
  if ($('convert-woff').checked) formats.push('woff');
  if ($('convert-woff2').checked) formats.push('woff2');
  if (!formats.length) {
    alert(t('tools.chooseFormat'));
    return;
  }

  showOverlay('loading.convert');
  try {
    const output = await invoke('create_build_dir');
    const response = await invoke('run_engine', {
      args: [
        'convert',
        '-o', output,
        '--formats', formats.join(','),
        ...state.paths
      ]
    });
    state.fontToolsConversion = response.result;
    renderConvertResult();
  } catch (error) {
    alert(t('error.title') + '\n\n' + String(error));
  } finally {
    hideOverlay();
  }
}


function glyphItem(char) {
  return glyphFamily()?.chars?.find(item => item.char === char) || null;
}

function glyphStatusText(item) {
  if (!item) return '—';
  if (item.status === 'present') return t('glyph.present');
  if (item.status === 'partial') return t('glyph.partial');
  return t('glyph.missing');
}

function renderGlyphGrid() {
  const family = glyphFamily();
  if (!family) return;

  $('glyph-family').textContent = family.family;

  $('glyph-grid').innerHTML = family.chars.map(item => {
    const selected = item.char === state.glyphSelected ? 'selected' : '';
    const queued = state.glyphRecipes[item.char] ? 'queued' : '';
    return `
      <button class="glyph-cell ${item.status} ${selected} ${queued}" data-glyph-char="${esc(item.char)}">
        <span>${esc(item.char)}</span>
        <small>${esc(item.codepoint)}</small>
      </button>
    `;
  }).join('');

  document.querySelectorAll('[data-glyph-char]').forEach(button => {
    button.addEventListener('click', () => selectGlyph(button.dataset.glyphChar));
  });

  const missing = family.chars.filter(item => item.status !== 'present');
  const ready = missing.filter(item => item.repairable).length;

  $('glyph-summary-title').textContent = family.complete
    ? t('glyph.summaryComplete')
    : t('glyph.summaryMissing') + ': ' + missing.length;

  $('glyph-summary-text').textContent = family.complete
    ? '18 / 18'
    : t('glyph.summaryReady') + ': ' + ready + ' / ' + missing.length;
}

function recipeSourceLabel(preview) {
  if (!preview) return '—';
  if (preview.existing_name) return t('glyph.existing');
  if (preview.recipe?.geometry) return t('glyph.geometry');
  if (preview.mark_name) return t('glyph.component') + ': ' + preview.mark_name;
  return t('glyph.notRepairable');
}

function transformPoint(x, y, ox, oy, scale, angleDeg) {
  const angle = angleDeg * Math.PI / 180;
  const px = (x - ox) * scale;
  const py = (y - oy) * scale;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [ox + px * c - py * s, oy + px * s + py * c];
}

function geometryPath(kind, recipe, upm) {
  const x = Number(recipe.dx || 0);
  const y = Number(recipe.dy || 0);
  const scale = Number(recipe.scale || 1);
  const rotation = Number(recipe.rotation || 0);
  const w = Number(recipe.mark_width || upm * 0.13);
  const h = Number(recipe.mark_height || upm * 0.18);
  let raw;

  if (kind === 'acute') {
    raw = [
      [x, y],
      [x + w * 0.36, y],
      [x + w, y + h],
      [x + w * 0.55, y + h]
    ];
  } else if (kind === 'dot') {
    raw = [
      [x + w * 0.5, y],
      [x + w, y + h * 0.5],
      [x + w * 0.5, y + h],
      [x, y + h * 0.5]
    ];
  } else {
    raw = [
      [x + w * 0.78, y + h],
      [x + w, y + h * 0.82],
      [x + w * 0.72, y + h * 0.46],
      [x + w * 0.48, y + h * 0.12],
      [x + w * 0.18, y],
      [x, y + h * 0.18],
      [x + w * 0.30, y + h * 0.34],
      [x + w * 0.50, y + h * 0.66]
    ];
  }

  const pts = raw.map(([px, py]) => transformPoint(px, py, x, y, scale, rotation));
  return 'M' + pts.map(([px, py]) => px.toFixed(2) + ' ' + py.toFixed(2)).join(' L') + ' Z';
}

function strokePath(recipe) {
  const x = Number(recipe.stroke_x || 0) + Number(recipe.dx || 0);
  const y = Number(recipe.stroke_y || 0) + Number(recipe.dy || 0);
  const width = Number(recipe.stroke_width || 500) * Number(recipe.scale || 1);
  const thickness = Number(recipe.thickness || 60) * Number(recipe.scale || 1);
  const angle = Number(recipe.rotation || -10) * Math.PI / 180;
  const vx = Math.cos(angle) * width;
  const vy = Math.sin(angle) * width;
  const nx = -Math.sin(angle) * thickness / 2;
  const ny = Math.cos(angle) * thickness / 2;
  const pts = [
    [x + nx, y + ny],
    [x + vx + nx, y + vy + ny],
    [x + vx - nx, y + vy - ny],
    [x - nx, y - ny]
  ];
  return 'M' + pts.map(([px, py]) => px.toFixed(2) + ' ' + py.toFixed(2)).join(' L') + ' Z';
}

function renderGlyphCanvas() {
  const preview = state.glyphPreview;
  const item = glyphItem(state.glyphSelected);
  if (!preview || !item) {
    $('glyph-canvas').innerHTML = '';
    return;
  }

  const recipe = state.glyphRecipes[state.glyphSelected] || preview.recipe || {};
  const width = Math.max(Number(preview.advance || 1000), Number(preview.upm || 1000)) + 220;
  const ascent = Number(preview.ascent || 800);
  const descent = Number(preview.descent || -200);
  const height = ascent - descent + 220;
  const viewY = -ascent - 110;

  let mark = '';
  if (item.status === 'present' && preview.existing_path) {
    mark = `<path class="glyph-existing" d="${esc(preview.existing_path)}"></path>`;
  } else if (recipe.kind === 'stroke') {
    mark = `<path class="glyph-mark" d="${strokePath(recipe)}"></path>`;
  } else if (recipe.geometry) {
    mark = `<path class="glyph-mark" d="${geometryPath(recipe.kind, recipe, Number(preview.upm || 1000))}"></path>`;
  } else if (preview.mark_path) {
    const dx = Number(recipe.dx || 0);
    const dy = Number(recipe.dy || 0);
    const scale = Number(recipe.scale || 1);
    const rotation = Number(recipe.rotation || 0);
    mark = `
      <g transform="translate(${dx} ${dy}) rotate(${rotation}) scale(${scale})">
        <path class="glyph-mark" d="${esc(preview.mark_path)}"></path>
      </g>
    `;
  }

  const basePath = item.status === 'present' && preview.existing_path ? '' :
    `<path class="glyph-base" d="${esc(preview.base_path)}"></path>`;

  $('glyph-canvas').innerHTML = `
    <svg viewBox="-110 ${viewY} ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <line class="glyph-baseline" x1="-110" x2="${width}" y1="0" y2="0"></line>
      <g transform="scale(1 -1)">
        ${basePath}
        ${mark}
      </g>
    </svg>
  `;
}

function setRange(id, value, min, max, step = 1) {
  const input = $(id);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(Number(value ?? 0));
}

function updateGlyphControlLabels() {
  const recipe = state.glyphRecipes[state.glyphSelected] || {};
  $('glyph-x-value').textContent = Math.round(Number(recipe.dx || 0));
  $('glyph-y-value').textContent = Math.round(Number(recipe.dy || 0));
  $('glyph-scale-value').textContent = Number(recipe.scale || 1).toFixed(2);
  $('glyph-rotation-value').textContent = Math.round(Number(recipe.rotation || 0)) + '°';
  $('glyph-thickness-value').textContent = Math.round(Number(recipe.thickness || 0));
  $('glyph-width-value').textContent = Math.round(Number(recipe.mark_width || 0));
  $('glyph-height-value').textContent = Math.round(Number(recipe.mark_height || 0));
}

function renderGlyphControls() {
  const preview = state.glyphPreview;
  const item = glyphItem(state.glyphSelected);
  if (!preview || !item) return;

  $('glyph-char-label').textContent = item.char;
  $('glyph-status-label').textContent = glyphStatusText(item);
  $('glyph-source-label').textContent = recipeSourceLabel(preview);

  const recipe = state.glyphRecipes[item.char] || preview.recipe || {};
  const upm = Number(preview.upm || 1000);

  setRange('glyph-x', recipe.dx || 0, -upm, upm, 1);
  setRange('glyph-y', recipe.dy || 0, -upm, upm * 1.5, 1);
  $('glyph-scale').value = String(Number(recipe.scale || 1));
  $('glyph-rotation').value = String(Number(recipe.rotation || 0));

  $('glyph-thickness-row').classList.toggle('hidden', recipe.kind !== 'stroke');
  $('glyph-width-row').classList.toggle('hidden', !recipe.geometry);
  $('glyph-height-row').classList.toggle('hidden', !recipe.geometry);

  if (recipe.kind === 'stroke') {
    setRange('glyph-thickness', recipe.thickness || upm * 0.055, 8, upm * 0.25, 1);
  }
  if (recipe.geometry) {
    setRange('glyph-width', recipe.mark_width || upm * 0.13, 20, upm * 0.5, 1);
    setRange('glyph-height', recipe.mark_height || upm * 0.18, 20, upm * 0.5, 1);
  }

  const disabled = item.status === 'present' || !item.repairable;
  document.querySelectorAll('.glyph-controls input').forEach(input => input.disabled = disabled);
  $('glyph-save-recipe').disabled = disabled;

  $('glyph-recipe-status').textContent = !item.repairable
    ? t('glyph.notRepairable')
    : (state.glyphRecipes[item.char]?._edited ? t('glyph.recipeSaved') : '');

  updateGlyphControlLabels();
  renderGlyphCanvas();
}

function renderGlyphLab() {
  renderGlyphGrid();
  renderGlyphControls();
}

async function selectGlyph(char) {
  state.glyphSelected = char;
  renderGlyphGrid();

  showOverlay('loading.glyphPreview');
  try {
    const current = state.glyphRecipes[char];
    const args = ['glyph-preview', '--char', char];
    if (current) args.push('--recipe-json', JSON.stringify(current));
    args.push(...state.paths);

    const response = await invoke('run_engine', { args });
    state.glyphPreview = response.preview;

    if (!state.glyphRecipes[char]) {
      state.glyphRecipes[char] = { ...(response.preview?.recipe || {}) };
    }

    renderGlyphLab();
  } catch (error) {
    alert(t('error.title') + '\n\n' + String(error));
  } finally {
    hideOverlay();
  }
}

async function openGlyphLab() {
  const family = glyphFamily();
  if (!family) return;

  $('glyph-modal').classList.remove('hidden');
  $('glyph-modal').setAttribute('aria-hidden', 'false');

  const first = family.chars.find(item => item.status !== 'present') || family.chars[0];
  if (first) await selectGlyph(first.char);
}

function closeGlyphLab() {
  $('glyph-modal').classList.add('hidden');
  $('glyph-modal').setAttribute('aria-hidden', 'true');
}

function updateRecipeFromControls() {
  const char = state.glyphSelected;
  if (!char || !state.glyphRecipes[char]) return;

  const recipe = state.glyphRecipes[char];
  recipe.dx = Number($('glyph-x').value);
  recipe.dy = Number($('glyph-y').value);
  recipe.scale = Number($('glyph-scale').value);
  recipe.rotation = Number($('glyph-rotation').value);

  if (recipe.kind === 'stroke') {
    recipe.thickness = Number($('glyph-thickness').value);
  }
  if (recipe.geometry) {
    recipe.mark_width = Number($('glyph-width').value);
    recipe.mark_height = Number($('glyph-height').value);
  }

  recipe._edited = true;
  state.glyphRecipes[char] = recipe;
  updateGlyphControlLabels();
  renderGlyphCanvas();
  renderGlyphGrid();
}

async function resetGlyphAuto() {
  const item = glyphItem(state.glyphSelected);
  if (!item) return;

  state.glyphRecipes[item.char] = { ...(item.suggested_recipe || {}) };
  state.glyphRecipes[item.char]._edited = false;
  await selectGlyph(item.char);
  $('glyph-recipe-status').textContent = t('glyph.autoLoaded');
}

function autoAllGlyphs() {
  const family = glyphFamily();
  if (!family) return;

  family.chars.forEach(item => {
    if (item.status !== 'present' && item.repairable && item.suggested_recipe) {
      state.glyphRecipes[item.char] = { ...item.suggested_recipe };
    }
  });

  renderGlyphLab();
}

function saveGlyphRecipe() {
  const char = state.glyphSelected;
  if (!char || !state.glyphRecipes[char]) return;
  state.glyphRecipes[char]._edited = true;
  $('glyph-recipe-status').textContent = t('glyph.recipeSaved');
  renderGlyphGrid();
}

async function repairGlyphs() {
  const family = glyphFamily();
  if (!family) return;

  const missing = family.chars.filter(item => item.status !== 'present');
  const blocked = missing.filter(item => !item.repairable);
  if (blocked.length) {
    alert(t('glyph.notRepairable') + '\n\n' + blocked.map(item => item.char).join(' '));
    return;
  }

  const recipes = missing.map(item => {
    const recipe = state.glyphRecipes[item.char] || item.suggested_recipe;
    const clean = { ...(recipe || {}) };
    delete clean._edited;
    return clean;
  });

  showOverlay('loading.glyphRepair');

  try {
    const repairDir = await invoke('create_build_dir');
    const response = await invoke('run_engine', {
      args: [
        'glyph-repair',
        '-o', repairDir,
        '--recipes-json', JSON.stringify(recipes),
        ...state.paths
      ]
    });

    state.repairedOutputs = [...(response.result.outputs || [])];
    state.repairedZip = response.result.zip || null;
    state.paths = [...state.repairedOutputs];
    state.glyphRecipes = {};
    state.glyphPreview = null;
    state.glyphSelected = null;
    await runAnalysis();
    state.step = 2;
    closeGlyphLab();
    render();

    setTimeout(() => {
      const bar = document.querySelector('.glyph-audit-bar.complete');
      if (bar) bar.classList.add('flash-success');
    }, 60);
  } catch (error) {
    alert(t('error.title') + '\n\n' + String(error));
  } finally {
    hideOverlay();
  }
}

$('pick-files').addEventListener('click', async () => {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: 'Fonts / ZIP', extensions: ['ttf','otf','woff','woff2','zip'] }]
  });

  if (!selected) return;
  addPaths(Array.isArray(selected) ? selected : [selected]);
});

$('pick-folder').addEventListener('click', async () => {
  const selected = await open({ directory: true, multiple: false });
  if (!selected) return;
  addPaths([selected]);
});

$('clear').addEventListener('click', resetAll);
$('analyze').addEventListener('click', analyze);
$('back-input').addEventListener('click', () => {
  state.step = 1;
  state.replaceOnNextAdd = true;
  render();
});
$('font-tools-action').addEventListener('click', openFontTools);
$('glyph-action').addEventListener('click', openGlyphLab);
$('build').addEventListener('click', build);
$('new-build').addEventListener('click', resetAll);

$('save-zip').addEventListener('click', async () => {
  const zip = collectOutputs().find(item => item.type === 'zip');
  if (zip) await saveOutput(zip.path, zip.type);
});

$('settings-open').addEventListener('click', openSettings);
$('settings-close').addEventListener('click', closeSettings);
$('settings-save').addEventListener('click', saveSettings);
document.querySelectorAll('[data-close-settings]').forEach(el => el.addEventListener('click', closeSettings));

$('font-tools-close').addEventListener('click', closeFontTools);
document.querySelectorAll('[data-close-font-tools]').forEach(el => el.addEventListener('click', closeFontTools));
$('tools-variant').addEventListener('change', event => selectToolVariant(event.target.value));
document.querySelectorAll('.tool-nav-btn').forEach(button => {
  button.addEventListener('click', () => switchToolTab(button.dataset.toolTab));
});
$('tools-preview-text').addEventListener('input', event => {
  $('tools-preview-canvas').textContent = event.target.value || ' ';
});
$('tools-preview-size').addEventListener('input', event => {
  $('tools-preview-canvas').style.fontSize = event.target.value + 'px';
  $('tools-preview-size-value').textContent = event.target.value + ' px';
});
$('tools-charmap-search').addEventListener('input', () => {
  state.fontToolsCharmapLimit = 800;
  renderCharmapTool();
});
$('tools-charmap-more').addEventListener('click', () => {
  state.fontToolsCharmapLimit += 800;
  renderCharmapTool();
});
$('tools-save-metadata').addEventListener('click', saveToolMetadata);
$('tools-convert-run').addEventListener('click', runToolConvert);

$('glyph-close').addEventListener('click', closeGlyphLab);
document.querySelectorAll('[data-close-glyphs]').forEach(el => el.addEventListener('click', closeGlyphLab));
$('glyph-auto-all').addEventListener('click', autoAllGlyphs);
$('glyph-reset').addEventListener('click', resetGlyphAuto);
$('glyph-save-recipe').addEventListener('click', saveGlyphRecipe);
$('glyph-repair').addEventListener('click', repairGlyphs);

['glyph-x','glyph-y','glyph-scale','glyph-rotation','glyph-thickness','glyph-width','glyph-height']
  .forEach(id => $(id).addEventListener('input', updateRecipeFromControls));

document.querySelectorAll('.lang-btn').forEach(button => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeSettings();
    closeFontTools();
    closeGlyphLab();
  }
});

const webview = getCurrentWebview();
webview.onDragDropEvent(event => {
  if (event.payload.type === 'drop') addPaths(event.payload.paths);

  document.body.classList.toggle(
    'dragging',
    event.payload.type === 'enter' || event.payload.type === 'over'
  );

  if (event.payload.type === 'leave' || event.payload.type === 'drop') {
    document.body.classList.remove('dragging');
  }
}).catch(console.error);

async function init() {
  await loadSettings();
  setLanguage(state.lang);
  render();
}

init().catch(error => {
  console.error('App initialization failed', error);
  setLanguage(state.lang);
  render();
});
