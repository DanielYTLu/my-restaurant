/* ==================================================
   Image Processing Module
================================================== */

import { IMAGE_CONFIG } from './config.js';
import { getCurrentUser } from './storage.js';
import { supabaseClient } from './supabase.js';

// DOM Elements
const restaurantImageInput = document.getElementById("restaurantImage");
const restaurantImagePreview = document.getElementById("restaurantImagePreview");

// Read file as data URL
export function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const imageUrl = URL.createObjectURL(file);

        image.addEventListener("load", () => {
            const maxSize = IMAGE_CONFIG.MAX_SIZE;
            const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement("canvas");

            canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(imageUrl);
            resolve(canvas.toDataURL("image/jpeg", IMAGE_CONFIG.QUALITY));
        });

        image.addEventListener("error", () => {
            URL.revokeObjectURL(imageUrl);
            reject(new Error("圖片無法讀取"));
        });

        image.src = imageUrl;
    });
}

// Upload image to Supabase storage
export async function uploadImageToSupabaseStorage(file) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error("User not authenticated");
        }

        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${currentUser.id}/${fileName}`;

        const { data, error } = await supabaseClient.storage
            .from('restaurant-images')
            .upload(filePath, file);

        if (error) {
            console.error("❌ 圖片上傳失敗：", error);
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from('restaurant-images')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error("❌ 圖片上傳發生錯誤：", error);
        throw error;
    }
}

// Get restaurant image source
export function getRestaurantImageSrc(image) {
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

// Update restaurant image preview
export function updateRestaurantImagePreview(fileOrUrl) {
    if (!restaurantImagePreview) {
        return;
    }

    if (!fileOrUrl) {
        restaurantImagePreview.innerHTML = `
            <div class="menu-preview-empty">
                <span class="menu-upload-icon">🏪</span>
                <p>點擊上傳餐廳圖片</p>
            </div>
        `;
        return;
    }

    const imageUrl = fileOrUrl instanceof File
        ? URL.createObjectURL(fileOrUrl)
        : fileOrUrl;

    restaurantImagePreview.innerHTML = `
        <img src="${imageUrl}" alt="餐廳圖片預覽" class="menu-preview-image">
    `;
}

// Update menu preview
export function updateMenuPreview(menuNumber, fileOrUrl) {
    const preview = document.getElementById(`menuPreview${menuNumber}`);

    if (!preview) {
        console.error(`❌ 找不到 menuPreview${menuNumber}`);
        return;
    }

    if (!fileOrUrl) {
        preview.innerHTML = `
            <div class="menu-preview-empty">
                <span class="menu-upload-icon">📖</span>
                <p>點擊上傳菜單圖片</p>
            </div>
        `;
        return;
    }

    if (fileOrUrl instanceof File) {
        const imageURL = URL.createObjectURL(fileOrUrl);
        preview.innerHTML = `
            <img src="${imageURL}" alt="菜單 ${menuNumber}" class="menu-preview-image">
        `;
        return;
    }

    if (typeof fileOrUrl === "string") {
        if (fileOrUrl.startsWith("C:\\fakepath\\") || fileOrUrl.startsWith("file:///")) {
            updateMenuPreview(menuNumber, "");
            return;
        }

        preview.innerHTML = `
            <img src="${fileOrUrl}" alt="菜單 ${menuNumber}" class="menu-preview-image">
        `;
        return;
    }
}

// Clear menu image
export function clearMenuImage(menuNumber) {
    const input = document.getElementById(`restaurantMenu${menuNumber}`);
    if (!input) return;

    input.value = "";
    input.dataset.menuRemoved = "true";
    updateMenuPreview(menuNumber, "");
}

// Initialize restaurant image upload
export function initializeRestaurantImageUpload() {
    if (!restaurantImageInput || !restaurantImagePreview) {
        return;
    }

    restaurantImageInput.style.display = "none";
    restaurantImagePreview.style.cursor = "pointer";

    restaurantImagePreview.addEventListener("click", () => restaurantImageInput.click());

    restaurantImageInput.addEventListener("change", () => {
        const file = restaurantImageInput.files && restaurantImageInput.files.length > 0
            ? restaurantImageInput.files[0]
            : null;

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("請選擇圖片檔案。");
            restaurantImageInput.value = "";
            return;
        }

        restaurantImageInput.dataset.imageRemoved = "false";
        updateRestaurantImagePreview(file);
    });

    document.getElementById("restaurantImageRemove").addEventListener("click", event => {
        event.stopPropagation();
        restaurantImageInput.value = "";
        restaurantImageInput.dataset.imageRemoved = "true";
        updateRestaurantImagePreview("");
    });
}

// Initialize menu preview
export function initializeMenuPreview() {
    const menuInputs = [
        document.getElementById("restaurantMenu1"),
        document.getElementById("restaurantMenu2"),
        document.getElementById("restaurantMenu3")
    ];

    menuInputs.forEach((input, index) => {
        const menuNumber = index + 1;

        if (!input) {
            console.error(`❌ 找不到 restaurantMenu${menuNumber}`);
            return;
        }

        const preview = document.getElementById(`menuPreview${menuNumber}`);
        if (!preview) {
            console.error(`❌ 找不到 menuPreview${menuNumber}`);
            return;
        }

        input.style.display = "none";
        preview.style.cursor = "pointer";

        preview.addEventListener("click", () => {
            input.click();
        });

        input.addEventListener("change", () => {
            const file = input.files && input.files.length > 0 ? input.files[0] : null;

            if (!file) return;

            if (!file.type.startsWith("image/")) {
                alert("請選擇圖片檔案。");
                input.value = "";
                return;
            }

            input.dataset.menuRemoved = "false";
            updateMenuPreview(menuNumber, file);
        });
    });
}

// Initialize menu remove buttons
export function initializeMenuRemoveButtons() {
    const buttons = document.querySelectorAll("[data-menu-remove]");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const number = button.dataset.menuRemove;
            clearMenuImage(number);
        });
    });
}