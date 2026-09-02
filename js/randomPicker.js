/* ==================================================
   Random Picker Module
================================================== */

import { getRestaurants, setRandomPickerResultId, getRandomPickerResultId } from './restaurant.js';
import { getGroupFilteredRestaurants } from './group.js';
import { renderRestaurants } from './ui.js';
import { showToast } from './utils.js';

// Initialize random picker
export function initializeRandomPicker() {
    const randomPickerButton = document.getElementById("randomPickerButton");

    if (!randomPickerButton) {
        return;
    }

    randomPickerButton.addEventListener("click", async () => {
        const restaurants = getRestaurants();
        const availableRestaurants = getGroupFilteredRestaurants(restaurants);

        if (availableRestaurants.length === 0) {
            showToast("目前群組沒有餐廳可以抽籤");
            return;
        }

        // 顯示過場遮罩 (方案三)
        const overlay = document.getElementById("randomPickerOverlay");
        overlay.classList.add("show");

        // 模擬等待儀式感 (至少 1.5 秒)
        await new Promise(resolve => setTimeout(resolve, 2500));

        const randomIndex = Math.floor(Math.random() * availableRestaurants.length);
        const selectedRestaurant = availableRestaurants[randomIndex];

        setRandomPickerResultId(String(selectedRestaurant.id));
        renderRestaurants(availableRestaurants);
        setRandomPickerResultId(null);

        // 關閉遮罩
        overlay.classList.remove("show");

        showToast(`🎲 今天就決定吃：${selectedRestaurant.name}！`);

        const restaurantList = document.getElementById("restaurantList");
        const selectedCard = restaurantList.querySelector(
            `[data-id="${CSS.escape(String(selectedRestaurant.id))}"]`
        );

        selectedCard?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        // Add visual highlighting
        if (selectedCard) {
            selectedCard.classList.add("random-picker-selected");
            setTimeout(() => {
                selectedCard.classList.remove("random-picker-selected");
            }, 3000);
        }
    });
}