require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const YT_API_KEY = process.env.YT_KEY;

app.use(cors());
app.use(bodyParser.json());

if (!YT_API_KEY) {
  console.warn('⚠️  WARNING: YouTube API key not found. Set YT_KEY in .env file');
}

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Backend is running',
    timestamp: new Date().toISOString(),
    ytApiConfigured: !!YT_API_KEY
  });
});

function videoTitleFromSnippet(snippet) {
  if (!snippet) return 'Untitled video';
  if (typeof snippet.title === 'string') return snippet.title;
  return 'Untitled video';
}

function thumbnailFromSnippet(snippet, videoId) {
  const thumbs = snippet?.thumbnails || {};
  return thumbs.medium?.url ||
    thumbs.default?.url ||
    thumbs.high?.url ||
    `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

async function fetchPlaylistWithApi(playlistId, maxPages = 20) {
  if (!YT_API_KEY) {
    const err = new Error('YouTube API key not configured');
    err.statusCode = 500;
    throw err;
  }

  const videos = [];
  let pageToken = '';
  let page = 0;

  do {
    const params = {
      key: YT_API_KEY,
      playlistId,
      part: 'snippet',
      maxResults: 50
    };

    if (pageToken) params.pageToken = pageToken;

    const response = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', { params });
    const pageVideos = (response.data.items || [])
      .map(item => {
        const snippet = item.snippet || {};
        const videoId = snippet.resourceId?.videoId;
        if (!videoId || snippet.title === 'Deleted video' || snippet.title === 'Private video') return null;
        return {
          videoId,
          title: videoTitleFromSnippet(snippet),
          description: snippet.description || '',
          thumbnail: thumbnailFromSnippet(snippet, videoId)
        };
      })
      .filter(Boolean);

    videos.push(...pageVideos);
    pageToken = response.data.nextPageToken || '';
    page++;
  } while (pageToken && page < maxPages);

  return { videos, source: 'youtube-api' };
}

function extractJsonAfter(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;

  const start = html.indexOf('{', markerIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') inString = true;
    if (ch === '{') depth++;
    if (ch === '}') depth--;

    if (depth === 0) {
      return html.slice(start, i + 1);
    }
  }

  return null;
}

function textFromRuns(node) {
  if (!node) return '';
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map(run => run.text || '').join('');
  return '';
}

function collectPlaylistRenderers(node, out = []) {
  if (!node || typeof node !== 'object') return out;

  if (node.playlistVideoRenderer) {
    out.push(node.playlistVideoRenderer);
  }

  if (Array.isArray(node)) {
    node.forEach(child => collectPlaylistRenderers(child, out));
  } else {
    Object.values(node).forEach(child => collectPlaylistRenderers(child, out));
  }

  return out;
}

function collectContinuationTokens(node, out = []) {
  if (!node || typeof node !== 'object') return out;

  const token = node.continuationItemRenderer
    ?.continuationEndpoint
    ?.continuationCommand
    ?.token;

  if (token) out.push(token);

  if (Array.isArray(node)) {
    node.forEach(child => collectContinuationTokens(child, out));
  } else {
    Object.values(node).forEach(child => collectContinuationTokens(child, out));
  }

  return out;
}

function addPlaylistVideosFromData(data, videos, seen) {
  collectPlaylistRenderers(data)
    .forEach(renderer => {
      const videoId = renderer.videoId;
      const title = textFromRuns(renderer.title);
      if (!videoId || !title || seen.has(videoId)) return;
      seen.add(videoId);

      const thumbs = renderer.thumbnail?.thumbnails || [];
      const bestThumb = thumbs[thumbs.length - 1]?.url ||
        `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

      videos.push({
        videoId,
        title,
        description: '',
        thumbnail: bestThumb
      });
    });
}

async function fetchPlaylistFromPublicPage(playlistId) {
  const response = await axios.get('https://www.youtube.com/playlist', {
    params: { list: playlistId },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  const jsonText = extractJsonAfter(response.data, 'ytInitialData');
  if (!jsonText) {
    throw new Error('Could not read public playlist data');
  }

  const initialData = JSON.parse(jsonText);
  const apiKey = response.data.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const clientVersion = response.data.match(/"clientVersion":"([^"]+)"/)?.[1];
  const seen = new Set();
  const usedContinuations = new Set();
  const videos = [];

  addPlaylistVideosFromData(initialData, videos, seen);

  let continuation = collectContinuationTokens(initialData)[0];
  let continuationPages = 0;

  while (apiKey && clientVersion && continuation && continuationPages < 50) {
    if (usedContinuations.has(continuation)) break;
    usedContinuations.add(continuation);

    const continuationResponse = await axios.post(
      `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`,
      {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion
          }
        },
        continuation
      },
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Content-Type': 'application/json'
        }
      }
    );

    addPlaylistVideosFromData(continuationResponse.data, videos, seen);
    continuation = collectContinuationTokens(continuationResponse.data)
      .find(token => !usedContinuations.has(token));
    continuationPages++;
  }

  return { videos, source: 'public-page' };
}

