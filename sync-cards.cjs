// sync-cards.cjs — 從官方 decklog API 抓卡片清單，比對本地 webpcards，找出缺少的卡圖
// 用法:
//   node sync-cards.cjs             → 只列出缺少的卡圖（dry-run）
//   node sync-cards.cjs --download  → 下載缺圖 PNG 到 new_cards/ 並自動轉 webp 放進 webpcards/
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const API = 'https://decklog.bushiroad.com/system/app/api/search/9';
const IMG_CDN = 'https://hololive-official-cardgame.com/wp-content/images/cardlist/';
const WEBP_DIR = path.join(__dirname, 'client/public/webpcards');
const NEW_DIR = path.join(__dirname, 'new_cards');
const MAGICK = process.env.MAGICK || 'magick'; // 預設用 PATH 上的 magick，路徑不同可用環境變數 MAGICK 指定

const DOWNLOAD = process.argv.includes('--download');

async function fetchPage(page) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://decklog.bushiroad.com/create?c=9',
    },
    body: JSON.stringify({ page, param: { keyword: '', keyword_type: ['no'], expansion: '' } }),
  });
  if (!res.ok) throw new Error(`API ${res.status} on page ${page}`);
  return res.json();
}

async function main() {
  // 1. 抓官方全卡表（分頁直到空頁）
  const official = new Map(); // img path -> card info
  for (let page = 1; ; page++) {
    const cards = await fetchPage(page);
    if (!cards.length) break;
    for (const c of cards) official.set(c.img, c);
    process.stdout.write(`\r抓取官方卡表中... 第 ${page} 頁，累計 ${official.size} 張`);
    await new Promise(r => setTimeout(r, 200)); // 禮貌性間隔
  }
  console.log(`\n官方卡圖總數: ${official.size}`);

  // 2. 掃本地 webpcards — 只比對檔名（同一張卡可能放在不同資料夾，官方與本地資料夾名不一致）
  const local = new Set();
  for (const folder of fs.readdirSync(WEBP_DIR)) {
    const fp = path.join(WEBP_DIR, folder);
    if (!fs.statSync(fp).isDirectory()) continue;
    for (const f of fs.readdirSync(fp)) {
      if (f.endsWith('.webp')) local.add(f.replace('.webp', ''));
    }
  }
  console.log(`本地卡圖總數: ${local.size}`);

  // 官方資料庫已知錯誤，不要下載
  const BLACKLIST = new Set([
    'hBP05/hBP02-085_HR.png', // 檔名打錯的重複記錄，實際是 hBP02-065_HR ネリッサ
  ]);

  // 3. 比對（用檔名，不含資料夾）；sele 開頭是教學卡，跳過
  const missing = [...official.keys()]
    .filter(img => !img.startsWith('sele') && !BLACKLIST.has(img))
    .filter(img => !local.has(path.basename(img, '.png')))
    .sort();
  if (!missing.length) {
    console.log('✅ 沒有缺少的卡圖！');
    return;
  }
  console.log(`\n缺少 ${missing.length} 張卡圖:`);
  missing.forEach(m => console.log('  ' + m));

  if (!DOWNLOAD) {
    console.log('\n加上 --download 參數可自動下載並轉 webp');
    return;
  }

  // 4. 下載 + 轉 webp（官方資料夾名 → 本地資料夾名對應）
  const FOLDER_ALIAS = { hWF01: 'Twin_Wafer', hCO01: '2025Live_Set' };
  console.log('\n開始下載...');
  for (const img of missing) {
    const [folder, file] = img.split('/');
    const localFolder = FOLDER_ALIAS[folder] || folder;
    const pngPath = path.join(NEW_DIR, localFolder, file);
    const webpPath = path.join(WEBP_DIR, localFolder, file.replace('.png', '.webp'));
    fs.mkdirSync(path.dirname(pngPath), { recursive: true });
    fs.mkdirSync(path.dirname(webpPath), { recursive: true });

    const res = await fetch(IMG_CDN + img, { headers: { 'Referer': 'https://hololive-official-cardgame.com/' } });
    if (!res.ok) { console.log(`  ❌ ${img} (HTTP ${res.status})`); continue; }
    fs.writeFileSync(pngPath, Buffer.from(await res.arrayBuffer()));
    execFileSync(MAGICK, [pngPath, webpPath]);
    console.log(`  ✅ ${img} → webp`);
    await new Promise(r => setTimeout(r, 300)); // 禮貌性間隔
  }
  console.log(`\n完成！PNG 原檔在 ${NEW_DIR}，webp 已放入 webpcards/`);
  console.log('記得執行 npm run build:index 更新 imageIndex，並更新對應 cardList JSON 的 versions');
}

main().catch(e => { console.error(e); process.exit(1); });
