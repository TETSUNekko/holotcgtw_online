// src/components/DeckBuilder/DeckBuilder.jsx
import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { cardSets, allTags } from "../cardsConfig";
import { byKey, webpUrlFromKey, parseKey } from "../../utils/imageIndex";
import SearchBar from "../SearchBar";
import CardArea from "./CardArea";
import DeckArea from "./DeckArea";
import ZoomModal from "./ZoomModal";
import WelcomeModal from "./WelcomeModal";
import { sortDeckByType } from "../../utils/sort";
import { API_BASE, saveDeck, importDecklog, loadDeck } from "../../utils/api";
import { toKeys, loadCurrent, saveCurrent } from "../../utils/deckStorage";
import { Folder } from "lucide-react";
import DrawHandModal from "./DrawHandModal";
import OddsModal from "./OddsModal";
import MyDecksModal from "./MyDecksModal";

const folderRank = (f = "") => {
  if (/^hYS\d+$/i.test(f)) return 100;
  if (/^hBP\d+$/i.test(f)) return 200;
  if (/^hSD\d+$/i.test(f)) return 300;
  if (f === "hPR") return 400;
  if (f === "PC_Set") return 500;
  if (f === "energy") return 600;
  return 999;
};

// 篩選條件 ↔ 網址參數：可分享、重整不掉、搜尋引擎可收錄
// ponytail: 用 replaceState 不用 pushState —— 每次打字都推一筆歷史會讓上一頁按不完
const FILTER_DEFAULTS = {
  q: "", type: "全部", color: "全部顏色", grade: "全部階級", series: "全部彈數",
  sub: "全部", ver: "全部版本", effect: "全部效果", tag: "全部標籤",
};
const urlParam = (k) => new URLSearchParams(window.location.search).get(k) ?? FILTER_DEFAULTS[k];

