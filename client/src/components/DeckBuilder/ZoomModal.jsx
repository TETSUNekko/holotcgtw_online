// src/components/DeckBuilder/ZoomModal.jsx
import { parseKey } from "../../utils/imageIndex";
import React, { useEffect, useState } from "react";

function ZoomModal({ card, imageUrl, onClose, onPrev, onNext }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showTranslated, setShowTranslated] = useState(true);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // 每次換卡時重置翻譯圖狀態
  useEffect(() => {
    setShowTranslated(true);
  }, [card?.key]);

  // 卡圖 400x559、翻譯圖 1120x1080，原始尺寸差很多。
  // 兩邊共用同一個高度才不會一大一小；上限 620px 是避免 559px 的卡圖被放大到糊掉。
  const IMG_H = "min(74vh, 620px)";

  if (!card || !imageUrl) return null;

  const entry = card.key ? parseKey(card.key) : null;
  const base = import.meta.env.BASE_URL || "/";
  let primary = null;
  let fallback = null;

  if (entry) {
    primary = `${base}webpcards/${entry.folder}-trans/${entry.id}.webp`;
    const prefix = entry.id.split("-")[0];
    fallback = `${base}webpcards/${prefix}-trans/${entry.id}.webp`;
  }

  const handleError = (e) => {
    if (primary && fallback && !e.currentTarget.dataset.fallback) {
      e.currentTarget.dataset.fallback = "true";
      e.currentTarget.src = fallback;
    } else {
      setShowTranslated(false);
    }
  };

  const cardId = card.id || "";
  const rutenUrl = `https://www.ruten.com.tw/find/?q=${encodeURIComponent(cardId)}`;
  const shopeeUrl = `https://shopee.tw/search?keyword=${encodeURIComponent(cardId)}`;

  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    if (!imageUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      // 轉成 PNG（如果原本是 webp 也統一存成 .png 副檔名）
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cardId}${card.version || ""}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("下載失敗，請稍後再試");
    } finally {
      setDownloading(false);
    }
  };

  const shopBtnStyle = (mobile) => ({
    display: "inline-flex", alignItems: "center", gap: mobile ? "4px" : "6px",
    padding: mobile ? "7px 12px" : "10px 22px",
    borderRadius: "20px",
    fontSize: mobile ? "12px" : "15px",
    fontWeight: 600, cursor: "pointer",
    border: "1.5px solid", textDecoration: "none",
    whiteSpace: "nowrap",
  });

  const buttons = (mobile) => cardId && (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{
          ...shopBtnStyle(mobile),
          borderColor: "#6b3fa0",
          color: downloading ? "#4a3f5c" : "#c084fc",
          background: "rgba(107,63,160,0.12)",
          cursor: downloading ? "not-allowed" : "pointer",
          opacity: downloading ? 0.6 : 1,
        }}
      >
        {downloading ? "⏳" : "⬇"} {mobile ? "下載" : "下載圖片"}
      </button>
      <a href={rutenUrl} target="_blank" rel="noopener noreferrer"
        style={{ ...shopBtnStyle(mobile), borderColor: "#e05c2a", color: "#f87c4a", background: "rgba(224,92,42,0.12)" }}
        onClick={e => e.stopPropagation()}
      >
        🛒 {mobile ? "露天" : "露天查卡"}
      </a>
      <a href={shopeeUrl} target="_blank" rel="noopener noreferrer"
        style={{ ...shopBtnStyle(mobile), borderColor: "#e05c2a", color: "#f87c4a", background: "rgba(224,92,42,0.12)" }}
        onClick={e => e.stopPropagation()}
      >
        🛍 {mobile ? "蝦皮" : "蝦皮查卡"}
      </a>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      {isMobile ? (
        /* ── 手機版：左原圖、右(翻譯圖+按鈕)，垂直置中 ── */
        <div
          style={{
            display: "flex", flexDirection: "row", alignItems: "center",
            gap: "8px", padding: "52px 8px 16px", width: "100%",
            height: "100%", boxSizing: "border-box",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* 左欄：原圖 */}
          <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center" }}>
            <img src={imageUrl} alt="原圖"
              style={{ width: "100%", objectFit: "contain", borderRadius: "8px", maxHeight: "80vh" }}
            />
          </div>
          {/* 右欄：翻譯圖 + 按鈕 */}
          <div style={{
            flex: "1 1 0", minWidth: 0,
            display: "flex", flexDirection: "column", justifyContent: "center",
            alignItems: "center", gap: "8px",
          }}>
            {primary && showTranslated && (
              <img src={primary} alt="翻譯圖"
                style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: "8px" }}
                onError={handleError}
              />
            )}
            {buttons(true)}
          </div>
        </div>
      ) : (
        /* ── 桌面版：左原圖，右翻譯圖＋按鈕 ── */
        <div
          style={{
            display: "flex", flexDirection: "row",
            alignItems: "center",
            gap: "16px", padding: "24px 40px",
            boxSizing: "border-box", overflow: "auto",
            maxHeight: "100vh",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <img src={imageUrl} alt="原圖"
            style={{ flex: "0 0 auto", height: IMG_H, width: "auto", maxWidth: "40vw", objectFit: "contain", borderRadius: "8px" }}
          />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", flex: "0 0 auto" }}>
            {primary && showTranslated && (
              <img src={primary} alt="翻譯圖"
                style={{ height: IMG_H, width: "auto", maxWidth: "48vw", objectFit: "contain", borderRadius: "8px" }}
                onError={handleError}
              />
            )}
            {buttons(false)}
          </div>
        </div>
      )}

      {/* 左箭頭 */}
      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          style={{
            position: "fixed", left: "12px", top: "50%",
            transform: "translateY(-50%)",
            fontSize: "26px", color: "white",
            background: "rgba(0,0,0,0.45)", border: "none",
            borderRadius: "8px", padding: "8px 12px",
            cursor: "pointer", zIndex: 10001,
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.75)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.45)"}
        >←</button>
      )}

      {/* 右箭頭 */}
      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          style={{
            position: "fixed", right: "12px", top: "50%",
            transform: "translateY(-50%)",
            fontSize: "26px", color: "white",
            background: "rgba(0,0,0,0.45)", border: "none",
            borderRadius: "8px", padding: "8px 12px",
            cursor: "pointer", zIndex: 10001,
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.75)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.45)"}
        >→</button>
      )}

      {/* 關閉按鈕 */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "fixed", top: "16px", right: "16px",
          zIndex: 10001, background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "white", borderRadius: "50%",
          width: "40px", height: "40px",
          fontSize: "18px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.8)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.5)"}
      >✕</button>
    </div>
  );
}

export default ZoomModal;
