/* ==================================================
   Main Application Entry Point
================================================== */

import AppLoading from './loading.js';
import { setCurrentUser, getCurrentUser } from './storage.js';
import { initializeAuthSession, setupAuthStateListener, initializeAuthSystem, reloadUserScopedLocalData, handleRoute } from './auth.js';
import { testSupabaseConnection, setSupabaseConnected, isSupabaseConnected } from './supabase.js';
import { 
    getRestaurants, setRestaurants, 
    loadRestaurantsFromSupabase, 
    createRestaurantInSupabase, 
    updateRestaurantInSupabase, 
    deleteRestaurantFromSupabase,
    normalizeWeeklyHours,
    createEmptyWeeklyHours,
    getHoursSummary,
    getHoursSummary as getRestaurantHoursSummary,
    getWeeklyHoursText,
    getTodayHours,
    formatHoursRange,
    mapRestaurantToSupabase
} from './restaurant.js';
import { 
    getGroups, setGroups, getCurrentGroupId, setCurrentGroupId,
    loadGroupsFromSupabase, 
    ensureGroupsInitialized, 
    assignMissingGroupIds, 
    getCurrentGroupName, 
    canEditCurrentGroup,
    switchGroup,
    deleteGroup,
    getGroupFilteredRestaurants,
    updateGroupInSupabase,
    createGroupInSupabase,
    joinGroupByInviteCode
} from './group.js';
import { 
    loadRestaurantsFromLocal, 
    saveRestaurantsLocal,
    loadGroupsFromLocal, 
    saveGroupsLocal,
    migrateLegacyGuestStorage,
    cleanupLegacyStorage,
    loadDisplaySettings,
    saveDisplaySettings
} from './storage.js';
import { 
    renderRestaurants, 
    applyDisplaySettings,
    showSkeletonLoading,
    finishAppStartup,
    updateGroupSwitchButton,
    cleanDisplayOrder,
    getDisplaySettings,
    setDisplaySettings,
    getOrderedRestaurants,
    initializeDisplaySettings
} from './ui.js';
import { initializeSearch } from './search.js';
import { initializeTheme, changeTheme } from './theme.js';
import { initializeAnnouncements } from './announcements.js';
import { openMenuViewer } from './menu.js';
import { 
    initializeRestaurantImageUpload, 
    initializeMenuPreview, 
    initializeMenuRemoveButtons,
    updateRestaurantImagePreview,
    updateMenuPreview,
    readFileAsDataUrl,
    uploadImageToSupabaseStorage,
    clearMenuImage
} from './image.js';
import { initializeRandomPicker } from './randomPicker.js';
import { WEEK_DAYS, UNCATEGORIZED_GROUP_NAME, ALL_CATEGORIES } from './config.js';
import { showToast, escapeHtml, generateUuid, generateInviteCode, copyToClipboard } from './utils.js';



// (已移除之前錯誤插入的片段)

// Handle PWA Share Target
async function initShareTargetListener() {
    const parsedUrl = new URL(window.location.href);
    const sharedUrl = parsedUrl.searchParams.get('url');

    if (sharedUrl) {
        // 清除 URL 參數以免重新整理時重複觸發
        window.history.replaceState({}, document.title, window.location.pathname);
        
        console.log('Shared URL detected:', sharedUrl);
        showToast('正在讀取餐廳資料...', 'info');

        try {
            // 實際 API 請求 (部署後使用)
            const response = await fetch(`/api/parse-map?url=${encodeURIComponent(sharedUrl)}`);
            if (!response.ok) throw new Error('解析失敗');
            const data = await response.json();
            
            /* 測試模式：模擬 API 回傳
            const data = {
                name: "測試餐廳",
                address: "台北市信義區測試路1號",
                phone: "02-12345678"
            };
            console.log('Using mock data for testing');
            */
            
            console.log('Parsed data:', data);

            // 確保 DOM 已經載入，並在需要時查詢
            const restaurantModal = document.getElementById("restaurantModal");
            const restaurantForm = document.getElementById("restaurantForm");
            
            if (restaurantModal && restaurantForm) {
                // 開啟新增視窗邏輯
                delete restaurantForm.dataset.editingId;
                restaurantForm.reset();
                const imgEl = document.getElementById("restaurantImage");
                if (imgEl) imgEl.dataset.imageRemoved = "false";
                
                if (typeof updateRestaurantImagePreview === 'function') updateRestaurantImagePreview("");
                if (typeof renderWeeklyHoursEditor === 'function') renderWeeklyHoursEditor();

                // 填充資料
                const nameInput = document.getElementById('restaurantName');
                const addressInput = document.getElementById('restaurantAddress');
                const phoneInput = document.getElementById('restaurantPhone');

                if (nameInput) nameInput.value = data.name || '';
                if (addressInput) addressInput.value = data.address || '';
                if (phoneInput) phoneInput.value = data.phone || '';

                restaurantModal.classList.add("show");
                showToast('已自動填入餐廳資料', 'success');
            }
        } catch (error) {
            console.error(error);
            showToast('無法自動匯入資料，請手動輸入', 'error');
        }
    }
}

