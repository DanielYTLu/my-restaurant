# 食光 (My Restaurant)

這是一個基於 HTML5、CSS3 和 Vanilla JavaScript 開發的餐廳應用程式，提供使用者瀏覽餐廳資訊、管理個人帳號與相關設定。

## 專案介紹
「食光」是一個輕量級的 Web 應用程式，專注於提供使用者流暢的互動體驗，包含：
*   **使用者認證系統**：支援登入、註冊、忘記密碼與帳號驗證。
*   **響應式設計**：完美適配各種螢幕尺寸（桌機、平板、手機）。
*   **PWA (Progressive Web App)**：支援安裝至裝置，提供接近原生 App 的體驗。
*   **深色/淺色模式**：自動偵測系統偏好並進行主題切換。

## 技術棧
本專案採用純前端技術開發，無依賴外部龐大框架：
*   **HTML5**：語意化標籤結構。
*   **CSS3**：響應式佈局 (Flexbox/Grid)、自訂屬性 (Variables)。
*   **Vanilla JavaScript (ES6+)**：模組化程式碼、DOM 操作、API 互動。

## 目錄結構
```text
my-restaurant/
├── admin/          # 後台管理相關檔案
├── css/            # 樣式表檔案
├── icons/          # App 圖示與資源
├── js/             # JavaScript 邏輯處理
├── index.html      # 主入口檔案
├── manifest.json   # PWA 設定檔
└── style.css       # 核心樣式檔案
```

## 功能特點
- [x] 響應式 Header 與導覽列
- [x] 使用者登入/註冊/重設密碼功能
- [x] PWA 安裝提示與離線支援
- [x] 主題切換 (深色/淺色)

## 安裝與執行
由於本專案為純前端專案，只需將檔案放置於 Web 伺服器中，或直接使用 VS Code 的 **Live Server** 擴充功能即可運行。

1. 克隆此專案：`git clone <你的儲存庫連結>`
2. 開啟 `index.html` 進行預覽。
