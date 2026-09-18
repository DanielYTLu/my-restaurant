# 專案計畫：Google Maps 資料自動匯入模組

## 1. 目標
達成透過 Google Maps 分享連結，自動將餐廳名稱、電話、地址、營業時間解析並帶入「食光 App」新增餐廳視窗。

## 2. 系統架構
- **前端 (食光 App)**：接收 PWA Share Target 傳來的 URL，顯示 loading 狀態，並呼叫 Vercel 後端 API。
- **後端 (Vercel Functions)**：
  - 接收 Google Maps 連結。
  - 使用解析套件讀取網頁內容並提取結構化資料。
  - 回傳 JSON 資料。
- **前端 (回填)**：收到 JSON 後自動填充至 `restaurantModal` 表單。

## 3. 開發階段
### 第一階段：後端解析服務 (Vercel)
- 建立 `/api/parse-map.js` 處理函數。
- 實作網頁讀取與 HTML 解析。
- 驗證解析出的結構化 JSON 資料。

### 第二階段：PWA 分享目標整合
- 修改 `manifest.json` 加入 `share_target`。
- 在 `app.js` 實作 `initShareTargetListener()` 函數。

### 第三階段：UI/UX 整合
- 增加「解析中...」的 Toast 或 Loading 狀態。
- 若解析失敗，自動跳回空白的新增視窗，確保流程不中斷。

## 4. 風險管理
- Google Maps 網頁結構變更導致解析失效（需設計錯誤回退機制）。
- 若解析頻繁，可能需考慮使用 API 或增加 Cache 機制。
