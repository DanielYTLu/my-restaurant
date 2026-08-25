// ==================================================
// Supabase Configuration
// ==================================================

const SUPABASE_URL =
    "https://rcyqxzerhpdneagmjwjf.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_UykY-RJm0HyKtmJkkE9CWg_CDFpwlHJ";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


// ==================================================
// Restaurant Management System
// ==================================================


// ==================================================
// Local Cache
// ==================================================

let restaurants = [];


// ==================================================
// Supabase Status
// ==================================================

let supabaseConnected = false;

const favoriteSyncVersions = new Map();

const displaySettings = loadDisplaySettings();

const themePreference =
    localStorage.getItem("theme") || "system";

function isDarkTheme(theme = themePreference) {
    return theme === "dark" || (
        theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = isDarkTheme(theme)
        ? "dark"
        : "light";

    const themeColor =
        document.querySelector('meta[name="theme-color"]');

    themeColor?.setAttribute(
        "content",
        isDarkTheme(theme) ? "#171716" : "#f7f7f5"
    );
}

function initializeTheme() {
    applyTheme(themePreference);

    window.matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
            if (localStorage.getItem("theme") === "system") {
                applyTheme("system");
            }
        });
}

function loadDisplaySettings() {
    try {
        const saved = JSON.parse(localStorage.getItem("displaySettings"));

        return {
            fontSize: ["extra-small", "small", "medium", "large", "extra-large"].includes(saved?.fontSize)
                ? saved.fontSize
                : "medium",
            viewMode: saved?.viewMode === "list" ? "list" : "card",
            customOrder: Array.isArray(saved?.customOrder)
                ? saved.customOrder.map(String)
                : []
        };
    }
    catch {
        return { fontSize: "medium", viewMode: "card", customOrder: [] };
    }
}

function saveDisplaySettings() {
    localStorage.setItem("displaySettings", JSON.stringify(displaySettings));
}

function showToast(message, type = "info") {
    const previousToast = document.querySelector(".toast");

    previousToast?.remove();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add("is-leaving");
        toast.addEventListener("animationend", () => toast.remove(), { once: true });
    }, 1700);
}

function getOrderedRestaurants(source = restaurants) {
    const available = new Map(source.map(restaurant => [String(restaurant.id), restaurant]));
    const ordered = displaySettings.customOrder
        .map(id => available.get(String(id)))
        .filter(Boolean);
    const orderedIds = new Set(ordered.map(restaurant => String(restaurant.id)));

    return ordered.concat(
        source.filter(restaurant => !orderedIds.has(String(restaurant.id)))
    );
}

function applyDisplaySettings() {
    document.body.classList.remove(
        "font-extra-small",
        "font-small",
        "font-medium",
        "font-large",
        "font-extra-large"
    );
    document.body.classList.add(`font-${displaySettings.fontSize}`);
    restaurantList.classList.toggle("list-view", displaySettings.viewMode === "list");
}


// ==================================================
// DOM
// ==================================================

const restaurantList =
    document.getElementById(
        "restaurantList"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const clearSearchButton =
    document.getElementById(
        "clearSearchButton"
    );

const categories =
    document.querySelectorAll(
        ".category"
    );

const addRestaurantButton =
    document.getElementById(
        "addRestaurantButton"
    );

const restaurantModal =
    document.getElementById(
        "restaurantModal"
    );

const closeModal =
    document.getElementById(
        "closeModal"
    );

const restaurantForm =
    document.getElementById(
        "restaurantForm"
    );

const displaySettingsButton =
    document.getElementById("displaySettingsButton");

const displaySettingsModal =
    document.getElementById("displaySettingsModal");

const orderSettingsModal =
    document.getElementById("orderSettingsModal");
const restaurantImageInput =
    document.getElementById(
        "restaurantImage"
    );
const restaurantImagePreview =
    document.getElementById(
        "restaurantImagePreview"
    );

const weekDays = [
    { key: "monday", label: "一" },
    { key: "tuesday", label: "二" },
    { key: "wednesday", label: "三" },
    { key: "thursday", label: "四" },
    { key: "friday", label: "五" },
    { key: "saturday", label: "六" },
    { key: "sunday", label: "日" }
];

function createEmptyWeeklyHours() {
    return Object.fromEntries(
        weekDays.map(day => [
            day.key,
            { open: false, start: "", end: "" }
        ])
    );
}

function normalizeWeeklyHours(value) {
    let parsed = value;

    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        }
        catch {
            parsed = null;
        }
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const weeklyHours = createEmptyWeeklyHours();

        weekDays.forEach(day => {
            const entry = parsed[day.key];

            if (entry && typeof entry === "object") {
                weeklyHours[day.key] = {
                    open: entry.open === true,
                    start: entry.start || "",
                    end: entry.end || ""
                };
            }
        });

        return weeklyHours;
    }

    const legacyMatch = String(value || "").match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);

    if (legacyMatch) {
        return Object.fromEntries(
            weekDays.map(day => [
                day.key,
                { open: true, start: legacyMatch[1], end: legacyMatch[2] }
            ])
        );
    }

    return createEmptyWeeklyHours();
}

function formatHoursRange(hours) {
    return hours.open && hours.start && hours.end
        ? `${hours.start}–${hours.end}`
        : "公休";
}

function getTodayHours(restaurant) {
    const dayKey = weekDays[(new Date().getDay() + 6) % 7].key;
    return normalizeWeeklyHours(restaurant.hours)[dayKey];
}

function getHoursSummary(restaurant) {
    const todayHours = getTodayHours(restaurant);

    return todayHours.open && todayHours.start && todayHours.end
        ? `🟢 今日營業 ${todayHours.start}–${todayHours.end}`
        : "🔴 今日公休";
}

function getWeeklyHoursText(restaurant) {
    const weeklyHours = normalizeWeeklyHours(restaurant.hours);

    return weekDays.map(day =>
        `星期${day.label}　${formatHoursRange(weeklyHours[day.key])}`
    ).join("\n");
}


// ==================================================
// Initialize
// ==================================================

initialize();


async function initialize() {

    console.log("🚀 餐廳管理系統啟動");

    // 從 Supabase 載入餐廳
    showSkeletonLoading();
    try {
        await loadRestaurants();
    }
    catch (error) {
        console.error("❌ 餐廳資料載入失敗：", error);
        loadRestaurantsFromLocal();
    }
    finally {
        finishAppStartup();
    }

}

function loadRestaurantsFromLocal() {
    try {
        const savedRestaurants = JSON.parse(
            localStorage.getItem("restaurants") || "[]"
        );

        restaurants = Array.isArray(savedRestaurants)
            ? savedRestaurants.map(restaurant => ({
                ...restaurant,
                id: String(restaurant.id),
                menuImages: Array.isArray(restaurant.menuImages)
                    ? restaurant.menuImages.filter(Boolean)
                    : [],
                hours: normalizeWeeklyHours(restaurant.hours)
            }))
            : [];
    }
    catch {
        restaurants = [];
    }

    cleanDisplayOrder();
    renderRestaurants();
}


// ==================================================
// Default Restaurants
// ==================================================

function createDefaultRestaurants() {

    return [

        {

            id:
                String(
                    Date.now()
                ),

            name:
                "山海鍋物",

            category:
                "火鍋",

            rating:
                4.6,

            image:
                "https://images.unsplash.com/photo-1547592180-85f173990554",

            phone:
                "02-1234-5678",

            address:
                "台北市大安區",

            hours:
                "11:30 - 21:30",

            maps:
                "https://www.google.com/maps",

            menuImages: [

                "https://images.unsplash.com/photo-1547592180-85f173990554"

            ],

            description:
                "適合朋友聚餐的火鍋店。",

            favorite:
                false

        },


        {

            id:
                String(
                    Date.now() + 1
                ),

            name:
                "Morning Coffee",

            category:
                "咖啡",

            rating:
                4.8,

            image:
                "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",

            phone:
                "02-2345-6789",

            address:
                "台北市大安區",

            hours:
                "08:00 - 18:00",

            maps:
                "https://www.google.com/maps",

            menuImages:
                [],

            description:
                "適合讀書與工作的咖啡廳。",

            favorite:
                false

        }

    ];

}


// ==================================================
// Load Restaurants From Supabase
// ==================================================

async function loadRestaurantsFromSupabase() {

    try {

        console.log(
            "☁️ 正在從 Supabase 讀取餐廳..."
        );


        const {
            data,
            error
        } =
            await supabaseClient
                .from("restaurants")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (
            error
        ) {

            console.error(
                "❌ Supabase 讀取失敗：",
                error
            );

            supabaseConnected =
                false;

            return false;

        }


        restaurants =
            data.map(
                mapSupabaseToRestaurant
            );


        supabaseConnected =
            true;


        saveRestaurantsLocal();


        console.log(
            `✅ Supabase 讀取成功，共 ${restaurants.length} 間餐廳`
        );


        return true;

    }

    catch (
        error
    ) {

        console.error(
            "❌ Supabase 連線失敗：",
            error
        );


        supabaseConnected =
            false;


        return false;

    }

}


// ==================================================
// Supabase → Frontend
// ==================================================

function mapSupabaseToRestaurant(
    row
) {

    return {

        // ==================================================
        // ID
        // ==================================================

        id:
            String(
                row.id
            ),


        // ==================================================
        // 基本資料
        // ==================================================

        name:
            row.name || "",

        category:
            row.category || "",


        // ==================================================
        // ⭐ 評分
        // ==================================================

        rating:
            row.rating !== null &&
            row.rating !== undefined
                ? Number(
                    row.rating
                )
                : null,


        // ==================================================
        // 🖼️ 餐廳圖片
        // ==================================================

        image:
            row.restaurant_image_url || "",


        // ==================================================
        // ☎️ 電話
        // ==================================================

        phone:
            row.phone || "",


        // ==================================================
        // 📍 地址
        // ==================================================

        address:
            row.address || "",


        // ==================================================
        // 🕐 營業時間
        // ==================================================

        hours:
            normalizeWeeklyHours(row.opening_hours),


        // ==================================================
        // 🗺️ Google Maps
        // ==================================================

        maps:
            row.google_maps_url || "",


        // ==================================================
        // 📖 菜單圖片
        // ==================================================

        menuImages:
            Array.isArray(
                row.menu_images
            )
                ? row.menu_images.filter(Boolean)
                : [],


        // ==================================================
        // 📝 備註
        // ==================================================

        description:
            row.notes || "",


        // ==================================================
        // ❤️ 收藏
        // ==================================================

        favorite:
            row.favorite === true

    };

}


