import { supabaseClient } from './supabase.js';
import { STORAGE_KEYS, DISPLAY_SETTINGS_DEFAULTS } from './config.js';
import { handleStorageError } from './utils.js';

// Global state for current user
let currentUser = null;

// Set current user for storage namespacing
export function setCurrentUser(user) {
    currentUser = user;
}

// Get current user for storage namespacing
export function getCurrentUser() {
    return currentUser;
}

// Get storage namespace based on current user
function getStorageNamespace() {
    return currentUser?.id || "guest";
}

// Get user-specific storage keys
function getRestaurantsStorageKey() {
    return `${STORAGE_KEYS.RESTAURANTS}_${getStorageNamespace()}`;
}

function getRestaurantGroupsStorageKey() {
    return `${STORAGE_KEYS.RESTAURANT_GROUPS}_${getStorageNamespace()}`;
}

function getCurrentGroupStorageKey() {
    return `${STORAGE_KEYS.CURRENT_GROUP}_${getStorageNamespace()}`;
}

function getDisplaySettingsStorageKey() {
    return `${STORAGE_KEYS.DISPLAY_SETTINGS}_${getStorageNamespace()}`;
}

// Legacy storage migration
function migrateLegacyGuestStorage() {
    // Skip migration if not in guest mode to avoid QuotaExceededError
    // We use fallback mechanism in loadRestaurantsFromLocal instead
    return;

    if (currentUser !== null) return;

    const pairs = [
        { oldKey: STORAGE_KEYS.RESTAURANTS, newKey: getRestaurantsStorageKey() },
        { oldKey: STORAGE_KEYS.RESTAURANT_GROUPS, newKey: getRestaurantGroupsStorageKey() },
        { oldKey: STORAGE_KEYS.CURRENT_GROUP, newKey: getCurrentGroupStorageKey() }
    ];

    pairs.forEach(({ oldKey, newKey }) => {
        try {
            if (localStorage.getItem(newKey) !== null) {
                return;
            }
            const oldVal = localStorage.getItem(oldKey);
            if (oldVal !== null) {
                localStorage.setItem(newKey, oldVal);
            }
        } catch (e) {
            if (e?.name === "QuotaExceededError" || (e && e.code === 22)) {
                console.warn(`⚠️ Legacy migration skipped due to LocalStorage quota (${oldKey} -> ${newKey}):`, e);
            } else {
                console.error(`❌ Migration error for ${oldKey} -> ${newKey}:`, e);
            }
        }
    });
}

// Cleanup legacy storage
function cleanupLegacyStorage() {
    const legacyKey = STORAGE_KEYS.RESTAURANTS;
    const currentKey = getRestaurantsStorageKey();

    // Only clear legacy key if new key has data and they're different
    if (currentKey !== legacyKey && localStorage.getItem(currentKey) && localStorage.getItem(legacyKey)) {
        try {
            console.log("🧹 發現 Legacy LocalStorage，執行清除：", legacyKey);
            localStorage.removeItem(legacyKey);
        } catch (e) {
            console.error("❌ 清除 Legacy LocalStorage 失敗：", e);
        }
    }
}

// Restaurant storage operations
export function saveRestaurantsLocal(restaurants) {
    try {
        localStorage.setItem(getRestaurantsStorageKey(), JSON.stringify(restaurants));
    } catch (error) {
        handleStorageError(error, "儲存餐廳資料");
    }
}

export function loadRestaurantsFromLocal() {
    try {
        const storageKey = getRestaurantsStorageKey();
        let rawData = localStorage.getItem(storageKey);

        // Guest fallback mechanism
        if (storageKey === "restaurants_guest" && (rawData === null || rawData === "[]")) {
            const oldData = localStorage.getItem(STORAGE_KEYS.RESTAURANTS);
            if (oldData) {
                rawData = oldData;
            }
        }

        const savedRestaurants = JSON.parse(rawData || "[]");
        return Array.isArray(savedRestaurants) ? savedRestaurants : [];
    } catch {
        return [];
    }
}

