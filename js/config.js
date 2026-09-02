/* ==================================================
   Application Configuration
================================================== */

// Supabase Configuration
const SUPABASE_URL = "https://rcyqxzerhpdneagmjwjf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UykY-RJm0HyKtmJkkE9CWg_CDFpwlHJ";

// Storage Keys
const STORAGE_KEYS = {
    RESTAURANTS: "restaurants",
    RESTAURANT_GROUPS: "restaurantGroups",
    CURRENT_GROUP: "currentGroupId",
    DISPLAY_SETTINGS: "displaySettings",
    THEME: "theme",
    LAST_VIEWED_ANNOUNCEMENTS: "lastViewedAnnouncements",
    ANNOUNCEMENTS_CACHE: "announcementsCache"
};

// Group Configuration
const UNCATEGORIZED_GROUP_NAME = "未分類";

// Week Days Configuration
const WEEK_DAYS = [
    { key: "monday", label: "一" },
    { key: "tuesday", label: "二" },
    { key: "wednesday", label: "三" },
    { key: "thursday", label: "四" },
    { key: "friday", label: "五" },
    { key: "saturday", label: "六" },
    { key: "sunday", label: "日" }
];

// Display Settings Defaults
const DISPLAY_SETTINGS_DEFAULTS = {
    fontSize: "medium",
    viewMode: "card",
    customOrder: {},
    visibleCategories: ["早餐", "午餐", "晚餐", "飲料", "點心", "速食", "日式料理", "美式/西式", "中式/台菜", "火鍋/燒烤", "咖啡廳/下午茶"]
};

// All Categories Configuration
const ALL_CATEGORIES = [
    { name: "早餐", icon: "🍳" },
    { name: "午餐", icon: "🍱" },
    { name: "晚餐", icon: "🍽️" },
    { name: "飲料", icon: "🧋" },
    { name: "點心", icon: "🍰" },
    { name: "速食", icon: "🍔" },
    { name: "日式料理", icon: "🍣" },
    { name: "美式/西式", icon: "🥩" },
    { name: "中式/台菜", icon: "🥟" },
    { name: "韓式料理", icon: "🥘" },
    { name: "義式/披薩", icon: "🍕" },
    { name: "泰式/南洋", icon: "🍜" },
    { name: "港式/茶餐廳", icon: "🇭🇰" },
    { name: "火鍋/燒烤", icon: "🍲" },
    { name: "咖啡廳/下午茶", icon: "☕" },
    { name: "居酒屋/餐酒館", icon: "🍻" },
    { name: "吃到飽/自助餐", icon: "🦀" },
    { name: "宵夜場", icon: "🌙" },
    { name: "素食/蔬食", icon: "🥗" },
    { name: "親子餐廳", icon: "🧸" },
    { name: "烘焙/麵包", icon: "🍞" },
    { name: "冰品/甜湯", icon: "🍧" },
    { name: "小吃/夜市", icon: "🍢" },
    { name: "健康餐盒/沙拉", icon: "🥗" },
    { name: "其他", icon: "🏷️" }
];

// Image Processing Configuration
const IMAGE_CONFIG = {
    MAX_SIZE: 1600,
    QUALITY: 0.82
};

// Font Size Options
const FONT_SIZE_OPTIONS = ["extra-small", "small", "medium", "large", "extra-large"];

// Theme Options
const THEME_OPTIONS = ["light", "dark", "system"];

// Export configuration
export {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    STORAGE_KEYS,
    UNCATEGORIZED_GROUP_NAME,
    WEEK_DAYS,
    DISPLAY_SETTINGS_DEFAULTS,
    ALL_CATEGORIES,
    IMAGE_CONFIG,
    FONT_SIZE_OPTIONS,
    THEME_OPTIONS
};