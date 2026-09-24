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

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  render();
  if (!$('glyph-modal').classList.contains('hidden')) renderGlyphLab();
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
  return state.glyphAudit?.families?.[0] || null;
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
  const family = analysisData();
  if (!family) return;

  const fonts = family.fonts || [];
  const weights = [...new Set(fonts.map(f => Number(f.weight)).filter(Number.isFinite))].sort((a,b) => a-b);
  const italics = fonts.filter(f => f.italic).length;
  const romans = fonts.length - italics;
  const mode = family.build_mode;
  const eligibility = variableEligibility(family);

  let note;
  if (fonts.length < 2) note = t('analysis.singleMasterNote');
  else if (mode === 'unsupported-source-outline') note = t('analysis.unsupportedNote');
  else if (mode === 'true-variable') note = t('analysis.smoothNote');
  else note = t('analysis.discreteNote');

  const repaired = state.repairedOutputs?.length === 1 ? state.repairedOutputs[0] : null;
  const repairedBox = repaired ? `
    <div class="static-export-bar">
      <div>
        <strong>✓ ${esc(t('analysis.repairedReady'))}</strong>
        <small>${esc(basename(repaired))}</small>
      </div>
      <button id="save-repaired-static">${esc(t('analysis.saveRepaired'))}</button>
    </div>
  ` : '';

  const blocker = eligibility.ok ? '' : `
    <div class="build-blocker">
      <strong>${esc(t('analysis.variableUnavailable'))}</strong>
      <span>${esc(eligibility.reason)}</span>
    </div>
  `;

  $('analysis-content').innerHTML = `
    <div class="stage-head">
      <div>
        <span class="status-pill success">✓ ${esc(t('analysis.reviewed'))}</span>
        <h2>${esc(family.family)}</h2>
      </div>
      <div class="subtle">${esc(t('analysis.ignored'))}: <strong>${state.analysis?.ignored?.length || 0}</strong></div>
    </div>

    <div class="metric-grid">
      <div class="metric"><span>${esc(t('analysis.variants'))}</span><strong>${fonts.length}</strong><small>${romans} roman · ${italics} italic</small></div>
      <div class="metric"><span>${esc(t('analysis.weights'))}</span><strong>${weights.length}</strong><small>${esc(weights.join(' · ') || '—')}</small></div>
      <div class="metric"><span>${esc(t('analysis.range'))}</span><strong>${weights[0] ?? '—'}–${weights.at(-1) ?? '—'}</strong><small>wght</small></div>
      <div class="metric"><span>${esc(t('analysis.mode'))}</span><strong class="metric-text">${esc(modeLabel(mode))}</strong><small>${esc(state.settings.build_mode.toUpperCase())}</small></div>
    </div>

    ${renderGlyphSummaryBar()}
    ${repairedBox}
    ${blocker}

    <div class="stage-note">${esc(note)}</div>
  `;

  $('open-glyph-lab')?.addEventListener('click', openGlyphLab);
  $('save-repaired-static')?.addEventListener('click', () => saveOutput(repaired, ext(repaired)));

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
  state.paths = [];
  state.analysis = null;
  state.build = null;
  state.buildDir = null;
  state.glyphAudit = null;
  state.glyphPreview = null;
  state.glyphSelected = null;
  state.glyphRecipes = {};
  state.repairedOutputs = [];
  render();
}

function addPaths(paths) {
  for (const p of paths || []) {
    if (!state.paths.includes(p)) state.paths.push(p);
  }
  state.analysis = null;
  state.build = null;
  state.buildDir = null;
  state.glyphAudit = null;
  state.glyphPreview = null;
  state.glyphSelected = null;
  state.glyphRecipes = {};
  state.repairedOutputs = [];
  state.step = 1;
  render();
}

async function runAnalysis() {
  state.analysis = await invoke('run_engine', { args: ['analyze', ...state.paths] });
  try {
    state.glyphAudit = await invoke('run_engine', { args: ['glyph-audit', ...state.paths] });
  } catch (error) {
    console.warn('Glyph audit unavailable', error);
    state.glyphAudit = null;
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
    message.textContent = t('result.saved') + ': ' + target;
    message.className = 'save-message success';
  } catch (error) {
    message.textContent = t('result.saveError') + ' ' + String(error);
    message.className = 'save-message error';
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

    state.paths = [response.result.output_dir];
    state.repairedOutputs = [...(response.result.outputs || [])];
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
$('back-input').addEventListener('click', () => { state.step = 1; render(); });
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
