### AI 專用專案說明書 (ai.md)

### 1. 【專案功能概述】

本專案為一個名為「**黑白呷 (MY RESTAURANTS)**」的單頁式前端美食/餐廳管理 Web App。其核心用途是讓使用者建立、紀錄、排序、分類並收藏自己常去的店家清單。此系統具備離線操作能力，支援 **PWA (Service Worker)** 離線暫存與 **LocalStorage** 緩存，並能無縫雙向同步至後端資料庫 **Supabase**。 

### 核心功能模組

* **Supabase 資料雙向同步**：支援與後端資料庫進行餐廳清單的即時增刪查改（CRUD）與收藏同步。
* **全域離線/同步狀態控管**：具備網路異常判定與連線測試，若雲端同步失敗會自動切換為本機 LocalStorage Fallback 暫存機制。
* **智慧型時間選擇與語法解析**：內建按星期獨立規劃的營業時間編輯器，支援快速批量套用，並具備舊版時間字串（如 11:30 - 21:30）的相容性解析演算法。
* **高效圖片編碼與優化**：上傳之餐廳封面與菜單圖片會經由 Canvas 自動等比例壓縮、調整品質並編碼為 Base64 (Data URL) 字串直接儲存。
* **動態顯示、排版與字級控制**：可動態切換淺色、深色或系統外觀；支援 5 種層級的字體大小切換；支援卡片與列表雙排版瀏覽。
* **自訂拖曳排序系統**：實作原生 HTML5 Drag and Drop API 與按鈕式（↑/↓）雙重自訂卡片展示順序管理。
* **進階菜單檢視器與 PWA 級手勢縮放**：具備多張菜單切換與全螢幕檢視，實作了跨裝置的 Pinch Zoom（雙指捏合縮放）、Pan（雙指拖曳位移）、Double Tap（雙擊放大）以及滑鼠滾輪/鍵盤控制演算法。

### 2. 【建議的模組化目錄結構】

為了避免單一檔案過大導致效能下降與 AI 幻覺，未來建議將專案重構為以下 ES6 Module 元件化目錄結構： 

text

my-restaurant-app/
├── index.html                   # 主頁面 HTML 進入點，移除行內 CSS/JS
├── ai.md                        # 本 AI 指南地圖
├── service-worker.js            # PWA 離線緩存邏輯
├── css/
│   ├── main.css                 # 核心進入點：僅存放全域變數與 @import 各子模組
│   ├── base.css                 # CSS Reset、HTML 基本全域樣式設定 [2]
│   ├── layouts.css              # Header、Main 容器排版樣式 [2]
│   ├── components/
│   │   ├── search-category.css  # 搜尋列與分類捲軸樣式 [2]
│   │   ├── restaurant-card.css  # 餐廳卡片 (卡片模式/列表模式/Skeleton) 樣式 [2]
│   │   ├── forms-hours.css      # 表單輸入、營業時間編輯器樣式 [2]
│   │   ├── modals-settings.css  # 各類彈窗、設定面板與排序列表樣式 [2]
│   │   └── menu-viewer.css      # 菜單檢視器與全螢幕手勢縮放樣式 [2]
│   └── states-animations.css    # Toast、Loading 控制與全域 Keyframes 動畫 [2]
└── js/
    ├── main.js                  # 核心初始化進入點，綁定全域基礎事件監聽器 [1]
    ├── config.js                # 存放 Supabase URL、Key 常數與第三方配置 [1]
    ├── state.js                 # 維護全域響應狀態管理（restaurants, settings 等） [1]
    ├── utils/
    │   ├── image.js             # Canvas 圖片壓縮、Base64/Data URL 格式相容性處理工具 [1]
    │   ├── datetime.js          # 營業時間資料規格化 (normalize) 與格式化處理工具 [1]
    │   └── common.js            # escapeHtml、Toast、DOM 安全操作工具 [1]
    ├── services/
    │   └── supabase.js          # 封裝所有與 Supabase 交互的 CRUD 與連線測試 API [1]
    └── components/
        ├── loading.js           # AppLoading 全域載入動畫元件狀態控管 [1]
        ├── theme.js             # 主題、深淺色外觀切換與系統自動適應控管 [1]
        ├── settings.js          # 字級調整、瀏覽方式與卡片自訂排序互動邏輯 [1]
        ├── restaurant-form.js   # 處理新增/編輯表單送出、營業時間編輯器邏輯 [1]
        ├── restaurant-list.js   # 負責渲染餐廳卡片、分類過濾、搜尋引擎與空狀態 [1]
        └── menu-viewer.js       # 核心演算法：菜單切換、Pinch Zoom、拖曳、雙擊放大邏輯 [1]

