/* ==================================================
   UI Rendering Module
================================================== */

import { escapeHtml } from './utils.js';
import { getHoursSummary, getWeeklyHoursText } from './restaurant.js';
import { toggleFavorite } from './restaurant.js';
import { getGroupFilteredRestaurants } from './group.js';
import { getRestaurants } from './restaurant.js';
import { changeTheme } from './theme.js';
import { renderOrderEditor, renderCategoryScroll } from './app.js';
import { getCurrentGroupId, canEditCurrentGroup } from './group.js';
import { getCurrentUser, loadDisplaySettings, saveDisplaySettings } from './storage.js';
import { ALL_CATEGORIES } from './config.js';


// Global Toast Handler
const toastContainer = document.getElementById("toastContainer");

export function showToast(message, duration = 3000) {
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    // Auto remove
    setTimeout(() => {
        toast.classList.remove("show");
        toast.addEventListener("transitionend", () => {
            toast.remove();
        }, { once: true });
    }, duration);
}

// DOM Elements
const restaurantList = document.getElementById("restaurantList");
const searchInput = document.getElementById("searchInput");
const clearSearchButton = document.getElementById("clearSearchButton");
const categories = document.querySelectorAll(".category");
const addRestaurantButton = document.getElementById("addRestaurantButton");
const restaurantModal = document.getElementById("restaurantModal");
const closeModal = document.getElementById("closeModal");
const restaurantForm = document.getElementById("restaurantForm");
const displaySettingsButton = document.getElementById("displaySettingsButton");
const displaySettingsModal = document.getElementById("displaySettingsModal");
const orderSettingsModal = document.getElementById("orderSettingsModal");
const categoryVisibilityModal = document.getElementById("categoryVisibilityModal");

// Display settings
let displaySettings = loadDisplaySettings();

// Listen to auth state changes to reload user-scoped display settings
window.addEventListener('authStateChanged', () => {
    displaySettings = loadDisplaySettings();
    updateDisplaySettingsControls();
    renderCategoryScroll();
});

// Get display settings
export function getDisplaySettings() {
    return displaySettings;
}

// Set display settings
export function setDisplaySettings(settings) {
    displaySettings = settings;
}

// Get ordered restaurants
export function getOrderedRestaurants(source) {
    const currentGroupId = document.getElementById("groupSwitchLabel")?.dataset.currentGroupId || null;
    const orderForGroup = displaySettings.customOrder[currentGroupId] || [];
    const available = new Map(source.map(restaurant => [String(restaurant.id), restaurant]));
    const ordered = orderForGroup
        .map(id => available.get(String(id)))
        .filter(Boolean);
    const orderedIds = new Set(ordered.map(restaurant => String(restaurant.id)));

    return ordered.concat(
        source.filter(restaurant => !orderedIds.has(String(restaurant.id)))
    );
}