// Group storage operations
export function saveGroupsLocal(groups, currentGroupId) {
    try {
        localStorage.setItem(getRestaurantGroupsStorageKey(), JSON.stringify(groups));
        localStorage.setItem(getCurrentGroupStorageKey(), currentGroupId || "");
    } catch (error) {
        handleStorageError(error, "儲存群組資料");
    }
}

export function loadGroupsFromLocal() {
    try {
        const saved = JSON.parse(localStorage.getItem(getRestaurantGroupsStorageKey()) || "[]");
        const groups = Array.isArray(saved)
            ? saved
                .filter(group => group && group.id && group.name)
                .map(group => ({
                    id: String(group.id),
                    name: String(group.name),
                    created_at: group.created_at || null
                }))
            : [];

        const currentGroupId = localStorage.getItem(getCurrentGroupStorageKey()) || null;
        return { groups, currentGroupId };
    } catch {
        return { groups: [], currentGroupId: null };
    }
}

// Display settings storage operations
export async function loadDisplaySettings() {
    try {
        let saved = null;
        const user = getCurrentUser();

        // 1. Try loading from Supabase if logged in
        if (user) {
            const { data, error } = await supabaseClient
                .from('user_profiles')
                .select('display_settings')
                .eq('id', user.id)
                .single();
            
            if (!error && data?.display_settings) {
                saved = data.display_settings;
                localStorage.setItem(getDisplaySettingsStorageKey(), JSON.stringify(saved));
            }
        }

        // 2. Fallback to localStorage if not loaded from Supabase
        if (!saved) {
            const raw = localStorage.getItem(getDisplaySettingsStorageKey());
            if (raw) saved = JSON.parse(raw);
        }

        // Handle customOrder with per-group ordering
        let customOrder = {};

        if (Array.isArray(saved?.customOrder)) {
            customOrder = { __legacy__: saved.customOrder.map(String) };
        } else if (saved?.customOrder && typeof saved.customOrder === "object") {
            Object.entries(saved.customOrder).forEach(([groupId, ids]) => {
                if (Array.isArray(ids)) {
                    customOrder[groupId] = ids.map(String);
                }
            });
        }

        return {
            fontSize: ["extra-small", "small", "medium", "large", "extra-large"].includes(saved?.fontSize)
                ? saved.fontSize
                : DISPLAY_SETTINGS_DEFAULTS.fontSize,
            viewMode: saved?.viewMode === "list" ? "list" : "card",
            customOrder,
            visibleCategories: Array.isArray(saved?.visibleCategories)
                ? saved.visibleCategories
                : [...DISPLAY_SETTINGS_DEFAULTS.visibleCategories]
        };
    } catch {
        return { ...DISPLAY_SETTINGS_DEFAULTS };
    }
}

export async function saveDisplaySettings(settings) {
    try {
        localStorage.setItem(getDisplaySettingsStorageKey(), JSON.stringify(settings));

        const user = getCurrentUser();
        if (user) {
            const { error } = await supabaseClient
                .from('user_profiles')
                .update({ display_settings: settings })
                .eq('id', user.id);
            
            if (error) {
                console.error("❌ 無法同步顯示設置至 Supabase：", error);
            }
        }
    } catch (error) {
        handleStorageError(error, "儲存顯示設置");
    }
}

// Theme storage operations
export function loadTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || "system";
}

export function saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

// Announcements storage operations
export function loadAnnouncementsData() {
    try {
        const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS_CACHE));
        const lastViewed = localStorage.getItem(STORAGE_KEYS.LAST_VIEWED_ANNOUNCEMENTS) || new Date(0).toISOString();
        return { cached, lastViewed };
    } catch {
        return { cached: null, lastViewed: new Date(0).toISOString() };
    }
}

export function saveAnnouncementsData(announcements, lastViewed) {
    try {
        if (announcements) {
            localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS_CACHE, JSON.stringify(announcements));
        }
        if (lastViewed) {
            localStorage.setItem(STORAGE_KEYS.LAST_VIEWED_ANNOUNCEMENTS, lastViewed);
        }
    } catch (error) {
        handleStorageError(error, "儲存公告資料");
    }
}

// Export utility functions
export {
    migrateLegacyGuestStorage,
    cleanupLegacyStorage,
    getStorageNamespace
};