// Weekly hours editor functions
function renderWeeklyHoursEditor(value = null) {
    const editor = document.getElementById("weeklyHoursEditor");
    const quickDays = document.getElementById("quickHoursDays");
    const weeklyHours = normalizeWeeklyHours(value);

    editor.innerHTML = WEEK_DAYS.map(day => {
        const hours = weeklyHours[day.key];

        return `
            <div class="hours-day-row" data-day="${day.key}">
                <span class="hours-day-name">星期${day.label}</span>
                <button type="button" class="hours-open-toggle ${hours.open ? "is-open" : ""}" data-open="${hours.open}">
                    ${hours.open ? "🟢 營業" : "⚪ 公休"}
                </button>
                <div class="hours-time-fields" ${hours.open ? "" : "hidden"}>
                    <input type="time" class="hours-start" value="${hours.start}">
                    <span>～</span>
                    <input type="time" class="hours-end" value="${hours.end}">
                </div>
            </div>
        `;
    }).join("");

    quickDays.innerHTML = WEEK_DAYS.map(day => `
    <label class="quick-day-item">
        <input type="checkbox" value="${day.key}">
        <span>${day.label}</span>
    </label>
    `).join("");

    editor.querySelectorAll(".hours-open-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const isOpen = button.dataset.open !== "true";
            const timeFields = button.parentElement.querySelector(".hours-time-fields");

            button.dataset.open = String(isOpen);
            button.classList.toggle("is-open", isOpen);
            button.textContent = isOpen ? "🟢 營業" : "⚪ 公休";
            timeFields.hidden = !isOpen;
        });
    });
}

function readWeeklyHoursFromEditor() {
    const weeklyHours = createEmptyWeeklyHours();

    document.querySelectorAll(".hours-day-row").forEach(row => {
        const open = row.querySelector(".hours-open-toggle").dataset.open === "true";
        const start = row.querySelector(".hours-start").value;
        const end = row.querySelector(".hours-end").value;

        if (open && (!start || !end || start >= end)) {
            throw new Error(`星期${row.querySelector(".hours-day-name").textContent.replace("星期", "")}的營業時間不完整或有誤`);
        }

        weeklyHours[row.dataset.day] = { open, start: open ? start : "", end: open ? end : "" };
    });

    return weeklyHours;
}

function initializeWeeklyHours() {
    document.getElementById("applyQuickHours").addEventListener("click", () => {
        const selectedDays = [...document.querySelectorAll("#quickHoursDays input:checked")].map(input => input.value);
        const start = document.getElementById("quickHoursStart").value;
        const end = document.getElementById("quickHoursEnd").value;

        if (selectedDays.length === 0 || !start || !end || start >= end) {
            alert("請選擇日期並設定正確的開始與結束時間。");
            return;
        }

        selectedDays.forEach(dayKey => {
            const row = document.querySelector(`[data-day="${dayKey}"]`);
            const toggle = row.querySelector(".hours-open-toggle");

            toggle.dataset.open = "true";
            toggle.classList.add("is-open");
            toggle.textContent = "🟢 營業";
            row.querySelector(".hours-time-fields").hidden = false;
            row.querySelector(".hours-start").value = start;
            row.querySelector(".hours-end").value = end;
        });
    });

    renderWeeklyHoursEditor();
}

// Restaurant form handling
const restaurantModal = document.getElementById("restaurantModal");
const closeModal = document.getElementById("closeModal");
const restaurantForm = document.getElementById("restaurantForm");
const addRestaurantButton = document.getElementById("addRestaurantButton");

function closeRestaurantModal() {
    restaurantModal.classList.remove("show");
    restaurantForm.reset();
    document.getElementById("restaurantImage").dataset.imageRemoved = "false";
    updateRestaurantImagePreview("");
    renderWeeklyHoursEditor();

    document.querySelectorAll("[id^='restaurantMenu']").forEach(input => {
        input.dataset.menuRemoved = "false";
    });

    delete restaurantForm.dataset.editingId;

    // (已移除群組選單邏輯)

    updateMenuPreview(1, "");
    updateMenuPreview(2, "");
    updateMenuPreview(3, "");
}