// ==================================================
// Map Website Restaurant → Supabase
// ==================================================

function mapRestaurantToSupabase(
    restaurant
) {

    return {

        // ==================================================
        // 基本資料
        // ==================================================

        name:
            restaurant.name || null,

        category:
            restaurant.category || null,


        // ==================================================
        // ⭐ 評分
        // ==================================================

        rating:
            restaurant.rating !== null &&
            restaurant.rating !== undefined &&
            restaurant.rating !== ""
                ? Number(
                    restaurant.rating
                )
                : null,


        // ==================================================
        // 📝 描述
        // ==================================================

        description:
            null,


        // ==================================================
        // ☎️ 電話
        // ==================================================

        phone:
            restaurant.phone || null,


        // ==================================================
        // 🕐 營業時間
        // ==================================================

        opening_hours:
            JSON.stringify(
                normalizeWeeklyHours(restaurant.hours)
            ),


        // ==================================================
        // 🗺️ Google Maps
        // ==================================================

        google_maps_url:
            restaurant.maps || null,


        // ==================================================
        // 🖼️ 餐廳封面圖片
        // ==================================================

        restaurant_image_url:
            restaurant.image || null,


        // ==================================================
        // ❤️ 收藏
        // ==================================================

        favorite:
            Boolean(
                restaurant.favorite
            ),


        // ==================================================
        // 📝 我的備註
        // ==================================================

        notes:
            restaurant.description || null,


        // ==================================================
        // 📍 地址
        // ==================================================

        address:
            restaurant.address || null,


        // ==================================================
        // 📖 菜單圖片
        // ==================================================

        menu_images:
            Array.isArray(
                restaurant.menuImages
            )
                ? restaurant.menuImages
                : []

    };

}


// ==================================================
// LocalStorage
// ==================================================

function saveRestaurantsLocal() {

    localStorage.setItem(
        "restaurants",
        JSON.stringify(restaurants)
    );

}

function cleanDisplayOrder() {
    const existingIds = new Set(
        restaurants.map(restaurant => String(restaurant.id))
    );

    displaySettings.customOrder = displaySettings.customOrder.filter(
        id => existingIds.has(String(id))
    );
    saveDisplaySettings();

}


// --------------------------------------------------
// Compatibility
// 保留舊函式，避免其他舊程式碼出錯
// --------------------------------------------------

function saveRestaurants() {

    saveRestaurantsLocal();

}


// ==================================================
// Create Restaurant
// ==================================================

async function createRestaurantInSupabase(
    restaurant
) {

    try {

        const payload =
            mapRestaurantToSupabase(
                restaurant
            );


        const {
            data,
            error
        } =
            await supabaseClient
                .from("restaurants")
                .insert(
                    payload
                )
                .select()
                .single();


        if (
            error
        ) {

            console.error(
                "❌ 新增餐廳失敗：",
                error
            );

            return null;

        }


        console.log(
            "✅ 餐廳新增至 Supabase：",
            data
        );


        return mapSupabaseToRestaurant(
            data
        );

    }

    catch (
        error
    ) {

        console.error(
            "❌ 新增餐廳錯誤：",
            error
        );

        return null;

    }

}


// ==================================================
// Update Restaurant
// ==================================================

async function updateRestaurantInSupabase(
    id,
    restaurant
) {

    try {

        const payload =
            mapRestaurantToSupabase(
                restaurant
            );


        const {
            data,
            error
        } =
            await supabaseClient
                .from("restaurants")
                .update(
                    payload
                )
                .eq(
                    "id",
                    id
                )
                .select()
                .single();


        if (
            error
        ) {

            console.error(
                "❌ 更新餐廳失敗：",
                error
            );

            return null;

        }


        console.log(
            "✅ 餐廳已更新至 Supabase"
        );


        return mapSupabaseToRestaurant(
            data
        );

    }

    catch (
        error
    ) {

        console.error(
            "❌ 更新餐廳錯誤：",
            error
        );

        return null;

    }

}


// ==================================================
// Delete Restaurant From Supabase
// ==================================================

async function deleteRestaurantFromSupabase(
    id
) {

    try {

        const {
            error
        } =
            await supabaseClient
                .from("restaurants")
                .delete()
                .eq(
                    "id",
                    id
                );


        if (
            error
        ) {

            console.error(
                "❌ Supabase 刪除失敗：",
                error
            );

            return false;

        }


        console.log(
            "✅ Supabase 餐廳已刪除"
        );


        return true;

    }

    catch (
        error
    ) {

        console.error(
            "❌ 刪除餐廳錯誤：",
            error
        );

        return false;

    }

}


// ==================================================
// Render Restaurants
// ==================================================

function renderRestaurants(
    restaurantData = restaurants
) {

    restaurantList.innerHTML = "";
    applyDisplaySettings();

    const visibleRestaurants = getOrderedRestaurants(restaurantData);


    if (
        visibleRestaurants.length === 0
    ) {

        renderEmptyState(restaurantData);

        return;

    }


    visibleRestaurants.forEach(
        restaurant => {

            restaurantList.appendChild(
                createRestaurantCard(
                    restaurant
                )
            );

        }
    );

}

// ==================================================
// Normalize Restaurant Image
// ==================================================

function getRestaurantImageSrc(image) {

    if (!image) {
        return "";
    }

    // 確保一定是字串
    image = String(image).trim();

    if (!image) {
        return "";
    }

    // ------------------------------------------
    // 已經是 Data URL
    // ------------------------------------------

    if (image.startsWith("data:image/")) {
        return image;
    }

    // ------------------------------------------
    // 一般網路圖片
    // ------------------------------------------

    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("blob:")
    ) {
        return image;
    }

    // ------------------------------------------
    // file:/// 或 fakepath
    // 這些不能直接拿來顯示
    // ------------------------------------------

    if (
        image.startsWith("file:///") ||
        image.startsWith("C:\\fakepath\\") ||
        image.startsWith("C:/fakepath/")
    ) {
        return "";
    }

    // ------------------------------------------
    // 純 Base64
    // ------------------------------------------

    // JPEG
    if (
        image.startsWith("/9j/") ||
        image.startsWith("/9J/")
    ) {
        return `data:image/jpeg;base64,${image}`;
    }

    // PNG
    if (
        image.startsWith("iVBORw0KGgo")
    ) {
        return `data:image/png;base64,${image}`;
    }

    // GIF
    if (
        image.startsWith("R0lGOD")
    ) {
        return `data:image/gif;base64,${image}`;
    }

    // WebP
    if (
        image.startsWith("UklGR")
    ) {
        return `data:image/webp;base64,${image}`;
    }

    // ------------------------------------------
    // 如果看起來像 Base64
    // 最後嘗試 JPEG
    // ------------------------------------------

    if (
        image.length > 1000 &&
        /^[A-Za-z0-9+/=\s]+$/.test(image)
    ) {
        return `data:image/jpeg;base64,${image}`;
    }

    // ------------------------------------------
    // 其他情況直接使用原值
    // ------------------------------------------

    return image;
}
// ==================================================
// Restaurant Card
// ==================================================

function createRestaurantCard(
    restaurant
) {

    const article =
        document.createElement(
            "article"
        );


    article.className =
        "restaurant-card";


    const menuCount =
        restaurant.menuImages
            ? restaurant.menuImages.filter(Boolean).length
            : 0;

        const restaurantImage =
    getRestaurantImageSrc(restaurant.image);

console.log(
    "🖼️ 餐廳圖片處理後：",
    restaurant.name,
    restaurantImage
);

article.innerHTML = `

    <div class="restaurant-image">

        ${
            restaurantImage
                ? `
                    <img
                        src="${restaurantImage}"
                        alt="${restaurant.name}"
                        class="restaurant-card-image"
                    >

                    <div
                        class="restaurant-image-placeholder"
                        hidden
                    >
                        <span>🍽️</span>
                        <small>圖片無法顯示</small>
                    </div>
                `
                : `
                    <div class="restaurant-image-placeholder">
                        <span>🍽️</span>
                        <small>尚未提供圖片</small>
                    </div>
                `
        }

        <button
            class="
                favorite
                ${restaurant.favorite ? "liked" : ""}
            "
            data-id="${restaurant.id}"
            aria-label="${restaurant.favorite ? "取消收藏" : "收藏"} ${restaurant.name}"
            aria-pressed="${restaurant.favorite}"
        >

            ${restaurant.favorite ? "♥" : "♡"}

        </button>

    </div>

        <button
            class="
                favorite
                ${restaurant.favorite ? "liked" : ""}
            "
            data-id="${restaurant.id}"
            aria-label="${restaurant.favorite ? "取消收藏" : "收藏"} ${restaurant.name}"
            aria-pressed="${restaurant.favorite}"
        >

            ${restaurant.favorite ? "♥" : "♡"}

        </button>

    </div>


    <div class="restaurant-content">

        <div class="restaurant-title">

            <div>

                <h2>
                    ${restaurant.name}
                </h2>

                <p class="rating">
                    ★
                    ${restaurant.rating || "—"}
                </p>

            </div>

            <span class="tag">
                ${restaurant.category}
            </span>

        </div>


        <p class="location">
            📍
            ${restaurant.address || "尚未提供地址"}
        </p>


        <button
            type="button"
            class="hours"
            data-hours-id="${restaurant.id}"
        >
            ${getHoursSummary(restaurant)}
        </button>


        <div class="card-actions">

            <button
                class="menu-button"
                data-id="${restaurant.id}"
            >
                📖 菜單
                ${
                    menuCount > 0
                        ? ` · ${menuCount} 張`
                        : ""
                }
            </button>


            <button
                class="view-button"
                data-id="${restaurant.id}"
            >
                查看資訊
            </button>

        </div>

    </div>

`;

const testImage =
    article.querySelector(".restaurant-image img");

if (testImage) {

    testImage.addEventListener(
        "load",
        () => {

            console.log(
                "✅ IMG 成功載入：",
                restaurant.name
            );

            console.log(
                "自然尺寸：",
                testImage.naturalWidth,
                "x",
                testImage.naturalHeight
            );

            console.log(
                "實際 src：",
                testImage.currentSrc
            );

        }
    );

    testImage.addEventListener(
        "error",
        event => {

            console.error(
                "❌ IMG 載入失敗：",
                restaurant.name
            );

            console.error(
                "src：",
                testImage.src
            );

            console.error(
                "currentSrc：",
                testImage.currentSrc
            );

        }
    );

}

    // Favorite

    article
        .querySelector(".favorite")
        .addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                toggleFavorite(
                    restaurant.id,
                    event.currentTarget
                );

            }
        );


    // Menu

    article
        .querySelector(".menu-button")
        .addEventListener(
            "click",
            () => {

                openMenuViewer(
                    restaurant
                );

            }
        );

    article
        .querySelector(".hours")
        .addEventListener(
            "click",
            () => alert(`營業時間\n\n${getWeeklyHoursText(restaurant)}`)
        );


    // Detail

    article
        .querySelector(".view-button")
        .addEventListener(
            "click",
            () => {

                showRestaurantDetail(
                    restaurant
                );

            }
        );


    return article;

}


