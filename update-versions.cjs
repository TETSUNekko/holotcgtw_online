// update-versions.cjs — 掃描 webpcards 圖檔，把缺少的版本合併進 cardList JSON 的 versions；
// 圖片所在資料夾若沒有對應 entry，自動從其他彈數複製一份 reprint entry（沿用 name/tags 等資料）
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'client/src');
const WEBP_DIR = path.join(__dirname, 'client/public/webpcards');

const FOLDER_JSON = {
  hBP01: 'cardList_hBP01.json', hBP02: 'cardList_hBP02.json', hBP03: 'cardList_hBP03.json',
  hBP04: 'cardList_hBP04.json', hBP05: 'cardList_hBP05.json', hBP06: 'cardList_hBP06.json',
  hBP07: 'cardList_hBP07.json', hBP08: 'cardList_hBP08.json',
  hBP09: 'cardList_hBP09.json',
  hEB01: 'cardList_hEB01.json',
  hSD01: 'cardList_hSD01.json', hSD02: 'cardList_hSD02.json', hSD03: 'cardList_hSD03.json',
  hSD04: 'cardList_hSD04.json', hSD05: 'cardList_hSD05.json', hSD06: 'cardList_hSD06.json',
  hSD07: 'cardList_hSD07.json', hSD08: 'cardList_hSD08.json', hSD09: 'cardList_hSD09.json',
  hSD10: 'cardList_hSD10.json', hSD11: 'cardList_hSD11.json', hSD12: 'cardList_hSD12.json',
  hSD13: 'cardList_hSD13.json', hSD14: 'cardList_hSD14.json', hSD15: 'cardList_hSD15.json',
  hSD16: 'cardList_hSD16.json', hSD17: 'cardList_hSD17.json', hSD18: 'cardList_hSD18.json',
  hSD19: 'cardList_hSD19.json',
  hPR: 'cardList_PR.json', hBD24: 'cardList_hBD24.json', hYS01: 'cardList_hYS01.json',
  energy: 'cardList_hY.json', PC_Set: 'cardList_PC_Set.json',
  '2025Live_Set': 'cardList_2025Live_Set.json', Twin_Wafer: 'cardList_TwinWafer.json',
  hCS01: 'cardList_hCS01.json',
};

const VERSION_ORDER = ["_C","_C_2","_C_02","_02_C","_U","_U_2","_U_02","_S","_02_S","_S_02","_SY",
  "_P","_P_01","_P_02","_P_03","_P_2","_01_P","_02_P","_03_P",
  "_R","_R_02","_RR","_RR_02","_SR","_SR_02","_02_SR","_UR","_HR","_SEC","_OSR","_OUR"];
const vRank = v => { const i = VERSION_ORDER.indexOf(v); return i === -1 ? 900 : i; };
const sortVersions = arr => arr.sort((a, b) => {
  const va = a.replace('.png',''), vb = b.replace('.png','');
  return vRank(va) - vRank(vb) || va.localeCompare(vb);
});

// 讀所有 JSON
const jsonData = {}; // filename -> array
for (const f of new Set(Object.values(FOLDER_JSON))) {
  const p = path.join(SRC, f);
  jsonData[f] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
}

// 全域最豐富 base entry（tags 最多者優先，其次有 name 者）
const richest = new Map();
for (const arr of Object.values(jsonData)) {
  for (const c of arr) {
    const prev = richest.get(c.id);
    const score = e => (e.name ? 100 : 0) + (Array.isArray(e.tags) ? e.tags.length : 0);
    if (!prev || score(c) > score(prev)) richest.set(c.id, c);
  }
}

// 掃圖檔
const changed = new Set();
let merged = 0, cloned = 0;
const noBase = [];

for (const folder of fs.readdirSync(WEBP_DIR)) {
  if (folder.endsWith('-trans')) continue;
  const jsonFile = FOLDER_JSON[folder];
  if (!jsonFile) { console.log(`⚠️ 略過未對應資料夾: ${folder}`); continue; }
  const fp = path.join(WEBP_DIR, folder);
  if (!fs.statSync(fp).isDirectory()) continue;

  // folder 內 id -> [suffixes]
  const byId = {};
  for (const f of fs.readdirSync(fp)) {
    const m = f.match(/^(h[A-Za-z]+\d*-\d{3})(.*)\.webp$/);
    if (!m) continue;
    (byId[m[1]] ||= []).push((m[2] || '_C') + '.png');
  }

  const arr = jsonData[jsonFile];
  for (const [id, suffixes] of Object.entries(byId)) {
    let entry = arr.find(c => c.id === id && (c.imageFolder || '').replace(/\/$/, '') === folder);
    if (!entry) {
      const base = richest.get(id);
      if (!base) { noBase.push(`${folder}/${id}`); continue; }
      entry = { ...base, imageFolder: folder + '/', versions: [] };
      arr.push(entry);
      cloned++;
      changed.add(jsonFile);
    }
    if (!Array.isArray(entry.versions)) entry.versions = [];
    for (const s of suffixes) {
      if (!entry.versions.includes(s)) {
        entry.versions.push(s);
        merged++;
        changed.add(jsonFile);
      }
    }
    sortVersions(entry.versions);
  }
}

// 寫回（字串陣列壓成單行，符合現有格式）
const serialize = arr => {
  const body = arr.map(e => '  ' + JSON.stringify(e, null, 2).replace(/\n/g, '\n  ')).join(',\n');
  return ('[\n' + body + '\n]\n').replace(
    /\[\s+("(?:[^"\\]|\\.)*"(?:,\s+"(?:[^"\\]|\\.)*")*)\s+\]/g,
    (m, inner) => '[' + inner.replace(/,\s+/g, ', ') + ']'
  );
};

for (const f of changed) {
  fs.writeFileSync(path.join(SRC, f), serialize(jsonData[f]), 'utf8');
  console.log(`✏️ 已更新 ${f}`);
}

console.log(`\n合併 ${merged} 個版本、新增 ${cloned} 筆 reprint entry`);
if (noBase.length) {
  console.log(`\n⚠️ 以下卡片找不到任何基礎資料（需手動建立）:`);
  noBase.forEach(x => console.log('  ' + x));
}
