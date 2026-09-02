/* ==================================================
   Search Functionality
================================================== */

import { renderRestaurants } from './ui.js';
import { getRestaurants } from './restaurant.js';

// DOM Elements
const searchInput = document.getElementById("searchInput");
const clearSearchButton = document.getElementById("clearSearchButton");
const voiceSearchButton = document.getElementById("voiceSearchButton");
const voiceSearchStatus = document.getElementById("voiceSearchStatus");
const voiceSearchStatusText = document.getElementById("voiceSearchStatusText");

// Voice search state
let speechRecognition = null;
let isVoiceListening = false;

// Initialize search functionality
export function initializeSearch() {
    // Normal text search
    searchInput.addEventListener("input", performRestaurantSearch);

    // Clear search
    clearSearchButton.addEventListener("click", () => {
        searchInput.value = "";
        clearSearchButton.hidden = true;
        renderRestaurants(getRestaurants());
        searchInput.focus();
    });

    // Voice search
    initializeVoiceSearch();
}

// Perform restaurant search
function performRestaurantSearch() {
    const keyword = searchInput.value.trim().toLowerCase();
    const restaurants = getRestaurants();

    const filtered = restaurants.filter(restaurant => {
        return (
            (restaurant.name || "").toLowerCase().includes(keyword) ||
            (restaurant.category || "").toLowerCase().includes(keyword) ||
            (restaurant.address || "").toLowerCase().includes(keyword) ||
            (restaurant.description || "").toLowerCase().includes(keyword) ||
            JSON.stringify(restaurant.hours || "").toLowerCase().includes(keyword)
        );
    });

    renderRestaurants(filtered);
    clearSearchButton.hidden = keyword.length === 0;
}

// Initialize voice search
function initializeVoiceSearch() {
    if (voiceSearchStatus) {
        voiceSearchStatus.style.display = "none";
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        speechRecognition = new SpeechRecognition();
        speechRecognition.lang = "zh-TW";
        speechRecognition.continuous = false;
        speechRecognition.interimResults = true;
        speechRecognition.maxAlternatives = 1;

        // Start button
        voiceSearchButton.addEventListener("click", () => {
            if (isVoiceListening) {
                speechRecognition.stop();
                return;
            }

            try {
                speechRecognition.start();
            } catch (error) {
                console.warn("語音辨識啟動失敗：", error);
            }
        });

        // Listening start
        speechRecognition.addEventListener("start", () => {
            isVoiceListening = true;
            voiceSearchButton.classList.add("listening");
            voiceSearchButton.setAttribute("aria-label", "停止語音搜尋");
            voiceSearchStatus.style.display = "flex";
            voiceSearchStatusText.textContent = "正在聆聽…";
            searchInput.placeholder = "請說出餐廳名稱、分類或地點…";
        });

        // Result
        speechRecognition.addEventListener("result", event => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            transcript = transcript.trim();

            if (!transcript) {
                return;
            }

            searchInput.value = transcript;
            performRestaurantSearch();
        });

        // End
        speechRecognition.addEventListener("end", () => {
            isVoiceListening = false;
            voiceSearchButton.classList.remove("listening");
            voiceSearchButton.setAttribute("aria-label", "語音搜尋");
            voiceSearchStatus.style.display = "none";
            searchInput.placeholder = "搜尋餐廳、分類或地點...";
        });

        // Error
        speechRecognition.addEventListener("error", event => {
            console.warn("語音辨識錯誤：", event.error);
            isVoiceListening = false;
            voiceSearchButton.classList.remove("listening");
            voiceSearchStatus.style.display = "flex";

            switch (event.error) {
                case "not-allowed":
                    voiceSearchStatusText.textContent = "請允許麥克風權限";
                    break;
                case "no-speech":
                    voiceSearchStatusText.textContent = "沒有聽到聲音，請再試一次";
                    break;
                case "audio-capture":
                    voiceSearchStatusText.textContent = "無法使用麥克風";
                    break;
                case "network":
                    voiceSearchStatusText.textContent = "語音辨識需要網路連線";
                    break;
                default:
                    voiceSearchStatusText.textContent = "語音辨識失敗，請再試一次";
            }

            setTimeout(() => {
                voiceSearchStatus.style.display = "none";
                searchInput.placeholder = "搜尋餐廳、分類或地點...";
            }, 2200);
        });
    } else {
        // Browser not supported
        voiceSearchButton.addEventListener("click", () => {
            voiceSearchStatus.style.display = "flex";
            voiceSearchStatusText.textContent = "目前的瀏覽器不支援語音搜尋";
            setTimeout(() => {
                voiceSearchStatus.style.display = "none";
            }, 2500);
        });
    }
}