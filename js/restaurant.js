/* ==================================================
   Restaurant Data Model and Operations
================================================== */

import { WEEK_DAYS } from './config.js';
import { supabaseClient, isMissingGroupTableOrColumnError, isSupabaseConnected } from './supabase.js';
import { getCurrentUser } from './storage.js';
import { showToast } from './utils.js';

// Global restaurant data
let restaurants = [];
let randomPickerResultId = null;

// Create empty weekly hours structure
export function createEmptyWeeklyHours() {
    return Object.fromEntries(
        WEEK_DAYS.map(day => [
            day.key,
            { open: false, start: "", end: "" }
        ])
    );
}

// Normalize weekly hours data
export function normalizeWeeklyHours(value) {
    let parsed = value;

    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            parsed = null;
        }
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const weeklyHours = createEmptyWeeklyHours();

        WEEK_DAYS.forEach(day => {
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

    // Legacy format support
    const legacyMatch = String(value || "").match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);

    if (legacyMatch) {
        return Object.fromEntries(
            WEEK_DAYS.map(day => [
                day.key,
                { open: true, start: legacyMatch[1], end: legacyMatch[2] }
            ])
        );
    }

    return createEmptyWeeklyHours();
}

// Format hours range for display
export function formatHoursRange(hours) {
    return hours.open && hours.start && hours.end
        ? `${hours.start}–${hours.end}`
        : "公休";
}

// Get today's hours for a restaurant
export function getTodayHours(restaurant) {
    const dayKey = WEEK_DAYS[(new Date().getDay() + 6) % 7].key;
    return normalizeWeeklyHours(restaurant.hours)[dayKey];
}

// Get hours summary for display
export function getHoursSummary(restaurant) {
    const todayHours = getTodayHours(restaurant);

    return todayHours.open && todayHours.start && todayHours.end
        ? `🟢 今日營業 ${todayHours.start}–${todayHours.end}`
        : "🔴 今日公休";
}

// Get weekly hours text for display
export function getWeeklyHoursText(restaurant) {
    const weeklyHours = normalizeWeeklyHours(restaurant.hours);

    return WEEK_DAYS.map(day =>
        `星期${day.label}　${formatHoursRange(weeklyHours[day.key])}`
    ).join("\n");
}

// Map Supabase row to restaurant object
export function mapSupabaseToRestaurant(row) {
    return {
        id: String(row.id),
        name: row.name || "",
        category: row.category || "",
        rating: row.rating !== null && row.rating !== undefined
            ? Number(row.rating)
            : null,
        image: row.restaurant_image_url || "",
        phone: row.phone || "",
        address: row.address || "",
        hours: normalizeWeeklyHours(row.opening_hours),
        maps: row.google_maps_url || "",
        menuImages: Array.isArray(row.menu_images)
            ? row.menu_images.filter(Boolean)
            : [],
        description: row.notes || "",
        favorite: row.favorite === true,
        groupId: row.group_id ? String(row.group_id) : null
    };
}

// Map restaurant object to Supabase format
export function mapRestaurantToSupabase(restaurant) {
    return {
        name: restaurant.name || null,
        category: restaurant.category || null,
        rating: restaurant.rating !== null && restaurant.rating !== undefined && restaurant.rating !== ""
            ? Number(restaurant.rating)
            : null,
        description: null,
        phone: restaurant.phone || null,
        opening_hours: JSON.stringify(normalizeWeeklyHours(restaurant.hours)),
        google_maps_url: restaurant.maps || null,
        restaurant_image_url: restaurant.image || null,
        favorite: Boolean(restaurant.favorite),
        notes: restaurant.description || null,
        address: restaurant.address || null,
        menu_images: Array.isArray(restaurant.menuImages)
            ? restaurant.menuImages
            : [],
        group_id: restaurant.groupId || null,
        user_id: getCurrentUser()?.id || null
    };
}

// Load restaurants from Supabase
export async function loadRestaurantsFromSupabase() {
    try {
        console.log("☁️ 正在從 Supabase 讀取餐廳...");

        const { data, error } = await supabaseClient
            .from("restaurants")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("❌ Supabase 讀取失敗：", error);
            return false;
        }

        restaurants = data.map(mapSupabaseToRestaurant);
        return true;
    } catch (error) {
        console.error("❌ Supabase 連線失敗：", error);
        return false;
    }
}

// Create restaurant in Supabase
export async function createRestaurantInSupabase(restaurant) {
    try {
        const payload = mapRestaurantToSupabase(restaurant);

        let { data, error } = await supabaseClient
            .from("restaurants")
            .insert(payload)
            .select()
            .single();

        // Fallback for missing group_id column
        if (error && isMissingGroupTableOrColumnError(error)) {
            console.warn("⚠️ Supabase 的 restaurants 資料表尚未有 group_id 欄位，先以不含群組的方式新增。");
            const { group_id, ...fallbackPayload } = payload;
            ({ data, error } = await supabaseClient
                .from("restaurants")
                .insert(fallbackPayload)
                .select()
                .single());
        }

        if (error) {
            console.error("❌ 新增餐廳失敗：", error);
            return null;
        }

        console.log("✅ 餐廳新增至 Supabase：", data);
        return mapSupabaseToRestaurant(data);
    } catch (error) {
        console.error("❌ 新增餐廳錯誤：", error);
        return null;
    }
}

