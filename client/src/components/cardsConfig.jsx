// src/config/cardsConfig.js
import cardListBD24 from "../cardList_hBD24.json";
import cardListBP01 from "../cardList_hBP01.json";
import cardListBP02 from "../cardList_hBP02.json";
import cardListBP03 from "../cardList_hBP03.json";
import cardListBP04 from "../cardList_hBP04.json";
import cardListBP05 from "../cardList_hBP05.json";
import cardListBP06 from "../cardList_hBP06.json";
import cardListBP07 from "../cardList_hBP07.json";
import cardListBP08 from "../cardList_hBP08.json";
import cardListBP09 from "../cardList_hBP09.json";

import cardListSD01 from "../cardList_hSD01.json";
import cardListSD02 from "../cardList_hSD02.json";
import cardListSD03 from "../cardList_hSD03.json";
import cardListSD04 from "../cardList_hSD04.json";
import cardListSD05 from "../cardList_hSD05.json";
import cardListSD06 from "../cardList_hSD06.json";
import cardListSD07 from "../cardList_hSD07.json";
import cardListSD08 from "../cardList_hSD08.json";
import cardListSD09 from "../cardList_hSD09.json";
import cardListSD10 from "../cardList_hSD10.json";
import cardListSD11 from "../cardList_hSD11.json";
import cardListSD12 from "../cardList_hSD12.json";
import cardListSD13 from "../cardList_hSD13.json";
import cardListSD14 from "../cardList_hSD14.json";
import cardListSD15 from "../cardList_hSD15.json";
import cardListSD16 from "../cardList_hSD16.json";
import cardListSD17 from "../cardList_hSD17.json";
import cardListSD18 from "../cardList_hSD18.json";
import cardListSD19 from "../cardList_hSD19.json";

import cardListEB01 from "../cardList_hEB01.json";

import energyCardList from "../cardList_hY.json";
import CardListYS01 from "../cardList_hYS01.json";
import cardListPC from "../cardList_PC_Set.json";
import cardListCS01 from "../cardList_hCS01.json";
import cardListPR from "../cardList_PR.json";
import cardList2025Live from "../cardList_2025Live_Set.json";
import cardListTwinWafer from "../cardList_TwinWafer.json";

// 🔹 集中管理所有卡表
export const cardSets = [
  cardListEB01,
  cardListBP01, cardListBP02, cardListBP03, cardListBP04, cardListBP05,
  cardListBP06, cardListBP07, cardListBP08, cardListBP09,
  cardListSD01, cardListSD02, cardListSD03, cardListSD04, cardListSD05,
  cardListSD06, cardListSD07, cardListSD08, cardListSD09, cardListSD10,
  cardListSD11, cardListSD12, cardListSD13, cardListSD14, cardListSD15,
  cardListSD16, cardListSD17, cardListSD18, cardListSD19,
  cardListPR, cardListBD24, energyCardList, CardListYS01, cardListPC, cardListCS01, cardList2025Live, cardListTwinWafer
];

// 🔹 集中管理標籤
export const allTags = [
  "LIMITED", "0期生", "1期生", "2期生", "3期生", "4期生", "5期生",
  "EN", "ID", "ID1期生", "ID2期生", "ID3期生", "JP",
  "Myth", "Promise", "半精靈", "獸耳", "海",
  "畫", "歌", "酒", "鳥", "秘密結社holoX", "Gamers", "料理",
  "射手", "語言學", "Advent", "HoloWitch", "魔法", "白上的角色",
  "嬰兒", "DEV_IS", "ReGLOSS", "Justice", "食物", "香菇", "夏季", "小夜璃實驗室",
  "FLOW GLOW", "Buzz商品", "卡埃拉的武器", "菈米的酒"

];

// 🔹 更新日誌
export const changelog = [
  //"8/26 更新內容 : 新增 hSD08、hSD09；修復部分問題",
  //"8/27 更新內容 : 部分翻譯效果文整改",
  //"9/5 更新內容 : 部分翻譯文法錯誤修正；新增生日主推 P 卡分類",
  //"9/5 更新內容 : 新增能量卡分類",
  //"9/18 更新內容 : 新增 hBP05、hPR、hYS、PC_Set，所有卡片上線",
  //"10/2 更新內容 :　修復原先代碼搜尋功能跑出的卡圖版本錯誤問題；圖片匯出功能修復上線",
  //"11/20 更新內容 : 千速 hSD10 & 笑虎 SD11起始預組上線" ,
  //"12/18 更新內容 : hBP06 「アヤカシヴァーミリオン」卡表上線",
  //"  1/8 更新內容 : 匯出/讀取代碼功能更新完成(可以搜尋任何官方五碼或是本網站六碼代碼)",
  //" 2/24 更新內容 : Advence hSD12 & Justice hSD13 卡表上線",
  //" 3/13 更新內容 : hBP07 卡表上線",
  //"  4/7 更新內容 : 部分BUG修復(新增露天&蝦皮查卡、匯出牌組卡片張數/速度問題、牌組張數細節顯示) ",
  //" 4/24 更新內容 : 新增hSD14、hSD15、hSD16、hSD17、hSD18、hSD19卡表上線 ",
  " 5/22 更新內容 : 新增2025 Live Set 卡片、高版本能量卡以及部分缺漏更新",
  " 6/18 更新內容 : hBP08「バウンサーバウンド」 & 「ツインウエハース」餅卡卡片上線 (卡片資料持續更新中) ",
  " 6/19 更新內容 : 限制卡更新；新增連動、開花、贈禮效果搜尋欄；hBP08全卡圖+資料上線 ",
  "  7/3 更新內容 : 網站優化及BUG修正；卡圖補齊，現在各版本卡圖皆可搜尋 ",
  " 8/18 更新內容 : 博衣こより中文翻譯修正；hEB01卡表上線 ",
  " 8/19 更新內容 : 機率測試，牌組檢查等等功能 + 優化 ",
  " 9/20 更新內容 : hBP09「ボリュームヴォルテックス」卡表上線；全站翻譯圖更新 ",
];
