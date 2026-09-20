// fetch-hbd24.cjs — 一次性：補齊 hBD24-041~067 生日卡（圖檔 + JSON entry）
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SITE = 'https://hololive-official-cardgame.com';
const WEBP_DIR = path.join(__dirname, 'client/public/webpcards/hBD24');
const NEW_DIR = path.join(__dirname, 'new_cards/hBD24');
const JSON_PATH = path.join(__dirname, 'client/src/cardList_hBD24.json');
const SRC = path.join(__dirname, 'client/src');
const MAGICK = process.env.MAGICK || 'magick'; // 預設用 PATH 上的 magick，路徑不同可用環境變數 MAGICK 指定

async function main() {
  // 1. 從官方卡表搜尋抓 卡號 -> { 卡名, 圖檔 }
  const cards = new Map();
  for (let p = 1; p <= 6; p++) {
    const url = `${SITE}/cardlist/cardsearch/?keyword=hBD24&attribute%5B0%5D=all&expansion_name=&card_kind%5B0%5D=all&rare%5B0%5D=all&bloom_level%5B0%5D=all&parallel%5B0%5D=all&view=text&page=${p}`;
    const html = await (await fetch(url)).text();
    const re = /images\/cardlist\/(hPR\/(hBD24-\d{3})(_[^."]*)\.png)"[^>]*title="([^"]+)"/g;
    let m, found = 0;
    while ((m = re.exec(html))) {
      cards.set(m[2], { img: m[1], suffix: m[3], name: m[4] });
      found++;
    }
    if (!found) break;
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`官方 hBD24 共 ${cards.size} 張`);

  // 2. 找出本地 JSON 缺少的
  const json = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const haveIds = new Set(json.map(c => c.id));
  const missing = [...cards.entries()].filter(([id]) => !haveIds.has(id)).sort();
  console.log(`缺少 ${missing.length} 張: ${missing.map(([id]) => id).join(', ')}`);
  if (!missing.length) return;

  // 3. 建 名字 -> 既有主推卡 的查表（拿 color / searchKeywords 譯名）
  const oshiByName = new Map();
  for (const f of fs.readdirSync(SRC).filter(f => f.startsWith('cardList_') && f.endsWith('.json'))) {
    for (const c of JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'))) {
      if (c.type === 'Oshi' && c.name && Array.isArray(c.color) && c.color.length && !oshiByName.has(c.name)) {
        oshiByName.set(c.name, c);
      }
    }
  }

  // 4. 下載圖 + 轉 webp + 建 entry
  fs.mkdirSync(NEW_DIR, { recursive: true });
  const needManual = [];
  for (const [id, info] of missing) {
    const pngPath = path.join(NEW_DIR, `${id}${info.suffix}.png`);
    const webpPath = path.join(WEBP_DIR, `${id}${info.suffix}.webp`);
    const res = await fetch(`${SITE}/wp-content/images/cardlist/${info.img}`, {
      headers: { Referer: SITE + '/' },
    });
    if (!res.ok) { console.log(`❌ ${id} 圖片下載失敗 HTTP ${res.status}`); continue; }
    fs.writeFileSync(pngPath, Buffer.from(await res.arrayBuffer()));
    execFileSync(MAGICK, [pngPath, webpPath]);

    const base = oshiByName.get(info.name);
    if (!base) needManual.push(`${id} ${info.name}`);
    json.push({
      id,
      type: 'Oshi',
      name: info.name,
      life: '',
      imageFolder: 'hBD24/',
      color: base ? base.color : [],
      searchKeywords: base ? base.searchKeywords.filter(k => k.length < 30) : [info.name],
      skillType: '',
      versions: [`${info.suffix}.png`],
      tags: '',
      grade: '',
    });
    console.log(`✅ ${id} ${info.name}${base ? '' : '（找不到同名主推卡，color 需手動填）'}`);
    await new Promise(r => setTimeout(r, 300));
  }

  // 5. 依 id 排序後寫回（字串陣列單行）
  json.sort((a, b) => a.id.localeCompare(b.id));
  const body = json.map(e => '  ' + JSON.stringify(e, null, 2).replace(/\n/g, '\n  ')).join(',\n');
  const out = ('[\n' + body + '\n]\n').replace(
    /\[\s+("(?:[^"\\]|\\.)*"(?:,\s+"(?:[^"\\]|\\.)*")*)\s+\]/g,
    (m, inner) => '[' + inner.replace(/,\s+/g, ', ') + ']'
  );
  fs.writeFileSync(JSON_PATH, out, 'utf8');
  console.log(`\n已更新 cardList_hBD24.json（共 ${json.length} 筆）`);
  if (needManual.length) {
    console.log('\n⚠️ 以下卡片 color/譯名需手動確認:');
    needManual.forEach(x => console.log('  ' + x));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
