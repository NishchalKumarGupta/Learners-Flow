const RUNNERS = {
  python: { language: 'python' },
  java:   { language: 'java' },
  cpp:    { language: 'cpp' }
};

let playlist = [];
let currentIdx = -1;
let currentVideoId = null;
let notes = [];
let currentLang = 'python';
let playlistSearch = '';
let ytPlayer = null;
let ytApiReady = false;

const TEMPLATES = {
  python: `# Python 3
name = input("Name: ")
print(f"Hello, {name}!")

for i in range(1, 6):
    print(i * "*")`,

  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Name: ");
        String name = sc.nextLine();
        System.out.println("Hello, " + name + "!");

        for (int i = 1; i <= 5; i++) {
            System.out.println("*".repeat(i));
        }
    }
}`,

  cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    cout << "Name: ";
    getline(cin, name);
    cout << "Hello, " << name << "!" << endl;

    for (int i = 1; i <= 5; i++) {
        cout << string(i, '*') << endl;
    }

    return 0;
}`
};

function save() {
  try { localStorage.setItem('lf_playlist', JSON.stringify(playlist)); } catch(e) {}
  try { localStorage.setItem('lf_notes', JSON.stringify(notes)); } catch(e) {}
}

function load() {
  try {
    const p = localStorage.getItem('lf_playlist');
    if (p) playlist = JSON.parse(p);
    playlist = playlist.map(v => ({ completed: false, ...v }));
  } catch(e) {}
  try {
    const n = localStorage.getItem('lf_notes');
    if (n) notes = JSON.parse(n);
  } catch(e) {}
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = type === 'err' ? '#ff5f6d' : 'rgba(255,255,255,.1)';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.style.transform = 'translateX(-50%) translateY(60px)';
  }, 2400);
}

function getVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getPlaylistId(url) {
  const m = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function updateStreak() {
  const today = notes.filter(n => {
    const d = new Date(n.id);
    return d.toDateString() === new Date().toDateString();
  });
  document.getElementById('streak-pill').textContent = `${today.length} notes today`;
}

function updateProgress() {
  const total = playlist.length;
  const done = playlist.filter(v => v.completed).length;
  const pill = document.getElementById('progress-pill');
  if (pill) pill.textContent = `${done} / ${total} complete`;

  const doneBtn = document.getElementById('done-btn');
  if (doneBtn) {
    const isDone = currentIdx >= 0 && !!playlist[currentIdx]?.completed;
    doneBtn.textContent = isDone ? 'Done' : 'Mark Done';
    doneBtn.classList.toggle('active', isDone);
    doneBtn.disabled = !playlist.length || currentIdx < 0;
  }
}

function setPlaylistSearch(value) {
  playlistSearch = String(value || '').trim().toLowerCase();
  renderList();
}

function matchesPlaylistSearch(video) {
  if (!playlistSearch) return true;
  return String(video.title || '').toLowerCase().includes(playlistSearch);
}

async function loadPlaylist() {
  const url = document.getElementById('pl-url').value.trim();
  if (!url) { toast('Paste a playlist URL first'); return; }
  const loaded = await loadPlaylistFromUrl(url);
  if (loaded) document.getElementById('pl-url').value = '';
}

async function loadPlaylistFromUrl(url) {
  const pid = getPlaylistId(url);
  const vid = getVideoId(url);

  if (pid) {
    document.getElementById('sidebar-list').innerHTML =
      '<div class="loading-row"><div class="spinner"></div><span>Loading full playlist...</span></div>';
    const queueList = document.getElementById('queue-list');
    const queueProgress = document.getElementById('queue-progress');
    if (queueList) queueList.innerHTML = '<div class="loading-row"><div class="spinner"></div><span>Loading full playlist...</span></div>';
    if (queueProgress) queueProgress.textContent = 'Reading playlist link...';

    try {
      const r = await fetch(
        `http://localhost:3000/api/playlist?playlistId=${encodeURIComponent(pid)}&full=true`
      );
      const d = await r.json();

      if (!r.ok || d.error) {
        toast('Could not load playlist: ' + (d.error || d.details || 'Unknown error'), 'err');
        renderList();
        renderQueue();
        return false;
      }

      const items = (d.videos || [])
        .filter(video => video.videoId)
        .map(video => ({
          id: video.videoId,
          title: video.title || 'Untitled video',
          thumb: video.thumbnail || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`,
          completed: false
        }));

      if (!items.length) {
        toast('No videos found', 'err');
        renderList();
        renderQueue();
        return false;
      }

      playlist = items;
      save();
      renderList();
      playVideo(0);
      toast(`Loaded ${items.length} playlist videos`);
      return true;
    } catch(e) {
      toast('Network error', 'err');
      renderList();
      renderQueue();
      return false;
    }
  } else if (vid) {
    addVideo(vid, '');
    return true;
  } else {
    toast('Invalid YouTube video or playlist URL', 'err');
    return false;
  }
}

function addVideo(vid, title) {
  playlist.push({
    id: vid,
    title: title || `Video ${playlist.length + 1}`,
    thumb: `https://img.youtube.com/vi/${vid}/mqdefault.jpg`,
    completed: false
  });
  save();
  renderList();
  playVideo(playlist.length - 1);
}

function deleteVideo(idx, e) {
  e.stopPropagation();
  playlist.splice(idx, 1);

  if (!playlist.length) {
    currentIdx = -1;
    currentVideoId = null;
    document.getElementById('video-box').innerHTML =
      `<div class="video-placeholder"><div class="vp-glyph">&#9654;</div><p>Load a playlist or add a video</p></div>`;
    document.getElementById('video-info').style.display = 'none';
    document.getElementById('now-playing').textContent = 'No video selected';
    renderQueue();
    updateProgress();
  } else {
    if (currentIdx >= playlist.length) currentIdx = playlist.length - 1;
    playVideo(currentIdx);
  }

  save();
  renderList();
  toast('Video removed');
}

function renderList() {
  const el = document.getElementById('sidebar-list');

  if (!playlist.length) {
    el.innerHTML = '<div class="empty-hint">Paste a playlist URL above<br>or click <strong>+ Add Video</strong></div>';
    updateProgress();
    return;
  }

  const visible = playlist
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => matchesPlaylistSearch(v));

  if (!visible.length) {
    el.innerHTML = '<div class="empty-hint">No videos match your search.</div>';
    updateProgress();
    return;
  }

  el.innerHTML = visible.map(({ v, i }) => `
    <div class="pl-item ${i === currentIdx ? 'active' : ''} ${v.completed ? 'completed' : ''}" onclick="playVideo(${i})">
      <span class="pl-num">${i + 1}</span>
      <div class="pl-thumb">
        <img src="${v.thumb}" alt="" loading="lazy" onerror="this.style.display='none'">
        ${i === currentIdx ? '<div class="pl-now">&#9654;</div>' : ''}
      </div>
      <div class="pl-info">
        <div class="pl-name">${esc(v.title)}</div>
        ${v.completed ? '<div class="pl-state"><span class="pl-check">OK</span> Completed</div>' : ''}
      </div>
      <button class="pl-del" onclick="deleteVideo(${i}, event)" title="Remove">x</button>
    </div>`).join('');

  renderQueue();
  updateProgress();
}

function playVideo(idx) {
  if (idx < 0 || idx >= playlist.length) return;

  currentIdx = idx;
  const v = playlist[idx];
  currentVideoId = v.id;
  document.getElementById('now-playing').textContent = v.title;
  document.getElementById('vi-title').textContent = v.title;
  document.getElementById('video-info').style.display = 'block';
  document.getElementById('video-box').innerHTML =
    `<iframe id="yt-player" src="https://www.youtube.com/embed/${v.id}?rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}"
       allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
       allowfullscreen></iframe>`;

  bindYoutubePlayer();
  renderList();
  renderNotes();
  renderQueue();
  updateProgress();
}

function onYouTubeIframeAPIReady() {
  ytApiReady = true;
  bindYoutubePlayer();
}

function bindYoutubePlayer() {
  if (!ytApiReady || !window.YT || !YT.Player || !document.getElementById('yt-player')) return;
  try {
    ytPlayer = new YT.Player('yt-player');
  } catch(e) {
    ytPlayer = null;
  }
}

function formatSeconds(totalSeconds) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getCurrentVideoTime() {
  try {
    if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      return formatSeconds(ytPlayer.getCurrentTime());
    }
  } catch(e) {}
  return '00:00';
}

function playNextVideo() {
  if (!playlist.length) return;
  if (currentIdx < playlist.length - 1) {
    playVideo(currentIdx + 1);
  } else {
    toast('You are at the last video');
  }
}

function playPreviousVideo() {
  if (!playlist.length) return;
  if (currentIdx > 0) {
    playVideo(currentIdx - 1);
  } else {
    toast('You are at the first video');
  }
}

function renderQueue() {
  const list = document.getElementById('queue-list');
  const progress = document.getElementById('queue-progress');
  if (!list || !progress) return;

  if (!playlist.length) {
    progress.textContent = 'Load a playlist to build your path';
    list.innerHTML = '<div class="empty-hint">Your current and upcoming videos will appear here.</div>';
    updateProgress();
    return;
  }

  const safeIdx = currentIdx >= 0 ? currentIdx : 0;
  const remaining = Math.max(playlist.length - safeIdx - 1, 0);
  const done = playlist.filter(v => v.completed).length;
  progress.textContent = `Video ${safeIdx + 1} of ${playlist.length} - ${remaining} up next - ${done} completed`;

  const start = Math.max(safeIdx - 1, 0);
  const visible = playlist.slice(start, start + 8);

  list.innerHTML = visible.map((v, offset) => {
    const idx = start + offset;
    const isCurrent = idx === safeIdx;
    const label = isCurrent ? 'Now playing' : idx > safeIdx ? 'Up next' : 'Previous';
    return `
      <button class="queue-item ${isCurrent ? 'active' : ''} ${v.completed ? 'completed' : ''}" onclick="playVideo(${idx})">
        <img src="${v.thumb}" alt="" loading="lazy" onerror="this.style.display='none'">
        <span class="queue-meta">
          <span class="queue-kicker">${label} - ${idx + 1}</span>
          <span class="queue-title">${esc(v.title)}</span>
          ${v.completed ? '<span class="queue-done">Completed</span>' : ''}
        </span>
      </button>`;
  }).join('');
  updateProgress();
}

function toggleCurrentComplete() {
  if (currentIdx < 0 || !playlist[currentIdx]) {
    toast('Select a video first');
    return;
  }
  playlist[currentIdx].completed = !playlist[currentIdx].completed;
  save();
  renderList();
  renderQueue();
  updateProgress();
  toast(playlist[currentIdx].completed ? 'Marked complete' : 'Marked incomplete');
}

function clearPlaylist() {
  if (!playlist.length) return;
  if (!confirm('Remove all videos?')) return;

  playlist = [];
  currentIdx = -1;
  currentVideoId = null;
  save();
  renderList();
  document.getElementById('video-box').innerHTML =
    `<div class="video-placeholder"><div class="vp-glyph">&#9654;</div><p>Load a playlist or add a video</p></div>`;
  document.getElementById('video-info').style.display = 'none';
  document.getElementById('now-playing').textContent = 'No video selected';
  renderQueue();
  updateProgress();
  toast('Playlist cleared');
}

function saveNote() {
  const ta = document.getElementById('note-ta');
  const text = ta.value.trim();
  if (!text) { toast('Write something first'); return; }

  notes.unshift({
    text,
    videoId: currentVideoId,
    videoTitle: playlist[currentIdx]?.title || 'General',
    time: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
    id: Date.now()
  });

  save();
  ta.value = '';
  renderNotes();
  updateStreak();
  toast('Note saved');
}

function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  save();
  renderNotes();
  updateStreak();
}

function renderNotes() {
  const el = document.getElementById('notes-feed');
  const rel = notes.filter(n => n.videoId === currentVideoId);
  document.getElementById('note-count').textContent = rel.length;

  if (!rel.length) {
    el.innerHTML = '<div class="empty-hint" style="padding:20px 12px">Notes you save will appear here.<br>Press <kbd>Enter</kbd> to save, <kbd>Shift+Enter</kbd> for a new line.</div>';
    return;
  }

  el.innerHTML = rel.map(n => `
    <div class="note-card">
      <div class="note-card-top">
        <span class="note-ts">${n.time}</span>
        <button class="note-del-btn" onclick="deleteNote(${n.id})">x</button>
      </div>
      <div class="note-body">${esc(n.text)}</div>
    </div>`).join('');
}

function renderAllNotes() {
  const el = document.getElementById('allnotes-inner');
  const empty = document.getElementById('allnotes-empty');

  if (!notes.length) {
    el.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  const groups = {};

  notes.forEach(n => {
    const k = n.videoId || 'unknown';
    if (!groups[k]) groups[k] = { title: n.videoTitle, items: [] };
    groups[k].items.push(n);
  });

  el.innerHTML = Object.values(groups).map(g => `
    <div class="an-section">
      <div class="an-section-title">${esc(g.title)}</div>
      ${g.items.map(n => `
        <div class="note-card" style="margin-bottom:6px">
          <div class="note-card-top">
            <span class="note-ts">${n.time}</span>
            <button class="note-del-btn" onclick="deleteNote(${n.id});renderAllNotes()">x</button>
          </div>
          <div class="note-body">${esc(n.text)}</div>
        </div>`).join('')}
    </div>`).join('');
}

function switchTab(t) {
  document.querySelectorAll('.tab').forEach((el, i) =>
    el.classList.toggle('active', ['video', 'ide', 'allnotes'][i] === t));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + t).classList.add('active');
  if (t === 'allnotes') renderAllNotes();
}

function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-tab').forEach(el =>
    el.classList.toggle('active', el.dataset.lang === lang));
  document.getElementById('code-ta').value = TEMPLATES[lang];
  syncLineNums();
  clearOutput();
}

