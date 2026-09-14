# HoloTCG Online 維護備忘錄

## ⚠️ 待辦：Repo 整併收尾（2026-09-14 建立）

本專案原本的 GitHub repo `deck-api-server` 已改名為 **`holotcgtw_online`**
（https://github.com/TETSUNekko/holotcgtw_online）。本機這份資料夾的 `origin` 已同步改指向新網址，
本機資料夾也已改名為 `holotcgtw_online`（2026-09-15 確認）。

背景：盤點發現 GitHub 上有 4 個 holotcg 相關 repo，其中 3 個是廢棄舊版：

| Repo | 狀態 |
|---|---|
| `holotcgtw` | main 分支停在 2025-06-03（缺一堆新彈資料），但 `gh-pages` 分支目前仍是 `tetsunekko.github.io/holotcgtw` 實際服務來源 |
| `HoloTCG_UI` | Unity 專案，2 個 commit，只有 4 張卡圖當範例素材，完全被目前的 web 版取代 |
| `deckcode-server` | 陽春原型後端（純 JSON 檔存讀），功能已完全被本專案的 `deck-api-server/server.js` 取代 |

**執行時機**：等新網站（`holotcgtw_online` 這個 repo）部署好、確認程式碼跑起來都正常之後，再做以下清理，**不要現在做**：

1. GitHub 上刪除 3 個舊 repo：`holotcgtw`、`HoloTCG_UI`、`deckcode-server`
2. 本機同步刪掉對應的 3 個資料夾：`d:/GitHub/holotcgtw`、`d:/GitHub/HoloTCG_UI`、`d:/GitHub/deckcode-server`
3. **網址銜接**：目前網站掛在 `tetsunekko.github.io/holotcgtw/`（來自舊 `holotcgtw` repo 的 Pages）。`holotcgtw_online` 這個名字是暫時的（改名當下 `holotcgtw` 這個名字還被舊 repo 占用，不能重複）。等舊 `holotcgtw` repo 真的刪掉之後，可以考慮把 `holotcgtw_online` 再改名回 `holotcgtw`，把原本的網址拿回來；如果決定不搶回原網址，就需要在新 repo 設定 GitHub Pages 部署（目前 Pages 是用 `gh-pages` 分支跑的，`deploy.sh` 是現有的部署腳本，需要改成部署進自己的 repo 而不是推去外部的 `holotcgtw`）
4. 確認上述都完成後，才把這整段待辦刪掉

## 🖥️ 本機開發環境筆記（2026-09-14，系統碟重灌後補記）

系統碟重灌後，本機是空的，以下是重新跑起來時踩過的坑：

- **Node.js 完全沒裝**，要先裝（這台機器用 `winget install -e --id OpenJS.NodeJS.LTS`）。裝完新開的終端機才會吃到 PATH。
- 前端啟動：`cd client && npm install && npm run dev`，跑在 `http://localhost:5173/holotcgtw/`。
  `predev`/`prebuild` 會自動跑 `build:index` 重建 `imageIndex.json`——這個檔案內容通常不會真的變，只是換行符號（LF/CRLF）會被標記成有改動，**不用真的 commit 這個 diff**，`git restore` 掉即可。
- **前端預設打正式站 API**：`client/.env` 的 `VITE_API_BASE` 指向 Railway 正式站，本機開發模式下存牌組代碼、匯入 decklog 動到的都是**真實正式站資料庫**，不是本機隔離環境。要跑完全本機後端才需要另外準備一組 `DATABASE_URL`（見下方）。
- 後端（`deck-api-server/deck-api-server`）沒有 `DATABASE_URL` 環境變數就會直接噴錯拒絕啟動（2026-09-03 移除了寫死密碼的 fallback，見上方 commit ac191145），要在本機跑後端得自己設一組。
- 沒有安裝 `chromium-cli`，要用瀏覽器驗證畫面時改用 Playwright，寫一支簡單腳本 `page.goto()` + `screenshot()` 就夠。
- **已安裝工具（2026-09-15）**：Node.js v22（`H:\code\Node.js`）、Git、ImageMagick 7.1.1（`D:\OPNW-Tool\ImageMagick-7.1.1-Q16`，已在 PATH）、GitHub CLI `gh`（首次使用要 `gh auth login`）、Railway CLI（`npm i -g @railway/cli`，首次使用要 `railway login` + 在 `deck-api-server` 底下 `railway link`）、Playwright（全域安裝，Chromium 已下載，不寫進專案 package.json）。
- **後端 `npm install` 會卡在 `canvas` 編譯失敗**：舊的 `canvas` 套件 2026-04 已被 `@napi-rs/canvas` 取代（commit 87331e99），但當時沒從 package.json 移掉，Node 22 在 Windows 沒有預編譯檔。移除前暫時用 `npm install --ignore-scripts` 繞過。注意 **puppeteer 不能移**，`decklog-scraper.cjs`（匯入 decklog）要用。

