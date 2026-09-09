/* ==================================================
   Random Picker Module (高質感抽籤與開獎動效)
================================================== */

import { getRestaurants, setRandomPickerResultId } from './restaurant.js';
import { getGroupFilteredRestaurants } from './group.js';
import { renderRestaurants } from './ui.js';
import { showToast } from './utils.js';

// 美食隨機圖標
const FOOD_ICONS = ["🍜", "🍣", "🍱", "🍔", "🍕", "🥩", "🍲", "🥗", "🍛", "🌮", "🍨", "☕", "🥟", "🥘"];

// 輕量級高性能 Confetti 彩帶紙屑特效
function triggerConfetti() {
    const canvas = document.createElement("canvas");
    canvas.id = "confettiCanvas";
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9999";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const colors = ["#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#fbbf24"];
    const particleCount = 75;
    const particles = [];

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight * 0.45;

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 9 + 4;
        particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,
            size: Math.random() * 8 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 12,
            opacity: 1,
            gravity: 0.22,
            friction: 0.985,
            shape: Math.random() > 0.4 ? "rect" : "circle"
        });
    }

    let animationId;
    const startTime = performance.now();

    function render(currentTime) {
        const elapsed = currentTime - startTime;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        let activeCount = 0;

        particles.forEach(p => {
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;

            if (elapsed > 1600) {
                p.opacity -= 0.025;
            }

            if (p.opacity > 0) {
                activeCount++;
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;

                if (p.shape === "rect") {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2.2, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        });

        if (activeCount > 0 && elapsed < 3200) {
            animationId = requestAnimationFrame(render);
        } else {
            cancelAnimationFrame(animationId);
            canvas.remove();
        }
    }

    animationId = requestAnimationFrame(render);
}

// Initialize random picker
export function initializeRandomPicker() {
    const randomPickerButton = document.getElementById("randomPickerButton");
    const overlay = document.getElementById("randomPickerOverlay");

    if (!randomPickerButton) {
        return;
    }

    const rollingIcon = document.getElementById("pickerRollingIcon");
    const rollingName = document.getElementById("pickerRollingName");
    const rollingCategory = document.getElementById("pickerRollingCategory");
    const rollingCard = document.getElementById("pickerRollingCard");
    const progressBar = document.getElementById("pickerProgressBar");

    let isRunning = false;

    randomPickerButton.addEventListener("click", async () => {
        if (isRunning) return;

        const restaurants = getRestaurants();
        const availableRestaurants = getGroupFilteredRestaurants(restaurants);

        if (availableRestaurants.length === 0) {
            showToast("目前群組沒有餐廳可以抽籤");
            return;
        }

        isRunning = true;
        randomPickerButton.classList.add("is-rolling");

        // 開啟遮罩
        if (overlay) {
            overlay.classList.add("show");
            overlay.setAttribute("aria-hidden", "false");
        }

        if (rollingCard) {
            rollingCard.classList.remove("picker-locked");
        }
        if (progressBar) {
            progressBar.style.width = "0%";
        }

        // 決定最終中選餐廳
        const randomIndex = Math.floor(Math.random() * availableRestaurants.length);
        const selectedRestaurant = availableRestaurants[randomIndex];

        // 輪播列表：隨機輪播 + 最後一格定格在 selectedRestaurant
        const stepCount = Math.min(20, Math.max(14, availableRestaurants.length * 2));
        const rollSequence = [];

        for (let i = 0; i < stepCount - 1; i++) {
            const r = availableRestaurants[Math.floor(Math.random() * availableRestaurants.length)];
            rollSequence.push(r);
        }
        rollSequence.push(selectedRestaurant);

        // 減速計時曲線
        let delay = 55;
        for (let i = 0; i < rollSequence.length; i++) {
            const currentItem = rollSequence[i];
            const isLast = i === rollSequence.length - 1;

            if (rollingName) rollingName.textContent = currentItem.name;
            if (rollingCategory) rollingCategory.textContent = currentItem.category || "美食精選";
            if (rollingIcon) {
                rollingIcon.textContent = FOOD_ICONS[Math.floor(Math.random() * FOOD_ICONS.length)];
            }

            if (progressBar) {
                const progress = ((i + 1) / rollSequence.length) * 100;
                progressBar.style.width = `${progress}%`;
            }

            if (isLast) {
                if (rollingCard) rollingCard.classList.add("picker-locked");
                if (rollingIcon) rollingIcon.textContent = "🎉";
                break;
            }

            // 隨時間拉長間隔，營造老虎機減速感
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(320, Math.floor(delay * 1.13));
        }

        // 定格停留 450ms 讓使用者看清結果
        await new Promise(resolve => setTimeout(resolve, 450));

        // 重新渲染確認該群組的卡片
        setRandomPickerResultId(String(selectedRestaurant.id));
        renderRestaurants(availableRestaurants);
        setRandomPickerResultId(null);

        // 關閉抽籤遮罩
        if (overlay) {
            overlay.classList.remove("show");
            overlay.setAttribute("aria-hidden", "true");
        }

        randomPickerButton.classList.remove("is-rolling");
        isRunning = false;

        // 定位並滾動到選中的餐廳卡片
        const restaurantList = document.getElementById("restaurantList");
        const selectedCard = restaurantList?.querySelector(
            `[data-id="${CSS.escape(String(selectedRestaurant.id))}"]`
        );

        selectedCard?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        // 觸發高質感開獎動態
        if (selectedCard) {
            // 爆發 Confetti 慶祝紙屑雨
            triggerConfetti();

            // 建立金牌徽章
            const badge = document.createElement("div");
            badge.className = "random-picker-winner-badge";
            badge.innerHTML = `👑 命運首選｜今天吃這家！`;
            selectedCard.appendChild(badge);

            selectedCard.classList.add("random-picker-selected");

            showToast(`🎉 命運決定！今天就去吃「${selectedRestaurant.name}」！`);

            // 3.5 秒後優雅退場
            setTimeout(() => {
                selectedCard.classList.remove("random-picker-selected");
                badge.remove();
            }, 3500);
        } else {
            showToast(`🎉 今天就決定吃：${selectedRestaurant.name}！`);
        }
    });
}