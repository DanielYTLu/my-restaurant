/* ==================================================
   Menu Viewer System
================================================== */

import { escapeHtml } from './utils.js';

// Open menu viewer
export function openMenuViewer(restaurant) {
    const menuImages = (restaurant.menuImages || []).filter(Boolean);

    if (menuImages.length === 0) {
        alert("這間餐廳目前還沒有菜單圖片。");
        return;
    }

    const menuOverlay = document.createElement("div");
    menuOverlay.className = "menu-viewer";

    menuOverlay.innerHTML = `
        <div class="menu-viewer-header">
            <div>
                <p class="eyebrow">MENU</p>
                <h2>${restaurant.name}</h2>
            </div>
            <button class="menu-close">×</button>
        </div>
        <div class="menu-main-viewer">
            <button class="menu-nav menu-prev">‹</button>
            <div class="menu-image-stage">
                <img class="menu-main-image" src="${menuImages[0]}" alt="${restaurant.name} 菜單 1">
            </div>
            <button class="menu-nav menu-next">›</button>
        </div>
        <div class="menu-page-counter">
            <span class="current-page">1</span>
            <span>/</span>
            <span>${menuImages.length}</span>
        </div>
        <div class="menu-thumbnails">
            ${menuImages.map((image, index) => `
                <button class="menu-thumbnail ${index === 0 ? "active" : ""}" data-index="${index}">
                    <img src="${image}" alt="菜單第 ${index + 1} 頁">
                </button>
            `).join("")}
        </div>
        <p class="menu-hint">左右滑動切換菜單 · 點擊圖片放大</p>
    `;

    document.body.appendChild(menuOverlay);

    const mainImage = menuOverlay.querySelector(".menu-main-image");
    const prevButton = menuOverlay.querySelector(".menu-prev");
    const nextButton = menuOverlay.querySelector(".menu-next");
    const currentPage = menuOverlay.querySelector(".current-page");
    const thumbnails = menuOverlay.querySelectorAll(".menu-thumbnail");
    const imageStage = menuOverlay.querySelector(".menu-image-stage");

    let currentIndex = 0;

    function updateMenu(index) {
        if (index < 0 || index >= menuImages.length) {
            return;
        }

        currentIndex = index;
        mainImage.src = menuImages[currentIndex];
        mainImage.alt = `${restaurant.name} 菜單 ${currentIndex + 1}`;
        currentPage.textContent = currentIndex + 1;

        thumbnails.forEach((thumbnail, thumbnailIndex) => {
            thumbnail.classList.toggle("active", thumbnailIndex === currentIndex);
        });

        prevButton.disabled = currentIndex === 0;
        nextButton.disabled = currentIndex === menuImages.length - 1;

        if (thumbnails[currentIndex]) {
            thumbnails[currentIndex].scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center"
            });
        }
    }

    prevButton.addEventListener("click", () => updateMenu(currentIndex - 1));
    nextButton.addEventListener("click", () => updateMenu(currentIndex + 1));

    thumbnails.forEach(thumbnail => {
        thumbnail.addEventListener("click", () => {
            updateMenu(Number(thumbnail.dataset.index));
        });
    });

    // Swipe support
    let touchStartX = 0;
    imageStage.addEventListener("touchstart", event => {
        touchStartX = event.changedTouches[0].screenX;
    }, { passive: true });

    imageStage.addEventListener("touchend", event => {
        const touchEndX = event.changedTouches[0].screenX;
        const distance = touchEndX - touchStartX;

        if (distance < -50) {
            updateMenu(currentIndex + 1);
        }
        if (distance > 50) {
            updateMenu(currentIndex - 1);
        }
    }, { passive: true });

    // Fullscreen support
    mainImage.addEventListener("click", () => {
        openFullscreenMenuImage(menuImages, currentIndex, restaurant.name);
    });

    // Close handlers
    menuOverlay.querySelector(".menu-close").addEventListener("click", () => {
        menuOverlay.remove();
    });

    menuOverlay.addEventListener("click", event => {
        if (event.target === menuOverlay) {
            menuOverlay.remove();
        }
    });

    // Keyboard support
    function keyboardHandler(event) {
        if (event.key === "ArrowLeft") {
            updateMenu(currentIndex - 1);
        }
        if (event.key === "ArrowRight") {
            updateMenu(currentIndex + 1);
        }
        if (event.key === "Escape") {
            menuOverlay.remove();
            document.removeEventListener("keydown", keyboardHandler);
        }
    }

    document.addEventListener("keydown", keyboardHandler);
    updateMenu(0);
}