## ☁️ Railway 正式站排錯（2026-09-15 事故紀錄）

**症狀**：網站輸入/輸出代碼、匯出圖片全部跳「無法讀取該代碼：Failed to fetch」，但 Railway 面板顯示 `production · 1/1 service online`。

**根因**：commit ac191145 移除了 `server.js` 寫死的資料庫網址 fallback，而 Railway 上**從來沒設過 `DATABASE_URL`**（以前一直靠寫死的那組在跑）。部署到新版後程式一啟動就拋錯結束。

**教訓與檢查方式**：
- **面板顯示 online 不代表程式活著**。程式死掉後請求只會到 Railway 閘道，回 502「Application failed to respond」，不帶 CORS header，所以瀏覽器只顯示 `Failed to fetch`；而且**不會留下任何請求 log**。
- 快速確認：`curl https://deck-api-server-production.up.railway.app/healthz`，正常要回 `{"ok":true,...}`，回 502 就是後端沒在跑。
- 看原因：Deck API Server → 服務 → Deployments → 最新一筆 **View logs** → **Deploy Logs**（不是 Build Logs）。正常啟動要看到：
  ```
  [DEBUG] DATABASE_URL set: true
  [DB] Table ready
  Deck server running on http://0.0.0.0:...
  ```
- `start()` 會**先等資料庫連上才 listen**，而 `pg` 預設沒有連線逾時。若 log 停在 `[DB] Table ready` 之前沒有報錯，就是卡在資料庫連線。

**`DATABASE_URL` 的設定位置**：
- 設在 **Deck API Server** 專案的服務 → **Variables**
- 值要用 **Deck Codes Database** 專案 Postgres 的 **`DATABASE_PUBLIC_URL`**——資料庫和 API 在**不同 Railway 專案**，內部網址連不到
- 換資料庫密碼後要記得同步更新這個變數
- ⚠️ 舊的資料庫密碼仍留在 git 歷史（ac191145 之前的 `server.js`），建議在 Postgres 重設密碼

**不要再把資料庫網址寫死回程式碼**。

## 官方卡圖自動同步工具（2026-07-03 新增，2026-08-18 補 fetch-set.cjs）

專案根目錄有數支配套腳本，取代過去手動從官網一張張下載比對的流程。
**新彈上線用 `fetch-set.cjs`，日常補漏用 `sync-cards.cjs`。**

### fetch-set.cjs — 新彈完整卡表（主力工具）
```bash
node fetch-set.cjs hEB01           # 預覽解析結果，不寫檔
node fetch-set.cjs hEB01 --write   # 產生 client/src/cardList_hEB01.json
```
從**官方卡表網站**爬整個商品的收錄清單，自動填卡名／顏色／HP／Bloom 等級／標籤／效果類型。

⚠️ **最重要的一個坑：必須用 `expansion_name` 不能用 `keyword`**
```
?expansion_name=hEB01     ← 正確：整個商品的收錄清單（含復刻卡）
?keyword=hEB01            ← 錯誤：只抓得到卡號開頭是 hEB01 的卡
```
新彈通常收錄大量**復刻卡**，它們的卡號是原本的（例如 `hBP01-021`），只是在新彈出了新圖
（`hEB01/hBP01-021_C_02.png`）。用 keyword 搜會整批漏掉。
2026-08-18 hEB01 第一次爬就踩到：只抓到 34 張自身卡，實際整彈 93 張。

腳本的其他行為：
- **復刻卡用「卡號」對既有資料**，不是比對卡名。因為官方與本站的漢字字形可能不同
  （官方 `兎田ぺこら` U+514E／本站 `兔田ぺこら` U+5154），比對名字會失敗。
  對到既有 entry 就沿用本站的 `name` 和 `searchKeywords`，字形與譯名自動保持一致。
