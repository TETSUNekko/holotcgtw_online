import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync } from 'fs';
import { fetchDecklogData } from './decklog-scraper.cjs';
import path from 'path';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3001;

/* ===================== 1) 全域 CORS ===================== */
const ALLOW_ORIGINS = new Set([
  'https://tetsunekko.github.io',
  'http://localhost:5173',
]);

console.log('[DEBUG] DATABASE_URL set:', Boolean(process.env.DATABASE_URL));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, ALLOW_ORIGINS.has(origin));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.options('*', cors());

/* ===================== 2) 基本中介層 ===================== */
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url} Origin=${req.headers.origin || '-'}`);
  next();
});

/* ===================== 3) 路徑設定 ===================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 字體註冊（@napi-rs/canvas 使用 GlobalFonts，內建 Skia 不依賴系統字體）
const fontPath = path.join(__dirname, 'fonts', 'NotoSans-Bold.ttf');
console.log('[Font] registering:', fontPath, 'exists:', existsSync(fontPath));
try {
  GlobalFonts.registerFromPath(fontPath, 'NotoSans');
  console.log('[Font] registered OK');
} catch (e) {
  console.warn('[Font] registerFont failed:', e.message);
}

// 卡圖 CDN（Cloudflare R2）
const CARDS_CDN = process.env.CARDS_CDN || 'https://pub-9e063c0641df4849b7460815c8ee4a6d.r2.dev/cards';
console.log('[Export] Using CARDS_CDN:', CARDS_CDN);

/* ===================== 4) PostgreSQL 連線 ===================== */
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deck_codes (
      code      VARCHAR(10) PRIMARY KEY,
      payload   JSONB       NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('[DB] Table ready');
}

/* ===================== 5) 工具函式 ===================== */
function genShareCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function simplifyCards(cards = []) {
  const map = new Map();
  for (const c of cards) {
    if (!c?.key) continue;
    const add = Number.isFinite(c.count) ? Math.max(1, c.count | 0) : 1;
    if (!map.has(c.key)) map.set(c.key, { key: c.key, count: 0 });
    map.get(c.key).count += add;
  }
  return Array.from(map.values());
}

function parseKey(key) {
  if (!key) return null;
  const [idver, folder] = key.split('@');
  if (!idver || !folder) return null;
  const m = idver.match(/^(h[A-Za-z]+\d*-\d{3})(_[A-Za-z0-9_]+)?$/);
  if (!m) return null;
  return { id: m[1], version: m[2] || '_C', folder };
}

async function cleanExpiredCodes() {
  const result = await pool.query(
    `DELETE FROM deck_codes WHERE created_at < NOW() - INTERVAL '90 days'`
  );
  if (result.rowCount > 0) {
    console.log(`[DB] Cleaned ${result.rowCount} expired codes`);
  }
}

/* ===================== 6) 健康檢查 ===================== */
app.get('/', (req, res) => res.type('text').send('OK'));
app.get('/healthz', (req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get('/debug/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

/* canvas 文字渲染測試 — 回傳一張小圖，確認字體是否正常 */
app.get('/debug/canvas-text', async (_req, res) => {
  try {
    const c = createCanvas(200, 60);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, 200, 60);
    ctx.font = 'bold 24px NotoSans';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('x3 test OK', 100, 40);
    res.setHeader('Content-Type', 'image/png');
    const buf = await c.encode('png');
    res.end(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===================== 7) 六碼分享 ===================== */
app.post('/save', async (req, res) => {
  try {
    const { oshi = [], deck = [], energy = [] } = req.body || {};
    const payload = {
      oshi: simplifyCards(oshi),
      deck: simplifyCards(deck),
      energy: simplifyCards(energy),
    };

    let code = genShareCode(6);
    let guard = 0;
    while (guard++ < 50) {
      const { rows } = await pool.query('SELECT 1 FROM deck_codes WHERE code = $1', [code]);
      if (rows.length === 0) break;
      code = genShareCode(6);
    }

    await pool.query(
      'INSERT INTO deck_codes (code, payload) VALUES ($1, $2)',
      [code, JSON.stringify(payload)]
    );

    cleanExpiredCodes().catch(console.error);

    console.log('[SAVE] new share code:', code);
    res.json({ code });
  } catch (e) {
    console.error('POST /save error:', e);
    res.status(500).json({ error: 'Save failed' });
  }
});

app.post('/save/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { oshi = [], deck = [], energy = [] } = req.body || {};
    const payload = {
      oshi: simplifyCards(oshi),
      deck: simplifyCards(deck),
      energy: simplifyCards(energy),
    };
    await pool.query(
      `INSERT INTO deck_codes (code, payload)
       VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET payload = $2, created_at = NOW()`,
      [code, JSON.stringify(payload)]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('POST /save/:code error:', e);
    res.status(500).json({ error: 'Save failed' });
  }
});

app.get('/load/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { rows } = await pool.query(
      'SELECT payload, created_at FROM deck_codes WHERE code = $1',
      [code]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Code not found' });

    const age = Date.now() - new Date(rows[0].created_at).getTime();
    if (age > 90 * 24 * 60 * 60 * 1000) {
      return res.status(404).json({ error: 'Code expired' });
    }

    return res.json(rows[0].payload);
  } catch (e) {
    console.error('GET /load/:code error:', e);
    res.status(500).json({ error: 'Load failed' });
  }
});

/* ===================== 8) 五碼 decklog 匯入 ===================== */
app.get('/import-decklog/:code', async (req, res, next) => {
  try {
    const code = (req.params.code || '').trim().toUpperCase();
    console.log('[/import-decklog] hit:', code);

    if (req.query.dry === '1') {
      return res.json({ oshi: [], deck: [], energy: [], _dry: true, code });
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Decklog fetch timeout')), 30000)
    );
    const data = await Promise.race([fetchDecklogData(code), timeoutPromise]);

    console.log('[/import-decklog] ok', {
      oshi: data.oshi?.length || 0,
      deck: data.deck?.length || 0,
      energy: data.energy?.length || 0,
    });
    return res.json(data);
  } catch (err) {
    console.error('[/import-decklog] fail:', err?.message || err);
    return next(err);
  }
});

/* ===================== 9) 牌組圖輸出（使用 R2 CDN）===================== */
// 牌組圖渲染：POST /export-deck 與分享頁的 OG 預覽圖共用同一份邏輯
async function renderDeckImage({ oshi = [], deck = [], energy = [] }) {
  {
    // 主推卡只能1張才符合官方牌組規則，但匯出圖片是給玩家自由分享用，不在這裡擋，只擋誇張數量避免圖片爆炸
    const MAX_OSHI = 30, MAX_DECK = 50, MAX_ENERGY = 20;
    if (oshi.length > MAX_OSHI || deck.length > MAX_DECK || energy.length > MAX_ENERGY) {
      throw Object.assign(new Error('Card count exceeds limit'), { status: 400 });
    }

    const SCALE = 2; // 2x 解析度，避免模糊
    const canvasW = 1400 * SCALE;
    const cardW = 140 * SCALE, cardH = 196 * SCALE, gap = 12 * SCALE;
    const mainCols = 7;
    const mainRows = Math.ceil((deck.length || 0) / mainCols);
    const energyRows = Math.ceil((energy.length || 0) / 2);

    const oshiCount = oshi.length || 0;
    const oshiTop = 60 * SCALE;
    const oshiBottom = oshiTop + (oshiCount > 0 ? oshiCount * cardH + (oshiCount - 1) * gap : 0);
    const energyBaseY = oshiBottom + 80 * SCALE;

    const canvasH = Math.max(
      energyBaseY + energyRows * (cardH * 0.75 + gap) + 100 * SCALE,
      200 * SCALE + mainRows * (cardH + gap)
    );

    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d');

    // 背景圖從 CDN 讀取
    try {
      const bgUrl = `${CARDS_CDN}/backgrounds/wood.jpg`;
      const bgImg = await loadImage(bgUrl);
      ctx.drawImage(bgImg, 0, 0, canvasW, canvasH);
    } catch (e) {
      console.warn('⚠️ 背景載入失敗，改用灰色背景');
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    ctx.font = `${20 * SCALE}px NotoSans`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    function drawCardImage(ctx, img, x, y, w, h, count) {
      ctx.save();
      if (img) {
        ctx.drawImage(img, x, y, w, h);
        if (count > 1) {
          const boxW = 38 * SCALE, boxH = 22 * SCALE;
          const boxX = x + w - boxW - 3 * SCALE, boxY = y + h - boxH - 3 * SCALE;
          ctx.fillStyle = 'rgba(0,0,0,0.82)';
          ctx.fillRect(boxX, boxY, boxW, boxH);
          ctx.font = `bold ${14 * SCALE}px NotoSans`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(`x${count}`, boxX + boxW / 2, boxY + boxH - 4 * SCALE);
        }
      } else {
        ctx.fillStyle = '#2a2240';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#c084fc';
        ctx.font = `bold ${18 * SCALE}px NotoSans`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x + w / 2, y + h / 2);
      }
      ctx.restore();
    }

    function drawTitle(ctx, text, x, y) {
      ctx.save();
      ctx.font = `bold ${22 * SCALE}px NotoSans`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4 * SCALE;
      ctx.strokeStyle = 'white';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = 'black';
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    // 所有圖片 URL 與位置先計算好，再並行載入
    const drawJobs = [];

    // OSHI（規則上只能1張，但這裡不擋，多張就往下疊）
    for (let i = 0; i < oshi.length; i++) {
      const entry = parseKey(oshi[i].key);
      if (!entry) continue;
      drawJobs.push({
        url: `${CARDS_CDN}/${entry.folder}/${entry.id}${entry.version}.png`,
        x: 40 * SCALE, y: oshiTop + i * (cardH + gap), w: cardW, h: cardH, count: oshi[i].count || 1,
      });
    }

    // MAIN
    for (let i = 0; i < deck.length; i++) {
      const entry = parseKey(deck[i].key);
      if (!entry) continue;
      const col = i % mainCols, row = Math.floor(i / mainCols);
      drawJobs.push({
        url: `${CARDS_CDN}/${entry.folder}/${entry.id}${entry.version}.png`,
        x: 300 * SCALE + col * (cardW + gap), y: 60 * SCALE + row * (cardH + gap),
        w: cardW, h: cardH, count: deck[i].count || 1,
      });
    }

    // ENERGY
    const smallW = 110 * SCALE, smallH = 155 * SCALE;
    for (let i = 0; i < energy.length; i++) {
      const entry = parseKey(energy[i].key);
      if (!entry) continue;
      const col = i % 2, row = Math.floor(i / 2);
      drawJobs.push({
        url: `${CARDS_CDN}/${entry.folder}/${entry.id}${entry.version}.png`,
        x: 40 * SCALE + col * (smallW + gap), y: energyBaseY + 40 * SCALE + row * (smallH + gap),
        w: smallW, h: smallH, count: energy[i].count || 1,
      });
    }

    // 並行載入背景 + 所有卡片圖
    const bgUrl = `${CARDS_CDN}/backgrounds/wood.jpg`;
    const [bgResult, ...imgResults] = await Promise.all([
      loadImage(bgUrl).catch(() => null),
      ...drawJobs.map(job => loadImage(job.url).catch(() => null)),
    ]);

    // 畫背景
    if (bgResult) {
      ctx.drawImage(bgResult, 0, 0, canvasW, canvasH);
    } else {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // 畫標題
    drawTitle(ctx, `OSHI (${oshi.reduce((a, c) => a + (c.count || 1), 0)})`, 40 * SCALE, 20 * SCALE);
    drawTitle(ctx, `MAIN (${deck.reduce((a, c) => a + (c.count || 1), 0)})`, 300 * SCALE, 20 * SCALE);
    drawTitle(ctx, `ENERGY (${energy.reduce((a, c) => a + (c.count || 1), 0)})`, 40 * SCALE, energyBaseY);

    // 依序畫卡片（圖已載入好，純 canvas 操作）
    drawJobs.forEach((job, i) => {
      drawCardImage(ctx, imgResults[i], job.x, job.y, job.w, job.h, job.count);
    });

    return await canvas.encode('png');
  }
}

app.post('/export-deck', async (req, res, next) => {
  try {
    const buf = await renderDeckImage(req.body || {});
    res.setHeader('Content-Type', 'image/png');
    return res.end(buf);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

/* ===================== 9.5) 分享頁：OG 預覽（Discord / Twitter / LINE）=====================
   GitHub Pages 是靜態站，沒辦法針對不同代碼吐不同的 og:image，
   所以分享連結指向這裡：本路由回一頁帶 OG meta 的 HTML，再把人導回網站。 */
const SITE_URL = process.env.SITE_URL || 'https://tetsunekko.github.io/holotcgtw/';
const ogCache = new Map();               // code -> { buf, ts }
const OG_TTL = 60 * 60 * 1000;           // 1 小時
const OG_MAX = 100;

async function loadPayload(code) {
  const { rows } = await pool.query(
    'SELECT payload FROM deck_codes WHERE code = $1', [code]
  );
  return rows[0]?.payload || null;
}

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

app.get('/og/:code.png', async (req, res, next) => {
  try {
    const code = (req.params.code || '').trim().toUpperCase();
    const hit = ogCache.get(code);
    if (hit && Date.now() - hit.ts < OG_TTL) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.end(hit.buf);
    }

    const payload = await loadPayload(code);
    if (!payload) return res.status(404).json({ error: 'Code not found' });

    const buf = await renderDeckImage({
      oshi: payload.oshi || [], deck: payload.main || payload.deck || [], energy: payload.energy || [],
    });

    // 超過上限就丟掉最舊的（Map 是插入順序）
    if (ogCache.size >= OG_MAX) ogCache.delete(ogCache.keys().next().value);
    ogCache.set(code, { buf, ts: Date.now() });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(buf);
  } catch (err) {
    return next(err);
  }
});

app.get('/d/:code', async (req, res, next) => {
  try {
    const code = (req.params.code || '').trim().toUpperCase();
    const payload = await loadPayload(code);
    const target = `${SITE_URL}?code=${encodeURIComponent(code)}`;

    if (!payload) {
      return res.status(404).type('html').send(
        `<!doctype html><meta charset="utf-8"><title>找不到牌組</title>` +
        `<p>找不到代碼 ${esc(code)}，可能已過期（代碼保存 90 天）。</p>` +
        `<p><a href="${esc(SITE_URL)}">回到 HoloTCG Online</a></p>`
      );
    }

    const n = (a) => (a || []).reduce((s, c) => s + (c.count || 1), 0);
    const title = `HoloTCG 牌組 ${code}`;
    const desc = `主推 ${n(payload.oshi)} 張・主卡組 ${n(payload.main || payload.deck)} 張・能量 ${n(payload.energy)} 張`;
    const img = `${req.protocol}://${req.get('host')}/og/${encodeURIComponent(code)}.png`;

    res.type('html').send(`<!doctype html>
<html lang="zh-TW"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(target)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
</head><body>
<p>正在開啟牌組 ${esc(code)}…　<a href="${esc(target)}">沒有自動跳轉請點這裡</a></p>
</body></html>`);
  } catch (err) {
    return next(err);
  }
});

/* ===================== 10) 全域錯誤處理 ===================== */
app.use((err, req, res, next) => {
  console.error('[ERR]', err?.stack || err?.message || err);
  res.status(500).json({ error: 'Server error' });
});

/* ===================== 11) 啟動 ===================== */
async function start() {
  await initDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Deck server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});