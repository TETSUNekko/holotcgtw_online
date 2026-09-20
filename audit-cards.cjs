// audit-cards.cjs — 拿官方卡表對帳本地 cardList_*.json
// 用法:
//   node audit-cards.cjs              # 只回報差異
//   node audit-cards.cjs --fix-tags   # 把「官方有、我們沒有」的 tags 補進 JSON
//   node audit-cards.cjs --fix-hp     # 把 hp 空白的 entry 補上官方數值（不覆蓋已有的值）
//   node audit-cards.cjs --strip-extra-tags  # 刪掉官方沒有的 tags（自己加的主題標籤也會被刪！）
//   node audit-cards.cjs --fix-grade  # 把 grade/hp 直接對齊官方（會覆蓋已有的值）
// color 不自動改：多色卡官方頁只抓得到第一個顏色，覆蓋會弄丟其他顏色。
//   node audit-cards.cjs --refetch    # 忽略快取，重抓官方資料
//
// 官方 view=text 頁面有 タグ / カードタイプ / 色 / HP / Bloomレベル，
// decklog API 沒有，所以只能爬這裡。2559 筆 / 15 筆一頁 ≈ 171 頁。
const fs = require('fs');
const path = require('path');

const SITE = 'https://hololive-official-cardgame.com';
const SRC = path.join(__dirname, 'client/src');
const CACHE = path.join(__dirname, '.official-cards.json');
const FIX = process.argv.includes('--fix-tags');
const FIX_HP = process.argv.includes('--fix-hp');
const STRIP = process.argv.includes('--strip-extra-tags');
const FIX_GRADE = process.argv.includes('--fix-grade');
const REFETCH = process.argv.includes('--refetch');

const COLOR = { '赤': 'red', '青': 'blue', '緑': 'green', '白': 'white', '黄': 'yellow', '紫': 'purple', '無': 'colorless' };
const BLOOM = { 'Debut': 'debut', '1st': '1st', '2nd': '2nd', 'Spot': 'spot', 'Buzz': 'buzz' };
// 與 fetch-set.cjs 的 TAG 表同步；有新標籤時兩邊都要加
const TAG = {
  'JP': 'JP', 'EN': 'EN', 'ID': 'ID',
  '0期生': '0期生', '1期生': '1期生', '2期生': '2期生', '3期生': '3期生', '4期生': '4期生', '5期生': '5期生',
  'ID1期生': 'ID1期生', 'ID2期生': 'ID2期生', 'ID3期生': 'ID3期生',
  'Myth': 'Myth', 'Promise': 'Promise', 'Advent': 'Advent', 'Justice': 'Justice',
  'DEV_IS': 'DEV_IS', 'ReGLOSS': 'ReGLOSS', 'FLOW GLOW': 'FLOW GLOW',
  'ゲーマーズ': 'Gamers', 'Gamers': 'Gamers',
  '秘密結社holoX': '秘密結社holoX', 'ホロウィッチ': 'HoloWitch',
  '歌': '歌', '絵': '畫', '料理': '料理', '海': '海',
  'ケモミミ': '獸耳', 'ハーフエルフ': '半精靈', 'シューター': '射手', '言語学': '語言學',
  '魔法': '魔法', 'ベイビー': '嬰兒', '食べ物': '食物', 'きのこ': '香菇',
  'トリ': '鳥', 'お酒': '酒', 'ラミィのお酒': '菈米的酒', 'サマー': '夏季', '夏': '夏季',
  '白上の者': '白上的角色', 'こよラボ': '小夜璃實驗室', 'Buzzグッズ': 'Buzz商品',
  // 2026-08-18 對帳時補：官方實際用的寫法與原本 TAG 表不同
  '語学': '語言學',                 // 官方是 #語学，不是 #言語学
  '白上\'sキャラクター': '白上的角色', // 官方是 #白上'sキャラクター，不是 #白上の者
  'FLOW': 'FLOW GLOW',             // 官方寫 #FLOW GLOW，標籤含空白，切出來只會拿到 FLOW
  'カエラ\'sアームズ': '卡埃拉的武器', // 本站已用「卡埃拉的武器」
};