- **沿用原彈卡圖的收錄卡，要把圖複製進本彈資料夾**。有些復刻卡官方沒出新圖，
  卡圖路徑仍指向原彈（例如 hEB01 收錄的 `hBP01-104` 圖是 `hBP01/hBP01-104_C.png`）。
  這種卡**還是要建 entry**，而且必須把 webp 複製一份到本彈資料夾，否則彈數篩選會漏掉它們
  —— 因為篩選是看「卡圖在哪個資料夾」(`card.folder === filterSeries`)，不是看 JSON。
  這也是本站既有慣例：`hBP01-104_C.webp` 同一個檔名複製在 10 個資料夾裡。
  腳本會列出要複製哪些檔案並附上一鍵複製指令。
  hEB01 有 9 張是這種（`hBP01-104/107/118`、`hBP02-079/095`、`hBP03-088`、
  `hBP04-105`、`hSD01-018`、`hSD06-011`），漏掉的話整彈會從 102 張變成 93 張。
- 標籤對應表 `TAG` 用的是**官方日文標籤原文**，容易猜錯，跑預覽會列出未對應的。
  已知易錯：`#トリ`→鳥、`#お酒`→酒、`#ベイビー`→嬰兒、`#シューター`→射手、`#こよラボ`→小夜璃實驗室
- 支援卡沒有前例可對時要手動補 `NAME_ZH` 表。**中文譯名直接讀 `webpcards/<彈>-trans/` 的翻譯圖**
  （鳳凰貓做的圖上就印著卡片中文名），不要自己猜。
- `hp` 會填官方實際數值（UI 沒用到，純 metadata，但有總比空白好）

### sync-cards.cjs — 比對並下載缺圖
```bash
node sync-cards.cjs             # dry-run：列出官方有、本地缺的卡圖
node sync-cards.cjs --download  # 下載 PNG 到 new_cards/（已 gitignore）並自動轉 webp 放進 webpcards/
```
- 資料來源：官方 decklog API `POST https://decklog.bushiroad.com/system/app/api/search/9`（免登入，需帶 Referer header），每頁 30 張分頁抓完
- 圖片 CDN：`https://hololive-official-cardgame.com/wp-content/images/cardlist/{資料夾}/{檔名}.png`
- 比對方式：**只比對檔名**（官方與本地資料夾名不一致，同卡可能在多個資料夾）
- 資料夾對應：官方 `hWF01`＝本地 `Twin_Wafer`、官方 `hCO01`＝本地 `2025Live_Set`（寫在腳本的 `FOLDER_ALIAS`）
- 轉檔依賴 ImageMagick（路徑寫在腳本開頭的 `MAGICK`）
- `sele` 開頭的教學卡會自動跳過

⚠️ **decklog API 的兩個盲點**（所以新彈不能只靠 sync-cards.cjs）：
1. **完全不收主推卡**。拿任何主推卡卡號去查都是 0 筆（`hSD01-001` 也一樣）。
   試過 `card_kind`／`deck_type` 等參數都被忽略，也找不到另外的端點。
2. **沒有顏色／標籤欄位**，只有不透明的 `p_param`／`g_param`。

官方卡表網站兩者都有，所以 `fetch-set.cjs` 走網站爬蟲而非 API。

### audit-cards.cjs — 拿官方卡表對帳全站資料（2026-08-18 新增）
```bash
node audit-cards.cjs               # 只回報差異
node audit-cards.cjs --fix-tags    # 補「官方有、我們沒有」的 tags
node audit-cards.cjs --fix-hp      # 補 hp 空白（不覆蓋已有數值）
node audit-cards.cjs --refetch     # 忽略快取重抓官方（約 171 頁、2 分鐘）
```
- 官方資料快取在 `.official-cards.json`（已 gitignore），改 `TAG` 對照表**不必重抓**
  （標籤是從快取的 `rawTags` 重算的）
- 報告分五段：① 缺漏 tags ② 多出來的 tags ③ type/grade/hp/color 不符
  ④ 官方查無此卡號 ⑤ 未對應的官方標籤
- **同一張卡「同時有缺又有多」會標 ⚠️ 且不自動補**——那通常是抄錯（例如期別寫錯），
  自動補只會變成兩個都在
- **第 ⑤ 段是零才代表第 ① 段可信**：對不到的官方標籤會被當成「官方沒有這個 tag」

⚠️ `TAG` 對照表在 `fetch-set.cjs` 和 `audit-cards.cjs` **各有一份，要同步改**。
2026-08-18 對帳抓出 4 個原本錯的對應：

| 原本以為 | 官方實際 | 本站標籤 |
|---|---|---|
| `#言語学` | `#語学` | 語言學 |
| `#白上の者` | `#白上'sキャラクター` | 白上的角色 |
| （無） | `#FLOW GLOW` | FLOW GLOW |
| （無） | `#カエラ'sアームズ` | 卡埃拉的武器 |

