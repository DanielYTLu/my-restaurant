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



// (å·²ç§»?¤ä??éŒ¯èª¤æ??¥ç??‡æ®µ)

// ç§»é™¤?Šç??©è??è¼¯ï¼Œåœ¨ initialize ä¸­çµ±ä¸€?•ç?
async function handleShareTarget() {
    const urlParams = new URLSearchParams(window.location.search);
    const linkToParse = urlParams.get("url") || urlParams.get("text") || urlParams.get("title");
    
    if (!linkToParse || !(linkToParse.includes("maps.app.goo.gl") || linkToParse.includes("google.com/maps"))) return;

    // æ¸…é™¤ URL ?ƒæ•¸
    window.history.replaceState({}, document.title, window.location.pathname);
    
    console.log('Shared link detected:', linkToParse);
    AppLoading.show("æ­?œ¨è®€?–åœ°?–è???..");

    try {
        const response = await fetch(`/api/parse-map?url=${encodeURIComponent(linkToParse)}`);
        if (!response.ok) throw new Error('è§??å¤±æ?');
        const data = await response.json();
        
        const btn = document.getElementById("addRestaurantBtn") || document.querySelector(".add-restaurant-btn");
        if (btn) btn.click();

        // ç¢ºä? Modal ?‹å?å¾Œç?å¡«å?
        setTimeout(() => {
            if (data.name) document.getElementById("restaurantName").value = data.name;
            if (data.address) document.getElementById("restaurantAddress").value = data.address;
            if (data.phone) document.getElementById("restaurantPhone").value = data.phone;
            AppLoading.hide();
            showToast('å·²è‡ª?•å¡«?¥é?å»³è?è¨Šï?', 'success');
        }, 800);

    } catch (error) {
        console.error('Share Target Error:', error);
        AppLoading.hide();
        showToast('?¡æ??ªå??¯å…¥?°å?è³‡è?ï¼Œè??‹å??°å???, 'error');
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
                <span class="hours-day-name">?Ÿæ?${day.label}</span>
                <button type="button" class="hours-open-toggle ${hours.open ? "is-open" : ""}" data-open="${hours.open}">
                    ${hours.open ? "?Ÿ¢ ?Ÿæ¥­" : "???¬ä?"}
                </button>
                <div class="hours-time-fields" ${hours.open ? "" : "hidden"}>
                    <input type="time" class="hours-start" value="${hours.start}">
                    <span>ï½?/span>
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
            button.textContent = isOpen ? "?Ÿ¢ ?Ÿæ¥­" : "???¬ä?";
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
            throw new Error(`?Ÿæ?${row.querySelector(".hours-day-name").textContent.replace("?Ÿæ?", "")}?„ç?æ¥­æ??“ä?å®Œæ•´?–æ?èª¤`);
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
            alert("è«‹é¸?‡æ—¥?Ÿä¸¦è¨­å?æ­?¢º?„é?å§‹è?çµæ??‚é???);
            return;
        }

        selectedDays.forEach(dayKey => {
            const row = document.querySelector(`[data-day="${dayKey}"]`);
            const toggle = row.querySelector(".hours-open-toggle");

            toggle.dataset.open = "true";
            toggle.classList.add("is-open");
            toggle.textContent = "?Ÿ¢ ?Ÿæ¥­";
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

    // (å·²ç§»?¤ç¾¤çµ„é¸?®é?è¼?

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
                <button class="detail-close">?</button>
            </div>
            <div class="detail-main-image">
                <img src="${restaurant.image || ""}" alt="${restaurant.name}">
            </div>
            <div class="detail-content">
                <div class="detail-title-row">
                    <div>
                        <h2>${restaurant.name}</h2>
                        <p class="detail-rating">??${restaurant.rating || "??}</p>
                    </div>
                    <span class="tag">${restaurant.category}</span>
                </div>
                <button class="detail-menu-button">
                    <div>
                        <strong>?? ?¥ç??œå–®</strong>
                        <span>${menuCount > 0 ? `${menuCount} å¼µè??®å??‡` : "å°šæœª?°å??œå–®"}</span>
                    </div>
                    <span>??/span>
                </button>
                <div class="info-list">
                    <div class="info-item">
                        <span>??</span>
                        <div>
                            <small>?°å?</small>
                            <p>${restaurant.address || "å°šæœª?ä?"}</p>
                        </div>
                    </div>
                    <div class="info-item">
                        <span>??</span>
                        <div>
                            <small>?Ÿæ¥­?‚é?</small>
                            <p>${getRestaurantHoursSummary(restaurant)}</p>
                        </div>
                    </div>
                    <div class="info-item">
                        <span>??/span>
                        <div>
                            <small>?»è©±</small>
                            <p>${restaurant.phone || "å°šæœª?ä?"}</p>
                        </div>
                    </div>
                </div>
                <div class="description">
                    <h3>?‘ç??™è¨»</h3>
                    <p>${restaurant.description || "å°šæœª?°å??™è¨»"}</p>
                </div>
                <div class="detail-actions">
                    <button class="detail-map-button">?? Google Maps</button>
                    <button class="detail-edit-button">?ï? ç·¨è¼¯é¤å»³</button>
                    <button class="detail-delete-button">??ï¸??ªé™¤é¤å»³</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".detail-close").addEventListener("click", () => overlay.remove());

    overlay.querySelector(".detail-menu-button").addEventListener("click", () => {
        if (!restaurant.menuImages || restaurant.menuImages.length === 0) {
            alert("?™é?é¤å»³?®å??„æ??‰è??®å??‡ã€?);
            return;
        }
        overlay.remove();
        openMenuViewer(restaurant);
    });

    overlay.querySelector(".detail-map-button").addEventListener("click", () => {
        if (restaurant.maps) {
            window.open(restaurant.maps, "_blank");
        } else {
            alert("å°šæœªè¨­å? Google Maps");
        }
    });

    overlay.querySelector(".detail-edit-button").addEventListener("click", () => {
        if (!canEditCurrentGroup()) {
            showToast("?¯è?æ¨¡å?ï¼Œç„¡æ³•ç·¨è¼¯é?å»?);
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

    // (å·²ç§»?¤ç¾¤çµ„é¸?®é?è¼?

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
        showToast("?¯è?æ¨¡å?ï¼Œç„¡æ³•åˆª?¤é?å»?);
        return;
    }

    const restaurant = getRestaurants().find(r => String(r.id) === String(id));
    if (!restaurant) {
        alert("?¾ä??°è??ªé™¤?„é?å»³ã€?);
        return;
    }

    if (!confirm(`ç¢ºå?è¦åˆª?¤ã€?{restaurant.name}?å?ï¼Ÿ`)) {
        return;
    }

    if (isSupabaseConnected()) {
        const success = await deleteRestaurantFromSupabase(id);
        if (!success) {
            alert("??é¤å»³?ªé™¤å¤±æ?ï¼Œè?æª¢æŸ¥ç¶²è·¯?????);
            return;
        }
        await loadRestaurantsFromSupabase();
    } else {
        const restaurants = getRestaurants().filter(r => String(r.id) !== String(id));
        setRestaurants(restaurants);
        cleanDisplayOrder(restaurants);
        saveRestaurantsLocal(restaurants);
        alert("? ï? Supabase å°šæœª???ï¼Œç›®?åªå¾æœ¬æ©Ÿåˆª?¤ã€?);
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
            showToast(`??å·²è?è£½é?è«‹ç¢¼ï¼?{code}`, "success");
        } else {
            showToast(`??è¤‡è£½å¤±æ?ï¼Œé?è«‹ç¢¼?ºï?${code}`, "error");
        }
    });

    groupSheetModal.addEventListener("click", event => {
        if (event.target === groupSheetModal) {
            groupSheetModal.classList.remove("show");
        }
    });

    addGroupButton?.addEventListener("click", () => {
        if (!getCurrentUser()) {
            alert("? ï? è«‹å??»å…¥å¸³è?å¾Œå?å»ºç?ç¾¤ç?ï¼?);
            return;
        }
        delete groupForm.dataset.editingGroupId;
        groupFormTitle.textContent = "?°å?ç¾¤ç?";
        submitGroupFormButton.textContent = "å»ºç?";
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
            showToast("??è«‹è¼¸?¥æ??ˆç? 6 ä½æ•¸?€è«‹ç¢¼", "error");
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
            showToast("??? å…¥ç¾¤ç??‚ç™¼?ŸéŒ¯èª?, "error");
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
                    alert("?Œæœª?†é??ç¾¤çµ„ä??½ä¿®?¹ã€?);
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
            showToast(visibility === "shared" ? `??ç¾¤ç?è¨­å?å·²æ›´?°ï??€è«‹ç¢¼ï¼?{group.invite_code}` : "??ç¾¤ç?è¨­å?å·²æ›´??, "success");
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

            showToast(visibility === "shared" ? `??ç¾¤ç?å»ºç??å?ï¼é?è«‹ç¢¼ï¼?{inviteCode}` : `??å·²å»ºç«‹ä¸¦?‡æ??°ã€?{name}?`, "success");
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
        htmlOutput += `<div class="group-section-title">?‘ç?ç¾¤ç?</div>`;
        htmlOutput += myGroups.map(group => renderSingleGroupItem(group)).join("");
    }

    if (publicGroups.length > 0) {
        htmlOutput += `<div class="group-section-title">?¬é?ç¾¤ç?</div>`;
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
                showToast(`??å·²è?è£½é?è«‹ç¢¼ï¼?{code}`, "success");
            } else {
                showToast(`??è¤‡è£½å¤±æ?ï¼Œé?è«‹ç¢¼?ºï?${code}`, "error");
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
        badges.push(`<span style="font-size: 10px; background: rgba(0,128,0,0.1); color: green; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">?? ?¬é?</span>`);
    } else if (group.visibility === "shared") {
        badges.push(`<span style="font-size: 10px; background: rgba(255,165,0,0.15); color: #d97706; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">?? ?±äº«</span>`);
    } else {
        badges.push(`<span style="font-size: 10px; background: rgba(128,128,128,0.1); color: gray; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">?? ç§äºº</span>`);
    }

    if (isReadonly) {
        badges.push(`<span style="font-size: 10px; background: rgba(0,122,255,0.1); color: #007aff; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">??ï¸??¯è?</span>`);
    }

    const hasInviteCode = group.visibility === "shared" && group.invite_code;

    return `
        <div class="group-list-item ${group.id === getCurrentGroupId() ? "active" : ""}" data-group-id="${escapeHtml(group.id)}">
            <span class="group-list-check">${group.id === getCurrentGroupId() ? "?? : ""}</span>
            <button type="button" class="group-list-name" data-select-group-id="${escapeHtml(group.id)}">
                ${escapeHtml(group.name)} ${!isUncategorized ? badges.join("") : ""}
            </button>
            ${hasInviteCode ? `
                <button type="button" class="group-invite-code-btn" data-copy-invite-code="${escapeHtml(group.invite_code)}" title="é»æ?è¤‡è£½?€è«‹ç¢¼ï¼?{escapeHtml(group.invite_code)}">
                    <span>${escapeHtml(group.invite_code)}</span>
                    <span>??</span>
                </button>
            ` : ""}
            ${canEdit ? `
                <button type="button" class="group-rename-button" data-rename-group-id="${escapeHtml(group.id)}" aria-label="ä¿®æ”¹ç¾¤ç??ç¨±?‡è¨­å®? title="ä¿®æ”¹ç¾¤ç??ç¨±?‡è¨­å®?>??/button>
                <button type="button" class="group-delete-button" data-delete-group-id="${escapeHtml(group.id)}" aria-label="?ªé™¤ç¾¤ç?" title="?ªé™¤ç¾¤ç?">??ï¸?/button>
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
    groupFormTitle.textContent = "ä¿®æ”¹ç¾¤ç??ç¨±?‡è¨­å®?;
    submitGroupFormButton.textContent = "?²å?";
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
            data-category="?¨éƒ¨"
            type="button"
        >
            <span class="category-icon">?½ï¸?/span>
            <span>?¨éƒ¨</span>
        </button>
        <button
            class="category"
            data-category="?¶è?"
            type="button"
        >
            <span class="category-icon">?¤ï?</span>
            <span>?¶è?</span>
        </button>
    `;

    visibleCats.forEach(catName => {
        const icon = iconMap[catName] || "?·ï¸?;
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

            if (category === "?¨éƒ¨") {
                renderRestaurants(getGroupFilteredRestaurants(restaurants));
                return;
            }

            if (category === "?¶è?") {
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
            <span class="order-drag-handle">??/span>
            <span class="order-item-name">${restaurant.name || "?ªå‘½?é?å»?}</span>
            <button type="button" class="order-move-button" data-direction="up" ${index === 0 ? "disabled" : ""}>??/button>
            <button type="button" class="order-move-button" data-direction="down" ${index === orderedRestaurants.length - 1 ? "disabled" : ""}>??/button>
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
    console.log("?? é¤å»³ç®¡ç?ç³»çµ±?Ÿå?");

    // Initialize auth session
    await handleShareTarget();

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
        console.error("??ç¾¤ç?è¼‰å…¥?¯èª¤ï¼?, error);
    }

    ensureGroupsInitialized();
    updateGroupSwitchButton(getCurrentGroupName(), canEditCurrentGroup());

    // Initialize announcements
    try {
        initializeAnnouncements();
    } catch (err) {
        console.error("???¬å?ç³»çµ±?å??–éŒ¯èª¤ï?", err);
    }

    // Load restaurants
    AppLoading.show("æ­?œ¨å°‹æ‰¾ç¾é?æ¸…å–®...");
    try {
        await loadRestaurantsFromSupabase();
    } catch (error) {
        console.error("??é¤å»³è³‡æ?è¼‰å…¥å¤±æ?ï¼?, error);
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

  // Handle Web Share Target (REPLACED)

        if (editingId) {
            console.log("?ï? ?‹å??´æ–°é¤å»³ï¼?, editingId);

            if (isSupabaseConnected()) {
                const updatedRestaurant = await updateRestaurantInSupabase(editingId, restaurantData);

                if (!updatedRestaurant) {
                    AppLoading.hide();
                    alert("??é¤å»³?´æ–°å¤±æ?ï¼Œè?æª¢æŸ¥ç¶²è·¯?????);
                    return;
                }

                console.log("?ï? é¤å»³å·²æ??Ÿæ›´?°åˆ° Supabaseï¼?, updatedRestaurant);
                await loadRestaurantsFromSupabase();
                renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
                closeRestaurantModal();
                alert("??é¤å»³è³‡æ?å·²æ›´?°ï?");
            } else {
                const index = getRestaurants().findIndex(r => String(r.id) === String(editingId));
                if (index === -1) {
                    AppLoading.hide();
                    alert("?¾ä??°è?ç·¨è¼¯?„é?å»³ã€?);
                    return;
                }

                const restaurants = getRestaurants();
                restaurants[index] = { ...restaurants[index], ...restaurantData };
                setRestaurants(restaurants);
                saveRestaurantsLocal(restaurants);
                renderRestaurants(getGroupFilteredRestaurants(restaurants));
                closeRestaurantModal();
                alert("? ï? Supabase å°šæœª???ï¼Œç›®?åª?²å??¨æœ¬æ©Ÿã€?);
            }
        } else {
            const newRestaurant = {
                id: String(Date.now()),
                ...restaurantData,
                favorite: false
            };

            console.log("???‹å??°å?é¤å»³ï¼?, newRestaurant);

            if (isSupabaseConnected()) {
                if (!getCurrentUser()) {
                    alert("? ï? è«‹å??»å…¥å¸³è?å¾Œå??°å?é¤å»³ï¼?);
                    return;
                }

                const saved = await createRestaurantInSupabase(newRestaurant);

                if (saved) {
                    console.log("?ï? ?°é?å»³å·²?å??Œæ­¥??Supabaseï¼?, saved);
                    await loadRestaurantsFromSupabase();
                    renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
                    closeRestaurantModal();
                    alert("??é¤å»³å·²æ??Ÿæ–°å¢ï?");
                } else {
                    const restaurants = getRestaurants();
                    restaurants.unshift(newRestaurant);
                    setRestaurants(restaurants);
                    saveRestaurantsLocal(restaurants);
                    renderRestaurants(getGroupFilteredRestaurants(restaurants));
                    closeRestaurantModal();
                    alert("? ï? é¤å»³å·²æš«å­˜ï?ä½†ç„¡æ³•å?æ­¥åˆ° Supabase??);
                }
            } else {
                const restaurants = getRestaurants();
                restaurants.unshift(newRestaurant);
                setRestaurants(restaurants);
                saveRestaurantsLocal(restaurants);
                renderRestaurants(getGroupFilteredRestaurants(restaurants));
                closeRestaurantModal();
                alert("? ï? Supabase å°šæœª???ï¼Œç›®?åª?²å??¨æœ¬æ©Ÿã€?);
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
        AppLoading.show("æ­?œ¨?Œæ­¥?²ç«¯è³‡æ?...");
        const newUser = event.detail.user;
        const newUserId = newUser ? newUser.id : 'anonymous';
        
        // ç¢ºä?è¼‰å…¥?€?°ç¾¤çµ„è??™è?é¤å»³è³‡æ?
        await loadGroupsFromSupabase();
        await loadRestaurantsFromSupabase();
        
        updateGroupSwitchButton(getCurrentGroupName(), canEditCurrentGroup());
        renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));

        if (newUserId !== lastProcessedUserId) {
            lastProcessedUserId = newUserId;
            reloadUserScopedLocalData();
        } else {
            console.log("???µæ¸¬?°é?è¤‡ç? Auth State è®Šæ›´ï¼Œå·²è·³é??æ–°è¼‰å…¥");
        }
        AppLoading.hide(300);
    });

    window.addEventListener('groupSwitched', (event) => {
        AppLoading.show("æ­?œ¨?‡æ?é¤å»³?†ç?...");
        updateGroupSwitchButton(event.detail.groupName, canEditCurrentGroup());
        renderRestaurants(getGroupFilteredRestaurants(getRestaurants()));
        AppLoading.hide(300);
    });

    // Test Supabase connection
    testSupabaseConnection();

    // ?¥æœª?»å…¥ï¼Œæ”¹?ºé¡¯ç¤ºç™»?¥æ?ç¤ºï??Œé?å¼·åˆ¶ replaceState å°è‡´è·¯ç”±è·³è?
    if (!getCurrentUser()) {
        console.log("ä½¿ç”¨?…æœª?»å…¥ï¼Œæ??™é¡¯ç¤ºç™»?¥è?çª?..");
        // ç¢ºä? handleRoute ?§éƒ¨?è¼¯ä¸æ??¨æ??¨ç?å¼å?å§‹å??‚é€ æ??é¢?è?
        handleRoute();
    }
}

// Start the application
initialize();