請謹慎使用程式碼。

### 3. 【核心全域變數與狀態管理清單】

專案（目前位於 script.js）由以下核心狀態變數驅動全專案資料流： 

變數/狀態名稱 

資料類型 

預設值/初始化結構 

核心用途與運作機制說明 

**restaurants**
Array[]**全專案的資料核心根源。** 存放所有載入的餐廳物件陣列。格式必須符合前端統一規格，供搜尋、篩選與渲染卡片使用。
**supabaseConnected**
Booleanfalse**全域同步保險開關。** 標記目前與 Supabase 的連線健康狀態。當為 true 時，增刪查改會即時同步至雲端；為 false 時，自動切換至 LocalStorage Fallback 模式。
**displaySettings**
Object經 loadDisplaySettings() 從本機載入**UI 配置狀態。** 包含：
1. fontSize: 5種級距字體字級狀態
2. viewMode: card 或 list 展示排版模式
3. customOrder: 存放餐廳 ID 的字串陣列 ['id1', 'id2']，用來決定拖曳自訂順序
**themePreference**
StringlocalStorage.getItem("theme") 或 "system"**外觀主題狀態。** 記錄使用者指定的主題喜好。值可為 "light"、"dark" 或 "system"（自動追蹤系統深色模式變化）。
**favoriteSyncVersions**
Mapnew Map()**高併發防爆衝突鎖。** 用於處理使用者連續、快速點擊收藏愛心時的非同步異步同步競爭問題，追蹤各餐廳 ID 最新同步版本，避免舊回應覆蓋新狀態。

### 4. 【關鍵功能的關鍵函數導航】

本 App 之核心運作資料流全由特定核心函數鍊式傳遞，切勿破壞以下流程： 

### A. 初始化資料載入流程

當網頁開啟，資料流向與函數調用順序如下： 

1. initialize() (主進入點啟動，調用 showSkeletonLoading() 渲染骨架屏)
2. →right arrow
→
 進入 try {} 調用 loadRestaurants()（發起 Supabase 雲端非同步請求）
3. →right arrow
→
 （若成功）轉換資料格式 

→right arrow
→
 自動更新全域 restaurants 

→right arrow
→
 呼叫 renderRestaurants()
4. →right arrow
→
 （若失敗進入 catch）自動轉向調用 loadRestaurantsFromLocal() 

→right arrow
→
 從 LocalStorage 回填 restaurants
5. →right arrow
→
 cleanDisplayOrder()（自動清理不存在的過期排序 ID） 

→right arrow
→
 呼叫 renderRestaurants() 渲染畫面
6. →right arrow
→
 finishAppStartup() 移除 Standalone 模式下的 PWA 閃屏。

### B. 餐廳卡片列表過濾與關鍵字搜尋流

1. searchInput 監聽 input 事件
2. →right arrow
→
 取得過濾關鍵字，遍歷全域 restaurants 陣列進行多欄位（名稱、分類、地址、備註、營業時間）比對
3. →right arrow
→
 將篩選後的陣列丟入 renderRestaurants(filteredData)
4. →right arrow
→
 進入 renderRestaurants 內部 

→right arrow
→
 呼叫 getOrderedRestaurants() 依自訂排序計算出最終排序陣列
5. →right arrow
→
 若長度為 0 呼叫 renderEmptyState() 顯示無結果畫面；若有資料則遍歷呼叫 createRestaurantCard()
6. →right arrow
→
 呼叫 applyDisplaySettings() 套用全域字體大小與版型 

→right arrow
→
 渲染至 DOM。

### C. 新增與編輯店家儲存流程

1. restaurantForm 監聽 submit 事件 

→right arrow
→
 攔截預設行為並顯示 AppLoading.show()
2. →right arrow
→
 檢查 restaurantForm.dataset.editingId 判斷是「新增」或「編輯」