`#FLOW GLOW` 是個坑：**官方標籤含空白**，而解析用的 `#[^\s#]+` 遇到空白就斷，
只會切出 `FLOW`。所以對照表裡是 `'FLOW': 'FLOW GLOW'`。

### update-versions.cjs — 補 JSON 資料
```bash
node update-versions.cjs
```
- 掃描 webpcards 全部圖檔，把 JSON `versions` 缺少的版本自動併入（依 VERSION_ORDER 排序）
- 圖片所在資料夾若沒有對應 entry，**自動從其他彈數複製最豐富的一筆**（name/tags/effectType 都會帶過來）當 reprint entry
- 找不到任何基礎資料的卡會列出來，需手動建立
- 資料夾 → JSON 檔的對應寫在腳本的 `FOLDER_JSON`，**新增彈數時記得補這張表**

### process-images.ps1 — 翻譯圖裁切
翻譯圖是 1920x1080，取右半 1120x1080 輸出 webp。
```powershell
.\process-images.ps1 -InputFolder "C:\...\hEB01" -AutoRoute -DryRun   # 先看分流對不對
.\process-images.ps1 -InputFolder "C:\...\hEB01" -AutoRoute           # 實際輸出
```
`-AutoRoute` 依檔名自動分流到對應的 `<彈數>-trans` 資料夾：
```
hEB01-hBP01-021.jpg → hEB01-trans\hBP01-021.webp   （復刻卡：前綴=所在彈數，其餘=卡號）
hEB01-001.jpg       → hEB01-trans\hEB01-001.webp   （自身卡）
hBP04-001.jpg       → hBP04-trans\hBP04-001.webp   （散裝檔案依卡號歸位）
```
復刻卡要用**原始卡號**當檔名，是為了配合 `ZoomModal.jsx` 的查找順序：
```js
primary  = `webpcards/${entry.folder}-trans/${entry.id}.webp`   // 卡圖所在彈數
fallback = `webpcards/${id前綴}-trans/${entry.id}.webp`          // 卡片原始彈數
```
這樣復刻卡會優先吃到新彈版本的翻譯，沒有才 fallback 回原彈的舊翻譯。

⚠️ **這支檔案必須存成 UTF-8 with BOM**。PowerShell 5.1 讀 .ps1 預設當 ANSI(cp950)，
沒 BOM 的話裡面的中文會亂碼，導致字串沒收尾、整個檔案語法錯誤。
用別的編輯器改完記得確認編碼。

### 新彈 / 新卡圖標準流程
```bash
# 1. 卡表資料（新彈用這支，含主推卡與復刻卡）
node fetch-set.cjs <彈數>            # 先預覽，確認沒有「未對應標籤」「缺譯名」警告
node fetch-set.cjs <彈數> --write

# 2. 卡圖：官方 PNG → webp（Q=92 是 ImageMagick 預設值，與既有圖一致）
#    直接 magick in.png out.webp 即可，不用加參數

# 3. 翻譯圖
.\process-images.ps1 -InputFolder "<翻譯圖資料夾>" -AutoRoute

# 4. 補其他資料夾的版本（例如 hPR 的促銷版）
node update-versions.cjs

# 5. 索引 + 打包
cd client && npm run build:index
npm run build
# 然後 deploy（cd client/dist → git add/commit/push origin gh-pages）
```
全新資料夾（如 hEB01、hCS01）另需三處掛載：
1. `update-versions.cjs` 的 `FOLDER_JSON` 加對應
2. `cardsConfig.jsx` import 新 JSON 並加進 `cardSets`（放前面＝卡片列表排前面）
3. `SearchBar.jsx` 的 `SERIES_LIST` 加一筆

新標籤還要加進 `cardsConfig.jsx` 的 `allTags`，否則標籤篩選選單看不到。

### cardList JSON 的排列順序（2026-08-18 補記）

**JSON 陣列的順序 = 卡片列表的顯示順序。** `DeckBuilder.jsx` 用 `cardSets.flat()` 的 index
建 `folderOrderMap`，排序時直接吃這個順序，所以 JSON 怎麼排，畫面就怎麼出。

正確排列規則：

1. **先依卡片類型**：主推卡（Oshi）→ 角色卡（Member）→ 支援卡（Support）
2. **主推卡與角色卡再依顏色**：白 → 綠 → 紅 → 藍 → 紫 → 黃
   （`white → green → red → blue → purple → yellow`）
3. 支援卡不分顏色，依既有慣例照卡號排

顏色順序已從 hBP01~hBP08 全部 8 彈的實際資料驗證，8 彈完全一致，
並經確認無誤：**紫在黃前面**。

