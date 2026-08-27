# 黑白呷 (My Restaurant) - AI 開發說明書

## 專案概覽

**黑白呷** 是一個 Progressive Web App (PWA)，用於個人餐廳管理。支援新增、編輯、刪除餐廳資訊，包含菜單圖片、收藏功能、地區群組管理和多裝置雲端同步。

---

## 技術架構

| 項目 | 技術 |
|------|------|
| 前端框架 | Vanilla JavaScript (無框架) |
| 後端/雲端 | Supabase (PostgreSQL) |
| PWA | Service Worker + Web App Manifest |
| 圖示 | emoji + 圖片 |
| 主題 | 亮色/暗色 自動偵測 |

---

## 檔案結構

```
my-restaurant/
├── index.html          # 主 HTML，包含所有 UI 結構
├── script.js           # 所有 JavaScript 邏輯（~7143 行）
├── style.css           # 樣式表
├── manifest.json       # PWA 設定檔
├── service-worker.js   # PWA 快取策略
├── ai.md              # 本文件
├── icons/             # 應用程式圖示 (180px, 192px, 512px)
└── supabase-test.html # Supabase 測試頁面
```

---

## 資料模型

### Restaurant (餐廳)

```javascript
{
  id: string,                    // 唯一識別碼
  name: string,                  // 餐廳名稱
  category: string,              // 分類 (早餐/午餐/晚餐/飲料/點心/速食/其他)
  rating: number,                // 評分 (0-5)
  image: string,                 // 餐廳圖片 (base64)
  phone: string,                 // 電話
  address: string,               // 地址
  maps: string,                  // Google Maps URL
  hours: string | object,        // 營業時間 (JSON 或 舊版字串)
  menus: [string, string, string], // 菜單圖片陣列 (base64, 最多3張)
  description: string,           // 我的備註
  isFavorite: boolean,           // 是否收藏
  groupId: string,               // 所屬群組 ID
  created_at: string,            // 建立時間
  supabase_id: string           // Supabase 記錄 ID
}
```

### Restaurant Group (群組)

```javascript
{
  id: string,                    // 群組 ID (格式: group-timestamp-random)
  name: string,                  // 群組名稱
  created_at: string             // 建立時間
}
```

### Announcement (公告)

```javascript
{
  id: string,                    // 唯一識別碼 (UUID)
  created_at: string,            // 建立時間
  title: string,                 // 公告標題
  content: string,               // 公告內容 (支援 Markdown 或純文字)
  type: 'info' | 'update' | 'event' | 'maintenance' | 'important', // 公告類型
  is_pinned: boolean,            // 是否置頂
  is_published: boolean,         // 是否已發布
  published_at: string | null,   // 發布時間
  author_id: string | null,      // 作者 (未來開發者後台帳號 ID)
  metadata: object               // 預留未來擴充欄位 (JSONB)
}
```

### Weekly Hours (每週營業時間格式)

```javascript
{
  monday:    { open: boolean, start: "HH:mm", end: "HH:mm" },
  tuesday:   { open: boolean, start: "HH:mm", end: "HH:mm" },
  wednesday: { open: boolean, start: "HH:mm", end: "HH:mm" },
  thursday:  { open: boolean, start: "HH:mm", end: "HH:mm" },
  friday:    { open: boolean, start: "HH:mm", end: "HH:mm" },
  saturday:  { open: boolean, start: "HH:mm", end: "HH:mm" },
  sunday:    { open: boolean, start: "HH:mm", end: "HH:mm" }
}
```

---

## Supabase 整合

### 設定

```javascript
const SUPABASE_URL = "https://rcyqxzerhpdneagmjwjf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UykY-RJm0HyKtmJkkE9CWg_CDFpwlHJ";
```

### 資料表

| 資料表名稱 | 用途 |
|-------------------|------|
| `restaurants` | 儲存餐廳資料 |
| `restaurant_groups` | 儲存群組資料 |
| `announcements` | 儲存公告資料 |

### 同步策略

- **本地優先**: 所有操作先寫入 LocalStorage
- **雲端備份**: 嘗試同步到 Supabase，失敗不影響本機使用
- **收藏同步**: 使用 `favorite_sync` 表追蹤收藏變更版本
- **群組隔離**: 每個群組有獨立的排序設定
- **公告快取**: 儲存公告到 LocalStorage，並追蹤使用者上次查看時間，以顯示未讀標記。

---

## 重要模組

### AppLoading

全螢幕載入提示控制器。

```javascript
AppLoading.show(message)  // 顯示載入動畫
AppLoading.hide(delay)    // 延遲隱藏
AppLoading.setMessage(msg) // 更新訊息
```

### Toast 通知

```javascript
showToast(message, type)  // type: "info" | "success" | "error"
```

### 顯示設定

```javascript
displaySettings = {
  fontSize: "medium",      // extra-small | small | medium | large | extra-large
  viewMode: "card",        // card | list
  customOrder: {           // 每群組獨立排序
    [groupId]: ["id1", "id2", ...]
  }
}
```

---

## 核心功能

### 1. 地區群組管理
- 新增/編輯/刪除群組
- 「未分類」群組不可刪除
- 刪除群組時餐廳自動移至「未分類」
- 切換群組時清除搜尋，回到「全部」

### 2. 餐廳 CRUD
- 新增/編輯/刪除餐廳
- 圖片上傳 (base64 編碼)
- 支援 3 張菜單圖片
- 每週營業時間設定

### 3. 收藏功能
- 愛心按鈕快速切換
- 收藏分類標籤
- Supabase 同步版本追蹤

### 4. 搜尋與過濾
- 即時搜尋 (名稱/分類/地點)
- 語音搜尋 (Web Speech API)
- 依分類篩選

### 5. 顯示設定
- 字體大小 5 級
- 卡片/列表視圖
- 亮色/暗色/系統主題

### 6. 卡片排序
- 拖曳排序
- 上下按鈕排序
- 每群組獨立排序

---

## 程式碼慣例

### 命名
- HTML ID: `camelCase` (例: `restaurantList`)
- CSS class: `kebab-case` (例: `restaurant-list`)
- JavaScript 變數: `camelCase`
- 常數: `SCREAMING_SNAKE_CASE`

### HTML 結構
- 使用 semantic HTML
- ARIA 標籤支援無障礙
- 按鈕 `type="button"` 防止表單提交

### JavaScript 模式
- IIFE 封裝模組 (例: `AppLoading`)
- 事件委派處理動態元素
- async/await 處理非同步
- try-catch 包裝 Supabase 操作

### CSS
- CSS 變數管理主題
- `[data-theme="dark"]` / `[data-theme="light"]` 切換
- skeleton loading 動畫

---

## PWA 設定

```json
{
  "name": "黑白呷",
  "display": "standalone",
  "start_url": "./",
  "theme_color": "#f7f7f5"
}
```

支援：
- 安裝到主畫面
- 離線使用 (需 Service Worker)
- 獨立視窗運行

---

## 開發注意事項

1. **圖片處理**: 使用 FileReader + base64，避免跨域問題
2. **時間格式**: 新版用 JSON物件，舊版用字串相容
3. **群組 ID**: 生成格式 `group-{timestamp}-{random}`
4. **LocalStorage 鍵名**:
   - `restaurants`: 餐廳資料
   - `restaurantGroups`: 群組資料
   - `currentGroupId`: 目前群組
   - `displaySettings`: 顯示設定
   - `theme`: 主題偏好

---

## 參考文獻

- [Supabase JS v2 Document](https://supabase.com/docs/reference/javascript/introduction)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [PWA Guide](https://web.dev/progressive-web-apps/)