// 找出 R2 缺的卡圖（扣掉卡號前綴資料夾已有的復刻卡），從官方 CDN 下載原始 PNG 到 r2upload/，再用 wrangler 上傳
// 用法：node fetch-r2-missing.cjs（上傳步驟見 MAINTENANCE.md「匯出圖片用的 R2 卡圖」）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'client/public/webpcards');
const OUT = path.join(__dirname, 'r2upload');
const CDN = 'https://pub-9e063c0641df4849b7460815c8ee4a6d.r2.dev/cards';
const BASE = 'https://hololive-official-cardgame.com';
const IMG = `${BASE}/wp-content/images/cardlist`;
const Q = 'attribute%5B0%5D=all&expansion_name=&card_kind%5B0%5D=all&rare%5B0%5D=all&bloom_level%5B0%5D=all&parallel%5B0%5D=all&view=text';
const H = { Referer: `${BASE}/` };

const exists = async url => (await fetch(url, { method: 'HEAD' })).ok;

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

// 官方站上某卡號出現過的所有圖片路徑（folder/file），同卡號只查一次
const searchCache = new Map();
async function officialPaths(id) {
  if (!searchCache.has(id)) {
    searchCache.set(id, (async () => {
      const found = new Set();
      for (let p = 1; p <= 5; p++) {
        const html = await (await fetch(`${BASE}/cardlist/cardsearch/?keyword=${id}&${Q}&page=${p}`, { headers: H })).text();
        const hits = html.match(new RegExp(`images/cardlist/[A-Za-z0-9_]+/${id}[A-Za-z0-9_]*\\.png`, 'g')) || [];
        if (!hits.length) break;
        hits.forEach(h => found.add(h.replace('images/cardlist/', '').replace('.png', '')));
      }
      return [...found];
    })());
  }
  return searchCache.get(id);
}

(async () => {
  const all = [];
  for (const dir of fs.readdirSync(ROOT)) {
    if (dir.endsWith('-trans')) continue;
    const d = path.join(ROOT, dir);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.webp')) all.push({ folder: dir, file: f.slice(0, -5) });
  }

  // 1. R2 缺圖（本站資料夾、卡號前綴資料夾都沒有）
  const missing = (await pool(all, 24, async c => {
    if (await exists(`${CDN}/${c.folder}/${c.file}.png`)) return null;
    const origin = c.file.split('-')[0];
    if (origin !== c.folder && await exists(`${CDN}/${origin}/${c.file}.png`)) return null;
    return c;
  })).filter(Boolean);
  console.log(`站上 ${all.length} 張，R2 實際缺 ${missing.length} 張`);

  // 2. 找官方圖：同資料夾 → 卡號前綴資料夾 → 搜尋全站同檔名
  const results = await pool(missing, 8, async c => {
    const origin = c.file.split('-')[0];
    const tries = [`${c.folder}/${c.file}`];
    if (origin !== c.folder) tries.push(`${origin}/${c.file}`);
    for (const t of tries) if (await exists(`${IMG}/${t}.png`)) return { ...c, src: t };
    const id = (c.file.match(/^h[A-Za-z]+\d*-\d{3}/) || [])[0];
    if (id) {
      const hit = (await officialPaths(id)).find(p => p.split('/')[1] === c.file);
      if (hit) return { ...c, src: hit };
    }
    return { ...c, src: null };
  });

  // 3. 下載到 r2upload/{本站資料夾}/{檔名}.png
  const ok = results.filter(r => r.src);
  await pool(ok, 8, async r => {
    const buf = Buffer.from(await (await fetch(`${IMG}/${r.src}.png`, { headers: H })).arrayBuffer());
    fs.mkdirSync(path.join(OUT, r.folder), { recursive: true });
    fs.writeFileSync(path.join(OUT, r.folder, `${r.file}.png`), buf);
  });

  const notFound = results.filter(r => !r.src);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'notfound.txt'), notFound.map(r => `${r.folder}/${r.file}`).join('\n'));
  const by = {};
  ok.forEach(r => by[r.folder] = (by[r.folder] || 0) + 1);
  console.log(`下載 ${ok.length} 張`, by);
  console.log(`官方找不到 ${notFound.length} 張：`, notFound.map(r => `${r.folder}/${r.file}`).join(' '));
})();