多色卡（例如 `["red","blue"]`）依既有資料是插在第一個顏色的區塊內。

`fetch-set.cjs` 產出時已直接照這個規則排序（步驟 5），新彈不需要再手動排。
`cardList_hEB01.json` 已於 2026-08-18 補排完成。

### 收工前跑一次健康檢查
用本文件最後的健檢腳本，兩個數字都要是 0：
- 孤兒圖片（有圖無索引）→ 忘了跑 `build:index`
- 版本錯誤（JSON versions 找不到對應圖）→ JSON 寫了不存在的版本，或圖還沒轉 webp

### 官方資料庫已知錯誤（sync-cards.cjs 內建黑名單）
- `hBP05/hBP02-085_HR.png`（2026-07-03 發現）：官方 decklog 的重複記錄，卡號掛 hBP02-085（HOLOLIVE FANTASY），
  圖片實際是 **hBP02-065 ネリッサ・レイヴンクロフト 的 HR 卡**（卡面右下角編號可證）。
  官方 API 中 hBP02-085 只有 U/S/P 版本，沒有 HR。
  誤下載會讓 ネリッサ 的圖繼承 HOLOLIVE FANTASY 的 LIMITED tag，出現在錯誤的篩選結果。
  已加入 sync-cards.cjs 的 `BLACKLIST`，若官方之後修正可移除。

### 生日卡（hBD）注意事項
生日卡**不在 decklog API 裡**（非構築合法卡），sync-cards.cjs 抓不到。
要用 `fetch-hbd24.cjs`：從官方卡表網站搜尋頁爬取
（`hololive-official-cardgame.com/cardlist/cardsearch/?keyword=hBD24&...&view=text`，有分頁），
自動下載圖檔＋建 JSON entry（color/譯名從同名主推卡複製）。
hBD25 出了之後把腳本裡的系列代號改掉重跑即可。
生日卡是全年陸續發售的，建議每隔幾個月跑一次確認有沒有新卡。

### API 額外用途
搜尋參數支援效果文字比對（`keyword_type: ["text"]`），可用來稽核資料缺漏，
例如搜「LIMITED」可以拿到官方完整限制卡清單，跟我們 JSON 的 tags 比對。
（2026-07-02 就是靠這個發現 6 張卡全部檔案都缺 LIMITED tag）

### 譯名變更的處理方式（2026-08-18 博衣こより 案例）
中文譯名改版時（`可佑理` → `小夜璃`），要動的地方有三處：
1. **tag**：`cardsConfig.jsx` 的 `allTags` + 各 cardList JSON 的 `tags`
2. **searchKeywords**：跨檔案散落各處，用腳本掃比較保險
3. **翻譯圖**：譯者重出的圖蓋掉舊檔（`process-images.ps1 -AutoRoute` 會自動歸位）

`searchKeywords` 的做法是**新譯名排前面、舊譯名保留在後**：
```json
["博衣こより", "博衣小夜璃", "博衣可佑理", "Hakui Koyori"]
```
直接取代會讓習慣舊稱呼的玩家搜不到，兩個都留沒有副作用。

同一角色的關聯字也要一起改：`AI可佑理`→`AI小夜璃`、`可佑理的助手君`→`小夜璃的助手君`。

---

## 2025-05-22 修復紀錄

### 修改內容

| 檔案 | 修改 |
|---|---|
| `client/src/cardList_hBP06.json` | hBP06-059 的 `versions` `_S.png` → `_SR.png`（版本名稱錯誤，實際圖檔為 `_SR`） |
| `client/src/cardList_hSD11.json` | hSD11-003 的 `versions` `_C.png` → `_C_re.png`（圖檔命名更新為 re 版） |
| `client/src/cardList_hSD11.json` | hSD11-004 的 `versions` `_U.png` → `_U_re.png`（同上） |
| `client/src/cardList_hSD14.json` | hSD14-010 的 `imageFolder` `hSD01/` → `hSD14/`（指向錯誤資料夾） |
| `client/src/cardList_PR.json` | hPR-002 的 `versions` 移除空的 `".png"` 條目 |
| `client/src/assets/imageIndex.json` | 執行 `npm run build:index` 重建，納入 2025Live_Set 的 8 張牌 |

### 2025Live_Set 問題原因
圖檔已放進 `client/public/webpcards/2025Live_Set/`，但 `imageIndex.json` 是自動產生的，需要手動執行 `npm run build:index` 才會更新。新增圖檔後記得重建。

---

## 系統架構說明

