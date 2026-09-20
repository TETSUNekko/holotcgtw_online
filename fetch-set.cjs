// fetch-set.cjs — 從官方卡表爬取整個彈數的卡片資料，產生 cardList_<set>.json
// 用法: node fetch-set.cjs hEB01 [--write]
//   不加 --write 只預覽解析結果
//
// 為什麼不用 decklog API：API 不收主推卡（推しホロメン），且沒有顏色/標籤欄位。
const fs = require('fs');
const path = require('path');

const SET = process.argv[2];
const WRITE = process.argv.includes('--write');
if (!SET) { console.error('用法: node fetch-set.cjs <彈數代號> [--write]'); process.exit(1); }

const SITE = 'https://hololive-official-cardgame.com';
const SRC = path.join(__dirname, 'client/src');
const OUT = path.join(SRC, `cardList_${SET}.json`);

const COLOR = { '赤': 'red', '青': 'blue', '緑': 'green', '白': 'white', '黄': 'yellow', '紫': 'purple', '無': 'colorless' };
const BLOOM = { 'Debut': 'debut', '1st': '1st', '2nd': '2nd', 'Spot': 'spot', 'Buzz': 'buzz' };
const SUBTYPE = {
  'アイテム': 'item', 'イベント': 'event', 'ツール': 'tool',
  'マスコット': 'mascot', 'ファン': 'fan', 'スタッフ': 'staff',
};
// 官方日文標籤 → 本站標籤
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
  'トリ': '鳥', 'お酒': '酒', 'ラミィのお酒': '菈米的酒',
  'サマー': '夏季', '夏': '夏季',
  '白上の者': '白上的角色', 'こよラボ': '小夜璃實驗室', 'Buzzグッズ': 'Buzz商品',
  // 2026-08-18 全站對帳時發現官方實際寫法與這裡不同，補上（audit-cards.cjs 的 TAG 表要同步）
  '語学': '語言學',                    // 官方是 #語学，不是 #言語学
  '白上\'sキャラクター': '白上的角色',   // 官方是 #白上'sキャラクター
  'FLOW': 'FLOW GLOW',                // 官方寫 #FLOW GLOW，標籤含空白，#[^\s#]+ 只切得到 FLOW
  'カエラ\'sアームズ': '卡埃拉的武器',
};

// 支援卡中文譯名（角色卡會自動從既有卡表撈，支援卡沒有前例只能列表）
// 來源：webpcards/<set>-trans 的翻譯圖（鳳凰貓）
const NAME_ZH = {
  'サマーパソコン': '夏季電腦',
  'クマリン': '熊瑪琳',
  'サマーライブ': 'Summer Live',
  'スイカ割り': '打西瓜',
  'スプラッシュシュート': '水花射擊',
  'ホロライブ・サマー': 'Hololive・Summer',
  '水遊び': '玩水',
  'STAR STAR☆T': 'STAR STAR☆T',   // 中譯同原名
  'ビーチボール': '沙灘排球',
  'なんでも爆解！': '一炸解千愁',
  // hBP09「ボリュームヴォルテックス」(2026-09-20，譯名讀自 hBP09-trans 翻譯圖)
  "コラボパソコン": "聯動電腦",
  "あずいろ BESTIE DAYS": "AZIro BESTIE DAYS",
  "雨の日ヴィヴィ": "下雨天薇薇",
  "応援するホロリス": "應援的Holo粉絲",
  "大空警察": "大空警察",
  "君に乾杯": "為你乾杯",
  "コンコ コンコンコ コンコンコン": "konkokonkokokonkonkon",
  "コンビプレイ": "聯手遊玩",
  "スイカバブル": "西瓜泡沫經濟",
  "スピード違反": "速度違反",
  "ノエルの特盛牛丼": "諾艾爾的特大碗牛丼",
  "バカ！変態！うるさーい！もう知らなーい！": "笨蛋!變態!吵死了!不理你了!",
  "ばんちょーダンス": "番長舞",
  "変な動き": "奇怪的動作",
  "ホロライブ体力王決定戦": "Hololive體力王決定戰",
  "BIG3": "BIG3",
  "カエラが作ったホロシールド": "卡埃拉製作的HOLO之盾",
  "カエラが作ったホロソード": "卡埃拉製作的HOLO之劍",
  "常闇トワのブレイクマイク": "常闇永遠的Break麥克風",
  "メイクアップ": "化妝",
  "雪夜月": "雪夜月",
  "Pemaloe": "Pemaloe",

};