app.get('/api/playlist', async (req, res) => {
  try {
    const { playlistId, pageToken, full } = req.query;

    if (!playlistId) {
      return res.status(400).json({ error: 'Playlist ID is required' });
    }

    if (full === 'true') {
      try {
        const result = await fetchPlaylistWithApi(playlistId);
        return res.json({
          videos: result.videos,
          total: result.videos.length,
          source: result.source,
          nextPageToken: null
        });
      } catch (apiError) {
        console.warn('YouTube API playlist fetch failed, using public page fallback:', apiError.message);
        const result = await fetchPlaylistFromPublicPage(playlistId);
        return res.json({
          videos: result.videos,
          total: result.videos.length,
          source: result.source,
          nextPageToken: null
        });
      }
    }

    if (!YT_API_KEY) {
      const result = await fetchPlaylistFromPublicPage(playlistId);
      return res.json({
        videos: result.videos,
        total: result.videos.length,
        source: result.source,
        nextPageToken: null
      });
    }

    const params = {
      key: YT_API_KEY,
      playlistId,
      part: 'snippet',
      maxResults: 50
    };

    if (pageToken) params.pageToken = pageToken;

    const response = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', { params });

    const videos = (response.data.items || [])
      .map(item => {
        const snippet = item.snippet || {};
        const videoId = snippet.resourceId?.videoId;
        if (!videoId || snippet.title === 'Deleted video' || snippet.title === 'Private video') return null;
        return {
          videoId,
          title: videoTitleFromSnippet(snippet),
          description: snippet.description || '',
          thumbnail: thumbnailFromSnippet(snippet, videoId)
        };
      })
      .filter(Boolean);

    res.json({ 
      videos,
      total: videos.length,
      source: 'youtube-api',
      nextPageToken: response.data.nextPageToken || null
    });
  } catch (error) {
    console.error('Error fetching playlist:', error.message);
    res.status(500).json({ error: 'Failed to fetch playlist', details: error.message });
  }
});

app.post('/api/video', async (req, res) => {
  try {
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    if (!YT_API_KEY) {
      return res.status(500).json({ error: 'YouTube API key not configured' });
    }

    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: YT_API_KEY,
        id: videoId,
        part: 'snippet,statistics'
      }
    });

    const video = response.data.items[0];
    res.json({
      videoId,
      title: video.snippet.title,
      description: video.snippet.description,
      thumbnail: video.snippet.thumbnails.high.url,
      viewCount: video.statistics.viewCount,
      likeCount: video.statistics.likeCount
    });
  } catch (error) {
    console.error('Error fetching video:', error.message);
    res.status(500).json({ error: 'Failed to fetch video', details: error.message });
  }
});

function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeout || 10000);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > 20000) stdout = stdout.slice(0, 20000);
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
      if (stderr.length > 20000) stderr = stderr.slice(0, 20000);
    });

    if (typeof options.stdin === 'string' && options.stdin.length) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();

    child.on('error', err => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, code: 1, timedOut });
    });

    child.on('close', code => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: timedOut ? `${stderr}\nExecution timed out.`.trim() : stderr,
        code,
        timedOut
      });
    });
  });
}

function normalizeLanguage(language) {
  const value = String(language || '').toLowerCase().trim();
  if (value === 'python' || value === 'py') return 'python';
  if (value === 'java') return 'java';
  if (value === 'cpp' || value === 'c++') return 'cpp';
  return null;
}

app.post('/api/execute', async (req, res) => {
  const language = normalizeLanguage(req.body.language);
  const code = typeof req.body.code === 'string' ? req.body.code : '';
  const stdin = typeof req.body.stdin === 'string' ? req.body.stdin : '';

  if (!language) {
    return res.status(400).json({ error: 'Unsupported language' });
  }
  if (!code.trim()) {
    return res.status(400).json({ error: 'Code is required' });
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-flow-'));

  try {
    if (language === 'python') {
      fs.writeFileSync(path.join(workDir, 'main.py'), code);
      const run = await runProcess('python', ['main.py'], { cwd: workDir, timeout: 10000, stdin });
      return res.json({ compile: { stdout: '', stderr: '' }, run });
    }

    if (language === 'java') {
      fs.writeFileSync(path.join(workDir, 'Main.java'), code);
      const compile = await runProcess('javac', ['Main.java'], { cwd: workDir, timeout: 10000 });
      if (compile.code !== 0) {
        return res.json({ compile, run: { stdout: '', stderr: '', code: null } });
      }
      const run = await runProcess('java', ['Main'], { cwd: workDir, timeout: 10000, stdin });
      return res.json({ compile, run });
    }

    fs.writeFileSync(path.join(workDir, 'main.cpp'), code);
    const exeName = process.platform === 'win32' ? 'main.exe' : 'main';
    const compile = await runProcess('g++', ['main.cpp', '-std=c++11', '-O2', '-o', exeName], {
      cwd: workDir,
      timeout: 10000
    });
    if (compile.code !== 0) {
      return res.json({ compile, run: { stdout: '', stderr: '', code: null } });
    }
    const runCommand = process.platform === 'win32' ? path.join(workDir, exeName) : `./${exeName}`;
    const run = await runProcess(runCommand, [], { cwd: workDir, timeout: 10000, stdin });
    return res.json({ compile, run });
  } catch (error) {
    res.status(500).json({ error: 'Code execution failed', details: error.message });
  } finally {
    fs.rm(workDir, { recursive: true, force: true }, () => {});
  }
});

const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Learner's Flow Backend running at http://localhost:${PORT}`);
  console.log(`📺 YouTube API configured: ${YT_API_KEY ? 'Yes' : 'No'}`);
});