### imageIndex.json 的產生方式
- **腳本**：`client/scripts/build-image-index.cjs`
- **觸發時機**：`npm run dev` 和 `npm run build` 執行前會自動跑（`predev`/`prebuild`）
- **手動執行**：`cd client && npm run build:index`
- **掃描對象**：`client/public/webpcards/` 下所有非 `-trans` 資料夾的 `.webp`/`.png` 檔案
- **輸出**：`client/src/assets/imageIndex.json`（`byKey` + `versionsById`）

### 圖片命名規則
```
{卡片ID}{版本尾碼}.webp
例：hBP01-001_C.webp、hSD11-003_C_re.webp、hPR-002_P.webp
```

**已知版本尾碼**（在 `build-image-index.cjs` 的 `VERSION_ORDER` 定義排序）：
`_C`, `_C_2`, `_C_02`, `_U`, `_U_2`, `_U_02`, `_S`, `_S_02`, `_P`, `_P_1`, `_P_2`, `_P_3`, `_P_02`, `_R`, `_R_02`, `_RR`, `_RR_02`, `_SR`, `_UR`, `_HR`, `_SEC`

沒有尾碼的檔案（如 `hPR-002.webp`）會被視為 `_C` 版本。

### cardList JSON 的 `versions` 欄位
- 每個字串對應一個版本尾碼，格式為 `_XX.png`（帶副檔名）
- **不影響 UI 顯示**：實際顯示的版本由 `imageIndex.json` 的 `byKey` 決定，JSON 的 `versions` 僅作為 metadata 參考
- 因此 `versions` 填錯不會讓牌消失，但會造成 metadata 不一致

### 跨 Set 的復刻牌
卡片 ID 和 `imageFolder` 不同是**正常設計**，代表這張牌以不同圖在另一個 set 出現。例如：
- `hBP01-104` 在 `hSD11.json` 中 `imageFolder: hSD11/` → 使用 hSD11 資料夾內的圖

### 同卡號的 tags 只有一份（2026-08-18 釐清）
**同一個卡號的 tags 是固定的，不會因為收錄在哪一彈而不同。** 同角色但 tags 不同
（例如有沒有 `#夏季`）的是**不同卡號的不同卡**，不要混為一談。

目前 36 個 cardList JSON 共 1816 筆 entry、1262 個唯一卡號（**與官方卡表的卡號數完全相同**），
其中 554 筆是復刻重複。

### 2026-08-18 全站對帳結果（`audit-cards.cjs`）
**全部修完，四個項目現在都是 0。** 修正內容：

| 類型 | 筆數 | 內容 |
|---|---|---|
| tags 缺漏 | 22 | 最大宗是 hBP03 的 8 張支援卡 + hPR-002 漏 `#LIMITED`；hPR-001 さくらみこ 整組 tags 是空的 |
| hp 空白 | 683 | 幾乎都是 PR / TwinWafer 的復刻 entry |
| 期別抄錯 | 6 | hSD19-005~009 大空スバル 寫成 3期生/4期生 → **2期生**；hBP05-072 角巻わため 寫成 Gamers → **4期生** |
| grade 抄錯 | 5 | hBP02-025 大神ミオ（hBP02 + TwinWafer）、hBP03-032 赤井はあと、hBP06-079 大空スバル、hBP08-016 ときのそら 寫 debut → **1st** |
| hp 抄錯 | 3 | hBP01-023 ときのそら 110→**210**、hSD14-008 白上フブキ 160→**140**、hSD17-009 星街すいせい 180→**170** |
| color 抄錯 | 1 | hBD24-055 AZKi purple → **green**（手動改，見下方說明） |
| 自己加的 tags | 38 | 支援卡上加的主題標籤（`#歌`、`#Promise`、`#秘密結社holoX`、`#FLOW GLOW` 等），官方沒有 → **依指示全部刪除，先讓資料與官方一致**。之後若要重做「支援卡主題搜尋」，要另外設計一套自訂標籤機制，不要混進 `tags` 欄 |

**grade 那 4 張的根因查過了：沒有系統性原因，是各自獨立的抄寫錯誤。**
驗證方式：全站「官方 1st、且前一號是同角色 debut 卡」的組合共 127 張，只有這 4 張寫錯；
「有 `_S` 版本的角色卡」共 224 張也沒有相關性。1262 張裡錯 4 張 ≈ 0.3%。

⚠️ **color 不做自動修正**：官方頁面的色彩欄位只抓得到第一個 `<img alt>`，多色卡會漏掉其他顏色，
自動覆蓋等於把多色卡改成單色。所以 `audit-cards.cjs` 只回報 color 差異，要改請手動。

