import './style.css';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';

const state = { paths: [], analysis: null };
const $ = (id) => document.getElementById(id);
const filesEl = $('files');
const out = $('output');

function renderFiles() {
  if (!state.paths.length) {
    filesEl.className = 'files empty';
    filesEl.textContent = 'Brak plików.';
  } else {
    filesEl.className = 'files';
    filesEl.innerHTML = state.paths.map(p => `<div><span>✓</span><code>${escapeHtml(p)}</code></div>`).join('');
  }
  $('analyze').disabled = !state.paths.length;
  $('build').disabled = !state.analysis;
}

function escapeHtml(s) {
  return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function addPaths(paths) {
  for (const p of paths || []) if (!state.paths.includes(p)) state.paths.push(p);
  state.analysis = null;
  renderFiles();
}

$('pick').addEventListener('click', async () => {
  const selected = await open({ multiple: true, directory: false, filters: [{ name: 'Fonts / ZIP', extensions: ['ttf','otf','woff','woff2','zip'] }] });
  if (!selected) return;
  addPaths(Array.isArray(selected) ? selected : [selected]);
});

$('clear').addEventListener('click', () => {
  state.paths = []; state.analysis = null; out.textContent = 'Czekam na pliki…'; renderFiles();
});

$('analyze').addEventListener('click', async () => {
  out.textContent = 'Analizuję…';
  try {
    state.analysis = await invoke('run_engine', { args: ['analyze', ...state.paths] });
    out.textContent = JSON.stringify(state.analysis, null, 2);
    $('build').disabled = false;
  } catch (e) { out.textContent = String(e); }
});

$('build').addEventListener('click', async () => {
  const dir = await open({ directory: true, multiple: false });
  if (!dir) return;
  out.textContent = 'Buduję…';
  try {
    const result = await invoke('run_engine', { args: ['build', ...state.paths, '-o', dir, '--mode', 'auto', '--formats', 'ttf,otf,woff,woff2,css,zip'] });
    out.textContent = JSON.stringify(result, null, 2);
  } catch (e) { out.textContent = String(e); }
});

const webview = getCurrentWebview();
await webview.onDragDropEvent((event) => {
  if (event.payload.type === 'drop') addPaths(event.payload.paths);
  document.body.classList.toggle('dragging', event.payload.type === 'enter' || event.payload.type === 'over');
  if (event.payload.type === 'leave' || event.payload.type === 'drop') document.body.classList.remove('dragging');
});

renderFiles();