// Update restaurant in Supabase
export async function updateRestaurantInSupabase(id, restaurant) {
    try {
        const payload = mapRestaurantToSupabase(restaurant);

        let { data, error } = await supabaseClient
            .from("restaurants")
            .update(payload)
            .eq("id", id)
            .select()
            .single();

        // Fallback for missing group_id column
        if (error && isMissingGroupTableOrColumnError(error)) {
            console.warn("⚠️ Supabase 的 restaurants 資料表尚未有 group_id 欄位，先以不含群組的方式更新。");
            const { group_id, ...fallbackPayload } = payload;
            ({ data, error } = await supabaseClient
                .from("restaurants")
                .update(fallbackPayload)
                .eq("id", id)
                .select()
                .single());
        }

        if (error) {
            console.error("❌ 更新餐廳失敗：", error);
            return null;
        }

        console.log("✅ 餐廳已更新至 Supabase");
        return mapSupabaseToRestaurant(data);
    } catch (error) {
        console.error("❌ 更新餐廳錯誤：", error);
        return null;
    }
}

// Delete restaurant from Supabase
export async function deleteRestaurantFromSupabase(id) {
    try {
        const { error } = await supabaseClient
            .from("restaurants")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("❌ Supabase 刪除失敗：", error);
            // 檢查是否為權限錯誤 (Postgres error code 42501 is insufficient_privilege)
            if (error.code === '42501') {
                showToast("🚫 無權限刪除此餐廳 (可能您不是該群組擁有者)", "error");
            } else {
                showToast(`❌ 刪除失敗: ${error.message}`, "error");
            }
            return false;
        }

        console.log("✅ Supabase 餐廳已刪除");
        return true;
    } catch (error) {
        console.error("❌ 刪除餐廳錯誤：", error);
        showToast("❌ 刪除過程中發生未知錯誤", "error");
        return false;
    }
}

// Toggle favorite status
export async function toggleFavorite(id, favoriteButton) {
    const index = restaurants.findIndex(
        restaurant => String(restaurant.id) === String(id)
    );

    if (index === -1) {
        return;
    }

    // Update local state immediately
    const previousFavorite = restaurants[index].favorite === true;
    const newFavorite = !previousFavorite;
    restaurants[index].favorite = newFavorite;

    // Update UI
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

    // Sync with Supabase
    if (isSupabaseConnected()) {
        const { error } = await supabaseClient
            .from("restaurants")
            .update({ favorite: newFavorite })
            .eq("id", id);

        if (error) {
            console.error("❌ 收藏同步失敗：", error);
            // Revert local state
            restaurants[index].favorite = previousFavorite;
            favoriteButton.classList.toggle("liked", previousFavorite);
            favoriteButton.textContent = previousFavorite ? "♥" : "♡";
            favoriteButton.setAttribute("aria-pressed", String(previousFavorite));
            showToast("⚠ 收藏同步失敗，已恢復原狀態", "warning");
        } else {
            console.log("☁️ 收藏狀態已同步：", newFavorite);
        }
    }
}

// Get restaurants data
export function getRestaurants() {
    return restaurants;
}

// Set restaurants data
export function setRestaurants(data) {
    restaurants = data;
}

// Get random picker result ID
export function getRandomPickerResultId() {
    return randomPickerResultId;
}

// Set random picker result ID
export function setRandomPickerResultId(id) {
    randomPickerResultId = id;
}

// Create default restaurants for demo
export function createDefaultRestaurants() {
    return [
        {
            id: String(Date.now()),
            name: "山海鍋物",
            category: "火鍋",
            rating: 4.6,
            image: "https://images.unsplash.com/photo-1547592180-85f173990554",
            phone: "02-1234-5678",
            address: "台北市大安區",
            hours: "11:30 - 21:30",
            maps: "https://www.google.com/maps",
            menuImages: ["https://images.unsplash.com/photo-1547592180-85f173990554"],
            description: "適合朋友聚餐的火鍋店。",
            favorite: false
        },
        {
            id: String(Date.now() + 1),
            name: "Morning Coffee",
            category: "咖啡",
            rating: 4.8,
            image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
            phone: "02-2345-6789",
            address: "台北市大安區",
            hours: "08:00 - 18:00",
            maps: "https://www.google.com/maps",
            menuImages: [],
            description: "適合讀書與工作的咖啡廳。",
            favorite: false
        }
    ];
}