// Open fullscreen menu image with zoom functionality
function openFullscreenMenuImage(images, startIndex, restaurantName) {
    let currentIndex = startIndex;
    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    const MIN_SCALE = 1;
    const MAX_SCALE = 4;

    let touches = [];
    let isPinching = false;
    let isDragging = false;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    let pinchCenterX = 0;
    let pinchCenterY = 0;
    let lastTapTime = 0;

    const fullscreen = document.createElement("div");
    fullscreen.className = "menu-fullscreen";

    fullscreen.innerHTML = `
        <button class="fullscreen-close" aria-label="關閉">×</button>
        <button class="fullscreen-prev" aria-label="上一張">‹</button>
        <div class="fullscreen-image-wrapper">
            <img class="fullscreen-image" src="${images[currentIndex]}" alt="${restaurantName} 菜單">
        </div>
        <button class="fullscreen-next" aria-label="下一張">›</button>
        <div class="fullscreen-counter">${currentIndex + 1} / ${images.length}</div>
        <div class="zoom-indicator">100%</div>
    `;

    document.body.appendChild(fullscreen);

    const image = fullscreen.querySelector(".fullscreen-image");
    const imageWrapper = fullscreen.querySelector(".fullscreen-image-wrapper");
    const prev = fullscreen.querySelector(".fullscreen-prev");
    const next = fullscreen.querySelector(".fullscreen-next");
    const counter = fullscreen.querySelector(".fullscreen-counter");
    const zoomIndicator = fullscreen.querySelector(".zoom-indicator");

    function applyTransform(animate = false) {
        image.style.transition = animate ? "transform 0.25s ease" : "none";
        image.style.transform = `
            translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px))
            scale(${scale})
        `;
    }

    let zoomIndicatorTimer;
    function showZoomIndicator() {
        zoomIndicator.textContent = `${Math.round(scale * 100)}%`;
        zoomIndicator.classList.add("show");
        clearTimeout(zoomIndicatorTimer);
        zoomIndicatorTimer = setTimeout(() => {
            zoomIndicator.classList.remove("show");
        }, 900);
    }

    function resetZoom(animate = true) {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform(animate);
        updateNavigation();
    }

    function clampPosition() {
        if (scale <= 1) {
            translateX = 0;
            translateY = 0;
            return;
        }

        const wrapperWidth = imageWrapper.clientWidth;
        const wrapperHeight = imageWrapper.clientHeight;
        const imageWidth = image.offsetWidth * scale;
        const imageHeight = image.offsetHeight * scale;

        const maxX = Math.max(0, (imageWidth - wrapperWidth) / 2);
        const maxY = Math.max(0, (imageHeight - wrapperHeight) / 2);

        translateX = Math.max(-maxX, Math.min(maxX, translateX));
        translateY = Math.max(-maxY, Math.min(maxY, translateY));
    }

    function setZoom(newScale, centerX = imageWrapper.clientWidth / 2, centerY = imageWrapper.clientHeight / 2) {
        const oldScale = scale;
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

        if (newScale === oldScale) return;

        const wrapperRect = imageWrapper.getBoundingClientRect();
        const pointX = centerX - wrapperRect.width / 2;
        const pointY = centerY - wrapperRect.height / 2;
        const scaleRatio = newScale / oldScale;

        translateX = pointX - (pointX - translateX) * scaleRatio;
        translateY = pointY - (pointY - translateY) * scaleRatio;
        scale = newScale;

        clampPosition();
        applyTransform();
        showZoomIndicator();
    }

    function updateNavigation() {
        prev.disabled = currentIndex === 0 || scale > 1;
        next.disabled = currentIndex === images.length - 1 || scale > 1;
    }

    function updateFullscreen(index) {
        if (index < 0 || index >= images.length) return;

        currentIndex = index;
        resetZoom(false);
        image.src = images[currentIndex];
        image.alt = `${restaurantName} 菜單 ${currentIndex + 1}`;
        counter.textContent = `${currentIndex + 1} / ${images.length}`;
        updateNavigation();
    }

    prev.addEventListener("click", event => {
        event.stopPropagation();
        if (scale > 1) return;
        updateFullscreen(currentIndex - 1);
    });

    next.addEventListener("click", event => {
        event.stopPropagation();
        if (scale > 1) return;
        updateFullscreen(currentIndex + 1);
    });

    fullscreen.querySelector(".fullscreen-close").addEventListener("click", () => {
        fullscreen.remove();
    });

    fullscreen.addEventListener("click", event => {
        if (event.target === fullscreen) {
            fullscreen.remove();
        }
    });

    // Touch events for pinch zoom and pan
    imageWrapper.addEventListener("touchstart", event => {
        touches = Array.from(event.touches);

        if (touches.length === 2) {
            isPinching = true;
            isDragging = false;
            pinchStartDistance = getDistance(touches[0], touches[1]);
            pinchStartScale = scale;
            const center = getTouchCenter(touches[0], touches[1]);
            pinchCenterX = center.x;
            pinchCenterY = center.y;
            event.preventDefault();
            return;
        }

        if (touches.length === 1) {
            isDragging = true;
            isPinching = false;
            lastTouchX = touches[0].clientX;
            lastTouchY = touches[0].clientY;
        }
    }, { passive: false });

    imageWrapper.addEventListener("touchmove", event => {
        touches = Array.from(event.touches);

        if (touches.length === 2 && isPinching) {
            event.preventDefault();
            const currentDistance = getDistance(touches[0], touches[1]);
            const distanceRatio = currentDistance / pinchStartDistance;
            scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStartScale * distanceRatio));

            const center = getTouchCenter(touches[0], touches[1]);
            const wrapperRect = imageWrapper.getBoundingClientRect();
            const centerX = center.x - wrapperRect.left;
            const centerY = center.y - wrapperRect.top;
            const pointX = centerX - wrapperRect.width / 2;
            const pointY = centerY - wrapperRect.height / 2;
            const ratio = scale / pinchStartScale;

            translateX = pointX - (pointX - translateX) * ratio;
            translateY = pointY - (pointY - translateY) * ratio;

            clampPosition();
            applyTransform();
            showZoomIndicator();
            return;
        }

        if (touches.length === 1 && isDragging && scale > 1) {
            event.preventDefault();
            const currentX = touches[0].clientX;
            const currentY = touches[0].clientY;
            translateX += currentX - lastTouchX;
            translateY += currentY - lastTouchY;
            lastTouchX = currentX;
            lastTouchY = currentY;
            clampPosition();
            applyTransform();
        }
    }, { passive: false });

    imageWrapper.addEventListener("touchend", event => {
        touches = Array.from(event.touches);

        if (isPinching && touches.length < 2) {
            isPinching = false;
            if (scale < 1.05) {
                resetZoom();
            } else {
                clampPosition();
                applyTransform(true);
            }
        }

        if (touches.length === 0) {
            isDragging = false;
        }
    }, { passive: true });

    // Double tap to zoom
    imageWrapper.addEventListener("touchend", event => {
        if (event.changedTouches.length !== 1) return;

        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime;
        lastTapTime = now;

        if (timeSinceLastTap < 300) {
            event.preventDefault();
            if (scale > 1) {
                resetZoom();
            } else {
                const touch = event.changedTouches[0];
                const rect = imageWrapper.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                scale = 2;
                translateX = -(x - rect.width / 2);
                translateY = -(y - rect.height / 2);
                clampPosition();
                applyTransform(true);
                showZoomIndicator();
            }
        }
    }, { passive: false });

    // Mouse wheel zoom
    imageWrapper.addEventListener("wheel", event => {
        event.preventDefault();
        const rect = imageWrapper.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const zoomAmount = event.deltaY < 0 ? 1.15 : 0.87;
        setZoom(scale * zoomAmount, x, y);
    }, { passive: false });

    // Keyboard support
    function keyboardHandler(event) {
        if (event.key === "Escape") {
            fullscreen.remove();
            document.removeEventListener("keydown", keyboardHandler);
            return;
        }
        if (event.key === "ArrowLeft" && scale <= 1) {
            updateFullscreen(currentIndex - 1);
        }
        if (event.key === "ArrowRight" && scale <= 1) {
            updateFullscreen(currentIndex + 1);
        }
        if (event.key === "+" || event.key === "=") {
            setZoom(scale + 0.25);
        }
        if (event.key === "-") {
            setZoom(scale - 0.25);
        }
        if (event.key === "0") {
            resetZoom();
        }
    }

    document.addEventListener("keydown", keyboardHandler);
    image.addEventListener("load", () => resetZoom(false));

    function getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function getTouchCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }

    updateFullscreen(currentIndex);
}