**新標籤上線時記得同步 `cardsConfig.jsx` 的 `allTags`**，否則篩選下拉選不到
（這次的 `卡埃拉的武器` 就是這種情況）。檢查指令：
```bash
node -e "const fs=require('fs'),p='client/src';const used=new Set();for(const f of fs.readdirSync(p).filter(x=>/^cardList_/.test(x)))for(const c of JSON.parse(fs.readFileSync(p+'/'+f,'utf8')))(Array.isArray(c.tags)?c.tags:[]).forEach(t=>used.add(t));const cfg=fs.readFileSync('client/src/components/cardsConfig.jsx','utf8');const listed=new Set(cfg.match(/export const allTags = \[([\s\S]*?)\];/)[1].match(/\"[^\"]+\"/g).map(x=>x.slice(1,-1)));console.log('資料有、選單沒有:',[...used].filter(t=>!listed.has(t)))"
```

**tags 來源**：官方卡表網站的 `view=text` 頁面有「タグ」欄（`fetch-set.cjs` 已在抓）；
**decklog API 沒有 tags 也沒有顏色**。

✅ 全站對帳已於 2026-08-18 執行完畢，見下方 `audit-cards.cjs`。

⚠️ **DeckBuilder 目前無法區分同卡號在不同彈的 tags**：[DeckBuilder.jsx](client/src/components/DeckBuilder/DeckBuilder.jsx)
的 `baseCardMap` 是用 **id 全域查「tags 最多的那一筆」**，不分 folder。所以只要任一彈
的 entry tags 較齊全，全部彈的同卡號都會吃到那一份。這也代表**復刻 entry 的
name / tags / hp / searchKeywords 實際上不會被顯示**——它們只提供 `imageFolder` 的排序位置。

---

## 組牌輔助功能（2026-08-18 新增）

### 篩選條件 ↔ 網址參數
[DeckBuilder.jsx](client/src/components/DeckBuilder/DeckBuilder.jsx) 的 9 個篩選狀態會同步到網址：
`?q=&type=&color=&grade=&series=&sub=&ver=&effect=&tag=`
例：`holotcgtw.com/?series=hBP08&color=blue&grade=1st`

- 等於預設值的參數**不寫進網址**，網址保持乾淨
- 用 `replaceState` 不是 `pushState`——搜尋框每打一個字都推歷史的話上一頁會按不完，
  代價是**上一頁不會回到前一個查詢**
- 新增篩選條件時要同時更新 `FILTER_DEFAULTS` 和寫回網址的那個 `useEffect`，兩邊都要加

### 起手機率 [OddsModal.jsx](client/src/components/DeckBuilder/OddsModal.jsx) + [odds.js](client/src/utils/odds.js)
超幾何分布，純前端。**不要求牌組滿 50 張**（跟「起手測試」不同，那個要求剛好 50），
未滿時以目前張數計算並在介面標註。

- `odds.js` 用**對數階乘**算組合數，直接算 C(50,7) 這種會爆 double
- 自我檢查：`node client/src/utils/odds.test.mjs`，改動 odds.js 後跑一次
- 目標可選 Bloom 階級 / 顏色 / 標籤 / 指定卡片，下拉**只列牌組裡真的有的**，
  避免選到永遠 0% 的選項

**多條件（最多 3 個）**用 `atLeastJoint()`，多變量超幾何分布。
關鍵是**同一張卡可能同時符合多個條件**（例如某張 debut 卡也帶 `#歌`），
所以先依「符合哪幾個條件」的 bitmask 把牌組切成**互斥的格子**再算，
不能把各條件的機率相乘，那會把重疊的卡重複計算。

演算法用 DP，並把「已滿足的張數」壓到需求上限（超過就不必再分辨）——
直接列舉每格抽幾張是 O(∏(count+1))，50 張牌會爆。
實測最壞情況（50 張抽 25、三條件、8 個格子）約 4ms。

`odds.test.mjs` 裡有容斥原理的手算對照，改動演算法後務必跑過。

### 正規牌組檢查 [deckCheck.js](client/src/utils/deckCheck.js)
**只提示、永不阻擋**——因為很多使用者是拿來查卡而不是組正規牌組。
底部「檢查」標籤點開才顯示清單，旁邊的「關閉檢查」可整組關掉（存 localStorage `deckCheck`）。