function DeckBuilder() {
  // ── 狀態 ────────────────────────────────────────────────
  const [zoomImageUrl, setZoomImageUrl] = useState("");
  const [zoomCard, setZoomCard] = useState(null);
  const [zoomIndex, setZoomIndex] = useState(null);
  const [oshiCards, setOshiCards] = useState([]);
  const [deckCards, setDeckCards] = useState([]);
  const [energyCards, setEnergyCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState(() => urlParam("q"));
  const [filterType, setFilterType] = useState(() => urlParam("type"));
  const [filterColor, setFilterColor] = useState(() => urlParam("color"));
  const [filterGrade, setFilterGrade] = useState(() => urlParam("grade"));
  const [filterSeries, setFilterSeries] = useState(() => urlParam("series"));
  const [supportSubtype, setSupportSubtype] = useState(() => urlParam("sub"));
  const [filterVersion, setFilterVersion] = useState(() => urlParam("ver"));
  const [filterEffect, setFilterEffect] = useState(() => urlParam("effect"));
  const [selectedTag, setSelectedTag] = useState(() => urlParam("tag"));
  const [shareCode, setShareCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [deckVisible, setDeckVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDrawHand, setShowDrawHand] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  const [showMyDecks, setShowMyDecks] = useState(false);

  // 拖拉分隔線
  const [cardPanelWidth, setCardPanelWidth] = useState(58); // 百分比
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const mainRef = useRef(null);
  const deckRef = useRef(null);
  const dividerCleanup = useRef(null);

  //手機板隱藏牌組區
  const [isMobile, setIsMobile] = useState(window.innerWidth < 620);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 620);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // 篩選條件變動時寫回網址（等於預設值的就不寫，網址保持乾淨）
  useEffect(() => {
    const cur = { q: searchTerm, type: filterType, color: filterColor, grade: filterGrade,
      series: filterSeries, sub: supportSubtype, ver: filterVersion, effect: filterEffect, tag: selectedTag };
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(cur)) {
      if (v === FILTER_DEFAULTS[k]) sp.delete(k); else sp.set(k, v);
    }
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [searchTerm, filterType, filterColor, filterGrade, filterSeries, supportSubtype, filterVersion, filterEffect, selectedTag]);

  // ── 卡片資料（memoized，不隨 state 重算）────────────────
  const allCards = useMemo(() => {
    const rawCards = cardSets.flat();
    const uniqueCardMap = new Map();
    rawCards.forEach((card, index) => {
      const key = `${card.id}-${(card.versions || []).join(",")}`;
      if (!uniqueCardMap.has(key)) {
        uniqueCardMap.set(key, { ...card, sortType: card.grade || card.type, _order: index });
      }
    });
    return Array.from(uniqueCardMap.values());
  }, []);

  const indexedCards = useMemo(() => {
    // 建立 id -> 全域順序 的對應表
    const orderMap = new Map(allCards.map(c => [c.id, c._order]));
    // 建立 id@folder -> 該 folder 內的順序 的對應表
    const folderOrderMap = new Map();
    cardSets.flat().forEach((card, index) => {
      const folder = (card.imageFolder || "").replace(/\/$/, "");
      folderOrderMap.set(`${card.id}@${folder}`, index);
    });

    // 建立 id -> 最豐富的 card 資料（優先選有 tags 的版本，避免 reprint 版 tags:"" 蓋掉正確的）
    const baseCardMap = new Map();
    allCards.forEach(c => {
      const prev = baseCardMap.get(c.id);
      const prevTagCount = Array.isArray(prev?.tags) ? prev.tags.length : 0;
      const newTagCount = Array.isArray(c.tags) ? c.tags.length : 0;
      if (!prev || newTagCount > prevTagCount) baseCardMap.set(c.id, c);
    });

    return Object.entries(byKey)
      .map(([key]) => {
        const [idVer, folder] = key.split("@");
        const match = idVer.match(/^(h[A-Za-z]+[0-9]*-\d{3})(.*)$/);
        if (!match) return null;
        const id = match[1];
        const version = match[2] || "_C";
        const baseCard = baseCardMap.get(id) || {};
        return { id, version, folder, key, path: webpUrlFromKey(key), ...baseCard };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // 優先用 id@folder 的順序，確保重刷卡依照所在 set 的 JSON 順序排列
        const orderA = folderOrderMap.get(`${a.id}@${a.folder}`) ?? orderMap.get(a.id) ?? 99999;
        const orderB = folderOrderMap.get(`${b.id}@${b.folder}`) ?? orderMap.get(b.id) ?? 99999;
        if (orderA !== orderB) return orderA - orderB;
        return a.version.localeCompare(b.version);
      });
  }, [allCards]);

  // ── 過濾（memoized，只在篩選條件變動時重算）─────────────
  const filteredCards = useMemo(() => {
    const seen = new Set();
    const q = searchTerm.toLowerCase(); // 迴圈外算一次，別在 2000+ 筆裡重算
    return indexedCards.filter((card) => {
      const isEnergy = card.folder === "energy" || card.type === "Energy";
      const matchType =
        filterType === "全部" ||
        card.type === filterType ||
        (filterType === "Energy" && isEnergy);
      const matchSearch =
        (card.id + (card.version || '')).toLowerCase().includes(q) ||
        (card.name && card.name.toLowerCase().includes(q)) ||
        (card.searchKeywords && card.searchKeywords.some(k => k.toLowerCase().includes(q)));
      const matchColor = filterColor === "全部顏色" || (Array.isArray(card.color) && card.color.includes(filterColor));
      const matchGrade = filterGrade === "全部階級" || card.grade === filterGrade;
      const matchSubtype = supportSubtype === "全部" || (Array.isArray(card.searchKeywords) && card.searchKeywords.includes(supportSubtype));
      const matchTag = !selectedTag || selectedTag === "全部標籤" || (Array.isArray(card.tags) && card.tags.includes(selectedTag));
      const matchSeries = filterSeries === "全部彈數" || card.folder === filterSeries;
      const matchVersion = filterVersion === "全部版本" || card.version === filterVersion;
      const matchEffect = filterEffect === "全部效果" || card.effectType === filterEffect;
      if (!(matchType && matchSearch && matchColor && matchGrade && matchSubtype && matchTag && matchSeries && matchVersion && matchEffect)) return false;
      const k = `${card.id}|${card.version}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [indexedCards, searchTerm, filterType, filterColor, filterGrade, filterSeries, filterVersion, filterEffect, supportSubtype, selectedTag]);

  // ── 加入卡片 ─────────────────────────────────────────────
  const handleAddCard = useCallback((card, version) => {
    const safeVersion = (version || card.version || "_C").replace(".png", "");
    const key = `${card.id}${safeVersion}@${card.folder}`;
    const newCard = { ...card, version, folder: card.folder, key };

    if (card.type === "Oshi") {
      setOshiCards(prev => [...prev, newCard]);
    } else if (card.type === "Energy") {
      setEnergyCards(prev => [...prev, newCard]);
    } else {
      setDeckCards(prev => sortDeckByType([...prev, newCard]));
    }
  }, []);

  // ── Zoom ─────────────────────────────────────────────────
  const handleZoom = useCallback((url, cardData, index) => {
    setZoomImageUrl(url);
    setZoomCard(cardData);
    setZoomIndex(index);
  }, []);

  const showAdjacentCard = useCallback((direction) => {
    if (zoomIndex == null) return;
    const newIndex = zoomIndex + direction;
    if (newIndex >= 0 && newIndex < filteredCards.length) {
      const next = filteredCards[newIndex];
      const imgSrc = next.key ? webpUrlFromKey(next.key) : null;
      setZoomImageUrl(imgSrc || null);
      setZoomCard(next);
      setZoomIndex(newIndex);
    }
  }, [zoomIndex, filteredCards]);
  // 預載相鄰卡片的卡圖與翻譯圖：翻譯圖比卡圖大不少，先抓起來放瀏覽器快取，
  // 按左右箭頭翻卡時就不會再等一次下載。
  useEffect(() => {
    if (zoomIndex == null) return;
    const base = import.meta.env.BASE_URL || "/";
    for (const d of [1, -1]) {
      const n = filteredCards[zoomIndex + d];
      if (!n?.key) continue;
      const urls = [webpUrlFromKey(n.key)];
      const e = parseKey(n.key);
      if (e) urls.push(`${base}webpcards/${e.folder}-trans/${e.id}.webp`);
      for (const u of urls) { if (u) new Image().src = u; }
    }
  }, [zoomIndex, filteredCards]);


  // ── 匯出代碼 ─────────────────────────────────────────────
  const groupByCard = useCallback((cards) => {
    const map = new Map();
    for (const c of cards) {
      if (!c.key) continue;
      if (!map.has(c.key)) map.set(c.key, { key: c.key, count: 0 });
      map.get(c.key).count++;
    }
    return Array.from(map.values());
  }, []);

  const handleExportCode = useCallback(async () => {
    const payload = {
      oshi: groupByCard(oshiCards),
      deck: groupByCard(deckCards),
      energy: groupByCard(energyCards),
    };
    try {
      const { code } = await saveDeck(payload);
      setShareCode(code);
      // 回傳連結而不是純代碼：貼到 Discord / X 會顯示牌組預覽圖
      return `${API_BASE}/d/${code}`;
    } catch {
      alert("❌ 匯出失敗");
      return null;
    }
  }, [oshiCards, deckCards, energyCards, groupByCard]);

  // ── 匯出圖片 ─────────────────────────────────────────────
  const handleExportImage = useCallback(async () => {
    setExporting(true);
    try {
      const payload = {
        oshi: groupByCard(oshiCards),
        deck: groupByCard(deckCards),
        energy: groupByCard(energyCards),
      };
      const res = await fetch(`${API_BASE}/export-deck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("後端匯出失敗");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const previewWindow = window.open("", "_blank");
      if (!previewWindow) { alert("❌ 預覽視窗被瀏覽器阻擋，請允許本站彈出視窗再試一次"); return; }
      previewWindow.document.open();
      previewWindow.document.write(`
        <html><head><title>Deck Export</title>
        <style>body{margin:0;background:#1a1625;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;overflow:auto;}
        img{max-width:100%;height:auto;object-fit:contain;display:block;}</style></head>
        <body><img src="${url}" /></body></html>
      `);
      previewWindow.document.close();
    } catch (err) {
      console.error(err);
      alert("❌ 匯出失敗，請檢查 console");
    } finally {
      setExporting(false);
    }
  }, [oshiCards, deckCards, energyCards, groupByCard]);

  // ── 匯入代碼 ─────────────────────────────────────────────
  // 代碼匯入與本機存檔共用：把 [{key}] / [{id,version,count}] 還原成完整卡片物件
  const attachCardData = useCallback((list) =>
    list.flatMap((item) => {
      const { key, id, version, count } = typeof item === "string" ? { key: item } : item;
      let matchKey = key;
      if (!matchKey && id && version) {
        const candidate = `${id}${version}`;
        matchKey = Object.keys(byKey).find(k => k.startsWith(candidate));
        if (!matchKey) {
          for (const v of [`${version}_U`, `${version}_C`]) {
            matchKey = Object.keys(byKey).find(k => k.startsWith(`${id}${v}`));
            if (matchKey) break;
          }
        }
        if (!matchKey) return [];
      }
      const entry = parseKey(matchKey);
      if (!entry) return [];
      const baseCard = allCards.find(c => c.id === entry.id) || {};
      return Array.from({ length: count || 1 }, () => ({
        ...baseCard, id: entry.id, version: entry.version,
        folder: entry.folder, key: matchKey,
        filename: `${entry.id}${entry.version}.png`,
        path: webpUrlFromKey(matchKey),
      }));
    }), [allCards]);

  // 進站還原：網址帶 ?code= 優先（別人分享的連結），否則還原上次編輯的內容
  const restored = useRef(false);
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("code");
    if (shared) {
      setShareCode(shared);
      loadDeck(shared)
        .then(data => {
          setOshiCards(attachCardData(data.oshi || []));
          setDeckCards(sortDeckByType(attachCardData(data.main || data.deck || [])));
          setEnergyCards(attachCardData(data.energy || []));
        })
        .catch(() => alert("❌ 這個分享連結的牌組讀不到，可能已過期（代碼保存 90 天）"))
        .finally(() => { restored.current = true; });
      return;
    }
    const saved = loadCurrent();
    if (saved) {
      setOshiCards(attachCardData(saved.oshi || []));
      setDeckCards(sortDeckByType(attachCardData(saved.deck || [])));
      setEnergyCards(attachCardData(saved.energy || []));
    }
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 牌組一有變動就寫回暫存
  // ponytail: 還原完成前不寫，否則掛載當下的空牌組會先把暫存洗掉
  useEffect(() => {
    if (!restored.current) return;
    saveCurrent({ oshi: toKeys(oshiCards), deck: toKeys(deckCards), energy: toKeys(energyCards) });
  }, [oshiCards, deckCards, energyCards]);

  const handleImportCode = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      if (shareCode.length === 5 && !shareCode.includes("-")) {
        data = await importDecklog(shareCode);
      } else {
        data = await loadDeck(shareCode);
      }
      setOshiCards(attachCardData(data.oshi || []));
      setDeckCards(attachCardData(data.main || data.deck || []));
      setEnergyCards(attachCardData(data.energy || []));
      alert("✅ 匯入成功");
    } catch (error) {
      alert(`❌ 無法讀取該代碼：${error.message || "不明錯誤"}`);
    } finally {
      setLoading(false);
    }
  }, [shareCode, attachCardData]);

  // ── 拖拉分隔線 ───────────────────────────────────────────
  useEffect(() => {
    return () => { if (dividerCleanup.current) dividerCleanup.current(); };
  }, []);

  const handleDividerMouseDown = useCallback((e) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = cardPanelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (e) => {
      if (!isDragging.current || !mainRef.current) return;
      const totalWidth = mainRef.current.offsetWidth;
      const delta = e.clientX - dragStartX.current;
      const newPct = Math.min(Math.max(dragStartWidth.current + (delta / totalWidth) * 100, 25), 78);
      setCardPanelWidth(newPct);
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      dividerCleanup.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    dividerCleanup.current = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [cardPanelWidth]);

  const allImageFolders = useMemo(() => Array.from(new Set(
    allCards.map(c => (c.imageFolder || "").replace(/^\//, "").replace(/\/$/, "")).filter(Boolean)
  )), [allCards]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", maxHeight: "100vh",
      background: "#1a1625",
    }}>
      {/* 搜尋列 */}
      <SearchBar
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        filterType={filterType} setFilterType={setFilterType}
        filterColor={filterColor} setFilterColor={setFilterColor}
        filterGrade={filterGrade} setFilterGrade={setFilterGrade}
        filterSeries={filterSeries} setFilterSeries={setFilterSeries}
        supportSubtype={supportSubtype} setSupportSubtype={setSupportSubtype}
        shareCode={shareCode} setShareCode={setShareCode}
        filterVersion={filterVersion} setFilterVersion={setFilterVersion}
        filterEffect={filterEffect} setFilterEffect={setFilterEffect}
        selectedTag={selectedTag} setSelectedTag={setSelectedTag}
        allTags={allTags} loading={loading}
        onExportImage={handleExportImage} exporting={exporting}
        onExportCode={handleExportCode}
        onImportCode={handleImportCode}
        onClearDeck={() => {
          if (window.confirm("確定要清空整副牌組嗎？")) {
            setOshiCards([]); setDeckCards([]); setEnergyCards([]); setShareCode("");
          }
        }}
        deckCount={deckCards.length}
        onDrawHand={() => setShowDrawHand(true)}
        onOdds={() => setShowOdds(true)}
        onMyDecks={() => setShowMyDecks(true)}
      />

      {/* 主區域 */}
      <div ref={mainRef} style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* 卡片區 */}
        <div style={{ width: isMobile ? "100%" : `${cardPanelWidth}%`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <CardArea
            filteredCards={filteredCards}
            filterSeries={filterSeries}
            filterVersion={filterVersion}
            onAddCard={handleAddCard}
            onZoom={handleZoom}
            allFolders={allImageFolders}
          />
        </div>

        {/* 拖拉分隔線 */}
        {!isMobile && (
        <div
          onMouseDown={handleDividerMouseDown}
          style={{
            width: "6px", flexShrink: 0,
            background: "#1a1625", cursor: "col-resize",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderLeft: "1px solid #2d2440", borderRight: "1px solid #2d2440",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#2d2440"}
          onMouseLeave={e => e.currentTarget.style.background = "#1a1625"}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ width: "2px", height: "2px", borderRadius: "50%", background: "#4a3f5c" }} />
            ))}
          </div>
        </div>
        )}

        {/* 牌組區 - 手機隱藏容器，但 DeckArea 本身永遠 render */}
        {!isMobile ? (
          <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
            <DeckArea
              ref={deckRef}
              oshiCards={oshiCards} deckCards={deckCards} energyCards={energyCards}
              setOshiCards={setOshiCards} setDeckCards={setDeckCards} setEnergyCards={setEnergyCards}
              filteredCards={filteredCards}
              onZoom={handleZoom}
              deckVisible={deckVisible}
              allFolders={allImageFolders}
            />
          </div>
        ) : (
          <DeckArea
            ref={deckRef}
            oshiCards={oshiCards} deckCards={deckCards} energyCards={energyCards}
            setOshiCards={setOshiCards} setDeckCards={setDeckCards} setEnergyCards={setEnergyCards}
            filteredCards={filteredCards}
            onZoom={handleZoom}
            deckVisible={deckVisible}
            allFolders={allImageFolders}
          />
        )}
      </div>

      {/* Zoom 彈窗 */}
      {zoomCard && (
        <ZoomModal
          card={zoomCard} imageUrl={zoomImageUrl}
          onClose={() => { setZoomImageUrl(""); setZoomCard(null); }}
          onPrev={() => showAdjacentCard(-1)}
          onNext={() => showAdjacentCard(1)}
        />
      )}

      {/* 歡迎彈窗 */}
      <WelcomeModal show={showWelcome} onClose={() => setShowWelcome(false)} />

      {/* 手機浮動按鈕 */}
      {!showWelcome && !zoomCard && isMobile && (
        <button
          onClick={() => setDeckVisible(!deckVisible)}
          style={{
            position: "fixed", bottom: "24px", right: "24px",
            zIndex: 9999, background: "#3d2d55",
            border: "1px solid #6b3fa0", color: "#e9d5ff",
            borderRadius: "50%", width: "60px", height: "60px",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            cursor: "pointer",
          }}
        >
          {deckVisible
            ? <><span style={{ fontSize: "20px" }}>✕</span><span style={{ fontSize: "9px", marginTop: "2px" }}>收起</span></>
            : <><Folder size={20} /><span style={{ fontSize: "9px", marginTop: "2px" }}>我的牌組</span></>
          }
        </button>
      )}

      {showDrawHand && (
        <DrawHandModal
          deckCards={deckCards}
          onClose={() => setShowDrawHand(false)}
          onZoom={handleZoom}
        />
      )}

      {showOdds && (
        <OddsModal deckCards={deckCards} onClose={() => setShowOdds(false)} />
      )}

      {showMyDecks && (
        <MyDecksModal
          current={{ oshi: toKeys(oshiCards), deck: toKeys(deckCards), energy: toKeys(energyCards) }}
          onLoad={(d) => {
            setOshiCards(attachCardData(d.oshi || []));
            setDeckCards(sortDeckByType(attachCardData(d.deck || [])));
            setEnergyCards(attachCardData(d.energy || []));
          }}
          onClose={() => setShowMyDecks(false)}
        />
      )}
    </div>
  );
}

export default DeckBuilder;