const decode = s => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').trim();

const unknownTags = new Map(); // 官方標籤 -> 出現的卡號

function parseBlock(b) {
  const num = (b.match(/<p class="number">([^<]+)<\/p>/) || [])[1];
  if (!num) return null;
  const name = decode((b.match(/<p class="name">([^<]*)<\/p>/) || [])[1] || '');
  const kind = decode((b.match(/カードタイプ<\/dt>\s*<dd>([^<]*)<\/dd>/) || [])[1] || '');
  const tagRaw = decode((b.match(/タグ<\/dt>\s*<dd>([^<]*)<\/dd>/) || [])[1] || '');
  const colorJa = (b.match(/色<\/dt>\s*<dd><img[^>]*alt="([^"]+)"/) || [])[1] || '';
  const hp = decode((b.match(/HP<\/dt>\s*<dd>([^<]*)<\/dd>/) || [])[1] || '');
  const bloomJa = decode((b.match(/Bloomレベル<\/dt>\s*<dd>([^<]*)<\/dd>/) || [])[1] || '');

  const tags = [];
  const rawTags = (tagRaw.match(/#[^\s#]+/g) || []).map(t => t.slice(1));
  for (const key of rawTags) {
    if (TAG[key]) { if (!tags.includes(TAG[key])) tags.push(TAG[key]); }
    else { if (!unknownTags.has(key)) unknownTags.set(key, []); unknownTags.get(key).push(num); }
  }
  if (kind.includes('LIMITED') && !tags.includes('LIMITED')) tags.push('LIMITED');

  let type, grade = '';
  if (kind.includes('エール')) type = 'Energy';       // 能量卡在官方是「エール」
  else if (kind.includes('推しホロメン')) type = 'Oshi';
  else if (kind.includes('ホロメン')) { type = 'Member'; grade = kind.includes('Buzz') ? 'buzz' : (BLOOM[bloomJa] || ''); }
  else type = 'Support';

  // エクストラ（このホロメンはデッキに何枚でも入れられる）＝不受 4 張上限。
  // 用 <div class="extra"> 判斷，不能比對效果文字裡的「何枚でも」——
  // 有些卡只是在效果文裡「提到」エクストラ卡（例如 hBP08-062 鷹嶺ルイ）。
  const extra = /<div class="extra">/.test(b);
  return { num, name, kind, tags, rawTags, type, grade, hp, extra, color: COLOR[colorJa] || '' };
}

async function fetchAll() {
  const byNum = {};
  for (let p = 1; p <= 300; p++) {
    const url = `${SITE}/cardlist/cardsearch/?keyword=&attribute%5B0%5D=all&expansion_name=&card_kind%5B0%5D=all&rare%5B0%5D=all&bloom_level%5B0%5D=all&parallel%5B0%5D=all&view=text&page=${p}`;
    const html = await (await fetch(url)).text();
    const blocks = html.split('<li><a href="/cardlist/?id=').slice(1).filter(b => /<p class="number">/.test(b));
    if (!blocks.length) break;
    for (const b of blocks) {
      const c = parseBlock(b);
      if (c && !byNum[c.num]) byNum[c.num] = c;
    }
    if (p % 20 === 0) process.stdout.write(`  ...第 ${p} 頁，已收 ${Object.keys(byNum).length} 個卡號\n`);
    await new Promise(r => setTimeout(r, 250));
  }
  return byNum;
}

const serialize = arr => {
  const body = arr.map(e => '  ' + JSON.stringify(e, null, 2).replace(/\n/g, '\n  ')).join(',\n');
  return ('[\n' + body + '\n]\n').replace(
    /\[\s+("(?:[^"\\]|\\.)*"(?:,\s+"(?:[^"\\]|\\.)*")*)\s+\]/g,
    (m, inner) => '[' + inner.replace(/,\s+/g, ', ') + ']'
  );
};

(async () => {
  let official;
  if (!REFETCH && fs.existsSync(CACHE)) {
    official = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    console.log(`使用快取 ${path.basename(CACHE)}（${Object.keys(official).length} 個卡號），要重抓加 --refetch\n`);
  } else {
    console.log('抓取官方卡表中（約 171 頁，需要一兩分鐘）...');
    official = await fetchAll();
    fs.writeFileSync(CACHE, JSON.stringify(official), 'utf8');
    console.log(`\n官方共 ${Object.keys(official).length} 個卡號，已快取\n`);
  }

  // 從 rawTags 重算一次標籤：改了上面的 TAG 表不必重抓官方資料
  unknownTags.clear();
  for (const o of Object.values(official)) {
    const tags = [];
    for (const key of o.rawTags || []) {
      if (TAG[key]) { if (!tags.includes(TAG[key])) tags.push(TAG[key]); }
      else { if (!unknownTags.has(key)) unknownTags.set(key, []); unknownTags.get(key).push(o.num); }
    }
    if ((o.tags || []).includes('LIMITED')) tags.push('LIMITED');
    o.tags = tags;
  }

  const files = fs.readdirSync(SRC).filter(f => f.startsWith('cardList_') && f.endsWith('.json'));
  const data = {};
  for (const f of files) data[f] = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));

  const missTags = [];   // 官方有、我們沒有 → 可自動補
  const extraTags = [];  // 我們有、官方沒有 → 只回報
  const mismatch = [];   // type / grade / color / hp 不符 → 只回報
  const notFound = new Map(); // 官方查無此卡號
  const changed = new Set();

  for (const f of files) {
    for (const c of data[f]) {
      const o = official[c.id];
      if (!o) { if (!notFound.has(c.id)) notFound.set(c.id, { name: c.name, files: [] }); notFound.get(c.id).files.push(f); continue; }

      const mine = Array.isArray(c.tags) ? c.tags : [];
      const miss = o.tags.filter(t => !mine.includes(t));
      const extra = mine.filter(t => !o.tags.includes(t));
      // 同時有缺有多 = 很可能是抄錯；只補不刪會變成兩個都在，所以除非同時開 --strip-extra-tags 否則不動
      const suspect = miss.length > 0 && extra.length > 0;
      if (miss.length) {
        missTags.push({ f, id: c.id, name: c.name, miss, mine, official: o.tags, suspect });
        if (FIX && (!suspect || STRIP)) {
          c.tags = [...mine, ...miss];
          changed.add(f);
        }
      }
      if (extra.length) {
        extraTags.push({ f, id: c.id, name: c.name, extra, official: o.tags, suspect });
        if (STRIP) {
          c.tags = (Array.isArray(c.tags) ? c.tags : []).filter(t => o.tags.includes(t));
          changed.add(f);
        }
      }

      const diffs = [];
      if (c.type !== o.type) diffs.push(`type: ${c.type} → 官方 ${o.type}`);
      if (o.type === 'Member' && (c.grade || '') !== o.grade) {
        diffs.push(`grade: ${c.grade || '(空)'} → 官方 ${o.grade || '(空)'}`);
        if (FIX_GRADE && o.grade) { c.grade = o.grade; changed.add(f); }
      }
      if (o.type === 'Member' && String(c.hp || '') !== String(o.hp || '')) {
        diffs.push(`hp: ${c.hp || '(空)'} → 官方 ${o.hp || '(空)'}`);
        // 只補空的，已經有值但對不上的算誤植，不自動蓋掉
        if ((FIX_HP && !c.hp && o.hp) || (FIX_GRADE && o.hp)) { c.hp = o.hp; changed.add(f); }
      }
      if (o.color) {
        const mineColor = Array.isArray(c.color) ? c.color : (c.color ? [c.color] : []);
        if (o.type !== 'Support' && !mineColor.includes(o.color)) diffs.push(`color: ${JSON.stringify(mineColor)} → 官方 ${o.color}`);
      }
      if (diffs.length) mismatch.push({ f, id: c.id, name: c.name, diffs });
    }
  }

  const set = f => f.replace('cardList_', '').replace('.json', '');
  const line = x => `  [${set(x.f)}] ${x.id} ${x.name || ''}`;

  console.log(`═══ 1. 缺漏的 tags（官方有、我們沒有）：${missTags.length} 筆 ═══`);
  missTags.forEach(x => console.log(`${line(x)}  缺 ${x.miss.map(t => '#' + t).join(' ')}${x.suspect ? '  ⚠️疑似抄錯，不自動補' : ''}   (我們: ${JSON.stringify(x.mine)})`));

  console.log(`\n═══ 2. 多出來的 tags（我們有、官方沒有）：${extraTags.length} 筆 ═══`);
  extraTags.forEach(x => console.log(`${line(x)}  多 ${x.extra.map(t => '#' + t).join(' ')}${x.suspect ? '  ⚠️同時有缺，疑似抄錯' : ''}   (官方: ${JSON.stringify(x.official)})`));

  console.log(`\n═══ 3. 其他欄位不符：${mismatch.length} 筆 ═══`);
  mismatch.forEach(x => console.log(`${line(x)}  ${x.diffs.join('； ')}`));

  console.log(`\n═══ 4. 官方卡表查無此卡號：${notFound.size} 個 ═══`);
  [...notFound].forEach(([id, v]) => console.log(`  ${id} ${v.name || ''}  (${[...new Set(v.files.map(set))].join(', ')})`));

  // エクストラ卡清單給前端的牌組檢查用
  const extras = Object.values(official).filter(o => o.extra).map(o => o.num).sort();
  const EXTRA_OUT = path.join(SRC, 'unlimitedCards.json');
  const prevExtras = fs.existsSync(EXTRA_OUT) ? JSON.parse(fs.readFileSync(EXTRA_OUT, 'utf8')) : [];
  console.log(`
═══ 6. エクストラ（不受 4 張上限）：${extras.length} 張 ═══`);
  if (extras.length) {
    extras.forEach(n => console.log(`  ${n} ${official[n].name}`));
    if (JSON.stringify(extras) !== JSON.stringify(prevExtras)) {
      fs.writeFileSync(EXTRA_OUT, JSON.stringify(extras, null, 2) + "\n", 'utf8');
      console.log(`  ✏️ 已更新 unlimitedCards.json（原本 ${prevExtras.length} 張）`);
    }
  } else if (prevExtras.length) {
    console.log('  ⚠️ 這次一張都沒抓到，但檔案裡有資料 —— 可能是官方頁面改版，先不覆蓋');
  }

  if (unknownTags.size) {
    console.log(`\n═══ 5. 未對應的官方標籤（TAG 表要補，否則第 1 項會少報）：${unknownTags.size} 個 ═══`);
    [...unknownTags].forEach(([t, nums]) => console.log(`  #${t}  ${nums.length} 張，例如 ${nums.slice(0, 3).join(', ')}`));
  }

  if ((FIX || FIX_HP || STRIP || FIX_GRADE) && changed.size) {
    for (const f of changed) fs.writeFileSync(path.join(SRC, f), serialize(data[f]), 'utf8');
    console.log(`\n✏️ 已寫回 ${changed.size} 個檔案：${[...changed].map(set).join(', ')}`);
  } else if (missTags.length) {
    console.log(`\n📌 補第 1 項（標 ⚠️ 的除外）加 --fix-tags；補 hp 空白加 --fix-hp`);
  }
})().catch(e => { console.error(e); process.exit(1); });