3. →right arrow
→
 呼叫 readWeeklyHoursFromEditor()：遍歷營業時間 DOM 節點，驗證時間正確性，包裝成標準 JSON 物件（若防呆失敗則拋出 Error 終斷流程並 alert）
4. →right arrow
→
 檢查是否有新上傳的圖片 File 

→right arrow
→
 有則呼叫 readFileAsDataUrl()（透過 Promise 與 Canvas 進行 82% 質量壓縮與尺寸調整並轉為 Base64 Data URL）
5. →right arrow
→
 組裝成標準餐廳結構 restaurantData 物件
6. →right arrow
→
 **執行分支**： 

  * **狀況一（有雲端連線 supabaseConnected === true）**： 

    * 呼叫 updateRestaurantInSupabase() 或 createRestaurantInSupabase()
    * 成功同步後，重新呼叫 loadRestaurants() 刷新全域記憶體與畫面
  * **狀況二（無雲端連線 / Fallback 離線）**： 

    * 直接操作全域 restaurants 陣列（unshift 新增或修改索引項目）
    * 呼叫 saveRestaurantsLocal() 寫入本機 LocalStorage
    * 呼叫 renderRestaurants() 重新渲染列表
7. →right arrow
→
 呼叫 closeRestaurantModal() 關閉並重設表單 

→right arrow
→
 視窗平滑滾動至頂端 window.scrollTo 

→right arrow
→
 關閉 Loading。

### 5. 【程式風格與防坑指南】

任何後續協助維護的 AI 必須嚴格遵守以下程式風格與架構限制，否則將導致 App 崩潰： 

### ⚠️ 絕對防坑死角（核心限制）

1. **圖片規格嚴禁改動**：本專案不將圖片檔案直接上傳到雲端 Storage，而是**全數轉換成 Base64 字串**存入 Supabase 的 text 欄位（restaurant_image_url、menu_images 陣列）。重構或新增功能時，**絕對不可以**擅自改成上傳原始 File 物件或 Blob 網址，必須確保經由 readFileAsDataUrl() 轉碼壓縮後才送出。
2. **營業時間資料欄位嚴格限定**：restaurant.hours 在前端記憶體與 LocalStorage 中是一個**標準的週營業時間結構化物件**（含有 monday 到 sunday 的 key，內含 open, start, end）。而在 Supabase 資料庫中，該欄位欄位名稱為 opening_hours 且以 **JSON 字串 (String)** 格式存放。在進行資料流對接時，必須維持 normalizeWeeklyHours() 的相容性解析，不可直接將物件或格式不符的字串直接塞入。
3. **資料規格轉換器不可遺漏**：前端與後端的資料欄位命名存在差異（例如前端叫 image，後端叫 restaurant_image_url；前端叫 description，後端叫 notes）。任何 CRUD 動作必須嚴格通過 mapSupabaseToRestaurant() 與 mapRestaurantToSupabase() 兩個對應函數進行雙向對齊，嚴禁直接將後端 row 資料直接賦值給前端變數。
4. **愛心收藏非同步鎖**：為了防止使用者快速連續點擊愛心收藏，導致異步請求返回順序錯亂（Race Condition），在 toggleFavorite() 中必須透過 favoriteSyncVersions 對版本號進行驗證。若異步請求返回時版本號已不對等，**只允許更新本機，不允許覆蓋畫面狀態**，否則會發生畫面閃爍或狀態倒退的 Bug。
5. **CSS 權重與 Dark Mode 優先級**：本專案之深色模式是透過在 <html> 標籤上套用 data-theme="dark" 屬性來達成。深色模式下的所有顏色樣式複寫，皆完整定義在 style.css 的最底部。重構 CSS 或將其拆分時，必須確保 [data-theme="dark"] 的選擇器權重與載入順序永遠在最下方，否則深色模式切換將會失效。

### 命名約定

* **DOM 元素命名**：採用小駝峰式命名法 (CamelCase)，例如 restaurantList、addRestaurantButton、displaySettingsModal。
* **CSS 選擇器**：採用 簡化版 BEM 與中線命名法 (kebab-case)，例如 .restaurant-card、.restaurant-image-placeholder、.hours-day-row。
* **資料庫規格對齊**：Supabase 資料表欄位名稱採用蛇形命名法 (snake_case)，例如 created_at、google_maps_url、menu_images。