function syncLineNums() {
  const lines = document.getElementById('code-ta').value.split('\n').length;
  document.getElementById('line-nums').textContent =
    Array.from({length: lines}, (_, i) => i + 1).join('\n');
}

function handleEditorKey(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const ta = e.target;
    const pos = ta.selectionStart;
    ta.value = ta.value.slice(0, pos) + '    ' + ta.value.slice(ta.selectionEnd);
    ta.setSelectionRange(pos + 4, pos + 4);
    syncLineNums();
    return;
  }

  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    runCode();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    runCode();
  }
}

function clearOutput() {
  const ob = document.getElementById('output-body');
  ob.className = 'output-body muted';
  ob.textContent = 'Run your code to see output here...';

  const tag = document.getElementById('output-tag');
  tag.textContent = '';
  tag.className = 'output-tag';

  document.getElementById('ide-status').textContent = 'Ready';
}

async function runCode() {
  const code = document.getElementById('code-ta').value.trim();
  const stdin = document.getElementById('stdin-ta').value;
  const btn = document.getElementById('run-btn');
  const ob = document.getElementById('output-body');
  const tag = document.getElementById('output-tag');
  const status = document.getElementById('ide-status');

  if (!code) { toast('Write some code first'); return; }

  const cfg = RUNNERS[currentLang];

  btn.disabled = true;
  btn.textContent = 'Running...';
  status.textContent = 'Executing...';
  ob.className = 'output-body muted';
  ob.textContent = 'Compiling and running...';
  tag.textContent = '';
  tag.className = 'output-tag';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch('http://localhost:3000/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        language: cfg.language,
        code,
        stdin
      })
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Backend returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const compile = data.compile || {};
    const run = data.run || {};
    const compileErr = (compile.stderr || '').trim();
    const compileOut = (compile.stdout || '').trim();
    const runStdout = (run.stdout || '').trim();
    const runStderr = (run.stderr || '').trim();

    if (compileErr || compile.code) {
      ob.className = 'output-body err';
      ob.textContent = compileErr || compileOut || 'Compilation failed.';
      tag.textContent = 'COMPILE ERROR';
      tag.className = 'output-tag err';
      status.textContent = 'Compile Error';
    } else if (runStderr || run.code) {
      ob.className = 'output-body err';
      ob.textContent = runStderr || 'Program exited with an error.';
      tag.textContent = run.timedOut ? 'TIMED OUT' : 'RUNTIME ERROR';
      tag.className = 'output-tag err';
      status.textContent = run.timedOut ? 'Timed Out' : 'Runtime Error';
    } else {
      ob.className = 'output-body';
      ob.textContent = runStdout || '(no output)';
      tag.textContent = 'OK';
      tag.className = 'output-tag ok';
      status.textContent = 'Done';
    }
  } catch (e) {
    ob.className = 'output-body err';
    ob.textContent =
`Could not reach the code execution backend.

Fix:
  1) Make sure the backend is running on http://localhost:3000
  2) Refresh this page with Ctrl+F5
  3) Check that Python, Java, and g++ are installed for their languages.`;
    tag.textContent = 'FAILED';
    tag.className = 'output-tag err';
    status.textContent = 'Failed';
  }

  btn.disabled = false;
  btn.textContent = 'Run';
}

