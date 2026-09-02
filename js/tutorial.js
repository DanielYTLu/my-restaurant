

import { closeAuthAccountMenu } from './auth.js';

const tutorialSteps = [
    {
        title: '👋 歡迎使用黑白呷！',
        content: '我們來快速帶您認識這款美食管理 App，輕鬆記錄並解決每天吃什麼的煩惱！',
        target: null,
        shape: 'rounded',
        icon: '💡'
    },
    {
        title: '📝 輕鬆記錄美食清單',
        content: '點擊右下角的「＋」按鈕新增餐廳，除了店名與類別，還能加入地圖連結與評價。',
        target: '#addRestaurantButton',
        shape: 'circle',
        icon: '📝'
    },
    {
        title: '📍 地區與群組切換',
        content: '使用群組功能，將餐廳依「午餐」、「晚餐」或「地區（如：公館、西門町）」分區管理。',
        target: '#groupSwitchButton',
        shape: 'pill',
        icon: '📍'
    },
    {
        title: '🎲 選擇困難救星',
        content: '不知選哪家？點擊底部導航的隨機推薦按鈕！我們會為您隨機挑選清單中的美食餐廳。',
        target: '#randomPickerButton',
        shape: 'circle',
        icon: '🎲'
    },
    {
        title: '⚙️ 視覺與個人化設定',
        content: '點擊右上角個人頭像，可調整字體大小（A− 到 A＋＋）、切換深色模式與排序。',
        target: '#authOpenButton',
        shape: 'pill',
        icon: '⚙️'
    },
    {
        title: '✨ 準備好探索美食了嗎？',
        content: '引導結束！未來若想重溫功能，隨時可從選單中的「使用說明」再次查看。',
        target: null,
        shape: 'rounded',
        icon: '🎉'
    }
];

let currentStep = 0;
let spotlightWrapper = null;
let backdropEl = null;
let holeEl = null;
let cardEl = null;
let isTourActive = false;

export function initTutorial() {
    if (!localStorage.getItem('hasSeenTutorial')) {
        setTimeout(startTutorial, 1500);
        localStorage.setItem('hasSeenTutorial', 'true');
    }
}

export function startTutorial() {
    try {
        closeAuthAccountMenu();
    } catch (e) {
        // Safe fallback
    }

    currentStep = 0;
    isTourActive = true;
    createSpotlightElements();
    renderStep(currentStep);

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('keydown', handleKeydown);
}


function stopTutorial() {
    isTourActive = false;
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('keydown', handleKeydown);

    if (spotlightWrapper) {
        spotlightWrapper.classList.remove('show');
        setTimeout(() => {
            spotlightWrapper?.remove();
            spotlightWrapper = null;
            backdropEl = null;
            holeEl = null;
            cardEl = null;
        }, 300);
    }
}

function createSpotlightElements() {
    if (spotlightWrapper) {
        spotlightWrapper.remove();
    }

    spotlightWrapper = document.createElement('div');
    spotlightWrapper.className = 'tutorial-spotlight-wrapper';

    backdropEl = document.createElement('div');
    backdropEl.className = 'tutorial-backdrop';

    holeEl = document.createElement('div');
    holeEl.className = 'tutorial-spotlight-hole is-hidden';

    cardEl = document.createElement('div');
    cardEl.className = 'tutorial-card';

    spotlightWrapper.appendChild(backdropEl);
    spotlightWrapper.appendChild(holeEl);
    spotlightWrapper.appendChild(cardEl);

    document.body.appendChild(spotlightWrapper);

    void spotlightWrapper.offsetWidth;
    spotlightWrapper.classList.add('show');
}

