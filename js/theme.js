/* ==================================================
   Theme Management
================================================== */

import { loadTheme, saveTheme } from './storage.js';
import { THEME_OPTIONS } from './config.js';

// Theme state
let themePreference = loadTheme();

// Check if dark theme is active
export function isDarkTheme(theme = themePreference) {
    return theme === "dark" || (
        theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
}

// Apply theme to document
export function applyTheme(theme) {
    document.documentElement.dataset.theme = isDarkTheme(theme)
        ? "dark"
        : "light";

    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute(
        "content",
        isDarkTheme(theme) ? "#171716" : "#f7f7f5"
    );
}

// Initialize theme system
export function initializeTheme() {
    applyTheme(themePreference);

    window.matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
            if (localStorage.getItem("theme") === "system") {
                applyTheme("system");
            }
        });
}

// Change theme
export function changeTheme(theme) {
    if (!THEME_OPTIONS.includes(theme)) {
        console.warn(`Invalid theme: ${theme}`);
        return;
    }

    themePreference = theme;
    saveTheme(theme);
    applyTheme(theme);
}

// Get current theme
export function getCurrentTheme() {
    return themePreference;
}