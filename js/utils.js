/* ==================================================
   Utility Functions
================================================== */

// UUID Generator
export function generateUuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    // Fallback UUID v4 generator if crypto.randomUUID is not available in insecure contexts
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
// Invite Code Generator
export function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字元 (0, O, I, 1)
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}


// Copy text to clipboard with fallback
export async function copyToClipboard(text) {
    if (!text) return false;

    // 1. Try navigator.clipboard
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn("navigator.clipboard.writeText 失敗，切換 fallback：", err);
        }
    }

    // 2. Fallback to execCommand('copy')
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        textArea.setAttribute("readonly", "");
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        return successful;
    } catch (err) {
        console.error("Fallback 複製失敗：", err);
        return false;
    }
}

// HTML Escape Function
export function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Show Toast Notification
export function showToast(message, type = "info") {
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

// Error Handler for Storage Operations
export function handleStorageError(error, context = "storage operation") {
    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.error(`❌ LocalStorage 已滿，${context} 失敗：`, error);
        showToast("⚠️ 本機儲存空間已滿，部分離線資料可能無法同步儲存。", "error");
    } else {
        console.error(`❌ ${context} 發生未預期錯誤：`, error);
    }
}

// Async sleep function
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Debounce function
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}