function showRestaurantDetail(restaurant) {
    const overlay = document.createElement("div");
    overlay.className = "detail-overlay";

    const menuCount = restaurant.menuImages ? restaurant.menuImages.length : 0;

    overlay.innerHTML = `
        <div class="detail-sheet">
            <div class="detail-header">
                <button class="detail-close">×</button>
            </div>
            <div class="detail-main-image">
                <img src="${restaurant.image || ""}" alt="${restaurant.name}">
            </div>
            <div class="detail-content">
                <div class="detail-title-row">
                    <div>
                        <h2>${restaurant.name}</h2>
                        <p class="detail-rating">★ ${restaurant.rating || "—"}</p>
                    </div>
                    <span class="tag">${restaurant.category}</span>
                </div>
                <button class="detail-menu-button">
                    <div>
                        <strong>📖 查看菜單</strong>
                        <span>${menuCount > 0 ? `${menuCount} 張菜單圖片` : "尚未新增菜單"}</span>
                    </div>
                    <span>→</span>
                </button>
                <div class="info-list">
                    <div class="info-item">
                        <span>📍</span>
                        <div>
                            <small>地址</small>
                            <p>${restaurant.address || "尚未提供"}</p>
                        </div>
                    </div>
                    <div class="info-item">
                        <span>🕐</span>
                        <div>
                            <small>營業時間</small>
                            <p>${getRestaurantHoursSummary(restaurant)}</p>
                        </div>
                    </div>
                    <div class="info-item">
                        <span>☎</span>
                        <div>
                            <small>電話</small>
                            <p>${restaurant.phone || "尚未提供"}</p>
                        </div>
                    </div>
                </div>
                <div class="description">
                    <h3>我的備註</h3>
                    <p>${restaurant.description || "尚未新增備註"}</p>
                </div>
                <div class="detail-actions">
                    <button class="detail-map-button">📍 Google Maps</button>
                    <button class="detail-edit-button">✏️ 編輯餐廳</button>
                    <button class="detail-delete-button">🗑️ 刪除餐廳</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".detail-close").addEventListener("click", () => overlay.remove());

    overlay.querySelector(".detail-menu-button").addEventListener("click", () => {
        if (!restaurant.menuImages || restaurant.menuImages.length === 0) {
            alert("這間餐廳目前還沒有菜單圖片。");
            return;
        }
        overlay.remove();
        openMenuViewer(restaurant);
    });

    overlay.querySelector(".detail-map-button").addEventListener("click", () => {
        if (restaurant.maps) {
            window.open(restaurant.maps, "_blank");
        } else {
            alert("尚未設定 Google Maps");
        }
    });

    overlay.querySelector(".detail-edit-button").addEventListener("click", () => {
        if (!canEditCurrentGroup()) {
            showToast("唯讀模式，無法編輯餐廳");
            return;
        }
        overlay.remove();
        openEditRestaurant(restaurant);
    });

    overlay.querySelector(".detail-delete-button").addEventListener("click", () => {
        deleteRestaurant(restaurant.id);
        overlay.remove();
    });
}

function openEditRestaurant(restaurant) {
    restaurantModal.classList.add("show");
    restaurantForm.dataset.editingId = restaurant.id;

    document.getElementById("restaurantName").value = restaurant.name || "";
    document.getElementById("restaurantCategory").value = restaurant.category || "";

    // (已移除群組選單邏輯)

    document.getElementById("restaurantRating").value = restaurant.rating ?? "";
    document.getElementById("restaurantPhone").value = restaurant.phone || "";
    document.getElementById("restaurantAddress").value = restaurant.address || "";
    renderWeeklyHoursEditor(restaurant.hours);
    document.getElementById("restaurantMaps").value = restaurant.maps || "";
    document.getElementById("restaurantDescription").value = restaurant.description || "";

    const menuImages = restaurant.menuImages || [];
    document.getElementById("restaurantMenu1").value = "";
    document.getElementById("restaurantMenu2").value = "";
    document.getElementById("restaurantMenu3").value = "";
    document.querySelectorAll("[id^='restaurantMenu']").forEach(input => {
        input.dataset.menuRemoved = "false";
    });
    document.getElementById("restaurantImage").dataset.imageRemoved = "false";
    updateRestaurantImagePreview(restaurant.image || "");

    updateMenuPreview(1, menuImages[0] || "");
    updateMenuPreview(2, menuImages[1] || "");
    updateMenuPreview(3, menuImages[2] || "");
}

async function deleteRestaurant(id) {
    if (!canEditCurrentGroup()) {
        showToast("唯讀模式，無法刪除餐廳");
        return;
    }

    const restaurant = getRestaurants().find(r => String(r.id) === String(id));
    if (!restaurant) {
        alert("找不到要刪除的餐廳。");
        return;
    }

    if (!confirm(`確定要刪除「${restaurant.name}」嗎？`)) {
        return;
    }

    if (isSupabaseConnected()) {
        const success = await deleteRestaurantFromSupabase(id);
        if (!success) {
            alert("❌ 餐廳刪除失敗，請檢查網路連線。");
            return;
        }
        await loadRestaurantsFromSupabase();
    } else {
        const restaurants = getRestaurants().filter(r => String(r.id) !== String(id));
        setRestaurants(restaurants);
        cleanDisplayOrder(restaurants);
        saveRestaurantsLocal(restaurants);
        alert("⚠️ Supabase 尚未連線，目前只從本機刪除。");
    }

    renderRestaurants(getRestaurants());
}

// Group management UI
function initializeGroupManagement() {
    const groupSwitchButton = document.getElementById("groupSwitchButton");
    const groupSheetModal = document.getElementById("groupSheetModal");
    const closeGroupSheet = document.getElementById("closeGroupSheet");
    const addGroupButton = document.getElementById("addGroupButton");
    const groupFormModal = document.getElementById("groupFormModal");
    const closeGroupFormModal = document.getElementById("closeGroupFormModal");
    const cancelGroupFormButton = document.getElementById("cancelGroupFormButton");
    const groupForm = document.getElementById("groupForm");
    const groupNameInput = document.getElementById("groupNameInput");
    const groupVisibilitySelect = document.getElementById("groupVisibilitySelect");
    const groupFormTitle = document.getElementById("groupFormTitle");
    const submitGroupFormButton = document.getElementById("submitGroupFormButton");
    const groupInviteCodeField = document.getElementById("groupInviteCodeField");
    const groupInviteCodeDisplay = document.getElementById("groupInviteCodeDisplay");
    const copyGroupInviteCodeButton = document.getElementById("copyGroupInviteCodeButton");

    if (!groupSwitchButton || !groupSheetModal || !groupFormModal || !groupForm) {
        return;
    }

    // Toggle invite code field visibility based on selected visibility
    function updateInviteCodeVisibility() {
        if (!groupVisibilitySelect || !groupInviteCodeField) return;
        const val = groupVisibilitySelect.value;
        if (val === "shared") {
            groupInviteCodeField.hidden = false;
            if (groupInviteCodeDisplay && !groupInviteCodeDisplay.value) {
                const editingGroupId = groupForm.dataset.editingGroupId;
                const editingGroup = editingGroupId ? getGroups().find(g => g.id === editingGroupId) : null;
                groupInviteCodeDisplay.value = editingGroup?.invite_code || generateInviteCode();
            }
        } else {
            groupInviteCodeField.hidden = true;
            if (groupInviteCodeDisplay) groupInviteCodeDisplay.value = "";
        }
    }

    groupVisibilitySelect?.addEventListener("change", updateInviteCodeVisibility);

    function closeGroupFormModalHandler() {
        groupFormModal.classList.remove("show");
        groupForm.reset();
        delete groupForm.dataset.editingGroupId;
        if (groupVisibilitySelect) groupVisibilitySelect.value = "private";
        if (groupInviteCodeDisplay) groupInviteCodeDisplay.value = "";
        updateInviteCodeVisibility();
    }

    groupSwitchButton.addEventListener("click", () => {
        renderGroupList();
        groupSheetModal.classList.add("show");
    });

    closeGroupSheet?.addEventListener("click", () => {
        groupSheetModal.classList.remove("show");
    });

    const joinInviteCodeInput = document.getElementById("joinInviteCodeInput");
    const joinGroupButton = document.getElementById("joinGroupButton");

    copyGroupInviteCodeButton?.addEventListener("click", async () => {
        const code = groupInviteCodeDisplay?.value?.trim();
        if (!code) return;
        
        const ok = await copyToClipboard(code);
        if (ok) {
            showToast(`✅ 已複製邀請碼：${code}`, "success");
        } else {
            showToast(`❌ 複製失敗，邀請碼為：${code}`, "error");
        }
    });

    groupSheetModal.addEventListener("click", event => {
        if (event.target === groupSheetModal) {
            groupSheetModal.classList.remove("show");
        }
    });

    addGroupButton?.addEventListener("click", () => {
        if (!getCurrentUser()) {
            alert("⚠️ 請先登入帳號後再建立群組！");
            return;
        }
        delete groupForm.dataset.editingGroupId;
        groupFormTitle.textContent = "新增群組";
        submitGroupFormButton.textContent = "建立";
        groupNameInput.value = "";
        if (groupVisibilitySelect) groupVisibilitySelect.value = "private";
        if (groupInviteCodeDisplay) groupInviteCodeDisplay.value = "";
        updateInviteCodeVisibility();
        groupSheetModal.classList.remove("show");
        groupFormModal.classList.add("show");
        groupNameInput.focus();
    });

    // Join shared group section
    const openJoinGroupButton = document.getElementById("openJoinGroupButton");
    const joinGroupContainer = document.getElementById("joinGroupContainer");
    const cancelJoinGroupButton = document.getElementById("cancelJoinGroupButton");

    openJoinGroupButton?.addEventListener("click", () => {
        joinGroupContainer.style.display = "block";
        openJoinGroupButton.style.display = "none";
        joinInviteCodeInput?.focus();
    });

    cancelJoinGroupButton?.addEventListener("click", () => {
        joinGroupContainer.style.display = "none";
        openJoinGroupButton.style.display = "flex";
        if (joinInviteCodeInput) joinInviteCodeInput.value = "";
    });

    joinInviteCodeInput?.addEventListener("input", (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    joinInviteCodeInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            joinGroupButton?.click();
        }
    });

    joinGroupButton?.addEventListener("click", async () => {
        const inviteCode = joinInviteCodeInput?.value.trim().toUpperCase();
        if (!inviteCode || inviteCode.length !== 6) {
            showToast("❌ 請輸入有效的 6 位數邀請碼", "error");
            return;
        }

        try {
            const result = await joinGroupByInviteCode(inviteCode);
            if (result.success && result.group) {
                const currentGroups = getGroups();
                saveGroupsLocal(currentGroups, result.group.id);
                if (joinInviteCodeInput) joinInviteCodeInput.value = "";
                joinGroupContainer.style.display = "none";
                openJoinGroupButton.style.display = "flex";
                renderGroupList();
                switchGroup(result.group.id);
                groupSheetModal.classList.remove("show");
                renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
            }
        } catch (err) {
            console.error("Join group error:", err);
            showToast("❌ 加入群組時發生錯誤", "error");
        }
    });

    closeGroupFormModal?.addEventListener("click", closeGroupFormModalHandler);
    cancelGroupFormButton?.addEventListener("click", closeGroupFormModalHandler);

    groupFormModal.addEventListener("click", event => {
        if (event.target === groupFormModal) {
            closeGroupFormModalHandler();
        }
    });

    groupForm.addEventListener("submit", event => {
        event.preventDefault();

        const name = groupNameInput.value.trim();
        const visibility = groupVisibilitySelect ? groupVisibilitySelect.value : "private";

        if (!name) return;

        const editingGroupId = groupForm.dataset.editingGroupId;

        if (editingGroupId) {
            const group = getGroups().find(candidate => candidate.id === editingGroupId);
            if (group) {
                if (group.name === UNCATEGORIZED_GROUP_NAME) {
                    alert("「未分類」群組不能修改。");
                    closeGroupFormModalHandler();
                    return;
                }
                group.name = name;
                group.visibility = visibility;
                if (visibility === "shared") {
                    group.invite_code = groupInviteCodeDisplay?.value?.trim() || group.invite_code || generateInviteCode();
                } else {
                    group.invite_code = null;
                }
                saveGroupsLocal(getGroups(), getCurrentGroupId());
                updateGroupInSupabase(editingGroupId, name, visibility, group.invite_code);
            }
            showToast(visibility === "shared" ? `✅ 群組設定已更新！邀請碼：${group.invite_code}` : "✅ 群組設定已更新", "success");
        } else {
            const groupUuid = generateUuid();
            const inviteCode = visibility === "shared" ? (groupInviteCodeDisplay?.value?.trim() || generateInviteCode()) : null;
            const newGroup = {
                id: groupUuid,
                name,
                visibility,
                invite_code: inviteCode,
                user_id: getCurrentUser()?.id || null,
                created_at: new Date().toISOString()
            };

            const groups = getGroups();
            groups.push(newGroup);
            setGroups(groups);
            setCurrentGroupId(groupUuid);
            saveGroupsLocal(groups, groupUuid);

            if (getCurrentUser()) {
                createGroupInSupabase(newGroup).then(supabaseId => {
                    if (supabaseId) {
                        const targetGroup = groups.find(g => g.id === groupUuid);
                        if (targetGroup) {
                            targetGroup.id = supabaseId;
                        }
                        if (getCurrentGroupId() === groupUuid) {
                            setCurrentGroupId(supabaseId);
                        }
                        const restaurants = getRestaurants();
                        restaurants.forEach(r => {
                            if (r.groupId === groupUuid) {
                                r.groupId = supabaseId;
                            }
                        });
                        saveGroupsLocal(getGroups(), getCurrentGroupId());
                        saveRestaurantsLocal(restaurants);
                        updateGroupSwitchButton();
                        renderRestaurants(restaurants);
                    }
                });
            }

            showToast(visibility === "shared" ? `✅ 群組建立成功！邀請碼：${inviteCode}` : `✅ 已建立並切換到「${name}」`, "success");
        }

        closeGroupFormModalHandler();
        updateGroupSwitchButton();
        renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
    });
}

function renderGroupList() {
    const groupList = document.getElementById("groupList");
    if (!groupList) return;

    const currentUser = getCurrentUser();
    const groups = getGroups();

    const myGroups = groups.filter(group => {
        if (group.name === UNCATEGORIZED_GROUP_NAME) return true;
        if (!currentUser) return !group.user_id || group.user_id === "local";
        if (group.user_id === currentUser.id) return true;
        if (group.visibility === 'shared' && localStorage.getItem('joined_shared_' + group.id) === 'true') return true;
        return false;
    });

    const publicGroups = groups.filter(group => {
        if (group.name === UNCATEGORIZED_GROUP_NAME) return false;
        const isPublicOrShared = group.visibility === "public" || group.visibility === "shared";
        const isMine = currentUser ? (group.user_id === currentUser.id) : (!group.user_id || group.user_id === "local");
        const isJoinedShared = currentUser && group.visibility === 'shared' && localStorage.getItem('joined_shared_' + group.id) === 'true';
        return isPublicOrShared && !isMine && !isJoinedShared;
    });

    let htmlOutput = "";

    if (myGroups.length > 0) {
        htmlOutput += `<div class="group-section-title">我的群組</div>`;
        htmlOutput += myGroups.map(group => renderSingleGroupItem(group)).join("");
    }

    if (publicGroups.length > 0) {
        htmlOutput += `<div class="group-section-title">公開群組</div>`;
        htmlOutput += publicGroups.map(group => renderSingleGroupItem(group, true)).join("");
    }

    groupList.innerHTML = htmlOutput;

    groupList.querySelectorAll("[data-select-group-id]").forEach(button => {
        button.addEventListener("click", () => {
            switchGroup(button.dataset.selectGroupId);
            groupSheetModal.classList.remove("show");
            renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
        });
    });

    // Copy Invite Code button from Group list item
    groupList.querySelectorAll("[data-copy-invite-code]").forEach(button => {
        button.addEventListener("click", async (e) => {
            e.stopPropagation();
            const code = button.dataset.copyInviteCode;
            if (!code) return;
            const ok = await copyToClipboard(code);
            if (ok) {
                showToast(`✅ 已複製邀請碼：${code}`, "success");
            } else {
                showToast(`❌ 複製失敗，邀請碼為：${code}`, "error");
            }
        });
    });

    groupList.querySelectorAll("[data-rename-group-id]").forEach(button => {
        button.addEventListener("click", () => {
            openRenameGroupModal(button.dataset.renameGroupId);
        });
    });

    groupList.querySelectorAll("[data-delete-group-id]").forEach(button => {
        button.addEventListener("click", () => {
            deleteGroup(button.dataset.deleteGroupId, getRestaurants());
            renderGroupList();
        });
    });
}

function renderSingleGroupItem(group, isOthersPublic = false) {
    const isUncategorized = group.name === UNCATEGORIZED_GROUP_NAME;
    const currentUser = getCurrentUser();
    const isOwner = currentUser ? (group.user_id === currentUser.id) : (!group.user_id || group.user_id === "local");
    const isReadonly = isOthersPublic;
    const canEdit = !isUncategorized && isOwner && !isOthersPublic;

    const badges = [];
    if (group.visibility === "public") {
        badges.push(`<span style="font-size: 10px; background: rgba(0,128,0,0.1); color: green; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">🌐 公開</span>`);
    } else if (group.visibility === "shared") {
        badges.push(`<span style="font-size: 10px; background: rgba(255,165,0,0.15); color: #d97706; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">🔗 共享</span>`);
    } else {
        badges.push(`<span style="font-size: 10px; background: rgba(128,128,128,0.1); color: gray; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">🔒 私人</span>`);
    }

    if (isReadonly) {
        badges.push(`<span style="font-size: 10px; background: rgba(0,122,255,0.1); color: #007aff; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">👁️ 唯讀</span>`);
    }

    const hasInviteCode = group.visibility === "shared" && group.invite_code;

    return `
        <div class="group-list-item ${group.id === getCurrentGroupId() ? "active" : ""}" data-group-id="${escapeHtml(group.id)}">
            <span class="group-list-check">${group.id === getCurrentGroupId() ? "✓" : ""}</span>
            <button type="button" class="group-list-name" data-select-group-id="${escapeHtml(group.id)}">
                ${escapeHtml(group.name)} ${!isUncategorized ? badges.join("") : ""}
            </button>
            ${hasInviteCode ? `
                <button type="button" class="group-invite-code-btn" data-copy-invite-code="${escapeHtml(group.invite_code)}" title="點擊複製邀請碼：${escapeHtml(group.invite_code)}">
                    <span>${escapeHtml(group.invite_code)}</span>
                    <span>📋</span>
                </button>
            ` : ""}
            ${canEdit ? `
                <button type="button" class="group-rename-button" data-rename-group-id="${escapeHtml(group.id)}" aria-label="修改群組名稱與設定" title="修改群組名稱與設定">✎</button>
                <button type="button" class="group-delete-button" data-delete-group-id="${escapeHtml(group.id)}" aria-label="刪除群組" title="刪除群組">🗑️</button>
            ` : ""}
        </div>
    `;
}

function openRenameGroupModal(groupId) {
    const group = getGroups().find(candidate => candidate.id === groupId);
    if (!group) return;

    const groupForm = document.getElementById("groupForm");
    const groupNameInput = document.getElementById("groupNameInput");
    const groupVisibilitySelect = document.getElementById("groupVisibilitySelect");
    const groupFormTitle = document.getElementById("groupFormTitle");
    const submitGroupFormButton = document.getElementById("submitGroupFormButton");
    const groupSheetModal = document.getElementById("groupSheetModal");
    const groupFormModal = document.getElementById("groupFormModal");

    groupForm.dataset.editingGroupId = groupId;
    groupFormTitle.textContent = "修改群組名稱與設定";
    submitGroupFormButton.textContent = "儲存";
    groupNameInput.value = group.name;
    if (groupVisibilitySelect) {
        groupVisibilitySelect.value = group.visibility || "private";
    }
    
    // Call invite code visibility check
    const groupInviteCodeField = document.getElementById("groupInviteCodeField");
    const groupInviteCodeDisplay = document.getElementById("groupInviteCodeDisplay");
    if (group.visibility === "shared") {
        if (!group.invite_code) {
            group.invite_code = generateInviteCode();
            saveGroupsLocal(getGroups(), getCurrentGroupId());
            updateGroupInSupabase(groupId, undefined, undefined, group.invite_code);
        }
        if (groupInviteCodeField) groupInviteCodeField.hidden = false;
        if (groupInviteCodeDisplay) groupInviteCodeDisplay.value = group.invite_code;
    } else {
        if (groupInviteCodeField) groupInviteCodeField.hidden = true;
        if (groupInviteCodeDisplay) groupInviteCodeDisplay.value = "";
    }

    groupSheetModal?.classList.remove("show");
    groupFormModal?.classList.add("show");
    groupNameInput.focus();
}

// Category handling & rendering
export function renderCategoryScroll() {
    const categoryScroll = document.getElementById("categoryScroll");
    if (!categoryScroll) return;

    const settings = getDisplaySettings();
    const visibleCats = settings.visibleCategories || [];

    // Find icon mapping from ALL_CATEGORIES
    const iconMap = {};
    ALL_CATEGORIES.forEach(cat => {
        iconMap[cat.name] = cat.icon;
    });

    let html = `
        <button
            class="category active"
            data-category="全部"
            type="button"
        >
            <span class="category-icon">🍽️</span>
            <span>全部</span>
        </button>
        <button
            class="category"
            data-category="收藏"
            type="button"
        >
            <span class="category-icon">❤️</span>
            <span>收藏</span>
        </button>
    `;

    visibleCats.forEach(catName => {
        const icon = iconMap[catName] || "🏷️";
        html += `
            <button
                class="category"
                data-category="${escapeHtml(catName)}"
                type="button"
            >
                <span class="category-icon">${icon}</span>
                <span>${escapeHtml(catName)}</span>
            </button>
        `;
    });

    categoryScroll.innerHTML = html;
    initializeCategories();
}

function initializeCategories() {
    const categories = document.querySelectorAll(".category");

    categories.forEach(categoryButton => {
        categoryButton.addEventListener("click", () => {
            categories.forEach(button => button.classList.remove("active"));
            categoryButton.classList.add("active");

            const category = categoryButton.dataset.category;
            const restaurants = getRestaurants();

            if (category === "全部") {
                renderRestaurants(getGroupFilteredRestaurants(restaurants));
                return;
            }

            if (category === "收藏") {
                const favoriteRestaurants = restaurants.filter(r => r.favorite === true);
                renderRestaurants(getGroupFilteredRestaurants(favoriteRestaurants));
                return;
            }

            const filteredRestaurants = restaurants.filter(r => r.category === category);
            renderRestaurants(getGroupFilteredRestaurants(filteredRestaurants));
        });
    });
}



export function renderOrderEditor() {
    const orderList = document.getElementById("orderList");
    const orderedRestaurants = getOrderedRestaurants(getGroupFilteredRestaurants(getRestaurants()));

    orderList.innerHTML = orderedRestaurants.map((restaurant, index) => `
        <div class="order-item" draggable="true" data-order-id="${restaurant.id}">
            <span class="order-drag-handle">☰</span>
            <span class="order-item-name">${restaurant.name || "未命名餐廳"}</span>
            <button type="button" class="order-move-button" data-direction="up" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="order-move-button" data-direction="down" ${index === orderedRestaurants.length - 1 ? "disabled" : ""}>↓</button>
        </div>
    `).join("");

    orderList.querySelectorAll(".order-move-button").forEach(button => {
        button.addEventListener("click", () => {
            const item = button.closest(".order-item");
            const target = button.dataset.direction === "up"
                ? item.previousElementSibling
                : item.nextElementSibling;

            if (target) {
                button.dataset.direction === "up"
                    ? orderList.insertBefore(item, target)
                    : orderList.insertBefore(target, item);
                renderOrderEditorButtons();
            }
        });
    });

    let draggedItem;

    orderList.querySelectorAll(".order-item").forEach(item => {
        item.addEventListener("dragstart", () => {
            draggedItem = item;
            item.classList.add("is-dragging");
        });
        item.addEventListener("dragend", () => {
            item.classList.remove("is-dragging");
            draggedItem = null;
        });
        item.addEventListener("dragover", event => {
            event.preventDefault();
            if (draggedItem && draggedItem !== item) {
                const rect = item.getBoundingClientRect();
                const after = event.clientY > rect.top + rect.height / 2;
                orderList.insertBefore(draggedItem, after ? item.nextSibling : item);
            }
        });
    });
}

function renderOrderEditorButtons() {
    const items = [...document.querySelectorAll("#orderList .order-item")];
    items.forEach((item, index) => {
        item.querySelector('[data-direction="up"]').disabled = index === 0;
        item.querySelector('[data-direction="down"]').disabled = index === items.length - 1;
    });
}

// Main initialization function
async function initialize() {
    console.log("🚀 餐廳管理系統啟動");

    // Initialize auth session
    await initShareTargetListener();

    await initializeAuthSession();

    // Execute legacy guest storage migration
    migrateLegacyGuestStorage();

    // Load groups
    const { groups, currentGroupId } = loadGroupsFromLocal();
    setGroups(groups);
    setCurrentGroupId(currentGroupId);

    try {
        await loadGroupsFromSupabase();
    } catch (error) {
        console.error("❌ 群組載入錯誤：", error);
    }

    ensureGroupsInitialized();
    updateGroupSwitchButton(getCurrentGroupName(), canEditCurrentGroup());

    // Initialize announcements
    try {
        initializeAnnouncements();
    } catch (err) {
        console.error("❌ 公告系統初始化錯誤：", err);
    }

    // Load restaurants
    AppLoading.show("正在尋找美食清單...");
    try {
        await loadRestaurantsFromSupabase();
    } catch (error) {
        console.error("❌ 餐廳資料載入失敗：", error);
        const restaurants = loadRestaurantsFromLocal();
        setRestaurants(restaurants);
    } finally {
        AppLoading.hide(300);
        finishAppStartup();
    }

    assignMissingGroupIds(getRestaurants());
    cleanDisplayOrder(getRestaurants());
    renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));

    // Initialize all subsystems
    initializeAuthSystem();
    setupAuthStateListener();
    initializeTheme();
    initializeDisplaySettings();
    initializeGroupManagement();
    initializeRestaurantImageUpload();
    initializeWeeklyHours();
    initializeMenuPreview();
    initializeRandomPicker();
    initializeMenuRemoveButtons();
    initializeSearch();
    renderCategoryScroll();

    // Handle Web Share Target
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("share")) {
        const sharedTitle = urlParams.get("title");
        const sharedText = urlParams.get("text");
        const sharedUrl = urlParams.get("url");

        if (sharedUrl || sharedText) {
            const linkToParse = sharedUrl || sharedText;
            if (linkToParse.includes("maps.app.goo.gl") || linkToParse.includes("google.com/maps")) {
                AppLoading.show("正在自動讀取地圖資料...");
                fetch(`/api/parse-map?url=${encodeURIComponent(linkToParse)}`)
                    .then(res => res.json())
                    .then(data => {
                        addRestaurantButton.click();
                        if (data.name) document.getElementById("restaurantName").value = data.name;
                        if (data.address) document.getElementById("restaurantAddress").value = data.address;
                        if (data.phone) document.getElementById("restaurantPhone").value = data.phone;
                    })
                    .catch(err => console.error("解析失敗", err))
                    .finally(() => AppLoading.hide());
            }
        }
        // 清除網址參數
        window.history.replaceState({}, document.title, window.location.pathname);
    }


    // Set up restaurant form
    addRestaurantButton.addEventListener("click", () => {
        delete restaurantForm.dataset.editingId;
        restaurantForm.reset();
        document.getElementById("restaurantImage").dataset.imageRemoved = "false";
        updateRestaurantImagePreview("");
        renderWeeklyHoursEditor();

        // (已移除群組選擇初始化)

        document.querySelectorAll("[id^='restaurantMenu']").forEach(input => {
            input.dataset.menuRemoved = "false";
        });

        updateMenuPreview(1, "");
        updateMenuPreview(2, "");
        updateMenuPreview(3, "");

        restaurantModal.classList.add("show");
    });

    closeModal.addEventListener("click", closeRestaurantModal);
    restaurantModal.addEventListener("click", event => {
        if (event.target === restaurantModal) {
            closeRestaurantModal();
        }
    });

    // Restaurant form submission
    restaurantForm.addEventListener("submit", async event => {
        event.preventDefault();
        AppLoading.show("正在幫你存好這家店…");
        
        const editingId = restaurantForm.dataset.editingId;
        const menuInputs = [
            document.getElementById("restaurantMenu1"),
            document.getElementById("restaurantMenu2"),
            document.getElementById("restaurantMenu3")
        ];

        const selectedMenuFiles = menuInputs.map(input =>
            input && input.files && input.files.length > 0 ? input.files[0] : null
        );

        const existingRestaurant = editingId
            ? getRestaurants().find(r => String(r.id) === String(editingId))
            : null;

        let restaurantImage;
        let menuImages;

        try {
            // Process main image
            if (document.getElementById("restaurantImage").files && document.getElementById("restaurantImage").files.length > 0) {
                if (getCurrentUser()) {
                    restaurantImage = await uploadImageToSupabaseStorage(document.getElementById("restaurantImage").files[0]);
                } else {
                    restaurantImage = await readFileAsDataUrl(document.getElementById("restaurantImage").files[0]);
                }
            } else if (document.getElementById("restaurantImage").dataset.imageRemoved === "true") {
                restaurantImage = "";
            } else {
                restaurantImage = existingRestaurant?.image || "";
            }

            // Process menu images
            menuImages = await Promise.all(
                selectedMenuFiles.map(async (file, index) => {
                    if (file) {
                        return getCurrentUser() ? await uploadImageToSupabaseStorage(file) : await readFileAsDataUrl(file);
                    }
                    if (menuInputs[index]?.dataset.menuRemoved === "true") {
                        return null;
                    }
                    return existingRestaurant?.menuImages?.[index] || "";
                })
            );
            menuImages = menuImages.filter(Boolean);
        } catch (error) {
            AppLoading.hide();
            console.error("❌ 圖片處理失敗，儲存中止：", error);
            alert("圖片上傳失敗，請稍後再試。");
            return;
        }

        const weeklyHours = readWeeklyHoursFromEditor();

        const restaurantData = {
            name: document.getElementById("restaurantName").value.trim(),
            category: document.getElementById("restaurantCategory").value,
            groupId: getCurrentGroupId(),
            rating: Number(document.getElementById("restaurantRating").value) || null,
            phone: document.getElementById("restaurantPhone").value.trim(),
            address: document.getElementById("restaurantAddress").value.trim(),
            hours: weeklyHours,
            maps: document.getElementById("restaurantMaps").value.trim(),
            image: restaurantImage,
            menuImages: menuImages,
            description: document.getElementById("restaurantDescription").value.trim()
        };

        if (editingId) {
            console.log("✏️ 開始更新餐廳：", editingId);

            if (isSupabaseConnected()) {
                const updatedRestaurant = await updateRestaurantInSupabase(editingId, restaurantData);

                if (!updatedRestaurant) {
                    AppLoading.hide();
                    alert("❌ 餐廳更新失敗，請檢查網路連線。");
                    return;
                }

                console.log("☁️ 餐廳已成功更新到 Supabase：", updatedRestaurant);
                await loadRestaurantsFromSupabase();
                renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
                closeRestaurantModal();
                alert("✅ 餐廳資料已更新！");
            } else {
                const index = getRestaurants().findIndex(r => String(r.id) === String(editingId));
                if (index === -1) {
                    AppLoading.hide();
                    alert("找不到要編輯的餐廳。");
                    return;
                }

                const restaurants = getRestaurants();
                restaurants[index] = { ...restaurants[index], ...restaurantData };
                setRestaurants(restaurants);
                saveRestaurantsLocal(restaurants);
                renderRestaurants(getGroupFilteredRestaurants(restaurants));
                closeRestaurantModal();
                alert("⚠️ Supabase 尚未連線，目前只儲存在本機。");
            }
        } else {
            const newRestaurant = {
                id: String(Date.now()),
                ...restaurantData,
                favorite: false
            };

            console.log("➕ 開始新增餐廳：", newRestaurant);

            if (isSupabaseConnected()) {
                if (!getCurrentUser()) {
                    alert("⚠️ 請先登入帳號後再新增餐廳！");
                    return;
                }

                const saved = await createRestaurantInSupabase(newRestaurant);

                if (saved) {
                    console.log("☁️ 新餐廳已成功同步到 Supabase：", saved);
                    await loadRestaurantsFromSupabase();
                    renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
                    closeRestaurantModal();
                    alert("✅ 餐廳已成功新增！");
                } else {
                    const restaurants = getRestaurants();
                    restaurants.unshift(newRestaurant);
                    setRestaurants(restaurants);
                    saveRestaurantsLocal(restaurants);
                    renderRestaurants(getGroupFilteredRestaurants(restaurants));
                    closeRestaurantModal();
                    alert("⚠️ 餐廳已暫存，但無法同步到 Supabase。");
                }
            } else {
                const restaurants = getRestaurants();
                restaurants.unshift(newRestaurant);
                setRestaurants(restaurants);
                saveRestaurantsLocal(restaurants);
                renderRestaurants(getGroupFilteredRestaurants(restaurants));
                closeRestaurantModal();
                alert("⚠️ Supabase 尚未連線，目前只儲存在本機。");
            }
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
        AppLoading.hide(300);
    });

    // Set up event listeners for custom events
    window.addEventListener('openMenuViewer', (event) => {
        openMenuViewer(event.detail.restaurant);
    });

    window.addEventListener('showRestaurantDetail', (event) => {
        showRestaurantDetail(event.detail.restaurant);
    });

    // Keep track of the last processed user ID to avoid redundant reloads
    let lastProcessedUserId = null;

    window.addEventListener('authStateChanged', async (event) => {
        AppLoading.show("正在同步雲端資料...");
        const newUser = event.detail.user;
        const newUserId = newUser ? newUser.id : 'anonymous';
        
        // 確保載入最新群組資料與餐廳資料
        await loadGroupsFromSupabase();
        await loadRestaurantsFromSupabase();
        
        updateGroupSwitchButton(getCurrentGroupName(), canEditCurrentGroup());
        renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));

        if (newUserId !== lastProcessedUserId) {
            lastProcessedUserId = newUserId;
            reloadUserScopedLocalData();
        } else {
            console.log("⚡ 偵測到重複的 Auth State 變更，已跳過重新載入");
        }
        AppLoading.hide(300);
    });

    window.addEventListener('groupSwitched', (event) => {
        AppLoading.show("正在切換餐廳分組...");
        updateGroupSwitchButton(event.detail.groupName, canEditCurrentGroup());
        renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
        AppLoading.hide(300);
    });

    // Test Supabase connection
    testSupabaseConnection();

    // 若未登入，改為顯示登入提示，而非強制 replaceState 導致路由跳轉
    if (!getCurrentUser()) {
        console.log("使用者未登入，準備顯示登入視窗...");
        // 確保 handleRoute 內部邏輯不會在應用程式初始化時造成頁面重載
        handleRoute();
    }
}

// Start the application
initialize();