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

function renderAnalysis() {
  const family = analysisData();
  if (!family) return;

  const fonts = family.fonts || [];
  const weights = [...new Set(fonts.map(f => Number(f.weight)).filter(Number.isFinite))].sort((a,b) => a-b);
  const italics = fonts.filter(f => f.italic).length;
  const romans = fonts.length - italics;
  const mode = family.build_mode;
  const note = mode === 'true-variable' ? t('analysis.smoothNote') : t('analysis.discreteNote');

  $('analysis-content').innerHTML = `
    <div class="stage-head">
      <div>
        <span class="status-pill success">✓ ${esc(t('analysis.title'))}</span>
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

    <div class="stage-note">${esc(note)}</div>
  `;
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
  render();
}

function addPaths(paths) {
  for (const p of paths || []) {
    if (!state.paths.includes(p)) state.paths.push(p);
  }
  state.analysis = null;
  state.build = null;
  state.buildDir = null;
  state.step = 1;
  render();
}

async function analyze() {
  showOverlay('loading.analyze');

  try {
    state.analysis = await invoke('run_engine', { args: ['analyze', ...state.paths] });
    state.step = 2;
    render();
  } catch (error) {
    alert(t('error.title') + '\n\n' + String(error));
  } finally {
    hideOverlay();
  }
}

async function build() {
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

document.querySelectorAll('.lang-btn').forEach(button => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeSettings();
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

await loadSettings();
setLanguage(state.lang);
render();
