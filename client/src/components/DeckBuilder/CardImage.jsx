// src/components/DeckBuilder/CardImage.jsx
import React, { useState, useEffect } from "react";
import { ZoomIn } from "lucide-react";
import { webpUrlFromKey, ensureVersion } from "../../utils/imageIndex";

const warningMap = {
  //"hBP01-010": "限制卡（一副牌中只能有一張）",
  //"hBP01-014": "限制卡（一副牌中只能有一張）",
  "hBP01-030": "限制卡（一副牌中只能有一張）",
  "hBP07-101": "限制卡（一副牌中只能有一張）",
};

// 本次瀏覽已載入過的圖（在瀏覽器快取裡），再次出現時不必延遲
const loadedUrls = new Set();
const DEFER_MS = 150;

// deferLoad：卡片要在畫面上停留 DEFER_MS 才開始下載。
// 快速捲動時一閃而過的卡不會發出請求——Chrome 不會取消已移出 DOM 的圖片下載，
// 這些請求會排在佇列前面，讓真正停下來那一頁的圖等很久。
export default function CardImage({ card, version, className, style, onZoom, onClick, deferLoad = false }) {
  const safeVersion = ensureVersion(version || card.version);
  const imgSrc = card.key ? webpUrlFromKey(card.key) : null;
  const [ready, setReady] = useState(() => !deferLoad || loadedUrls.has(imgSrc));
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setReady(true), DEFER_MS);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
      onClick={() => onClick && onClick(card, safeVersion)}
    >
      {imgSrc && !ready ? (
        <div style={{ width: "100%", height: "100%", background: "#2a2240" }} />
      ) : imgSrc ? (
        <img
          src={imgSrc}
          alt={card.id}
          loading="lazy"
          onLoad={() => loadedUrls.add(imgSrc)}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      ) : (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#2a2240", fontSize: "11px", color: "#4a3f5c",
        }}>
          缺圖
        </div>
      )}

      {/* 放大鏡按鈕 */}
      <button
        style={{
          position: "absolute", top: 0, left: 0,
          padding: "2px", color: "white",
          background: "rgba(0,0,0,0.5)", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center",
          borderRadius: "0 0 4px 0",
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (imgSrc && onZoom) onZoom(imgSrc, card);
        }}
      >
        <ZoomIn size={14} />
      </button>

      {/* 限制卡提示 */}
      {warningMap[card.id] && (
        <div style={{ position: "absolute", top: "2px", right: "2px" }}>
          <div
            style={{
              width: "16px", height: "16px",
              background: "#f0c060", color: "#412402",
              fontSize: "10px", fontWeight: 700,
              borderRadius: "3px 3px 0 3px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title={warningMap[card.id]}
          >
            !
          </div>
        </div>
      )}
    </div>
  );
}