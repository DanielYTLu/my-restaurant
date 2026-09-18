# 專案計畫：Google Maps 資料自動匯入模組

## 1. 目標
達成透過 Google Maps 分享連結，自動將餐廳名稱、電話、地址、營業時間解析並帶入「食光 App」新增餐廳視窗。

## 2. 系統架構
- **前端 (食光 App)**：接收 PWA Share Target 傳來的 URL，顯示 loading 狀態，並呼叫 Vercel 後端 API。
- **後端 (Vercel Functions)**：
  - 接收 Google Maps 連結。
  - 透過 URL 參數解析餐廳名稱（免費且穩定）。
  - 回傳 JSON 資料。
- **前端 (回填)**：收到 JSON 後自動填充至 `restaurantModal` 表單。

## 3. 開發階段
### 第一階段：後端解析服務 (Vercel)
- 建立 `/api/parse-map.js` 處理函數。
- [完成] 實作網頁 URL 解析邏輯，成功解析餐廳名稱。
- [完成] 驗證解析出的結構化 JSON 資料。

### 第二階段：PWA 分享目標整合
- [完成] 修改 `manifest.json` 加入 `share_target`。
- [完成] 在 `app.js` 實作分享參數監聽器，支援多種分享參數格式與自動觸發。

### 第三階段：UI/UX 整合
- [完成] 整合 Loading 狀態與自動填入邏輯。
- [完成] 增加錯誤處理（無法解析時自動回退）。

## 4. 風險管理
- Google Maps 網址結構變更導致解析失效（已設計 URL 模式匹配回退機制）。
- 若解析頻繁，目前採用的 URL 模式解析為免費且無流量限制。
