// src/components/DeckBuilder/CardArea.jsx
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import CardImage from "./CardImage";

// 卡片格尺寸（與原本 CSS grid 的 minmax(110px, 1fr) / 165px / gap 6px / padding 8px 相同）
const MIN_COL_W = 110;
const ROW_H = 165;
const GAP = 6;
const PAD = 8;
const STRIDE = ROW_H + GAP;
// 畫面外上下各多渲染幾排，正常捲動看不到空白
const BUFFER_ROWS = 4;

// 虛擬捲動：只把畫面附近的幾排放進 DOM。
// 全部 3000+ 張卡同時掛在 DOM 上時，捲過的圖解碼後會一直留在記憶體（每張約 0.9 MB），
// 單一分頁可吃到 2 GB 以上。捲出去的卡移除後，圖檔仍在瀏覽器快取裡，捲回來不必重新下載。
function CardArea({ filteredCards, onAddCard, onZoom }) {
  const scrollRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewport({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 捲動事件用 rAF 節流，一個 frame 最多重算一次
  const rafRef = useRef(0);
  const handleScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
    });
  };
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // 篩選後列表變短時瀏覽器會自動把捲軸夾回範圍內，這裡同步一次，避免算出空白區段
  useLayoutEffect(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, [filteredCards]);

  const innerW = Math.max(0, viewport.width - PAD * 2);
  const cols = Math.max(1, Math.floor((innerW + GAP) / (MIN_COL_W + GAP)));
  const totalRows = Math.ceil(filteredCards.length / cols);
  const totalH = totalRows > 0 ? PAD * 2 + totalRows * STRIDE - GAP : 0;

  const firstRow = Math.max(0, Math.floor((scrollTop - PAD) / STRIDE) - BUFFER_ROWS);
  const lastRow = Math.min(totalRows, Math.ceil((scrollTop + viewport.height) / STRIDE) + BUFFER_ROWS);
  const visibleCards = viewport.width ? filteredCards.slice(firstRow * cols, lastRow * cols) : [];

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      overflow: "hidden", height: "100%", background: "#1a1625",
    }}>
      {/* 標題列 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 12px", background: "#1e1830",
        borderBottom: "1px solid #2d2440", flexShrink: 0,
      }}>
        <span style={{ fontSize: "12px", color: "#9b8ab0", fontWeight: 500 }}>卡片列表</span>
        <span style={{ fontSize: "11px", color: "#c9b8e0" }}>{filteredCards.length} 張</span>
      </div>

      {/* 卡片格 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: "auto", position: "relative" }}
      >
        <div style={{ height: totalH, position: "relative" }}>
          <div style={{
            position: "absolute",
            top: PAD + firstRow * STRIDE, left: PAD, right: PAD,
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridAutoRows: `${ROW_H}px`,
            gap: `${GAP}px`,
          }}>
            {visibleCards.map((card) => (
              <div
                key={card.key}
                style={{
                  position: "relative",
                  cursor: "pointer",
                  borderRadius: "6px",
                  overflow: "hidden",
                  border: "1.5px solid #2d2440",
                  height: `${ROW_H}px`,
                  transition: "border-color 0.15s, transform 0.1s",
                }}
                onClick={() => onAddCard(card, card.version)}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "#6b3fa0";
                  e.currentTarget.style.transform = "scale(1.03)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "#2d2440";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <CardImage
                  card={card}
                  version={card.version}
                  deferLoad
                  onZoom={(url, cardData) => {
                    const index = filteredCards.findIndex(c => c.key === cardData.key);
                    onZoom(url, cardData, index);
                  }}
                />
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "rgba(0,0,0,0.65)", color: "rgba(255,255,255,0.85)",
                  fontSize: "9px", textAlign: "center", padding: "2px 4px",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {card.id} {card.version}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardArea;