// ==================================================
// Favorite
// ==================================================

async function toggleFavorite(id, favoriteButton) {

    const index = restaurants.findIndex(
        restaurant =>
            String(restaurant.id) === String(id)
    );

    if (index === -1) {
        return;
    }


    // ==================================================
    // 1. 立即更新畫面
    // ==================================================

    const previousFavorite =
        restaurants[index].favorite === true;

    const newFavorite =
        !previousFavorite;

    restaurants[index].favorite =
        newFavorite;

    favoriteButton.classList.toggle("liked", newFavorite);
    favoriteButton.textContent = newFavorite ? "♥" : "♡";
    favoriteButton.setAttribute("aria-pressed", String(newFavorite));
    favoriteButton.setAttribute(
        "aria-label",
        `${newFavorite ? "取消收藏" : "收藏"} ${restaurants[index].name}`
    );
    favoriteButton.classList.remove("favorite-pop");
    void favoriteButton.offsetWidth;
    favoriteButton.classList.add("favorite-pop");
    showToast(
        newFavorite ? "♥ 已加入收藏" : "♡ 已取消收藏",
        "success"
    );

    const syncVersion =
        (favoriteSyncVersions.get(String(id)) || 0) + 1;

    favoriteSyncVersions.set(
        String(id),
        syncVersion
    );


    // 先儲存本機
    saveRestaurantsLocal();


    const activeCategory =
        document.querySelector(".category.active")?.dataset.category;

    if (
        activeCategory === "收藏" &&
        !newFavorite
    ) {
        renderRestaurants();
    }


    // ==================================================
    // 2. 同步 Supabase
    // ==================================================

    if (supabaseConnected) {


        const {
            error
        } = await supabaseClient
            .from("restaurants")
            .update({
                favorite: newFavorite
            })
            .eq(
                "id",
                id
            );


        if (error) {

            if (
                favoriteSyncVersions.get(String(id)) === syncVersion
            ) {

                restaurants[index].favorite =
                    previousFavorite;

                saveRestaurantsLocal();
                favoriteButton.classList.toggle("liked", previousFavorite);
                favoriteButton.textContent = previousFavorite ? "♥" : "♡";
                favoriteButton.setAttribute("aria-pressed", String(previousFavorite));
                showToast("⚠ 收藏同步失敗，已恢復原狀態", "warning");

                if (
                    activeCategory === "收藏"
                ) {
                    renderRestaurants();
                }

            }

            console.error(
                "❌ 收藏同步失敗：",
                error
            );

        }

        else {

            console.log(
                "☁️ 收藏狀態已同步：",
                newFavorite
            );

        }

    }

}


// ==================================================
// Search
// ==================================================

searchInput.addEventListener(
    "input",
    () => {

        const keyword =
            searchInput.value
                .trim()
                .toLowerCase();


        const filtered =
            restaurants.filter(
                restaurant => {

                    return (

                        (
                            restaurant.name || ""
                        )
                            .toLowerCase()
                            .includes(keyword)

                        ||

                        (
                            restaurant.category || ""
                        )
                            .toLowerCase()
                            .includes(keyword)

                        ||

                        (
                            restaurant.address || ""
                        )
                            .toLowerCase()
                            .includes(keyword)

                        ||

                        (
                            restaurant.description || ""
                        )
                            .toLowerCase()
                            .includes(keyword)

                        ||

                        JSON.stringify(
                            restaurant.hours || ""
                        )
                            .toLowerCase()
                            .includes(keyword)

                    );

                }
            );


        renderRestaurants(
            filtered
        );

        clearSearchButton.hidden = keyword.length === 0;

    }
);

clearSearchButton.addEventListener(
    "click",
    () => {
        searchInput.value = "";
        clearSearchButton.hidden = true;
        renderRestaurants();
        searchInput.focus();
    }
);


// ==================================================
// Category
// ==================================================

categories.forEach(
    categoryButton => {

        categoryButton.addEventListener(
            "click",
            () => {

                // ==================================================
                // 移除其他分類的 active
                // ==================================================

                categories.forEach(
                    button => {

                        button.classList.remove(
                            "active"
                        );

                    }
                );


                // ==================================================
                // 當前分類加入 active
                // ==================================================

                categoryButton.classList.add(
                    "active"
                );


                // ==================================================
                // 取得分類
                // ==================================================

                const category =
                    categoryButton.dataset.category;


                // ==================================================
                // 全部
                // ==================================================

                if (
                    category === "全部"
                ) {

                    renderRestaurants();

                    return;

                }


                // ==================================================
                // 收藏
                // ==================================================

                if (
                    category === "收藏"
                ) {

                    const favoriteRestaurants =
                        restaurants.filter(
                            restaurant =>
                                restaurant.favorite === true
                        );


                    renderRestaurants(
                        favoriteRestaurants
                    );


                    return;

                }


                // ==================================================
                // 一般餐廳分類
                // ==================================================

                const filteredRestaurants =
                    restaurants.filter(
                        restaurant =>
                            restaurant.category ===
                            category
                    );


                renderRestaurants(
                    filteredRestaurants
                );

            }
        );

    }
);


// ==================================================
// Open Add Modal
// ==================================================

addRestaurantButton.addEventListener(
    "click",
    () => {

        delete restaurantForm.dataset.editingId;


        restaurantForm.reset();
        restaurantImageInput.dataset.imageRemoved = "false";
        updateRestaurantImagePreview("");
        renderWeeklyHoursEditor();

        document.querySelectorAll("[id^='restaurantMenu']").forEach(input => {
            input.dataset.menuRemoved = "false";
        });


        updateMenuPreview(
            1,
            ""
        );

        updateMenuPreview(
            2,
            ""
        );

        updateMenuPreview(
            3,
            ""
        );


        restaurantModal.classList.add(
            "show"
        );

    }
);


// ==================================================
// Close Modal
// ==================================================

closeModal.addEventListener(
    "click",
    closeRestaurantModal
);


restaurantModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            restaurantModal
        ) {

            closeRestaurantModal();

        }

    }
);


function closeRestaurantModal() {

    restaurantModal.classList.remove(
        "show"
    );


    restaurantForm.reset();
    restaurantImageInput.dataset.imageRemoved = "false";
    updateRestaurantImagePreview("");
    renderWeeklyHoursEditor();

    document.querySelectorAll("[id^='restaurantMenu']").forEach(input => {
        input.dataset.menuRemoved = "false";
    });


    delete restaurantForm.dataset.editingId;


    updateMenuPreview(
        1,
        ""
    );


    updateMenuPreview(
        2,
        ""
    );


    updateMenuPreview(
        3,
        ""
    );

}


// ==================================================
// Submit Form
// ==================================================

function readFileAsDataUrl(file) {

    return new Promise((resolve, reject) => {

        const image = new Image();
        const imageUrl = URL.createObjectURL(file);

        image.addEventListener("load", () => {

            const maxSize = 1600;
            const ratio = Math.min(
                1,
                maxSize / Math.max(image.naturalWidth, image.naturalHeight)
            );
            const canvas = document.createElement("canvas");

            canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(imageUrl);
            resolve(canvas.toDataURL("image/jpeg", 0.82));

        });

        image.addEventListener("error", () => {
            URL.revokeObjectURL(imageUrl);
            reject(new Error("圖片無法讀取"));
        });

        image.src = imageUrl;

    });

}

function renderWeeklyHoursEditor(value = null) {
    const editor = document.getElementById("weeklyHoursEditor");
    const quickDays = document.getElementById("quickHoursDays");
    const weeklyHours = normalizeWeeklyHours(value);

    editor.innerHTML = weekDays.map(day => {
        const hours = weeklyHours[day.key];

        return `
            <div class="hours-day-row" data-day="${day.key}">
                <span class="hours-day-name">星期${day.label}</span>
                <button type="button" class="hours-open-toggle ${hours.open ? "is-open" : ""}" data-open="${hours.open}">
                    ${hours.open ? "🟢 營業" : "⚪ 公休"}
                </button>
                <div class="hours-time-fields" ${hours.open ? "" : "hidden"}>
                    <input type="time" class="hours-start" value="${hours.start}">
                    <span>～</span>
                    <input type="time" class="hours-end" value="${hours.end}">
                </div>
            </div>
        `;
    }).join("");

    quickDays.innerHTML = weekDays.map(day => `
    <label class="quick-day-item">
        <input type="checkbox" value="${day.key}">
        <span>${day.label}</span>
    </label>
    `).join("");

    editor.querySelectorAll(".hours-open-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const isOpen = button.dataset.open !== "true";
            const timeFields = button.parentElement.querySelector(".hours-time-fields");

            button.dataset.open = String(isOpen);
            button.classList.toggle("is-open", isOpen);
            button.textContent = isOpen ? "🟢 營業" : "⚪ 公休";
            timeFields.hidden = !isOpen;
        });
    });
}

function readWeeklyHoursFromEditor() {
    const weeklyHours = createEmptyWeeklyHours();

    document.querySelectorAll(".hours-day-row").forEach(row => {
        const open = row.querySelector(".hours-open-toggle").dataset.open === "true";
        const start = row.querySelector(".hours-start").value;
        const end = row.querySelector(".hours-end").value;

        if (open && (!start || !end || start >= end)) {
            throw new Error(`星期${row.querySelector(".hours-day-name").textContent.replace("星期", "")}的營業時間不完整或有誤`);
        }

        weeklyHours[row.dataset.day] = { open, start: open ? start : "", end: open ? end : "" };
    });

    return weeklyHours;
}