function showModal() {
  document.getElementById('modal').style.display = 'flex';
  setTimeout(() => document.getElementById('modal-url').focus(), 50);
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-url').value = '';
  document.getElementById('modal-title').value = '';
}

async function submitModal() {
  const url = document.getElementById('modal-url').value.trim();
  const title = document.getElementById('modal-title').value.trim();
  const pid = getPlaylistId(url);
  const vid = getVideoId(url);

  if (!url) { toast('Paste a YouTube URL first'); return; }

  if (pid) {
    const loaded = await loadPlaylistFromUrl(url);
    if (loaded) closeModal();
    return;
  }

  if (vid) {
    addVideo(vid, title);
    closeModal();
    toast('Video added');
    return;
  }

  toast('Invalid YouTube video or playlist URL', 'err');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('note-ta').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveNote();
    }
  });

  document.getElementById('pl-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loadPlaylist();
    }
  });

  document.getElementById('modal-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitModal();
  });

  document.getElementById('modal-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitModal();
  });

  document.getElementById('code-ta').value = TEMPLATES.python;
  document.getElementById('stdin-ta').value = "Learner's Flow";
  syncLineNums();
});

load();
updateStreak();
updateProgress();
if (playlist.length) {
  renderList();
  playVideo(0);
} else {
  renderQueue();
}