檢查的規則（只放官方明文的**構築**規則，不自己發明）：
- 主推卡 1 張、主卡組 50 張、能量卡 20 張
- 同一卡號最多 4 張（不同版本卡圖算同一張）；**能量卡不受此限**
- **エクストラ卡也不受 4 張上限**（卡面關鍵字「このホロメンはデッキに何枚でも入れられる」）

#### エクストラ卡清單 `client/src/unlimitedCards.json`
由 `audit-cards.cjs` 從官方卡表產生，2026-08-19 首次產出 **154 張**。

判斷依據是官方 HTML 的 **`<div class="extra">`** 區塊，**不能比對效果文字裡的「何枚でも」**——
有些卡只是在自己的效果文裡「提到」エクストラ卡，例如 hBP08-062 鷹嶺ルイ、
hBP08-091 クリエイターパソコン、hBP05-074 フレンドリーパソコン 都會誤判。
用官方的關鍵字搜尋 `keyword=エクストラ` 也不行，會連「エクストラブースター」這種收錄商品名一起撈到。

新彈上線後跑 `node audit-cards.cjs --refetch` 就會自動更新這份清單（有變動才寫檔）。
若某次抓到 0 張，腳本會保留舊檔不覆蓋——那通常代表官方頁面改版，要先確認 selector。

不檢查的：
- **LIMITED**——那是「1 回合只能用 1 張」的**使用**限制，不是構築限制
- 卡片顏色與主推的關係——不是構築規則

### 統計列
[DeckArea.jsx](client/src/components/DeckBuilder/DeckArea.jsx) 主卡組那一列已有 Bloom 階級
與支援卡分類，2026-08-18 補上**顏色配比**（多色卡每個顏色各算一次，所以總和會大於卡片數）。

---

## 新增卡片 SOP（手動流程，一般情況請優先用上方的自動同步工具）

### 1. 新增卡組
1. 在 `client/public/webpcards/{setName}/` 放入 `.webp` 圖檔
2. 在 `client/src/` 新增 `cardList_{setName}.json`，格式參考既有檔案
3. 在 `client/src/components/cardsConfig.jsx` import 新的 JSON，並加進 `cardSets` 陣列
4. **在 `client/src/components/SearchBar.jsx` 的 `SERIES_LIST` 加一筆**（否則彈數篩選器選不到這個新套組）
5. 執行 `cd client && npm run build:index` 重建索引

### 2. 新增已有卡組的新圖（復刻/新版本）
1. 把圖檔放進對應資料夾，命名格式：`{ID}_{版本}.webp`
2. 在對應 `cardList_*.json` 的 `versions` 陣列加入新版本
3. 執行 `npm run build:index`

---

## 定期健康檢查腳本

在專案根目錄執行以下指令可快速驗證系統狀態：

```bash
node -e "
const fs = require('fs');
const path = require('path');
const idx = JSON.parse(fs.readFileSync('client/src/assets/imageIndex.json', 'utf8'));
const byKey = idx.byKey || {};
const srcDir = 'client/src';
const webpDir = 'client/public/webpcards';

// 1. 找孤兒圖片（在磁碟上但不在 imageIndex）
const folders = fs.readdirSync(webpDir).filter(f =>
  fs.statSync(path.join(webpDir, f)).isDirectory() && !f.endsWith('-trans')
);
let orphans = [];
for (const folder of folders) {
  for (const file of fs.readdirSync(path.join(webpDir, folder)).filter(f => f.endsWith('.webp'))) {
    const rel = folder + '/' + file;
    if (!Object.values(byKey).includes(rel)) orphans.push(rel);
  }
}
console.log('孤兒圖片（有圖無索引）:', orphans.length);
orphans.forEach(f => console.log(' ', f));

// 2. 找索引中版本錯誤的卡（JSON versions 指向不存在的 key）
const jsonFiles = fs.readdirSync(srcDir).filter(f => f.startsWith('cardList_') && f.endsWith('.json'));
let broken = [];
for (const jf of jsonFiles) {
  for (const card of JSON.parse(fs.readFileSync(path.join(srcDir, jf), 'utf8'))) {
    const folder = (card.imageFolder || '').replace(/\/\$/, '');
    for (const v of (card.versions || [])) {
      const s = v.replace(/\.(png|webp)\$/, '');
      if (!s) continue;
      const key = card.id + s + '@' + folder;
      if (!byKey[key]) broken.push(card.id + ' ' + v + ' (' + jf + ')');
    }
  }
}
console.log('版本錯誤（JSON versions 找不到對應圖）:', broken.length);
broken.forEach(b => console.log(' ', b));
"
```

正常狀態：兩個數字都應為 **0**。