// Apply display settings
export function applyDisplaySettings() {
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

// Render restaurants
export function renderRestaurants(restaurantData) {
    restaurantList.innerHTML = "";
    applyDisplaySettings();

    const groupScopedRestaurants = getGroupFilteredRestaurants(restaurantData);
    const visibleRestaurants = getOrderedRestaurants(groupScopedRestaurants);

    if (visibleRestaurants.length === 0) {
        renderEmptyState(restaurantData);
        return;
    }

    visibleRestaurants.forEach(restaurant => {
        const card = createRestaurantCard(restaurant);
        restaurantList.appendChild(card);
    });
}

// Create restaurant card
function createRestaurantCard(restaurant) {
    const article = document.createElement("article");
    article.className = "restaurant-card";
    article.dataset.id = String(restaurant.id);

    const menuCount = restaurant.menuImages ? restaurant.menuImages.filter(Boolean).length : 0;
    const phoneDisplay = restaurant.phone || "";
    const phoneTel = phoneDisplay.replace(/[^\d+]/g, "");
    const restaurantImage = getRestaurantImageSrc(restaurant.image);

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
                        <div class="restaurant-image-placeholder" hidden>
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
                class="favorite ${restaurant.favorite ? "liked" : ""}"
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
                    <h2>${restaurant.name}</h2>
                    <p class="rating">★ ${restaurant.rating || "—"}</p>
                </div>
                <span class="tag">${restaurant.category}</span>
            </div>
            <p class="location">📍 ${restaurant.address || "尚未提供地址"}</p>
            <button type="button" class="hours" data-hours-id="${restaurant.id}">
                ${getHoursSummary(restaurant)}
            </button>
            ${
                phoneDisplay
                    ? `
                        <a href="tel:${phoneTel}" class="restaurant-phone" aria-label="撥打 ${phoneDisplay}">
                            📞 ${phoneDisplay}
                        </a>
                    `
                    : ""
            }
            <div class="card-actions">
                <button class="menu-button" data-id="${restaurant.id}">
                    📖 菜單 ${menuCount > 0 ? ` · ${menuCount} 張` : ""}
                </button>
                <button class="view-button" data-id="${restaurant.id}">
                    查看資訊
                </button>
            </div>
        </div>
    `;

    // Add event listeners
    const testImage = article.querySelector(".restaurant-image img");
    if (testImage) {
        testImage.addEventListener("load", () => {
            console.log("✅ IMG 成功載入：", restaurant.name);
        });
        testImage.addEventListener("error", () => {
            console.error("❌ IMG 載入失敗：", restaurant.name);
        });
    }

    // Favorite button
    article.querySelector(".favorite").addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(restaurant.id, event.currentTarget);
    });

    // Menu button
    article.querySelector(".menu-button").addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent('openMenuViewer', { 
            detail: { restaurant }
        }));
    });

    // Hours button
    article.querySelector(".hours").addEventListener("click", () => {
        alert(`營業時間\n\n${getWeeklyHoursText(restaurant)}`);
    });

    // View button
    article.querySelector(".view-button").addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent('showRestaurantDetail', { 
            detail: { restaurant }
        }));
    });

    return article;
}

// Get restaurant image source
function getRestaurantImageSrc(image) {
    if (!image) {
        return "";
    }

    image = String(image).trim();
    if (!image) {
        return "";
    }

    // Data URL
    if (image.startsWith("data:image/")) {
        return image;
    }

    // Network images
    if (image.startsWith("http://") || image.startsWith("https://") || image.startsWith("blob:")) {
        return image;
    }

    // Invalid paths
    if (image.startsWith("file:///") || image.startsWith("C:\\fakepath\\") || image.startsWith("C:/fakepath/")) {
        return "";
    }

    // Base64 detection
    if (image.startsWith("/9j/") || image.startsWith("/9J/")) {
        return `data:image/jpeg;base64,${image}`;
    }
    if (image.startsWith("iVBORw0KGgo")) {
        return `data:image/png;base64,${image}`;
    }
    if (image.startsWith("R0lGOD")) {
        return `data:image/gif;base64,${image}`;
    }
    if (image.startsWith("UklGR")) {
        return `data:image/webp;base64,${image}`;
    }

    // Long base64 strings
    if (image.length > 1000 && /^[A-Za-z0-9+/=\s]+$/.test(image)) {
        return `data:image/jpeg;base64,${image}`;
    }

    return image;
}

// Render empty state
export function renderEmptyState(restaurantData) {
    const keyword = searchInput.value.trim();
    const activeCategory = document.querySelector(".category.active")?.dataset.category;
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

    const showButton = !isSearchEmpty && (isFavoriteEmpty);
    const buttonText = isFavoriteEmpty ? "查看全部店家" : "＋ 新增店家";

    restaurantList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <h2>${title}</h2>
            <p>${description}</p>
            ${showButton ? `
                <button type="button" class="empty-state-button" data-empty-action="${isFavoriteEmpty ? "all" : "add"}">
                    ${buttonText}
                </button>
            ` : ""}
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

// Show skeleton loading
export function showSkeletonLoading() {
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

// Update group switch button
export function updateGroupSwitchButton(groupName, isReadonly) {
    const label = document.getElementById("groupSwitchLabel");
    const addRestaurantButton = document.getElementById("addRestaurantButton");
    const editOrderButton = document.getElementById("editOrderButton");
    
    if (label) {
        let name = groupName;
        if (isReadonly) {
            name += " 👁️ 唯讀";
        }
        label.textContent = name;
    }

    const currentUser = getCurrentUser();
    const canEdit = currentUser && canEditCurrentGroup();

    if (addRestaurantButton) {
        addRestaurantButton.hidden = !canEdit;
        addRestaurantButton.style.display = canEdit ? "" : "none";
    }

    if (editOrderButton) {
        editOrderButton.hidden = !canEdit;
    }
}

// Finish app startup (remove splash screen)
export function finishAppStartup() {
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

// Clean display order
export function cleanDisplayOrder(restaurants) {
    const existingIds = new Set(
        restaurants.map(restaurant => String(restaurant.id))
    );

    Object.keys(displaySettings.customOrder).forEach(groupId => {
        displaySettings.customOrder[groupId] =
            (displaySettings.customOrder[groupId] || []).filter(
                id => existingIds.has(String(id))
            );
    });

    saveDisplaySettings(displaySettings);
}

export function initializeDisplaySettings() {
    const displaySettingsButton = document.getElementById("displaySettingsButton");
    const closeButton = document.getElementById("closeDisplaySettings");
    const editOrderButton = document.getElementById("editOrderButton");
    const authSettingsButton = document.getElementById("authSettingsButton");
    const displaySettingsModal = document.getElementById("displaySettingsModal");
    const orderSettingsModal = document.getElementById("orderSettingsModal");

    console.log("🔍 初始化顯示設定模組...");
    if (!displaySettingsModal) console.error("❌ 找不到 #displaySettingsModal");

    const openDisplaySettingsModal = () => {
        displaySettingsModal?.classList.add("show");
        console.log("🖱️ 點擊顯示設定按鈕");

        updateDisplaySettingsControls();
    };

    if (displaySettingsButton) {
        displaySettingsButton.addEventListener("click", () => {
            openDisplaySettingsModal();
            console.log("🖱️ 點擊個人資料選單設定按鈕");
        });
    }

    if (authSettingsButton) {
        authSettingsButton.addEventListener("click", (e) => {
            e.stopPropagation();
            openDisplaySettingsModal();
        });
    }

    closeButton?.addEventListener("click", () => {
        displaySettingsModal?.classList.remove("show");
    });

    displaySettingsModal?.addEventListener("click", event => {
        if (event.target === displaySettingsModal) {
            displaySettingsModal.classList.remove("show");
        }
    });

    document.querySelectorAll("#fontSizeOptions button").forEach(button => {
        button.addEventListener("click", () => {
            const settings = getDisplaySettings();
            settings.fontSize = button.dataset.fontSize;
            setDisplaySettings(settings);
            saveDisplaySettings(settings);
            applyDisplaySettings();
            updateDisplaySettingsControls();
        });
    });

    document.querySelectorAll("#viewModeOptions button").forEach(button => {
        button.addEventListener("click", () => {
            const settings = getDisplaySettings();
            settings.viewMode = button.dataset.viewMode;
            setDisplaySettings(settings);
            saveDisplaySettings(settings);
            renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
            updateDisplaySettingsControls();
        });
    });

    document.querySelectorAll("#themeOptions button").forEach(button => {
        button.addEventListener("click", () => {
            const theme = button.dataset.themeMode;
            changeTheme(theme);
            updateDisplaySettingsControls();
        });
    });

    const editCategoryVisibilityButton = document.getElementById("editCategoryVisibilityButton");
    editCategoryVisibilityButton?.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log("🖱️ 點擊顯示分類管理按鈕");
        
        if (displaySettingsModal) displaySettingsModal.classList.remove("show");
        
        renderCategoryVisibilityManager();
        if (categoryVisibilityModal) {
            categoryVisibilityModal.classList.add("show");
            console.log("✅ 分類管理模組已開啟");
        }
    });

    document.getElementById("finishCategoryVisibilityButton")?.addEventListener("click", () => {
        saveCategoryVisibilityFromModal();
        if (categoryVisibilityModal) {
            categoryVisibilityModal.classList.remove("show");
            categoryVisibilityModal.style.display = "";
        }
    });

    categoryVisibilityModal?.addEventListener("click", event => {
        if (event.target === categoryVisibilityModal) {
            saveCategoryVisibilityFromModal();
            categoryVisibilityModal.classList.remove("show");
            categoryVisibilityModal.style.display = "";
        }
    });

    editOrderButton?.addEventListener("click", () => {
        displaySettingsModal.classList.remove("show");
        renderOrderEditor();
        orderSettingsModal.classList.add("show");
    });
    document.getElementById("finishOrderButton")?.addEventListener("click", () => {
        const orderList = document.getElementById("orderList");
        const settings = getDisplaySettings();
        settings.customOrder[getCurrentGroupId()] = [...orderList.querySelectorAll("[data-order-id]")]
            .map(item => item.dataset.orderId);
        setDisplaySettings(settings);
        saveDisplaySettings(settings);
        orderSettingsModal.classList.remove("show");
        renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
    });

    updateDisplaySettingsControls();
}

function updateDisplaySettingsControls() {
    const settings = getDisplaySettings();
    document.querySelectorAll("#fontSizeOptions button").forEach(button => {
        button.classList.toggle("active", button.dataset.fontSize === settings.fontSize);
    });

    document.querySelectorAll("#viewModeOptions button").forEach(button => {
        button.classList.toggle("active", button.dataset.viewMode === settings.viewMode);
    });

    document.querySelectorAll("#themeOptions button").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.themeMode === (localStorage.getItem("theme") || "system")
        );
    });

    // Category visibility manager is now handled in its dedicated modal via renderCategoryVisibilityManager()
}
function renderCategoryVisibilityManager() {
    const grid = document.getElementById("categoryVisibilityManager");
    if (!grid) {
        console.warn("⚠️ 找不到 #categoryVisibilityManager 元素");
        return;
    }

    const settings = getDisplaySettings();
    if (!Array.isArray(ALL_CATEGORIES) || ALL_CATEGORIES.length === 0) {
        console.error("❌ ALL_CATEGORIES 未正確載入或為空");
        grid.innerHTML = '<div style="padding: 10px; color: red; font-size: 13px;">分類資料載入失敗</div>';
        return;
    }

    const visibleSet = new Set(settings.visibleCategories || ALL_CATEGORIES.map(c => c.name));
    grid.innerHTML = ALL_CATEGORIES.map(cat => {
        const isChecked = visibleSet.has(cat.name) ? "checked" : "";
        return `
            <label class="category-visibility-item">
                <input type="checkbox" value="${escapeHtml(cat.name)}" ${isChecked} class="category-visibility-checkbox">
                <span>${cat.icon} ${escapeHtml(cat.name)}</span>
            </label>
        `;
    }).join("");
}

function saveCategoryVisibilityFromModal() {
    const grid = document.getElementById("categoryVisibilityManager");
    if (!grid) return;

    const currentSettings = getDisplaySettings();
    const checkedBoxes = grid.querySelectorAll(".category-visibility-checkbox:checked");
    currentSettings.visibleCategories = Array.from(checkedBoxes).map(cb => cb.value);

    setDisplaySettings(currentSettings);
    saveDisplaySettings(currentSettings);
    renderCategoryScroll();
}