function initializeWeeklyHours() {
    document.getElementById("applyQuickHours").addEventListener("click", () => {
        const selectedDays = [...document.querySelectorAll("#quickHoursDays input:checked")].map(input => input.value);
        const start = document.getElementById("quickHoursStart").value;
        const end = document.getElementById("quickHoursEnd").value;

        if (selectedDays.length === 0 || !start || !end || start >= end) {
            alert("請選擇日期並設定正確的開始與結束時間。");
            return;
        }

        selectedDays.forEach(dayKey => {
            const row = document.querySelector(`[data-day="${dayKey}"]`);
            const toggle = row.querySelector(".hours-open-toggle");

            toggle.dataset.open = "true";
            toggle.classList.add("is-open");
            toggle.textContent = "🟢 營業";
            row.querySelector(".hours-time-fields").hidden = false;
            row.querySelector(".hours-start").value = start;
            row.querySelector(".hours-end").value = end;
        });
    });

    renderWeeklyHoursEditor();
}

restaurantForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const editingId =
            restaurantForm.dataset.editingId;


// ==================================================
// 取得菜單圖片
// ==================================================

const menuInputs = [
    document.getElementById("restaurantMenu1"),
    document.getElementById("restaurantMenu2"),
    document.getElementById("restaurantMenu3")
];

// ==================================================
// 取得目前使用者選擇的圖片 File
// ==================================================

const selectedMenuFiles = menuInputs.map(input =>
    input && input.files && input.files.length > 0
        ? input.files[0]
        : null
);

console.log(
    "📷 使用者選擇的菜單圖片：",
    selectedMenuFiles
);


        // ==================================================
        // 取得表單資料
        // ==================================================
        
        console.log(
    "📍 表單地址：",
    document.getElementById("restaurantAddress").value
);

console.log(
    "⭐ 表單評分：",
    document.getElementById("restaurantRating").value
);
        const existingRestaurant =
            editingId
                ? restaurants.find(
                    restaurant =>
                        String(
                            restaurant.id
                        ) ===
                        String(
                            editingId
                        )
                )
                : null;

        const menuImages = (await Promise.all(
            selectedMenuFiles.map(async (file, index) => {

                if (file) {
                    return readFileAsDataUrl(file);
                }

                if (menuInputs[index]?.dataset.menuRemoved === "true") {
                    return null;
                }

                return existingRestaurant?.menuImages?.[index] || "";

            })
        )).filter(Boolean);

        let weeklyHours;

        try {
            weeklyHours = readWeeklyHoursFromEditor();
        }
        catch (error) {
            alert(error.message);
            return;
        }

        const restaurantImage =
            restaurantImageInput.files &&
            restaurantImageInput.files.length > 0
                ? await readFileAsDataUrl(restaurantImageInput.files[0])
                : restaurantImageInput.dataset.imageRemoved === "true"
                    ? ""
                    : existingRestaurant?.image || "";

        const restaurantData = {

            name:
                document.getElementById(
                    "restaurantName"
                ).value.trim(),

            category:
                document.getElementById(
                    "restaurantCategory"
                ).value,

            rating:
                Number(
                    document.getElementById(
                        "restaurantRating"
                    ).value
                ) || null,


            phone:
                document.getElementById(
                    "restaurantPhone"
                ).value.trim(),

            address:
                document.getElementById(
                    "restaurantAddress"
                ).value.trim(),

            hours:
                weeklyHours,

            maps:
                document.getElementById(
                    "restaurantMaps"
                ).value.trim(),

            image:
                restaurantImage,

            menuImages:
                menuImages,

            description:
                document.getElementById(
                    "restaurantDescription"
                ).value.trim()

        };
        console.log("⭐ 表單取得的評分：", document.getElementById("restaurantRating").value);

        // ==================================================
        // EDIT
        // ==================================================

        if (editingId) {

            console.log(
                "✏️ 開始更新餐廳：",
                editingId
            );


            // --------------------------------------------------
            // 更新 Supabase
            // --------------------------------------------------

            if (supabaseConnected) {

                const updatedRestaurant =
                    await updateRestaurantInSupabase(
                        editingId,
                        restaurantData
                    );


                // --------------------------------------------------
                // Supabase 更新失敗
                // --------------------------------------------------

                if (!updatedRestaurant) {

                    alert(
                        "❌ 餐廳更新失敗，請檢查網路連線。"
                    );

                    return;

                }


                console.log(
                    "☁️ 餐廳已成功更新到 Supabase：",
                    updatedRestaurant
                );


                // --------------------------------------------------
                // 重新從 Supabase 讀取
                // --------------------------------------------------

                await loadRestaurants();


                // --------------------------------------------------
                // 更新畫面
                // --------------------------------------------------

                renderRestaurants();


                // --------------------------------------------------
                // 關閉編輯視窗
                // --------------------------------------------------

                closeRestaurantModal();


                alert(
                    "✅ 餐廳資料已更新！"
                );

            }


            // --------------------------------------------------
            // Supabase 沒連線
            // --------------------------------------------------

            else {

                const index =
                    restaurants.findIndex(
                        restaurant =>
                            String(
                                restaurant.id
                            ) ===
                            String(
                                editingId
                            )
                    );


                if (index === -1) {

                    alert(
                        "找不到要編輯的餐廳。"
                    );

                    return;

                }


                restaurants[index] = {

                    ...restaurants[index],

                    ...restaurantData

                };


                saveRestaurantsLocal();

                renderRestaurants();

                closeRestaurantModal();


                alert(
                    "⚠️ Supabase 尚未連線，目前只儲存在本機。"
                );

            }

        }


        // ==================================================
        // ADD
        // ==================================================

        else {

            const newRestaurant = {

                id:
                    String(
                        Date.now()
                    ),

                ...restaurantData,

                favorite:
                    false

            };


            console.log(
                "➕ 開始新增餐廳：",
                newRestaurant
            );


            // --------------------------------------------------
            // Supabase
            // --------------------------------------------------

            if (supabaseConnected) {

                const saved =
                    await createRestaurantInSupabase(
                        newRestaurant
                    );


                if (saved) {

                    console.log(
                        "☁️ 新餐廳已成功同步到 Supabase：",
                        saved
                    );


                    // 重新從 Supabase 讀取
                    await loadRestaurants();


                    // 更新畫面
                    renderRestaurants();


                    // 關閉視窗
                    closeRestaurantModal();


                    alert(
                        "✅ 餐廳已成功新增！"
                    );

                }


                else {

                    restaurants.unshift(
                        newRestaurant
                    );


                    saveRestaurantsLocal();

                    renderRestaurants();

                    closeRestaurantModal();


                    alert(
                        "⚠️ 餐廳已暫存，但無法同步到 Supabase。"
                    );

                }

            }


            // --------------------------------------------------
            // Local fallback
            // --------------------------------------------------

            else {

                restaurants.unshift(
                    newRestaurant
                );


                saveRestaurantsLocal();

                renderRestaurants();

                closeRestaurantModal();


                alert(
                    "⚠️ Supabase 尚未連線，目前只儲存在本機。"
                );

            }

        }


        // ==================================================
        // 回到列表頂端
        // ==================================================

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }
);


// ==================================================
// Restaurant Detail
// ==================================================