const decode = s => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').trim();

(async () => {
  // 1. 抓所有分頁的 <li> 卡片區塊
  // 用 expansion_name（收錄商品）而非 keyword —— keyword 只抓得到卡號開頭相符的卡，
  // 會漏掉整彈的復刻卡（例如 hEB01 收錄的 hBP01-021_C_02）
  const blocks = [];
  for (let p = 1; p <= 20; p++) {
    const url = `${SITE}/cardlist/cardsearch/?keyword=&attribute%5B0%5D=all&expansion_name=${SET}&card_kind%5B0%5D=all&rare%5B0%5D=all&bloom_level%5B0%5D=all&parallel%5B0%5D=all&view=text&page=${p}`;
    const html = await (await fetch(url)).text();
    const parts = html.split('<li><a href="/cardlist/?id=').slice(1);
    const hits = parts.filter(b => /<p class="number">/.test(b));
    if (!hits.length) break;
    blocks.push(...hits);
    await new Promise(r => setTimeout(r, 300));
  }

  // 2. 解析
  const byId = new Map();
  const unknownTags = new Set();
  for (const b of blocks) {
    const num = (b.match(/<p class="number">([^<]+)<\/p>/) || [])[1];
    if (!num) continue;

    const img = (b.match(/images\/cardlist\/([^"]+)\.png/) || [])[1] || '';
    const [folder, file] = img.split('/');
    const version = file ? file.replace(num, '') : '_C';

    if (!byId.has(num)) {
      const name = decode((b.match(/<p class="name">([^<]*)<\/p>/) || [])[1] || '');
      const kind = decode((b.match(/カードタイプ<\/dt>\s*<dd>([^<]*)<\/dd>/) || [])[1] || '');
      const tagRaw = decode((b.match(/タグ<\/dt>\s*<dd>([^<]*)<\/dd>/) || [])[1] || '');
      const colorJa = (b.match(/色<\/dt>\s*<dd><img[^>]*alt="([^"]+)"/) || [])[1] || '';
      const hp = decode((b.match(/HP<\/dt>\s*<dd>([^<]*)<\/dd>/) || [])[1] || '');
      const bloomJa = decode((b.match(/Bloomレベル<\/dt>\s*<dd>([^<]*)<\/dd>/) || [])[1] || '');

      // 標籤
      const tags = [];
      for (const t of (tagRaw.match(/#[^\s#]+/g) || [])) {
        const key = t.slice(1);
        if (TAG[key]) { if (!tags.includes(TAG[key])) tags.push(TAG[key]); }
        else unknownTags.add(key);
      }
      if (kind.includes('LIMITED') && !tags.includes('LIMITED')) tags.push('LIMITED');

      // 卡片種類
      let type, grade = '', subtype = '';
      if (kind.includes('推しホロメン')) type = 'Oshi';
      else if (kind.includes('ホロメン')) {
        type = 'Member';
        grade = kind.includes('Buzz') ? 'buzz' : (BLOOM[bloomJa] || '');
      } else {
        type = 'Support';
        for (const [ja, en] of Object.entries(SUBTYPE)) if (kind.includes(ja)) subtype = en;
      }

      // 效果類型
      let effectType = '';
      if (b.includes('コラボエフェクト')) effectType = 'Collaboration';
      else if (b.includes('ブルームエフェクト')) effectType = 'Bloom';
      else if (b.includes('ギフト')) effectType = 'Gift';

      byId.set(num, {
        num, name, kind, tags, colorJa, hp, bloomJa,
        type, grade, subtype, effectType,
        folder, versions: new Set(), otherFolders: new Map(),
      });
    }
    const e = byId.get(num);
    // 只收本彈數資料夾的版本；其他資料夾（hPR 等）交給 update-versions.cjs 建對應 entry
    if (folder === SET) e.versions.add(version + '.png');
    else e.otherFolders.set(folder, version + '.png');
  }

  // 3. 從既有卡表建索引：卡號 → 最完整的既有 entry；卡名 → 中英譯名
  //    復刻卡優先用「卡號」對既有資料（官方與本站的漢字字形可能不同，例如 兎田/兔田）
  const existingById = new Map();
  const nameKeywords = new Map();
  for (const f of fs.readdirSync(SRC).filter(f => f.startsWith('cardList_') && f.endsWith('.json'))) {
    for (const c of JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'))) {
      if (!Array.isArray(c.searchKeywords)) continue;
      const prev = existingById.get(c.id);
      if (!prev || c.searchKeywords.length > prev.searchKeywords.length) existingById.set(c.id, c);
      if (c.name && !nameKeywords.has(c.name)) {
        const kw = c.searchKeywords.filter(k => k.length < 25 && !Object.values(SUBTYPE).includes(k) && !Object.keys(SUBTYPE).includes(k));
        if (kw.length) nameKeywords.set(c.name, kw);
      }
    }
  }

  // 4. 組出 JSON
  const VORDER = ["_C","_C_2","_C_02","_02_C","_U","_U_2","_U_02","_S","_02_S","_S_02","_SY",
    "_P","_P_01","_P_02","_P_03","_01_P","_02_P","_R","_R_02","_RR","_RR_02",
    "_SR","_SR_02","_02_SR","_UR","_HR","_SEC","_OC","_OSR","_OUR"];
  const vr = v => { const i = VORDER.indexOf(v.replace('.png','')); return i === -1 ? 900 : i; };

  const out = [];
  const needTranslation = [];
  const skipped = [];
  for (const c of [...byId.values()].sort((a, b) => a.num.localeCompare(b.num))) {
    let versions = [...c.versions].sort((a, b) => vr(a) - vr(b) || a.localeCompare(b));
    // 官方沿用原彈卡圖（沒出新圖）→ 仍要建 entry，否則彈數篩選會漏掉這張，
    // 但卡圖要從原彈複製一份進本彈資料夾（本站慣例：收錄在哪彈就複製到哪個資料夾）
    if (!versions.length && c.otherFolders.size) {
      const [srcFolder, ver] = [...c.otherFolders.entries()][0];
      versions = [ver];
      skipped.push({ num: c.num, name: c.name, from: srcFolder, file: c.num + ver.replace('.png', '') });
    }
    if (!versions.length) continue;

    const color = COLOR[c.colorJa] || '';
    const exist = existingById.get(c.num);
    // 沿用本站既有的卡名與關鍵字（官方漢字字形可能不同，例如 兎田/兔田）
    const name = exist && exist.name ? exist.name : c.name;

    let searchKeywords;
    if (exist) {
      searchKeywords = [...exist.searchKeywords];
    } else if (c.type === 'Support') {
      const subtypeJa = Object.keys(SUBTYPE).find(k => SUBTYPE[k] === c.subtype) || '';
      searchKeywords = [c.subtype, subtypeJa, c.name];
      const zh = NAME_ZH[c.name];
      if (zh && zh !== c.name) searchKeywords.push(zh);
      else if (!zh) needTranslation.push(`${c.num}  ${c.name}  (支援卡，缺中文譯名)`);
    } else {
      const known = nameKeywords.get(c.name);
      searchKeywords = known ? [...known] : [c.name];
      if (!known) needTranslation.push(`${c.num}  ${c.name}  (缺中文/英文譯名)`);
    }

    if (c.type === 'Oshi') {
      out.push({ id: c.num, type: 'Oshi', name, life: '', imageFolder: c.folder + '/',
        color: color ? [color] : [], searchKeywords, skillType: '', versions,
        tags: c.tags.length ? c.tags : '', grade: '' });
    } else if (c.type === 'Member') {
      out.push({ id: c.num, type: 'Member', name, hp: c.hp || '', imageFolder: c.folder + '/',
        color: color ? [color] : [], grade: c.grade, searchKeywords, skillType: '', versions,
        tags: c.tags.length ? c.tags : '', effectType: c.effectType });
    } else {
      out.push({ id: c.num, type: 'Support', name, imageFolder: c.folder + '/',
        color: '', grade: '', searchKeywords, versions, tags: c.tags.length ? c.tags : '' });
    }
  }

  // 5. 排序：主推 → 角色 → 支援；主推/角色再依白綠紅藍紫黃，同色照卡號
  //    支援卡不分顏色，維持官方列表順序
  const TORDER = ['Oshi', 'Member', 'Support'];
  const CORDER = ['white', 'green', 'red', 'blue', 'purple', 'yellow'];
  out.forEach((c, i) => c.__i = i);
  out.sort((a, b) =>
    TORDER.indexOf(a.type) - TORDER.indexOf(b.type) ||
    (a.type === 'Support'
      ? a.__i - b.__i
      : CORDER.indexOf([].concat(a.color || [])[0]) - CORDER.indexOf([].concat(b.color || [])[0]) ||
        a.id.localeCompare(b.id))
  );
  out.forEach(c => delete c.__i);

  // 6. 輸出
  const body = out.map(e => '  ' + JSON.stringify(e, null, 2).replace(/\n/g, '\n  ')).join(',\n');
  const text = ('[\n' + body + '\n]\n').replace(
    /\[\s+("(?:[^"\\]|\\.)*"(?:,\s+"(?:[^"\\]|\\.)*")*)\s+\]/g,
    (m, inner) => '[' + inner.replace(/,\s+/g, ', ') + ']'
  );

  console.log(`${SET} 共 ${out.length} 張`);
  const byType = {};
  out.forEach(c => byType[c.type] = (byType[c.type] || 0) + 1);
  console.log('  ' + Object.entries(byType).map(([k, v]) => `${k} ${v}`).join('、'));
  console.log('');
  out.forEach(c => console.log(`  ${c.id}  ${(c.type).padEnd(8)} ${String(Array.isArray(c.color) ? c.color.join('/') : '-').padEnd(10)} ${(c.grade || '-').padEnd(7)} ${JSON.stringify(c.versions)}  ${c.name}  ${JSON.stringify(c.tags)}`));

  if (unknownTags.size) {
    console.log(`\n⚠️ 未對應的官方標籤（需補進 fetch-set.cjs 的 TAG 表）:`);
    [...unknownTags].forEach(t => console.log('  #' + t));
  }
  if (needTranslation.length) {
    console.log(`\n⚠️ 缺譯名（需手動補 searchKeywords）:`);
    needTranslation.forEach(t => console.log('  ' + t));
  }
  if (skipped.length) {
    console.log(`\n⚠️ 以下 ${skipped.length} 張官方沿用原彈卡圖，entry 已建但**卡圖要手動複製進本彈資料夾**:`);
    skipped.forEach(s => console.log(`  ${s.file}.webp   ${s.from}/ → ${SET}/   (${s.name})`));
    console.log(`  一鍵複製（PowerShell）:`);
    console.log(`  $w="client/public/webpcards"; ` + skipped.map(s =>
      `cp "$w/${s.from}/${s.file}.webp" "$w/${SET}/"`).join('; '));
  }

  if (WRITE) {
    fs.writeFileSync(OUT, text, 'utf8');
    console.log(`\n✅ 已寫入 ${OUT}`);
  } else {
    console.log(`\n（預覽模式，加 --write 才會寫檔）`);
  }
})().catch(e => { console.error(e); process.exit(1); });
