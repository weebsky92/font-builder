import './style.css';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { translations } from './i18n.js';

const savedLang = localStorage.getItem('fontbuilder.lang');
const detectedLang = navigator.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en';

const state = {
  paths: [],
  analysis: null,
  build: null,
  phase: 'idle',
  error: null,
  lang: savedLang || detectedLang
};

const $ = (id) => document.getElementById(id);
const filesEl = $('files');
const statusEl = $('status');

function t(key) {
  return translations[state.lang]?.[key] ?? translations.en[key] ?? key;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function setLanguage(lang) {
  if (!translations[lang]) return;
  state.lang = lang;
  localStorage.setItem('fontbuilder.lang', lang);
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  renderFiles();
  renderStatus();
}

function renderFiles() {
  if (!state.paths.length) {
    filesEl.className = 'files empty';
    filesEl.textContent = t('input.empty');
  } else {
    filesEl.className = 'files';
    filesEl.innerHTML = state.paths
      .map(p => `<div><span>✓</span><code>${escapeHtml(p)}</code></div>`)
      .join('');
  }

  $('analyze').disabled = !state.paths.length || state.phase === 'analyzing' || state.phase === 'building';
  $('build').disabled = !state.analysis || state.phase === 'analyzing' || state.phase === 'building';
}

function addPaths(paths) {
  for (const p of paths || []) {
    if (!state.paths.includes(p)) state.paths.push(p);
  }
  state.analysis = null;
  state.build = null;
  state.error = null;
  state.phase = state.paths.length ? 'idle' : 'idle';
  renderFiles();
  renderStatus();
}

function modeLabel(mode) {
  if (mode === 'true-variable') return t('analysis.smooth');
  if (mode === 'discrete-variable') return t('analysis.discrete');
  return t('analysis.unsupported');
}

function formatCount(value, suffix) {
  return `${value} ${suffix}`;
}

function analysisCard(family) {
  const fonts = family.fonts || [];
  const weights = [...new Set(fonts.map(font => Number(font.weight)).filter(Number.isFinite))].sort((a, b) => a - b);
  const italics = fonts.filter(font => font.italic).length;
  const romans = fonts.length - italics;
  const minWeight = weights.length ? weights[0] : '—';
  const maxWeight = weights.length ? weights[weights.length - 1] : '—';
  const note = family.build_mode === 'true-variable' ? t('analysis.smoothNote') : t('analysis.discreteNote');

  return `
    <article class="family-card">
      <div class="family-head">
        <div>
          <span class="success-dot"></span>
          <span class="status-label">${escapeHtml(t('analysis.ready'))}</span>
        </div>
        <strong>${escapeHtml(family.family)}</strong>
      </div>

      <div class="metrics">
        <div class="metric">
          <span>${escapeHtml(t('analysis.variants'))}</span>
          <strong>${fonts.length}</strong>
          <small>${escapeHtml(formatCount(romans, t('analysis.romanSuffix')))} · ${escapeHtml(formatCount(italics, t('analysis.italicSuffix')))}</small>
        </div>
        <div class="metric">
          <span>${escapeHtml(t('analysis.weights'))}</span>
          <strong>${weights.length}</strong>
          <small>${escapeHtml(weights.join(' · ') || '—')}</small>
        </div>
        <div class="metric">
          <span>${escapeHtml(t('analysis.weightRange'))}</span>
          <strong>${escapeHtml(minWeight)}–${escapeHtml(maxWeight)}</strong>
          <small>wght</small>
        </div>
        <div class="metric">
          <span>${escapeHtml(t('analysis.mode'))}</span>
          <strong class="metric-text">${escapeHtml(modeLabel(family.build_mode))}</strong>
          <small>${family.compatible ? '✓' : 'AUTO'}</small>
        </div>
      </div>

      <div class="info-note">${escapeHtml(note)}</div>
    </article>
  `;
}

function renderAnalysis() {
  const families = state.analysis?.families || [];
  const ignored = state.analysis?.ignored?.length || 0;

  statusEl.innerHTML = `
    <div class="status-summary">
      <div>
        <span class="success-dot"></span>
        <strong>${families.length} ${escapeHtml(t('analysis.familiesFound').toLowerCase())}</strong>
      </div>
      <span>${escapeHtml(t('analysis.ignored'))}: <strong>${ignored}</strong></span>
    </div>
    <div class="family-list">
      ${families.map(analysisCard).join('')}
    </div>
  `;
}

function buildFormats(result) {
  const formats = new Set();
  for (const path of result.produced || []) {
    const match = String(path).match(/\.([a-z0-9]+)$/i);
    if (match) formats.add(match[1].toUpperCase());
  }
  if (result.zip) formats.add('ZIP');
  return [...formats].filter(x => x !== 'JSON').join(' · ');
}

function renderBuild() {
  const results = state.build?.results || [];

  statusEl.innerHTML = `
    <div class="build-success">
      <div class="success-icon">✓</div>
      <div>
        <strong>${escapeHtml(t('build.success'))}</strong>
        <p>${escapeHtml(t('build.successText'))}</p>
      </div>
    </div>

    <div class="family-list">
      ${results.map(result => `
        <article class="family-card build-card">
          <div class="family-head">
            <div><span class="success-dot"></span><span class="status-label">${escapeHtml(t('build.done'))}</span></div>
            <strong>${escapeHtml(result.family)}</strong>
          </div>

          <div class="build-grid">
            <div>
              <span>${escapeHtml(t('build.mode'))}</span>
              <strong>${escapeHtml(modeLabel(result.mode))}</strong>
            </div>
            <div>
              <span>${escapeHtml(t('build.formats'))}</span>
              <strong>${escapeHtml(buildFormats(result) || 'TTF · OTF · WOFF · WOFF2 · CSS · ZIP')}</strong>
            </div>
          </div>

          ${result.zip ? `
            <div class="output-path">
              <span>${escapeHtml(t('build.output'))}</span>
              <code>${escapeHtml(result.zip)}</code>
            </div>
          ` : ''}
        </article>
      `).join('')}
    </div>
  `;
}

function renderLoading(messageKey) {
  statusEl.innerHTML = `
    <div class="loading-state">
      <span class="spinner"></span>
      <strong>${escapeHtml(t(messageKey))}</strong>
    </div>
  `;
}

function renderError() {
  statusEl.innerHTML = `
    <div class="error-state">
      <strong>${escapeHtml(t('error.title'))}</strong>
      <p>${escapeHtml(t('error.text'))}</p>
      <code>${escapeHtml(state.error)}</code>
    </div>
  `;
}

function renderStatus() {
  if (state.phase === 'analyzing') return renderLoading('status.analyzing');
  if (state.phase === 'building') return renderLoading('status.building');
  if (state.phase === 'error') return renderError();
  if (state.phase === 'built' && state.build) return renderBuild();
  if (state.phase === 'analyzed' && state.analysis) return renderAnalysis();

  statusEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-orb">Aa</div>
      <span>${escapeHtml(t('status.idle'))}</span>
    </div>
  `;
}

$('pick').addEventListener('click', async () => {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: 'Fonts / ZIP', extensions: ['ttf', 'otf', 'woff', 'woff2', 'zip'] }]
  });

  if (!selected) return;
  addPaths(Array.isArray(selected) ? selected : [selected]);
});

$('clear').addEventListener('click', () => {
  state.paths = [];
  state.analysis = null;
  state.build = null;
  state.error = null;
  state.phase = 'idle';
  renderFiles();
  renderStatus();
});

$('analyze').addEventListener('click', async () => {
  state.phase = 'analyzing';
  state.error = null;
  renderFiles();
  renderStatus();

  try {
    state.analysis = await invoke('run_engine', { args: ['analyze', ...state.paths] });
    state.build = null;
    state.phase = 'analyzed';
  } catch (e) {
    state.error = String(e);
    state.phase = 'error';
  }

  renderFiles();
  renderStatus();
});

$('build').addEventListener('click', async () => {
  const dir = await open({ directory: true, multiple: false });
  if (!dir) return;

  state.phase = 'building';
  state.error = null;
  renderFiles();
  renderStatus();

  try {
    state.build = await invoke('run_engine', {
      args: [
        'build',
        ...state.paths,
        '-o', dir,
        '--mode', 'auto',
        '--formats', 'ttf,otf,woff,woff2,css,zip'
      ]
    });
    state.phase = 'built';
  } catch (e) {
    state.error = String(e);
    state.phase = 'error';
  }

  renderFiles();
  renderStatus();
});

document.querySelectorAll('.lang-btn').forEach((button) => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});

const webview = getCurrentWebview();
webview.onDragDropEvent((event) => {
  if (event.payload.type === 'drop') addPaths(event.payload.paths);

  document.body.classList.toggle(
    'dragging',
    event.payload.type === 'enter' || event.payload.type === 'over'
  );

  if (event.payload.type === 'leave' || event.payload.type === 'drop') {
    document.body.classList.remove('dragging');
  }
}).catch((error) => {
  console.error('Drag and drop initialization failed:', error);
});

setLanguage(state.lang);