function showRestaurantDetail(
    restaurant
) {

    const overlay =
        document.createElement(
            "div"
        );


    overlay.className =
        "detail-overlay";


    const menuCount =
        restaurant.menuImages
            ? restaurant.menuImages.length
            : 0;
    
            console.log(
    "========== 餐廳圖片檢查 =========="
);

console.log(
    "餐廳：",
    restaurant.name
);

console.log(
    "image：",
    restaurant.image
);

console.log(
    "image type：",
    typeof restaurant.image
);

console.log(
    "image length：",
    restaurant.image
        ? String(restaurant.image).length
        : 0
);

console.log(
    "=================================="
);

    overlay.innerHTML = `

        <div class="detail-sheet">

            <div class="detail-header">

                <button
                    class="detail-close"
                >
                    ×
                </button>

            </div>


            <div class="detail-main-image">

                <img
                    src="${restaurant.image || ""}"
                    alt="${restaurant.name}"
                >

            </div>


            <div class="detail-content">


                <div class="detail-title-row">

                    <div>

                        <h2>
                            ${restaurant.name}
                        </h2>

                        <p class="detail-rating">

                            ★
                            ${restaurant.rating || "—"}

                        </p>

                    </div>


                    <span class="tag">

                        ${restaurant.category}

                    </span>

                </div>


                <button
                    class="detail-menu-button"
                >

                    <div>

                        <strong>
                            📖 查看菜單
                        </strong>

                        <span>

                            ${
                                menuCount > 0
                                    ? `${menuCount} 張菜單圖片`
                                    : "尚未新增菜單"
                            }

                        </span>

                    </div>


                    <span>
                        →
                    </span>

                </button>


                <div class="info-list">


                    <div class="info-item">

                        <span>
                            📍
                        </span>

                        <div>

                            <small>
                                地址
                            </small>

                            <p>
                                ${
                                    restaurant.address ||
                                    "尚未提供"
                                }
                            </p>

                        </div>

                    </div>


                    <div class="info-item">

                        <span>
                            🕐
                        </span>

                        <div>

                            <small>
                                營業時間
                            </small>

                            <p>
                                ${
                                    getHoursSummary(restaurant)
                                }
                            </p>

                        </div>

                    </div>


                    <div class="info-item">

                        <span>
                            ☎
                        </span>

                        <div>

                            <small>
                                電話
                            </small>

                            <p>
                                ${
                                    restaurant.phone ||
                                    "尚未提供"
                                }
                            </p>

                        </div>

                    </div>

                </div>


                <div class="description">

                    <h3>
                        我的備註
                    </h3>

                    <p>

                        ${
                            restaurant.description ||
                            "尚未新增備註"
                        }

                    </p>

                </div>


                <div class="detail-actions">

                    <button
                        class="detail-map-button"
                    >

                        📍 Google Maps

                    </button>


                    <button
                        class="detail-edit-button"
                    >

                        ✏️ 編輯餐廳

                    </button>


                    <button
                        class="detail-delete-button"
                    >

                        🗑️ 刪除餐廳

                    </button>

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(
        overlay
    );


    // Close

    overlay
        .querySelector(".detail-close")
        .addEventListener(
            "click",
            () => {

                overlay.remove();

            }
        );


    // Menu

    overlay
        .querySelector(".detail-menu-button")
        .addEventListener(
            "click",
            () => {

                if (
                    !restaurant.menuImages ||
                    restaurant.menuImages.length === 0
                ) {

                    alert(
                        "這間餐廳目前還沒有菜單圖片。"
                    );

                    return;

                }


                overlay.remove();


                openMenuViewer(
                    restaurant
                );

            }
        );


    // Maps

    overlay
        .querySelector(".detail-map-button")
        .addEventListener(
            "click",
            () => {

                if (
                    restaurant.maps
                ) {

                    window.open(
                        restaurant.maps,
                        "_blank"
                    );

                }

                else {

                    alert(
                        "尚未設定 Google Maps"
                    );

                }

            }
        );


    // Edit

    overlay
        .querySelector(".detail-edit-button")
        .addEventListener(
            "click",
            () => {

                overlay.remove();


                openEditRestaurant(
                    restaurant
                );

            }
        );


    // Delete

    overlay
        .querySelector(".detail-delete-button")
        .addEventListener(
            "click",
            () => {

                deleteRestaurant(
                    restaurant.id
                );

                overlay.remove();

            }
        );

}


// ==================================================
// Edit Restaurant
// ==================================================

function openEditRestaurant(
    restaurant
) {

    restaurantModal.classList.add(
        "show"
    );


    restaurantForm.dataset.editingId =
        restaurant.id;


    // ==================================================
    // 基本資料
    // ==================================================

    document.getElementById(
        "restaurantName"
    ).value =
        restaurant.name || "";


    document.getElementById(
        "restaurantCategory"
    ).value =
        restaurant.category || "";


    document.getElementById(
        "restaurantRating"
    ).value =
        restaurant.rating ?? "";


    // ==================================================
    // 聯絡資訊
    // ==================================================

    document.getElementById(
        "restaurantPhone"
    ).value =
        restaurant.phone || "";


    document.getElementById(
        "restaurantAddress"
    ).value =
        restaurant.address || "";


    renderWeeklyHoursEditor(restaurant.hours);


    // ==================================================
    // Google Maps
    // ==================================================

    document.getElementById(
        "restaurantMaps"
    ).value =
        restaurant.maps || "";


    // ==================================================
    // 備註
    // ==================================================

    document.getElementById(
        "restaurantDescription"
    ).value =
        restaurant.description || "";


    // ==================================================
    // 菜單圖片
    // ==================================================

   const menuImages =
    restaurant.menuImages || [];


// File input 不能直接填入舊圖片
document.getElementById(
    "restaurantMenu1"
).value = "";

document.getElementById(
    "restaurantMenu2"
).value = "";

document.getElementById(
    "restaurantMenu3"
).value = "";

document.querySelectorAll("[id^='restaurantMenu']").forEach(input => {
    input.dataset.menuRemoved = "false";
});

restaurantImageInput.dataset.imageRemoved = "false";
updateRestaurantImagePreview(restaurant.image || "");


// 顯示目前已儲存的菜單圖片
updateMenuPreview(
    1,
    menuImages[0] || ""
);

updateMenuPreview(
    2,
    menuImages[1] || ""
);

updateMenuPreview(
    3,
    menuImages[2] || ""
);

}


// ==================================================
// Delete Restaurant
// ==================================================

async function deleteRestaurant(
    id
) {

    const restaurant =
        restaurants.find(
            restaurant =>
                String(
                    restaurant.id
                ) ===
                String(id)
        );


    // ==================================================
    // 找不到餐廳
    // ==================================================

    if (
        !restaurant
    ) {

        alert(
            "找不到要刪除的餐廳。"
        );

        return;

    }


    // ==================================================
    // 確認刪除
    // ==================================================

    const confirmed =
        confirm(
            `確定要刪除「${restaurant.name}」嗎？`
        );


    if (
        !confirmed
    ) {

        return;

    }


    // ==================================================
    // Supabase
    // ==================================================

    if (
        supabaseConnected
    ) {

        console.log(
            "🗑️ 開始從 Supabase 刪除：",
            id
        );


        const success =
            await deleteRestaurantFromSupabase(
                id
            );


        // --------------------------------------------------
        // Supabase 刪除失敗
        // --------------------------------------------------

        if (
            !success
        ) {

            alert(
                "❌ 餐廳刪除失敗，請檢查網路連線。"
            );

            return;

        }


        console.log(
            "☁️ 餐廳已成功從 Supabase 刪除：",
            id
        );


        // --------------------------------------------------
        // 重新讀取 Supabase
        // --------------------------------------------------

        await loadRestaurants();


        // --------------------------------------------------
        // 更新畫面
        // --------------------------------------------------

        renderRestaurants();


        alert(
            "✅ 餐廳已成功刪除！"
        );

    }


    // ==================================================
    // Local fallback
    // ==================================================

    else {

        restaurants =
            restaurants.filter(
                restaurant =>
                    String(
                        restaurant.id
                    ) !==
                    String(id)
            );

                cleanDisplayOrder();


        saveRestaurantsLocal();

        renderRestaurants();


        alert(
            "⚠️ Supabase 尚未連線，目前只從本機刪除。"
        );

    }

}


// ==================================================
// Initialize Menu Image Upload
// 點擊灰色菜單框 → 開啟圖片選擇器
// ==================================================

function initializeMenuPreview() {

    const menuInputs = [
        document.getElementById("restaurantMenu1"),
        document.getElementById("restaurantMenu2"),
        document.getElementById("restaurantMenu3")
    ];

    menuInputs.forEach((input, index) => {

        const menuNumber = index + 1;

        console.log(
            `📖 初始化菜單 ${menuNumber}`
        );

        // ------------------------------------------
        // 確認 input
        // ------------------------------------------

        if (!input) {

            console.error(
                `❌ 找不到 restaurantMenu${menuNumber}`
            );

            return;
        }

        // ------------------------------------------
        // 找到對應的灰色預覽框
        // ------------------------------------------

        const preview =
            document.getElementById(
                `menuPreview${menuNumber}`
            );

        if (!preview) {

            console.error(
                `❌ 找不到 menuPreview${menuNumber}`
            );

            return;
        }

        // ------------------------------------------
        // 隱藏原本的檔案選擇器
        // ------------------------------------------

        input.style.display = "none";

        // ------------------------------------------
        // 灰色框可以點擊
        // ------------------------------------------

        preview.style.cursor = "pointer";

        // ------------------------------------------
        // 點擊灰色框
        // ------------------------------------------

        preview.addEventListener(
            "click",
            () => {

                console.log(
                    `📸 點擊菜單 ${menuNumber}`
                );

                input.click();

            }
        );

        // ------------------------------------------
        // 選擇圖片
        // ------------------------------------------

        input.addEventListener(
            "change",
            () => {

                const file =
                    input.files &&
                    input.files.length > 0
                        ? input.files[0]
                        : null;

                console.log(
                    `📷 菜單 ${menuNumber} 選擇圖片：`,
                    file
                );

                if (!file) {
                    return;
                }

                input.dataset.menuRemoved = "false";

                // ----------------------------------
                // 確認是不是圖片
                // ----------------------------------

                if (
                    !file.type.startsWith("image/")
                ) {

                    alert(
                        "請選擇圖片檔案。"
                    );

                    input.value = "";

                    return;
                }

                // ----------------------------------
                // 顯示預覽
                // ----------------------------------

                updateMenuPreview(
                    menuNumber,
                    file
                );

            }
        );

    });

}

// ==================================================
// Update Menu Image Preview
// ==================================================

function updateMenuPreview(
    menuNumber,
    fileOrUrl
) {

    const preview =
        document.getElementById(
            `menuPreview${menuNumber}`
        );

    if (!preview) {

        console.error(
            `❌ 找不到 menuPreview${menuNumber}`
        );

        return;
    }

    // ==================================================
    // 沒有圖片
    // ==================================================

    if (!fileOrUrl) {

        preview.innerHTML = `

            <div class="menu-preview-empty">

                <span class="menu-upload-icon">
                    📖
                </span>

                <p>
                    點擊上傳菜單圖片
                </p>

            </div>

        `;

        return;
    }

    // ==================================================
    // 使用者剛剛選擇的 File
    // ==================================================

    if (
        fileOrUrl instanceof File
    ) {

        console.log(
            `📷 菜單 ${menuNumber} File：`,
            fileOrUrl
        );

        // ----------------------------------------------
        // 建立瀏覽器暫時圖片網址
        // ----------------------------------------------

        const imageURL =
            URL.createObjectURL(
                fileOrUrl
            );

        console.log(
            `🖼️ 菜單 ${menuNumber} 預覽網址：`,
            imageURL
        );

        preview.innerHTML = `

            <img
                src="${imageURL}"
                alt="菜單 ${menuNumber}"
                class="menu-preview-image"
            >

        `;

        return;
    }

    // ==================================================
    // 已經存在的圖片 URL
    // 例如編輯餐廳時使用
    // ==================================================

    if (
        typeof fileOrUrl === "string"
    ) {

        if (
            fileOrUrl.startsWith("C:\\fakepath\\") ||
            fileOrUrl.startsWith("file:///")
        ) {

            updateMenuPreview(menuNumber, "");

            return;
        }

        preview.innerHTML = `

            <img
                src="${fileOrUrl}"
                alt="菜單 ${menuNumber}"
                class="menu-preview-image"
            >

        `;

        return;
    }

}


function updateRestaurantImagePreview(
    fileOrUrl
) {

    if (!restaurantImagePreview) {
        return;
    }

    if (!fileOrUrl) {
        restaurantImagePreview.innerHTML = `

            <div class="menu-preview-empty">

                <span class="menu-upload-icon">
                    🏪
                </span>

                <p>
                    點擊上傳餐廳圖片
                </p>

            </div>

        `;

        return;
    }

    const imageUrl =
        fileOrUrl instanceof File
            ? URL.createObjectURL(fileOrUrl)
            : fileOrUrl;

    restaurantImagePreview.innerHTML = `

        <img
            src="${imageUrl}"
            alt="餐廳圖片預覽"
            class="menu-preview-image"
        >

    `;

}


function initializeRestaurantImageUpload() {

    if (!restaurantImageInput || !restaurantImagePreview) {
        return;
    }

    restaurantImageInput.style.display = "none";
    restaurantImagePreview.style.cursor = "pointer";

    restaurantImagePreview.addEventListener(
        "click",
        () => restaurantImageInput.click()
    );

    restaurantImageInput.addEventListener(
        "change",
        () => {

            const file =
                restaurantImageInput.files &&
                restaurantImageInput.files.length > 0
                    ? restaurantImageInput.files[0]
                    : null;

            if (!file) {
                return;
            }

            if (!file.type.startsWith("image/")) {
                alert("請選擇圖片檔案。");
                restaurantImageInput.value = "";
                return;
            }

            restaurantImageInput.dataset.imageRemoved = "false";
            updateRestaurantImagePreview(file);

        }
    );

    document
        .getElementById("restaurantImageRemove")
        .addEventListener(
            "click",
            event => {

                event.stopPropagation();
                restaurantImageInput.value = "";
                restaurantImageInput.dataset.imageRemoved = "true";
                updateRestaurantImagePreview("");

            }
        );

}



// ==================================================
// Clear Menu Image
// ==================================================

function clearMenuImage(
    menuNumber
) {

    const input =
        document.getElementById(
            `restaurantMenu${menuNumber}`
        );


    if (
        !input
    ) {

        return;

    }


    input.value =
        "";

    input.dataset.menuRemoved = "true";


    updateMenuPreview(
        menuNumber,
        ""
    );

}


// ==================================================
// Menu Remove Buttons
// ==================================================

function initializeMenuRemoveButtons() {

    const buttons =
        document.querySelectorAll(
            "[data-menu-remove]"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const number =
                        button.dataset.menuRemove;


                    clearMenuImage(
                        number
                    );

                }
            );

        }
    );

}


// ==================================================
// Menu Viewer
// ==================================================

function openMenuViewer(
    restaurant
) {

    const menuImages =
        (restaurant.menuImages || []).filter(Boolean);


    if (
        menuImages.length === 0
    ) {

        alert(
            "這間餐廳目前還沒有菜單圖片。"
        );

        return;

    }


    const menuOverlay =
        document.createElement(
            "div"
        );


    menuOverlay.className =
        "menu-viewer";


    menuOverlay.innerHTML = `

        <div class="menu-viewer-header">

            <div>

                <p class="eyebrow">
                    MENU
                </p>

                <h2>
                    ${restaurant.name}
                </h2>

            </div>


            <button
                class="menu-close"
            >
                ×
            </button>

        </div>


        <div class="menu-main-viewer">

            <button
                class="menu-nav menu-prev"
            >
                ‹
            </button>


            <div class="menu-image-stage">

                <img
                    class="menu-main-image"
                    src="${menuImages[0]}"
                    alt="${restaurant.name} 菜單 1"
                >

            </div>


            <button
                class="menu-nav menu-next"
            >
                ›
            </button>

        </div>


        <div class="menu-page-counter">

            <span class="current-page">
                1
            </span>

            <span>
                /
            </span>

            <span>
                ${menuImages.length}
            </span>

        </div>


        <div class="menu-thumbnails">

            ${menuImages.map(
                (image, index) => `

                <button
                    class="
                        menu-thumbnail
                        ${index === 0 ? "active" : ""}
                    "
                    data-index="${index}"
                >

                    <img
                        src="${image}"
                        alt="菜單第 ${index + 1} 頁"
                    >

                </button>

            `).join("")}

        </div>


        <p class="menu-hint">

            左右滑動切換菜單 · 點擊圖片放大

        </p>

    `;


    document.body.appendChild(
        menuOverlay
    );


    const mainImage =
        menuOverlay.querySelector(
            ".menu-main-image"
        );


    const prevButton =
        menuOverlay.querySelector(
            ".menu-prev"
        );


    const nextButton =
        menuOverlay.querySelector(
            ".menu-next"
        );


    const currentPage =
        menuOverlay.querySelector(
            ".current-page"
        );


    const thumbnails =
        menuOverlay.querySelectorAll(
            ".menu-thumbnail"
        );


    const imageStage =
        menuOverlay.querySelector(
            ".menu-image-stage"
        );


    let currentIndex =
        0;


    function updateMenu(
        index
    ) {

        if (
            index < 0 ||
            index >= menuImages.length
        ) {

            return;

        }


        currentIndex =
            index;


        mainImage.src =
            menuImages[currentIndex];


        mainImage.alt =
            `${restaurant.name} 菜單 ${currentIndex + 1}`;


        currentPage.textContent =
            currentIndex + 1;


        thumbnails.forEach(
            (
                thumbnail,
                thumbnailIndex
            ) => {

                thumbnail.classList.toggle(
                    "active",
                    thumbnailIndex ===
                        currentIndex
                );

            }
        );


        prevButton.disabled =
            currentIndex === 0;


        nextButton.disabled =
            currentIndex ===
                menuImages.length - 1;


        if (
            thumbnails[currentIndex]
        ) {

            thumbnails[
                currentIndex
            ].scrollIntoView({

                behavior:
                    "smooth",

                block:
                    "nearest",

                inline:
                    "center"

            });

        }

    }


    prevButton.addEventListener(
        "click",
        () => {

            updateMenu(
                currentIndex - 1
            );

        }
    );


    nextButton.addEventListener(
        "click",
        () => {

            updateMenu(
                currentIndex + 1
            );

        }
    );


    thumbnails.forEach(
        thumbnail => {

            thumbnail.addEventListener(
                "click",
                () => {

                    updateMenu(
                        Number(
                            thumbnail.dataset.index
                        )
                    );

                }
            );

        }
    );


    // ==================================================
    // Swipe
    // ==================================================

    let touchStartX =
        0;


    imageStage.addEventListener(
        "touchstart",
        event => {

            touchStartX =
                event.changedTouches[0]
                    .screenX;

        },
        {
            passive: true
        }
    );


    imageStage.addEventListener(
        "touchend",
        event => {

            const touchEndX =
                event.changedTouches[0]
                    .screenX;


            const distance =
                touchEndX -
                touchStartX;


            if (
                distance < -50
            ) {

                updateMenu(
                    currentIndex + 1
                );

            }


            if (
                distance > 50
            ) {

                updateMenu(
                    currentIndex - 1
                );

            }

        },
        {
            passive: true
        }
    );


    // ==================================================
    // Fullscreen
    // ==================================================

    mainImage.addEventListener(
        "click",
        () => {

            openFullscreenMenuImage(
                menuImages,
                currentIndex,
                restaurant.name
            );

        }
    );


    // ==================================================
    // Close
    // ==================================================

    menuOverlay
        .querySelector(
            ".menu-close"
        )
        .addEventListener(
            "click",
            () => {

                menuOverlay.remove();

            }
        );


    menuOverlay.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                menuOverlay
            ) {

                menuOverlay.remove();

            }

        }
    );


    // ==================================================
    // Keyboard
    // ==================================================

    function keyboardHandler(
        event
    ) {

        if (
            event.key ===
            "ArrowLeft"
        ) {

            updateMenu(
                currentIndex - 1
            );

        }


        if (
            event.key ===
            "ArrowRight"
        ) {

            updateMenu(
                currentIndex + 1
            );

        }


        if (
            event.key ===
            "Escape"
        ) {

            menuOverlay.remove();


            document.removeEventListener(
                "keydown",
                keyboardHandler
            );

        }

    }


    document.addEventListener(
        "keydown",
        keyboardHandler
    );


    updateMenu(0);

}


// ==================================================
// Fullscreen Menu Image
// Real Pinch Zoom + Pan + Double Tap
// ==================================================

function openFullscreenMenuImage(
    images,
    startIndex,
    restaurantName
) {

    let currentIndex =
        startIndex;


    let scale =
        1;


    let translateX =
        0;


    let translateY =
        0;


    const MIN_SCALE =
        1;


    const MAX_SCALE =
        4;


    let touches =
        [];


    let isPinching =
        false;


    let isDragging =
        false;


    let lastTouchX =
        0;


    let lastTouchY =
        0;


    let pinchStartDistance =
        0;


    let pinchStartScale =
        1;


    let pinchCenterX =
        0;


    let pinchCenterY =
        0;


    let lastTapTime =
        0;


    const fullscreen =
        document.createElement(
            "div"
        );


    fullscreen.className =
        "menu-fullscreen";


    fullscreen.innerHTML = `

        <button
            class="fullscreen-close"
            aria-label="關閉"
        >
            ×
        </button>


        <button
            class="fullscreen-prev"
            aria-label="上一張"
        >
            ‹
        </button>


        <div class="fullscreen-image-wrapper">

            <img
                class="fullscreen-image"
                src="${images[currentIndex]}"
                alt="${restaurantName} 菜單"
            >

        </div>


        <button
            class="fullscreen-next"
            aria-label="下一張"
        >
            ›
        </button>


        <div class="fullscreen-counter">

            ${currentIndex + 1}
            /
            ${images.length}

        </div>


        <div class="zoom-indicator">

            100%

        </div>

    `;


    document.body.appendChild(
        fullscreen
    );


    const image =
        fullscreen.querySelector(
            ".fullscreen-image"
        );


    const imageWrapper =
        fullscreen.querySelector(
            ".fullscreen-image-wrapper"
        );


    const prev =
        fullscreen.querySelector(
            ".fullscreen-prev"
        );


    const next =
        fullscreen.querySelector(
            ".fullscreen-next"
        );


    const counter =
        fullscreen.querySelector(
            ".fullscreen-counter"
        );


    const zoomIndicator =
        fullscreen.querySelector(
            ".zoom-indicator"
        );


    function applyTransform(
        animate = false
    ) {

        image.style.transition =
            animate
                ? "transform 0.25s ease"
                : "none";


        image.style.transform = `
            translate(
                calc(-50% + ${translateX}px),
                calc(-50% + ${translateY}px)
            )
            scale(${scale})
        `;

    }


    let zoomIndicatorTimer;


    function showZoomIndicator() {

        zoomIndicator.textContent =
            `${Math.round(scale * 100)}%`;


        zoomIndicator.classList.add(
            "show"
        );


        clearTimeout(
            zoomIndicatorTimer
        );


        zoomIndicatorTimer =
            setTimeout(
                () => {

                    zoomIndicator.classList.remove(
                        "show"
                    );

                },
                900
            );

    }


    function resetZoom(
        animate = true
    ) {

        scale =
            1;


        translateX =
            0;


        translateY =
            0;


        applyTransform(
            animate
        );


        updateNavigation();

    }


    function clampPosition() {

        if (
            scale <= 1
        ) {

            translateX =
                0;

            translateY =
                0;

            return;

        }


        const wrapperWidth =
            imageWrapper.clientWidth;


        const wrapperHeight =
            imageWrapper.clientHeight;


        const imageWidth =
            image.offsetWidth *
            scale;


        const imageHeight =
            image.offsetHeight *
            scale;


        const maxX =
            Math.max(
                0,
                (
                    imageWidth -
                    wrapperWidth
                ) / 2
            );


        const maxY =
            Math.max(
                0,
                (
                    imageHeight -
                    wrapperHeight
                ) / 2
            );


        translateX =
            Math.max(
                -maxX,
                Math.min(
                    maxX,
                    translateX
                )
            );


        translateY =
            Math.max(
                -maxY,
                Math.min(
                    maxY,
                    translateY
                )
            );

    }


    function setZoom(
        newScale,
        centerX =
            imageWrapper.clientWidth / 2,
        centerY =
            imageWrapper.clientHeight / 2
    ) {

        const oldScale =
            scale;


        newScale =
            Math.max(
                MIN_SCALE,
                Math.min(
                    MAX_SCALE,
                    newScale
                )
            );


        if (
            newScale ===
            oldScale
        ) {

            return;

        }


        const wrapperRect =
            imageWrapper.getBoundingClientRect();


        const pointX =
            centerX -
            wrapperRect.width / 2;


        const pointY =
            centerY -
            wrapperRect.height / 2;


        const scaleRatio =
            newScale /
            oldScale;


        translateX =
            pointX -
            (
                pointX -
                translateX
            ) *
            scaleRatio;


        translateY =
            pointY -
            (
                pointY -
                translateY
            ) *
            scaleRatio;


        scale =
            newScale;


        clampPosition();

        applyTransform();

        showZoomIndicator();

    }


    function updateNavigation() {

        prev.disabled =
            currentIndex === 0 ||
            scale > 1;


        next.disabled =
            currentIndex ===
                images.length - 1 ||
            scale > 1;

    }


    function updateFullscreen(
        index
    ) {

        if (
            index < 0 ||
            index >= images.length
        ) {

            return;

        }


        currentIndex =
            index;


        resetZoom(
            false
        );


        image.src =
            images[currentIndex];


        image.alt =
            `${restaurantName} 菜單 ${currentIndex + 1}`;


        counter.textContent =
            `${currentIndex + 1} / ${images.length}`;


        updateNavigation();

    }


    prev.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            if (
                scale > 1
            ) {

                return;

            }


            updateFullscreen(
                currentIndex - 1
            );

        }
    );


    next.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            if (
                scale > 1
            ) {

                return;

            }


            updateFullscreen(
                currentIndex + 1
            );

        }
    );


    fullscreen
        .querySelector(
            ".fullscreen-close"
        )
        .addEventListener(
            "click",
            () => {

                fullscreen.remove();

            }
        );


    fullscreen.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                fullscreen
            ) {

                fullscreen.remove();

            }

        }
    );


    // ==================================================
    // Touch Start
    // ==================================================

    imageWrapper.addEventListener(
        "touchstart",
        event => {

            touches =
                Array.from(
                    event.touches
                );


            if (
                touches.length === 2
            ) {

                isPinching =
                    true;


                isDragging =
                    false;


                pinchStartDistance =
                    getDistance(
                        touches[0],
                        touches[1]
                    );


                pinchStartScale =
                    scale;


                const center =
                    getTouchCenter(
                        touches[0],
                        touches[1]
                    );


                pinchCenterX =
                    center.x;


                pinchCenterY =
                    center.y;


                event.preventDefault();


                return;

            }


            if (
                touches.length === 1
            ) {

                isDragging =
                    true;


                isPinching =
                    false;


                lastTouchX =
                    touches[0].clientX;


                lastTouchY =
                    touches[0].clientY;

            }

        },
        {
            passive: false
        }
    );


    // ==================================================
    // Touch Move
    // ==================================================

    imageWrapper.addEventListener(
        "touchmove",
        event => {

            touches =
                Array.from(
                    event.touches
                );


            if (
                touches.length === 2 &&
                isPinching
            ) {

                event.preventDefault();


                const currentDistance =
                    getDistance(
                        touches[0],
                        touches[1]
                    );


                const distanceRatio =
                    currentDistance /
                    pinchStartDistance;


                scale =
                    Math.max(
                        MIN_SCALE,
                        Math.min(
                            MAX_SCALE,
                            pinchStartScale *
                            distanceRatio
                        )
                    );


                const center =
                    getTouchCenter(
                        touches[0],
                        touches[1]
                    );


                const wrapperRect =
                    imageWrapper.getBoundingClientRect();


                const centerX =
                    center.x -
                    wrapperRect.left;


                const centerY =
                    center.y -
                    wrapperRect.top;


                const pointX =
                    centerX -
                    wrapperRect.width / 2;


                const pointY =
                    centerY -
                    wrapperRect.height / 2;


                const ratio =
                    scale /
                    pinchStartScale;


                translateX =
                    pointX -
                    (
                        pointX -
                        translateX
                    ) *
                    ratio;


                translateY =
                    pointY -
                    (
                        pointY -
                        translateY
                    ) *
                    ratio;


                clampPosition();

                applyTransform();

                showZoomIndicator();


                return;

            }


            if (
                touches.length === 1 &&
                isDragging &&
                scale > 1
            ) {

                event.preventDefault();


                const currentX =
                    touches[0].clientX;


                const currentY =
                    touches[0].clientY;


                translateX +=
                    currentX -
                    lastTouchX;


                translateY +=
                    currentY -
                    lastTouchY;


                lastTouchX =
                    currentX;


                lastTouchY =
                    currentY;


                clampPosition();

                applyTransform();

            }

        },
        {
            passive: false
        }
    );


    // ==================================================
    // Touch End
    // ==================================================

    imageWrapper.addEventListener(
        "touchend",
        event => {

            touches =
                Array.from(
                    event.touches
                );


            if (
                isPinching &&
                touches.length < 2
            ) {

                isPinching =
                    false;


                if (
                    scale < 1.05
                ) {

                    resetZoom();

                }

                else {

                    clampPosition();

                    applyTransform(
                        true
                    );

                }

            }


            if (
                touches.length === 0
            ) {

                isDragging =
                    false;

            }

        },
        {
            passive: true
        }
    );


    // ==================================================
    // Touch Cancel
    // ==================================================

    imageWrapper.addEventListener(
        "touchcancel",
        () => {

            touches =
                [];


            isPinching =
                false;


            isDragging =
                false;

        },
        {
            passive: true
        }
    );


    // ==================================================
    // Double Tap
    // ==================================================

    imageWrapper.addEventListener(
        "touchend",
        event => {

            if (
                event.changedTouches.length !== 1
            ) {

                return;

            }


            const now =
                Date.now();


            const timeSinceLastTap =
                now -
                lastTapTime;


            lastTapTime =
                now;


            if (
                timeSinceLastTap < 300
            ) {

                event.preventDefault();


                if (
                    scale > 1
                ) {

                    resetZoom();

                }

                else {

                    const touch =
                        event.changedTouches[0];


                    const rect =
                        imageWrapper.getBoundingClientRect();


                    const x =
                        touch.clientX -
                        rect.left;


                    const y =
                        touch.clientY -
                        rect.top;


                    scale =
                        2;


                    translateX =
                        -(
                            x -
                            rect.width / 2
                        );


                    translateY =
                        -(
                            y -
                            rect.height / 2
                        );


                    clampPosition();

                    applyTransform(
                        true
                    );

                    showZoomIndicator();

                }

            }

        },
        {
            passive: false
        }
    );


    // ==================================================
    // Mouse Wheel
    // ==================================================

    imageWrapper.addEventListener(
        "wheel",
        event => {

            event.preventDefault();


            const rect =
                imageWrapper.getBoundingClientRect();


            const x =
                event.clientX -
                rect.left;


            const y =
                event.clientY -
                rect.top;


            const zoomAmount =
                event.deltaY < 0
                    ? 1.15
                    : 0.87;


            setZoom(
                scale *
                zoomAmount,
                x,
                y
            );

        },
        {
            passive: false
        }
    );


    // ==================================================
    // Keyboard
    // ==================================================

    function keyboardHandler(
        event
    ) {

        if (
            event.key ===
            "Escape"
        ) {

            fullscreen.remove();


            document.removeEventListener(
                "keydown",
                keyboardHandler
            );


            return;

        }


        if (
            event.key ===
            "ArrowLeft"
        ) {

            if (
                scale <= 1
            ) {

                updateFullscreen(
                    currentIndex - 1
                );

            }

        }


        if (
            event.key ===
            "ArrowRight"
        ) {

            if (
                scale <= 1
            ) {

                updateFullscreen(
                    currentIndex + 1
                );

            }

        }


        if (
            event.key === "+" ||
            event.key === "="
        ) {

            setZoom(
                scale + 0.25
            );

        }


        if (
            event.key === "-"
        ) {

            setZoom(
                scale - 0.25
            );

        }


        if (
            event.key === "0"
        ) {

            resetZoom();

        }

    }


    document.addEventListener(
        "keydown",
        keyboardHandler
    );


    image.addEventListener(
        "load",
        () => {

            resetZoom(
                false
            );

        }
    );


    function getDistance(
        touch1,
        touch2
    ) {

        const dx =
            touch1.clientX -
            touch2.clientX;


        const dy =
            touch1.clientY -
            touch2.clientY;


        return Math.sqrt(
            dx * dx +
            dy * dy
        );

    }


    function getTouchCenter(
        touch1,
        touch2
    ) {

        return {

            x:
                (
                    touch1.clientX +
                    touch2.clientX
                ) / 2,

            y:
                (
                    touch1.clientY +
                    touch2.clientY
                ) / 2

        };

    }


    updateFullscreen(
        currentIndex
    );

}


// ==================================================
// Initialize Menu Features
// ==================================================

initializeTheme();
initializeDisplaySettings();
initializeRestaurantImageUpload();
initializeWeeklyHours();
initializeMenuPreview();

initializeMenuRemoveButtons();

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {
            navigator.serviceWorker.register(
                "./service-worker.js",
                {
                    scope: "./"
                }
            ).catch(
                error => console.error(
                    "❌ Service Worker 註冊失敗：",
                    error
                )
            );
        }
    );

}

// ==================================================
// Supabase Connection Test
// ==================================================

async function testSupabaseConnection() {

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("restaurants")
                .select("id")
                .limit(1);


        if (
            error
        ) {

            console.error(
                "❌ Supabase 連線 / 查詢失敗：",
                error
            );


            supabaseConnected =
                false;


            return false;

        }


        console.log(
            "✅ Supabase 連線成功！",
            data
        );


        supabaseConnected =
            true;


        return true;

    }

    catch (
        error
    ) {

        console.error(
            "❌ Supabase Failed to Fetch：",
            error
        );


        supabaseConnected =
            false;


        return false;

    }

}

testSupabaseConnection();


// ==================================================
// Load Restaurants From Supabase
// ==================================================

async function loadRestaurants() {

    console.log("☁️ 正在從 Supabase 讀取餐廳資料...");

    const {
        data,
        error
    } = await supabaseClient
        .from("restaurants")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    // ==================================================
    // Supabase 讀取失敗
    // ==================================================

    if (error) {

        console.error(
            "❌ Supabase 讀取餐廳失敗：",
            error
        );

        loadRestaurantsFromLocal();

        return;

    }


    console.log(
        "✅ Supabase 原始資料：",
        data
    );


    // ==================================================
    // 將 Supabase 資料轉換成網站使用的格式
    // ==================================================

    restaurants =
        (data || []).map(
            restaurant => ({

                // ------------------------------------------
                // 基本資料
                // ------------------------------------------

                id:
                    restaurant.id,

                name:
                    restaurant.name || "",

                category:
                    restaurant.category || "",


                // ------------------------------------------
                // ⭐ 評分
                // ------------------------------------------

                rating:
                    restaurant.rating !== null &&
                    restaurant.rating !== undefined
                        ? Number(
                            restaurant.rating
                        )
                        : null,


                // ------------------------------------------
                // 🖼️ 餐廳圖片
                // ------------------------------------------

                image:
                    restaurant.restaurant_image_url || "",


                // ------------------------------------------
                // ☎️ 電話
                // ------------------------------------------

                phone:
                    restaurant.phone || "",


                // ------------------------------------------
                // 📍 地址
                // ------------------------------------------

                address:
                    restaurant.address || "",


                // ------------------------------------------
                // 🕐 營業時間
                // ------------------------------------------

                hours:
                    normalizeWeeklyHours(restaurant.opening_hours),


                // ------------------------------------------
                // 🗺️ Google Maps
                // ------------------------------------------

                maps:
                    restaurant.google_maps_url || "",


                // ------------------------------------------
                // 📖 菜單圖片
                // ------------------------------------------

                menuImages:
                    Array.isArray(
                        restaurant.menu_images
                    )
                        ? restaurant.menu_images.filter(Boolean)
                        : [],


                // ------------------------------------------
                // 📝 備註
                // ------------------------------------------

                description:
                    restaurant.notes || "",


                // ------------------------------------------
                // ❤️ 收藏
                // ------------------------------------------

                favorite:
                    restaurant.favorite === true

            })
        );


    console.log(
        "✅ 轉換後的網站餐廳資料：",
        restaurants
    );


    // ==================================================
    // 更新畫面
    // ==================================================

    renderRestaurants();

}

function initializeDisplaySettings() {
    const closeButton = document.getElementById("closeDisplaySettings");
    const editOrderButton = document.getElementById("editOrderButton");

    displaySettingsButton.addEventListener("click", () => {
        displaySettingsModal.classList.add("show");
        updateDisplaySettingsControls();
    });

    closeButton.addEventListener("click", () => {
        displaySettingsModal.classList.remove("show");
    });

    displaySettingsModal.addEventListener("click", event => {
        if (event.target === displaySettingsModal) {
            displaySettingsModal.classList.remove("show");
        }
    });

    document.querySelectorAll("#fontSizeOptions button").forEach(button => {
        button.addEventListener("click", () => {
            displaySettings.fontSize = button.dataset.fontSize;
            saveDisplaySettings();
            applyDisplaySettings();
            updateDisplaySettingsControls();
        });
    });

    document.querySelectorAll("#viewModeOptions button").forEach(button => {
        button.addEventListener("click", () => {
            displaySettings.viewMode = button.dataset.viewMode;
            saveDisplaySettings();
            renderRestaurants();
            updateDisplaySettingsControls();
        });
    });

    document.querySelectorAll("#themeOptions button").forEach(button => {
        button.addEventListener("click", () => {
            const theme = button.dataset.themeMode;

            localStorage.setItem("theme", theme);
            applyTheme(theme);
            updateDisplaySettingsControls();
        });
    });

    editOrderButton.addEventListener("click", () => {
        displaySettingsModal.classList.remove("show");
        renderOrderEditor();
        orderSettingsModal.classList.add("show");
    });

    document.getElementById("finishOrderButton").addEventListener("click", () => {
        const orderList = document.getElementById("orderList");

        displaySettings.customOrder = [...orderList.querySelectorAll("[data-order-id]")]
            .map(item => item.dataset.orderId);
        saveDisplaySettings();
        orderSettingsModal.classList.remove("show");
        renderRestaurants();
    });

    updateDisplaySettingsControls();
}

function updateDisplaySettingsControls() {
    document.querySelectorAll("#fontSizeOptions button").forEach(button => {
        button.classList.toggle("active", button.dataset.fontSize === displaySettings.fontSize);
    });

    document.querySelectorAll("#viewModeOptions button").forEach(button => {
        button.classList.toggle("active", button.dataset.viewMode === displaySettings.viewMode);
    });

    document.querySelectorAll("#themeOptions button").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.themeMode === (localStorage.getItem("theme") || "system")
        );
    });
}

function renderOrderEditor() {
    const orderList = document.getElementById("orderList");
    const orderedRestaurants = getOrderedRestaurants(restaurants);

    orderList.innerHTML = orderedRestaurants.map((restaurant, index) => `
        <div class="order-item" draggable="true" data-order-id="${restaurant.id}">
            <span class="order-drag-handle">☰</span>
            <span class="order-item-name">${restaurant.name || "未命名餐廳"}</span>
            <button type="button" class="order-move-button" data-direction="up" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="order-move-button" data-direction="down" ${index === orderedRestaurants.length - 1 ? "disabled" : ""}>↓</button>
        </div>
    `).join("");

    orderList.querySelectorAll(".order-move-button").forEach(button => {
        button.addEventListener("click", () => {
            const item = button.closest(".order-item");
            const target = button.dataset.direction === "up"
                ? item.previousElementSibling
                : item.nextElementSibling;

            if (target) {
                button.dataset.direction === "up"
                    ? orderList.insertBefore(item, target)
                    : orderList.insertBefore(target, item);
                renderOrderEditorButtons();
            }
        });
    });

    let draggedItem;

    orderList.querySelectorAll(".order-item").forEach(item => {
        item.addEventListener("dragstart", () => {
            draggedItem = item;
            item.classList.add("is-dragging");
        });
        item.addEventListener("dragend", () => {
            item.classList.remove("is-dragging");
            draggedItem = null;
        });
        item.addEventListener("dragover", event => {
            event.preventDefault();
            if (draggedItem && draggedItem !== item) {
                const rect = item.getBoundingClientRect();
                const after = event.clientY > rect.top + rect.height / 2;
                orderList.insertBefore(draggedItem, after ? item.nextSibling : item);
            }
        });
    });
}

function renderOrderEditorButtons() {
    const items = [...document.querySelectorAll("#orderList .order-item")];

    items.forEach((item, index) => {
        item.querySelector('[data-direction="up"]').disabled = index === 0;
        item.querySelector('[data-direction="down"]').disabled = index === items.length - 1;
    });
}

function renderEmptyState(restaurantData) {
    const keyword = searchInput.value.trim();
    const activeCategory =
        document.querySelector(".category.active")?.dataset.category;
    const isSearchEmpty = keyword.length > 0;
    const isFavoriteEmpty = activeCategory === "收藏";
    const icon = isSearchEmpty ? "🔍" : isFavoriteEmpty ? "♡" : "🏪";
    const title = isSearchEmpty
        ? "找不到店家"
        : isFavoriteEmpty
            ? "還沒有收藏"
            : "還沒有店家";
    const description = isSearchEmpty
        ? `沒有符合「${escapeHtml(keyword)}」的結果`
        : isFavoriteEmpty
            ? "點擊店家上的愛心，收藏喜歡的店家"
            : "新增你常去的店家，開始建立自己的店家清單";

    restaurantList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <h2>${title}</h2>
            <p>${description}</p>
            ${isSearchEmpty ? "" : `
                <button type="button" class="empty-state-button" data-empty-action="${isFavoriteEmpty ? "all" : "add"}">
                    ${isFavoriteEmpty ? "查看全部店家" : "＋ 新增店家"}
                </button>
            `}
        </div>
    `;

    const action = restaurantList.querySelector("[data-empty-action]");

    action?.addEventListener("click", () => {
        if (action.dataset.emptyAction === "add") {
            addRestaurantButton.click();
            return;
        }

        document.querySelector('[data-category="全部"]')?.click();
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showSkeletonLoading() {
    restaurantList.innerHTML = Array.from({ length: 3 }, () => `
        <article class="skeleton-card" aria-hidden="true">
            <div class="skeleton-block skeleton-image"></div>
            <div class="skeleton-content">
                <div class="skeleton-block skeleton-title"></div>
                <div class="skeleton-block skeleton-line"></div>
                <div class="skeleton-block skeleton-line short"></div>
            </div>
        </article>
    `).join("");
}

function finishAppStartup() {
    const splash = document.getElementById("appSplash");

    if (!splash) {
        return;
    }

    const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;

    if (!isStandalone) {
        splash.remove();
        return;
    }

    splash.classList.add("is-leaving");
    splash.addEventListener("animationend", () => splash.remove(), { once: true });
}