function renderStep(index) {
    if (index < 0 || index >= tutorialSteps.length) {
        stopTutorial();
        return;
    }

    currentStep = index;
    const step = tutorialSteps[index];
    const totalSteps = tutorialSteps.length;
    const isFirst = index === 0;
    const isLast = index === totalSteps - 1;
    const progressPercent = Math.round(((index + 1) / totalSteps) * 100);

    cardEl.innerHTML = `
        <div class="tutorial-card-progress-bar">
            <div class="tutorial-card-progress-fill" style="width: ${progressPercent}%;"></div>
        </div>
        <div class="tutorial-card-header">
            <span class="tutorial-card-step-badge">${index + 1} / ${totalSteps}</span>
            <button type="button" class="tutorial-card-close" id="tourCloseBtn" aria-label="關閉引導">✕</button>
        </div>
        <div class="tutorial-card-body">
            <span class="tutorial-card-icon">${step.icon || '💡'}</span>
            <div>
                <h3 class="tutorial-card-title">${step.title}</h3>
                <p class="tutorial-card-text">${step.content}</p>
            </div>
        </div>
        <div class="tutorial-card-footer">
            <button type="button" class="tutorial-btn-skip" id="tourSkipBtn">跳過</button>
            <div class="tutorial-nav-group">
                ${!isFirst ? `<button type="button" class="tutorial-btn-prev" id="tourPrevBtn">上一步</button>` : ''}
                <button type="button" class="tutorial-btn-next" id="tourNextBtn">${isLast ? '開始體驗 🎉' : '下一步'}</button>
            </div>
        </div>
    `;

    document.getElementById('tourCloseBtn')?.addEventListener('click', stopTutorial);
    document.getElementById('tourSkipBtn')?.addEventListener('click', stopTutorial);
    document.getElementById('tourPrevBtn')?.addEventListener('click', () => renderStep(currentStep - 1));
    document.getElementById('tourNextBtn')?.addEventListener('click', () => {
        if (isLast) {
            stopTutorial();
        } else {
            renderStep(currentStep + 1);
        }
    });

    updatePositions();
}

function updatePositions() {
    if (!isTourActive || !holeEl || !cardEl) return;

    const step = tutorialSteps[currentStep];
    const targetEl = step.target ? document.querySelector(step.target) : null;

    if (targetEl && targetEl.getBoundingClientRect) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

        const rect = targetEl.getBoundingClientRect();
        const padding = 8;

        let width = rect.width + padding * 2;
        let height = rect.height + padding * 2;
        let top = rect.top - padding;
        let left = rect.left - padding;
        let borderRadius = '14px';

        if (step.shape === 'circle') {
            const size = Math.max(width, height);
            left = rect.left + rect.width / 2 - size / 2;
            top = rect.top + rect.height / 2 - size / 2;
            width = size;
            height = size;
            borderRadius = '50%';
        } else if (step.shape === 'pill') {
            borderRadius = '24px';
        }

        holeEl.style.top = `${top}px`;
        holeEl.style.left = `${left}px`;
        holeEl.style.width = `${width}px`;
        holeEl.style.height = `${height}px`;
        holeEl.style.borderRadius = borderRadius;
        holeEl.classList.remove('is-hidden');

        positionCardRelativeToTarget(rect);
    } else {
        holeEl.classList.add('is-hidden');
        positionCardCentered();
    }
}

function positionCardRelativeToTarget(targetRect) {
    const cardWidth = Math.min(280, window.innerWidth - 32); // 配合 CSS 調整
    const cardHeight = cardEl.offsetHeight || 220;
    const padding = 24; // 增加 padding，讓視窗與聚光燈保持更遠距離

    let top = 0;
    let left = 0;

    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;

    // 優先判斷空間，若下方空間不足且上方有空間，則置於上方
    if (spaceBelow >= cardHeight + padding || spaceBelow >= spaceAbove) {
        top = targetRect.bottom + padding;
    } else {
        top = targetRect.top - cardHeight - padding;
    }

    // 確保水平居中，並避免超出螢幕邊緣
    left = targetRect.left + targetRect.width / 2 - cardWidth / 2;

    // 加入更嚴格的螢幕邊界檢查
    top = Math.max(16, Math.min(top, window.innerHeight - cardHeight - 16));
    left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));

    cardEl.style.top = `${top}px`;
    cardEl.style.left = `${left}px`;
    cardEl.style.transform = 'none';
}

function positionCardCentered() {
    cardEl.style.top = '50%';
    cardEl.style.left = '50%';
    cardEl.style.transform = 'translate(-50%, -50%)';
}

function handleResize() {
    if (isTourActive) {
        updatePositions();
    }
}

function handleScroll() {
    if (isTourActive) {
        updatePositions();
    }
}

function handleKeydown(e) {
    if (!isTourActive) return;

    if (e.key === 'Escape') {
        stopTutorial();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStep < tutorialSteps.length - 1) {
            renderStep(currentStep + 1);
        } else {
            stopTutorial();
        }
    } else if (e.key === 'ArrowLeft') {
        if (currentStep > 0) {
            renderStep(currentStep - 1);
        }
    }
}


