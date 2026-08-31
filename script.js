/* ==================================================
   Global Loading Controller
================================================== */

const AppLoading = (() => {

    const loadingElement = document.getElementById("appLoading");
    const loadingText = document.getElementById("appLoadingText");

    let hideTimer = null;


    function show(message = "正在處理中…") {

        if (!loadingElement) {
            return;
        }

        clearTimeout(hideTimer);

        if (loadingText) {
            loadingText.textContent = message;
        }

        loadingElement.classList.add("is-visible");
        loadingElement.setAttribute("aria-hidden", "false");

        document.body.classList.add("loading-active");
    }


    function hide(delay = 0) {

        if (!loadingElement) {
            return;
        }

        clearTimeout(hideTimer);

        hideTimer = setTimeout(() => {

            loadingElement.classList.remove("is-visible");
            loadingElement.setAttribute("aria-hidden", "true");

            document.body.classList.remove("loading-active");

        }, delay);
    }


    function setMessage(message) {

        if (loadingText) {
            loadingText.textContent = message;
        }

    }


    return {
        show,
        hide,
        setMessage
    };

})();

// ==================================================
// Supabase Configuration
// ==================================================

const SUPABASE_URL =
    "https://rcyqxzerhpdneagmjwjf.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_UykY-RJm0HyKtmJkkE9CWg_CDFpwlHJ";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


// ==================================================
// Restaurant Management System
// ==================================================


// ==================================================
// Local Cache
// ==================================================

let restaurants = [];
let currentUser = null;
let authSessionInitializedFlag = false;


function getStorageNamespace() {
    return currentUser?.id || "guest";
}

function getRestaurantsStorageKey() {
    return `restaurants_${getStorageNamespace()}`;
}

function getRestaurantGroupsStorageKey() {
    return `restaurantGroups_${getStorageNamespace()}`;
}

function getCurrentGroupStorageKey() {
    return `currentGroupId_${getStorageNamespace()}`;
}

function migrateLegacyGuestStorage() {
    // 【修改說明】若非登入狀態，跳過 migration 以免觸發 QuotaExceededError (大型 Base64 搬遷)
    // 我們改用 loadRestaurantsFromLocal 中的 fallback 機制處理資料讀取
    return;

    if (currentUser !== null) return;

    const pairs = [
        { oldKey: "restaurants", newKey: getRestaurantsStorageKey() },
        { oldKey: "restaurantGroups", newKey: getRestaurantGroupsStorageKey() },
        { oldKey: "currentGroupId", newKey: getCurrentGroupStorageKey() }
    ];

    pairs.forEach(({ oldKey, newKey }) => {
        try {
            if (localStorage.getItem(newKey) !== null) {
                return;
            }
            const oldVal = localStorage.getItem(oldKey);
            if (oldVal !== null) {
                localStorage.setItem(newKey, oldVal);
            }
        } catch (e) {
            if (e?.name === "QuotaExceededError" || (e && e.code === 22)) {
                console.warn(`⚠️ Legacy migration skipped due to LocalStorage quota (${oldKey} -> ${newKey}):`, e);
            } else {
                console.error(`❌ Migration error for ${oldKey} -> ${newKey}:`, e);
            }
        }
    });
}
function cleanupLegacyStorage() {
    const legacyKey = "restaurants";
    const currentKey = getRestaurantsStorageKey();

    // 只有在新的儲存鍵已有資料且不等於 legacyKey 時，才考慮清除舊鍵
    if (currentKey !== legacyKey && localStorage.getItem(currentKey) && localStorage.getItem(legacyKey)) {
        try {
            console.log("🧹 發現 Legacy LocalStorage，執行清除：", legacyKey);
            localStorage.removeItem(legacyKey);
        } catch (e) {
            console.error("❌ 清除 Legacy LocalStorage 失敗：", e);
        }
    }
}

let authReloadSequence = 0;

async function initializeAuthSession() {
    try {
        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("❌ 取得 Auth Session 失敗：", error);
            currentUser = null;
        } else {
            currentUser = session?.user || null;
        }

        console.log("🔒 Auth Session:", currentUser);
    } catch (err) {
        console.error("❌ 初始化 Auth Session 發生例外：", err);
        currentUser = null;
    } finally {
        authSessionInitializedFlag = true;
    }
}

async function handleAuthUserChanged(user) {
    currentUser = user || null;
    console.log("🔄 Auth State Changed:", currentUser);
    updateAuthUI();
    await reloadUserScopedLocalData();
}

async function reloadUserScopedLocalData() {
    const currentSeq = ++authReloadSequence;
    try {
        console.log("🔄 正在重新載入使用者 Scoped 資料與狀態 (包含雲端)：", getStorageNamespace());
        
        restaurants = [];
        restaurantGroups = [];
        currentGroupId = null;

        cleanupLegacyStorage();
        migrateLegacyGuestStorage();

        // 核心修正：加入 Cloud Hydration
        loadGroupsFromLocal();
        await loadGroupsFromSupabase();
        ensureGroupsInitialized();
        updateGroupSwitchButton();

        // 載入餐廳
        try {
            await loadRestaurants();
        } catch (e) {
            console.warn("⚠️ 雲端餐廳載入失敗，改用本地快取", e);
            loadRestaurantsFromLocal();
        }

        if (currentSeq !== authReloadSequence) {
            console.log("⚡ 偵測到更新的 Auth Reload 請求，放棄本次過期渲染");
            return;
        }

        renderRestaurants();
        console.log("✅ 使用者 Scoped 本地與雲端資料重新載入完成");
    } catch (err) {
        console.error("❌ 重新載入使用者 Scoped 資料發生錯誤：", err);
    }
}


let isPasswordRecoveryMode = false;

async function forgotPassword(email) {
    const trimmedEmail = (email || "").trim();

    if (!trimmedEmail) {
        showToast("請輸入電子郵件", "error");
        return false;
    }

    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
        showToast("請輸入有效的電子郵件格式", "error");
        return false;
    }

    try {
        const redirectToUrl = `${window.location.origin}/`;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(trimmedEmail, {
            redirectTo: redirectToUrl
        });

        if (error) {
            console.error("❌ 寄送重設密碼信失敗：", error);
            showToast("寄送失敗，請稍後再試", "error");
            return false;
        }

        showToast("✅ 重設密碼信已寄出，請檢查您的電子郵件", "success");
        return true;
    } catch (err) {
        console.error("❌ 寄送重設密碼信發生例外：", err);
        showToast("發生錯誤，請稍後再試", "error");
        return false;
    }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    const user = session?.user || null;
    console.log("🔄 Auth State Changed Event:", event, user);

    if (event === "PASSWORD_RECOVERY") {
        isPasswordRecoveryMode = true;
        console.log("🔑 PASSWORD_RECOVERY event received. Entering recovery mode.");
        history.replaceState({}, "", "/reset-password");
        handleRoute();
    }

    if (event === "INITIAL_SESSION") {
        return;
    }

    void handleAuthUserChanged(user);
});




async function login(email, password) {
    const trimmedEmail = (email || "").trim();
    const trimmedPassword = password || "";

    if (!trimmedEmail) {
        showToast("請輸入電子郵件", "error");
        return;
    }

    if (!trimmedPassword) {
        showToast("請輸入密碼", "error");
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword
        });

        if (error) {
            console.error("登入失敗：", error);
            showToast("電子郵件或密碼錯誤", "error");
            return;
        }

        if (data?.user) {
            currentUser = data.user;
            showToast("✅ 登入成功", "success");

            // 確保資料載入完成再切換
            await handleAuthUserChanged(data.user);

            history.pushState({}, "", "/");
            handleRoute();
        }
    } catch (err) {
        console.error("登入發生例外：", err);
        showToast("登入發生錯誤，請稍後再試", "error");
    }
}

async function signup(email, password) {
    const trimmedEmail = (email || "").trim();
    const trimmedPassword = password || "";

    if (!trimmedEmail) {
        showToast("請輸入電子郵件", "error");
        return;
    }

    if (!trimmedPassword) {
        showToast("請輸入密碼", "error");
        return;
    }

    if (trimmedPassword.length < 6) {
        showToast("密碼長度至少需要 6 個字元", "error");
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: trimmedEmail,
            password: trimmedPassword
        });

        if (error) {
            console.error("註冊失敗：", error);
            const msg = error.message || "";
            if (msg.includes("already registered")) {
                showToast("此電子郵件已被註冊", "error");
            } else if (msg.includes("valid email")) {
                showToast("電子郵件格式不正確", "error");
            } else {
                showToast("註冊失敗，請稍後再試", "error");
            }
            return false;
        }

        if (data?.user) {
            if (data.session) {
                showToast("✅ 註冊成功並已自動登入", "success");
            } else {
                showToast("✅ 註冊成功，請檢查您的電子郵件以進行驗證", "success");
            }

            history.pushState({}, "", "/");
            handleRoute();
            return true;
        }
    } catch (err) {
        console.error("註冊發生例外：", err);
        showToast("註冊發生錯誤，請稍後再試", "error");
    }
    return false;
}

async function logout() {
    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            console.error("❌ 登出失敗：", error);
            showToast("登出失敗，請稍後再試", "error");
            return false;
        }

        console.log("✅ 登出成功");
        showToast("已成功登出", "success");
        return true;
    } catch (err) {
        console.error("❌ 登出發生例外：", err);
        showToast("登出發生錯誤，請稍後再試", "error");
        return false;
    }
}

// 統一關閉選單並處理焦點的輔助函式
function closeAuthAccountMenu() {
    const authAccountMenu = document.getElementById("authAccountMenu");
    const authOpenButton = document.getElementById("authOpenButton");

    if (authAccountMenu && !authAccountMenu.hidden) {
        // 在隱藏前將焦點移回開啟按鈕，避免 aria-hidden 警告
        if (authOpenButton) {
            authOpenButton.focus();
            authOpenButton.setAttribute("aria-expanded", "false");
        }
        authAccountMenu.hidden = true;
        authAccountMenu.setAttribute("aria-hidden", "true");
    }
}

function updateAuthUI() {
    const authButtonLabel = document.getElementById("authButtonLabel");
    const authAccountTitle = document.getElementById("authAccountTitle");
    const authOpenButton = document.getElementById("authOpenButton");

    if (currentUser) {
        let nickname = "使用者";
        const metaNickname = currentUser.user_metadata?.nickname;
        if (metaNickname && typeof metaNickname === "string" && metaNickname.trim() !== "") {
            nickname = metaNickname.trim().slice(0, 3);
        }

        if (authButtonLabel) authButtonLabel.textContent = nickname;
        if (authAccountTitle) authAccountTitle.textContent = `👤 ${nickname}`;
        if (authOpenButton) {
            authOpenButton.title = `已登入 (${nickname}) - 點擊管理帳號`;
        }
    } else {
        if (authButtonLabel) authButtonLabel.textContent = "登入";
        if (authAccountTitle) authAccountTitle.textContent = "👤 使用者";
        if (authOpenButton) {
            authOpenButton.title = "使用者登入";
        }
        if (authAccountMenu) {
            closeAuthAccountMenu();
        }
    }
}

function handleRoute() {
    const path = window.location.pathname;
    const loginView = document.getElementById("loginView");
    const registerView = document.getElementById("registerView");
    const forgotView = document.getElementById("forgotView");
    const recoveryView = document.getElementById("recoveryView");
    const authModalTitle = document.getElementById("authModalTitle");
    const authRouteContainer = document.getElementById("authRouteContainer");

    if (!authRouteContainer) return;

    // 隱藏所有 auth view
    if (loginView) loginView.hidden = true;
    if (registerView) registerView.hidden = true;
    if (forgotView) forgotView.hidden = true;
    if (recoveryView) recoveryView.hidden = true;

    if (path === "/login") {
        if (loginView) loginView.hidden = false;
        if (authModalTitle) authModalTitle.textContent = "登入黑白呷";
        authRouteContainer.hidden = false;
        document.body.style.overflow = "hidden";
    } else if (path === "/register") {
        if (registerView) registerView.hidden = false;
        if (authModalTitle) authModalTitle.textContent = "註冊黑白呷帳號";
        authRouteContainer.hidden = false;
        document.body.style.overflow = "hidden";
    } else if (path === "/forgot-password") {
        if (forgotView) forgotView.hidden = false;
        if (authModalTitle) authModalTitle.textContent = "重設密碼";
        authRouteContainer.hidden = false;
        document.body.style.overflow = "hidden";
    } else if (path === "/reset-password") {
        if (recoveryView) recoveryView.hidden = false;
        if (authModalTitle) authModalTitle.textContent = "設定新密碼";
        authRouteContainer.hidden = false;
        document.body.style.overflow = "hidden";
    } else {
        // 主 App "/"
        if (authRouteContainer && authRouteContainer.contains(document.activeElement)) {
            // 先強制將焦點從容器內容移出
            document.activeElement?.blur();
            
            const authOpenButton = document.getElementById("authOpenButton");
            if (authOpenButton) {
                authOpenButton.focus();
            }
        }
        authRouteContainer.hidden = true;
        document.body.style.overflow = "";
    }
}

window.addEventListener("popstate", () => {
    handleRoute();
});

window.addEventListener("hashchange", () => {
    handleRoute();
});

// 初始化時執行一次
handleRoute();
function initializeAuthSystem() {
    const authOpenButton = document.getElementById("authOpenButton");
    const authRouteContainer = document.getElementById("authRouteContainer");
    const closeAuthModal = document.getElementById("closeAuthModal");
    const loginForm = document.getElementById("loginForm");
    const loginEmail = document.getElementById("loginEmail");
    const loginPassword = document.getElementById("loginPassword");

    if (authOpenButton) {
        authOpenButton.addEventListener("click", (e) => {
            e.stopPropagation();
            if (currentUser) {
                const authAccountMenu = document.getElementById("authAccountMenu");
                if (authAccountMenu) {
                    const isHidden = authAccountMenu.hidden;
                    authAccountMenu.hidden = !isHidden;
                    authAccountMenu.setAttribute("aria-hidden", isHidden ? "false" : "true");
                    authOpenButton.setAttribute("aria-expanded", isHidden ? "true" : "false");
                }
            } else {
                history.pushState({}, "", "/login");
                handleRoute();
            }
        });
    }
    const authProfileButton = document.getElementById("authProfileButton");
    const profileModal = document.getElementById("profileModal");
    const closeProfileModal = document.getElementById("closeProfileModal");
    const cancelProfileButton = document.getElementById("cancelProfileButton");
    const profileForm = document.getElementById("profileForm");
    const profileEmail = document.getElementById("profileEmail");
    const profileNickname = document.getElementById("profileNickname");
    const submitProfileButton = document.getElementById("submitProfileButton");

    const closeProfileModalHandler = () => {
        if (profileModal) {
            profileModal.classList.remove("show");
        }
        if (profileForm) {
            profileForm.reset();
        }
    };

    if (authProfileButton) {
        authProfileButton.addEventListener("click", (e) => {
            e.stopPropagation();
            closeAuthAccountMenu();

            if (currentUser) {
                if (profileEmail) profileEmail.value = currentUser.email || "";
                const currentMetaNickname = currentUser.user_metadata?.nickname || "";
                if (profileNickname) profileNickname.value = currentMetaNickname;
            }

            if (profileModal) {
                profileModal.classList.add("show");
                if (profileNickname) profileNickname.focus();
            }
        });
    }

    if (closeProfileModal) {
        closeProfileModal.addEventListener("click", closeProfileModalHandler);
    }
    if (cancelProfileButton) {
        cancelProfileButton.addEventListener("click", closeProfileModalHandler);
    }
    if (profileModal) {
        profileModal.addEventListener("click", (e) => {
            if (e.target === profileModal) {
                closeProfileModalHandler();
            }
        });
    }

    if (profileForm) {
        profileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const rawNickname = profileNickname?.value || "";
            const trimmedNickname = rawNickname.trim();

            if (!trimmedNickname) {
                showToast("暱稱不能為空白", "error");
                if (profileNickname) profileNickname.focus();
                return;
            }

            if (trimmedNickname.length > 3) {
                showToast("暱稱限制 1～3 個字", "error");
                if (profileNickname) profileNickname.focus();
                return;
            }

            if (submitProfileButton) {
                submitProfileButton.disabled = true;
            }

            try {
                const { data, error } = await supabaseClient.auth.updateUser({
                    data: { nickname: trimmedNickname }
                });

                if (error) {
                    console.error("❌ 更新個人資料失敗：", error);
                    showToast(error.message || "更新個人資料失敗，請稍後再試", "error");
                    return;
                }

                if (data && data.user) {
                    currentUser = data.user;
                }

                updateAuthUI();
                showToast("✅ 個人資料更新成功", "success");
                closeProfileModalHandler();
            } catch (err) {
                console.error("❌ 更新個人資料發生例外：", err);
                showToast("發生錯誤，請稍後再試", "error");
            } finally {
                if (submitProfileButton) {
                    submitProfileButton.disabled = false;
                }
            }
        });
    }




    const authLogoutButton = document.getElementById("authLogoutButton");
    if (authLogoutButton) {
        authLogoutButton.addEventListener("click", async () => {
            closeAuthAccountMenu();
            await logout();
        });
    }

    document.addEventListener("click", (e) => {
        const authAccountMenu = document.getElementById("authAccountMenu");
        const authOpenButton = document.getElementById("authOpenButton");
        if (authAccountMenu && !authAccountMenu.hidden) {
            if (!authAccountMenu.contains(e.target) && !authOpenButton.contains(e.target)) {
                closeAuthAccountMenu();
            }
        }
    });

    updateAuthUI();

    if (closeAuthModal) {
        closeAuthModal.addEventListener("click", () => {
            const authOpenButton = document.getElementById("authOpenButton");
            if (authOpenButton) {
                authOpenButton.focus();
            }
            history.pushState({}, "", "/");
            handleRoute();
        });
    }
    const registerForm = document.getElementById("registerForm");
    const registerEmail = document.getElementById("registerEmail");
    const registerPassword = document.getElementById("registerPassword");
    const registerConfirmPassword = document.getElementById("registerConfirmPassword");
    const registerSubmitButton = document.getElementById("registerSubmitButton");
    const loginView = document.getElementById("loginView");
    const registerView = document.getElementById("registerView");
    const switchToRegisterButton = document.getElementById("switchToRegisterButton");
    const switchToLoginButton = document.getElementById("switchToLoginButton");
    const authModalTitle = document.getElementById("authModalTitle");
    const forgotForm = document.getElementById("forgotForm");


    if (switchToRegisterButton && loginView && registerView && authModalTitle) {
        switchToRegisterButton.addEventListener("click", () => {
            loginView.hidden = true;
            registerView.hidden = false;
            authModalTitle.textContent = "註冊黑白呷帳號";
        });
    }

    if (switchToLoginButton && loginView && registerView && authModalTitle) {
        switchToLoginButton.addEventListener("click", () => {
            registerView.hidden = true;
            loginView.hidden = false;
            authModalTitle.textContent = "登入黑白呷";
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async e => {
            e.preventDefault();
            const email = registerEmail?.value || "";
            const password = registerPassword?.value || "";
            const confirmPassword = registerConfirmPassword?.value || "";

            if (!email || !password || !confirmPassword) {
                showToast("請填寫所有欄位", "error");
                return;
            }

            if (password !== confirmPassword) {
                showToast("兩次輸入的密碼不一致", "error");
                return;
            }

            if (registerSubmitButton) {
                registerSubmitButton.disabled = true;
            }

            try {
                await signup(email, password);
            } finally {
                if (registerSubmitButton) {
                    registerSubmitButton.disabled = false;
                }
            }
        });
    }


    if (loginForm) {
        loginForm.addEventListener("submit", async e => {
            e.preventDefault();
            const email = loginEmail?.value || "";
            const password = loginPassword?.value || "";
            await login(email, password);
        });
    }

    const forgotEmail = document.getElementById("forgotEmail");
    const forgotSubmitButton = document.getElementById("forgotSubmitButton");
    const forgotView = document.getElementById("forgotView");
    const switchToForgotButton = document.getElementById("switchToForgotButton");
    const backToLoginButton = document.getElementById("backToLoginButton");

    if (switchToForgotButton && loginView && forgotView && authModalTitle) {
        switchToForgotButton.addEventListener("click", () => {
            loginView.hidden = true;
            forgotView.hidden = false;
            authModalTitle.textContent = "重設密碼";
        });
    }

    if (backToLoginButton && loginView && forgotView && authModalTitle) {
        backToLoginButton.addEventListener("click", () => {
            forgotView.hidden = true;
            loginView.hidden = false;
            authModalTitle.textContent = "登入黑白呷";
        });
    }

    if (forgotForm) {
        forgotForm.addEventListener("submit", async e => {
            e.preventDefault();
            const email = forgotEmail?.value || "";

            if (!email) {
                showToast("請輸入電子郵件", "error");
                return;
            }

            if (forgotSubmitButton) {
                forgotSubmitButton.disabled = true;
            }

            try {
                const success = await forgotPassword(email);
                if (success && forgotEmail) {
                    forgotEmail.value = "";
                }
            } finally {
                if (forgotSubmitButton) {
                    forgotSubmitButton.disabled = false;
                }
            }
        });
    }

    const recoveryForm = document.getElementById("recoveryForm");
    const recoveryNewPassword = document.getElementById("recoveryNewPassword");
    const recoveryConfirmPassword = document.getElementById("recoveryConfirmPassword");
    const recoverySubmitButton = document.getElementById("recoverySubmitButton");

    if (recoveryForm) {
        recoveryForm.addEventListener("submit", async e => {
            e.preventDefault();
            const newPassword = recoveryNewPassword?.value || "";
            const confirmPassword = recoveryConfirmPassword?.value || "";

            if (!newPassword || !confirmPassword) {
                showToast("請填寫所有欄位", "error");
                return;
            }

            if (newPassword.length < 6) {
                showToast("密碼長度至少需要 6 個字元", "error");
                return;
            }

            if (newPassword !== confirmPassword) {
                showToast("兩次輸入的密碼不一致", "error");
                return;
            }

            if (recoverySubmitButton) {
                recoverySubmitButton.disabled = true;
            }

            try {
                const { error } = await supabaseClient.auth.updateUser({
                    password: newPassword
                });

                if (error) {
                    console.error("❌ 更新密碼失敗：", error);
                    showToast(error.message || "更新密碼失敗，請稍後再試", "error");
                    return;
                }

                showToast("✅ 密碼更新成功", "success");
                isPasswordRecoveryMode = false;

                if (recoveryNewPassword) recoveryNewPassword.value = "";
                if (recoveryConfirmPassword) recoveryConfirmPassword.value = "";

                history.pushState({}, "", "/");
                handleRoute();
            } catch (err) {
                console.error("❌ 更新密碼發生例外：", err);
                showToast("發生錯誤，請稍後再試", "error");
            } finally {
                if (recoverySubmitButton) {
                    recoverySubmitButton.disabled = false;
                }
            }
        });
    }
}






let randomPickerResultId = null;
// ==================================================
// 地區 / 餐廳群組 (Group = 資料隔離層，不是分類)
// ==================================================

let restaurantGroups = [];
let currentGroupId = null;

const UNCATEGORIZED_GROUP_NAME = "未分類";
const GROUPS_STORAGE_KEY = "restaurantGroups";
const CURRENT_GROUP_STORAGE_KEY = "currentGroupId";


// ==================================================
// Supabase Status
// ==================================================

let supabaseConnected = false;

const favoriteSyncVersions = new Map();

const displaySettings = loadDisplaySettings();

const themePreference =
    localStorage.getItem("theme") || "system";

function isDarkTheme(theme = themePreference) {
    return theme === "dark" || (
        theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = isDarkTheme(theme)
        ? "dark"
        : "light";

    const themeColor =
        document.querySelector('meta[name="theme-color"]');

    themeColor?.setAttribute(
        "content",
        isDarkTheme(theme) ? "#171716" : "#f7f7f5"
    );
}

function initializeTheme() {
    applyTheme(themePreference);

    window.matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
            if (localStorage.getItem("theme") === "system") {
                applyTheme("system");
            }
        });
}

function loadDisplaySettings() {
    try {
        const saved = JSON.parse(localStorage.getItem("displaySettings"));

        // ==================================================
        // customOrder 需要支援「每個群組獨立排序」
        // 格式：{ [groupId]: ["restaurantId", ...] }
        //
        // 舊版格式是單一陣列（尚未有群組概念），
        // 先暫存在 "__legacy__"，等群組初始化完成後
        // 由 ensureGroupsInitialized() 搬移到正確的群組。
        // ==================================================

        let customOrder = {};

        if (Array.isArray(saved?.customOrder)) {
            customOrder = { __legacy__: saved.customOrder.map(String) };
        }
        else if (saved?.customOrder && typeof saved.customOrder === "object") {
            Object.entries(saved.customOrder).forEach(([groupId, ids]) => {
                if (Array.isArray(ids)) {
                    customOrder[groupId] = ids.map(String);
                }
            });
        }

        return {
            fontSize: ["extra-small", "small", "medium", "large", "extra-large"].includes(saved?.fontSize)
                ? saved.fontSize
                : "medium",
            viewMode: saved?.viewMode === "list" ? "list" : "card",
            customOrder
        };
    }
    catch {
        return { fontSize: "medium", viewMode: "card", customOrder: {} };
    }
}

function saveDisplaySettings() {
    localStorage.setItem("displaySettings", JSON.stringify(displaySettings));
}

function showToast(message, type = "info") {
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

function getOrderedRestaurants(source = restaurants) {
    const orderForGroup = displaySettings.customOrder[currentGroupId] || [];
    const available = new Map(source.map(restaurant => [String(restaurant.id), restaurant]));
    const ordered = orderForGroup
        .map(id => available.get(String(id)))
        .filter(Boolean);
    const orderedIds = new Set(ordered.map(restaurant => String(restaurant.id)));

    return ordered.concat(
        source.filter(restaurant => !orderedIds.has(String(restaurant.id)))
    );
}

function applyDisplaySettings() {
    document.body.classList.remove(
        "font-extra-small",
        "font-small",
        "font-medium",
        "font-large",
        "font-extra-large"
    );
    document.body.classList.add(`font-${displaySettings.fontSize}`);
    restaurantList.classList.toggle("list-view", displaySettings.viewMode === "list");
}


// ==================================================
// DOM
// ==================================================

const restaurantList =
    document.getElementById(
        "restaurantList"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const clearSearchButton =
    document.getElementById(
        "clearSearchButton"
    );

const categories =
    document.querySelectorAll(
        ".category"
    );

const addRestaurantButton =
    document.getElementById(
        "addRestaurantButton"
    );

const restaurantModal =
    document.getElementById(
        "restaurantModal"
    );

const closeModal =
    document.getElementById(
        "closeModal"
    );

const restaurantForm =
    document.getElementById(
        "restaurantForm"
    );

const displaySettingsButton =
    document.getElementById("displaySettingsButton");

const displaySettingsModal =
    document.getElementById("displaySettingsModal");

const announcementsButton = document.getElementById("announcementsButton");
const announcementsBadge = document.getElementById("announcementsBadge");
const announcementsModal = document.getElementById("announcementsModal");
const closeAnnouncementsButton = document.getElementById("closeAnnouncements");
const announcementsContent = document.getElementById("announcementsContent");

const LAST_VIEWED_ANNOUNCEMENTS_KEY = "lastViewedAnnouncements";
const ANNOUNCEMENTS_CACHE_KEY = "announcementsCache";

const orderSettingsModal =
    document.getElementById("orderSettingsModal");
const restaurantImageInput =
    document.getElementById(
        "restaurantImage"
    );
const restaurantImagePreview =
    document.getElementById(
        "restaurantImagePreview"
    );

const weekDays = [
    { key: "monday", label: "一" },
    { key: "tuesday", label: "二" },
    { key: "wednesday", label: "三" },
    { key: "thursday", label: "四" },
    { key: "friday", label: "五" },
    { key: "saturday", label: "六" },
    { key: "sunday", label: "日" }
];

function createEmptyWeeklyHours() {
    return Object.fromEntries(
        weekDays.map(day => [
            day.key,
            { open: false, start: "", end: "" }
        ])
    );
}

function normalizeWeeklyHours(value) {
    let parsed = value;

    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        }
        catch {
            parsed = null;
        }
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const weeklyHours = createEmptyWeeklyHours();

        weekDays.forEach(day => {
            const entry = parsed[day.key];

            if (entry && typeof entry === "object") {
                weeklyHours[day.key] = {
                    open: entry.open === true,
                    start: entry.start || "",
                    end: entry.end || ""
                };
            }
        });

        return weeklyHours;
    }

    const legacyMatch = String(value || "").match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);

    if (legacyMatch) {
        return Object.fromEntries(
            weekDays.map(day => [
                day.key,
                { open: true, start: legacyMatch[1], end: legacyMatch[2] }
            ])
        );
    }

    return createEmptyWeeklyHours();
}

function formatHoursRange(hours) {
    return hours.open && hours.start && hours.end
        ? `${hours.start}–${hours.end}`
        : "公休";
}

function getTodayHours(restaurant) {
    const dayKey = weekDays[(new Date().getDay() + 6) % 7].key;
    return normalizeWeeklyHours(restaurant.hours)[dayKey];
}

function getHoursSummary(restaurant) {
    const todayHours = getTodayHours(restaurant);

    return todayHours.open && todayHours.start && todayHours.end
        ? `🟢 今日營業 ${todayHours.start}–${todayHours.end}`
        : "🔴 今日公休";
}

function getWeeklyHoursText(restaurant) {
    const weeklyHours = normalizeWeeklyHours(restaurant.hours);

    return weekDays.map(day =>
        `星期${day.label}　${formatHoursRange(weeklyHours[day.key])}`
    ).join("\n");
}


// ==================================================
// 地區 / 餐廳群組管理
// 群組 = 資料隔離層（不是分類、不是標籤）
// ==================================================

function generateUuid() {
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

function saveGroupsLocal() {
    localStorage.setItem(getRestaurantGroupsStorageKey(), JSON.stringify(restaurantGroups));
    localStorage.setItem(getCurrentGroupStorageKey(), currentGroupId || "");
}

function loadGroupsFromLocal() {
    try {
        const saved = JSON.parse(localStorage.getItem(getRestaurantGroupsStorageKey()) || "[]");

        restaurantGroups = Array.isArray(saved)
            ? saved
                .filter(group => group && group.id && group.name)
                .map(group => ({
                    id: String(group.id),
                    name: String(group.name),
                    created_at: group.created_at || null
                }))
            : [];
    }
    catch {
        restaurantGroups = [];
    }

    currentGroupId = localStorage.getItem(getCurrentGroupStorageKey()) || null;
}

function getUncategorizedGroupId() {
    let group = restaurantGroups.find(
        candidate => candidate.name === UNCATEGORIZED_GROUP_NAME
    );

    if (!group) {
        // 如果群組陣列中真的沒有「未分類」，回傳第一個群組 ID 或 null，絕不在查詢時自動 generate 寫入 Supabase
        return restaurantGroups[0]?.id || null;
    }

    return group.id;
}

function ensureGroupsInitialized() {
    if (restaurantGroups.length === 0 || !restaurantGroups.some(g => g.name === UNCATEGORIZED_GROUP_NAME)) {
        if (!restaurantGroups.some(g => g.name === UNCATEGORIZED_GROUP_NAME)) {
            restaurantGroups.unshift({
                id: "uncategorized-default",
                name: UNCATEGORIZED_GROUP_NAME,
                created_at: null
            });
            saveGroupsLocal();
        }
    }

    const validIds = new Set(restaurantGroups.map(group => group.id));

    if (!currentGroupId || !validIds.has(currentGroupId)) {
        currentGroupId = restaurantGroups[0].id;
    }

    // ==================================================
    // 舊版 customOrder（單一群組排序）搬移到「未分類」
    // ==================================================

    if (displaySettings.customOrder.__legacy__) {
        const legacyOrder = displaySettings.customOrder.__legacy__;
        delete displaySettings.customOrder.__legacy__;

        const targetGroupId = getUncategorizedGroupId();

        displaySettings.customOrder[targetGroupId] =
            (displaySettings.customOrder[targetGroupId] || []).concat(legacyOrder);

        saveDisplaySettings();
    }

    saveGroupsLocal();
}

function assignMissingGroupIds() {
    let changed = false;

    restaurants.forEach(restaurant => {
        if (!restaurant.groupId) {
            restaurant.groupId = getUncategorizedGroupId();
            changed = true;
        }
    });

    if (changed) {
        saveRestaurantsLocal();
    }
}

function getGroupFilteredRestaurants(source = restaurants) {
    if (!currentGroupId) {
        return source;
    }

    const validGroupIds = new Set(restaurantGroups.map(group => String(group.id)));
    const uncatId = getUncategorizedGroupId();

    return source.filter(restaurant => {
        let rGroupId = restaurant.groupId ? String(restaurant.groupId) : null;

        // 如果餐廳的 groupId 不在目前有效的群組 ID 集合中（例如 orphan ID 或 null），
        // 僅在前端顯示層安全視為「未分類」群組，絕不自動修改 Supabase
        if (!rGroupId || !validGroupIds.has(rGroupId)) {
            rGroupId = uncatId;
        }

        return rGroupId === currentGroupId;
    });
}

function getCurrentGroupName() {
    const group = restaurantGroups.find(candidate => candidate.id === currentGroupId);
    return group?.name || UNCATEGORIZED_GROUP_NAME;
}

function getCurrentGroup() {
    return restaurantGroups.find(candidate => candidate.id === currentGroupId);
}

function canEditCurrentGroup() {
    const group = getCurrentGroup();
    // 如果是「未分類」或找不到群組，視為使用者自己的，允許修改
    if (!group || group.id === "uncategorized-default" || group.name === UNCATEGORIZED_GROUP_NAME) {
        return true;
    }
    // 檢查是否擁有該群組 (user_id 匹配)
    return currentUser && group.user_id === currentUser.id;
}

function updateGroupSwitchButton() {
    const label = document.getElementById("groupSwitchLabel");
    const addRestaurantButton = document.getElementById("addRestaurantButton");
    const editOrderButton = document.getElementById("editOrderButton");
    
    if (label) {
        let name = getCurrentGroupName();
        const isReadonly = !canEditCurrentGroup();
        if (isReadonly) {
            name += " 👁️ 唯讀";
        }
        label.textContent = name;
    }

    if (addRestaurantButton) {
        addRestaurantButton.hidden = !canEditCurrentGroup();
    }

    if (editOrderButton) {
        editOrderButton.hidden = !canEditCurrentGroup();
    }
}


// --------------------------------------------------
// Supabase：restaurant_groups
// 若資料表 / 欄位尚未建立，會安靜地退回本機資料，
// 不影響其餘既有功能。
// --------------------------------------------------

function isMissingGroupTableOrColumnError(error) {
    if (!error) {
        return false;
    }

    const message = (error.message || "").toLowerCase();
    const code = error.code || "";

    return (
        code === "42703" || // column does not exist
        code === "42P01" || // relation does not exist
        message.includes("group_id") ||
        message.includes("restaurant_groups")
    );
}

async function loadGroupsFromSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from("restaurant_groups")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) {
            if (!isMissingGroupTableOrColumnError(error)) {
                console.error("❌ 群組讀取失敗：", error);
            }
            else {
                console.warn("⚠️ Supabase 尚未建立 restaurant_groups 資料表，改用本機群組資料。");
            }

            return false;
        }

        if (Array.isArray(data) && data.length > 0) {
            let fetchedGroups = data.map(row => ({
                id: String(row.id),
                name: row.name || UNCATEGORIZED_GROUP_NAME,
                visibility: row.visibility || "private",
                user_id: row.user_id || null,
                created_at: row.created_at || null
            }));

            // 未登入時只保留 public 群組，或若本機已有自己建立的群組也保留
            if (!currentUser) {
                fetchedGroups = fetchedGroups.filter(g => g.visibility === "public" || g.name === UNCATEGORIZED_GROUP_NAME);
            }

            restaurantGroups = fetchedGroups;

            // 確保從 Supabase 載入時，若雲端沒有「未分類」，在前端記憶體與本地補上一個預設未分類（不強行寫入雲端破壞 schema）
            if (!restaurantGroups.some(g => g.name === UNCATEGORIZED_GROUP_NAME)) {
                restaurantGroups.unshift({
                    id: "uncategorized-default",
                    name: UNCATEGORIZED_GROUP_NAME,
                    visibility: "private",
                    user_id: currentUser?.id || null,
                    created_at: null
                });
            }

            saveGroupsLocal();
        }
        else {
            // 若雲端 restaurant_groups 為空，確保至少有一個未分類
            if (!restaurantGroups.some(g => g.name === UNCATEGORIZED_GROUP_NAME)) {
                restaurantGroups = [{
                    id: "uncategorized-default",
                    name: UNCATEGORIZED_GROUP_NAME,
                    visibility: "private",
                    user_id: currentUser?.id || null,
                    created_at: null
                }];
                saveGroupsLocal();
            }
        }

        return true;
    }
    catch (error) {
        console.error("❌ 群組連線失敗：", error);
        return false;
    }
}

async function createGroupInSupabase(group) {
    const payload = {
        id: group.id,
        name: group.name,
        visibility: group.visibility || "private",
        user_id: currentUser?.id || null,
        created_at: group.created_at || new Date().toISOString()
    };

    console.log("🚀 [createGroupInSupabase] 實際送出的 insert payload：", payload);

    try {
        const response = await supabaseClient
            .from("restaurant_groups")
            .insert(payload)
            .select()
            .single();

        console.log("📥 [createGroupInSupabase] Supabase 回傳完整 response：", response);
        console.log("📊 [createGroupInSupabase] HTTP status / response.status：", response.status);

        const { data, error } = response;

        if (error) {
            console.error("❌ [createGroupInSupabase] 完整 error 物件：", error);
            console.error("❌ [createGroupInSupabase] error.code：", error.code);
            console.error("❌ [createGroupInSupabase] error.message：", error.message);
            console.error("❌ [createGroupInSupabase] error.details：", error.details);
            console.error("❌ [createGroupInSupabase] error.hint：", error.hint);

            if (!isMissingGroupTableOrColumnError(error)) {
                console.error("❌ 群組新增至 Supabase 失敗：", error);
            }

            return null;
        }

        console.log("✅ [createGroupInSupabase] Supabase Insert 成功，回傳 data：", data);

        if (data && data.id) {
            return String(data.id);
        }

        return group.id;
    }
    catch (error) {
        console.error("❌ [createGroupInSupabase] 發生未預期例外錯誤 (Catch)：", error);
        return null;
    }
}

async function updateGroupInSupabase(id, name, visibility) {
    const group = restaurantGroups.find(candidate => String(candidate.id) === String(id));
    if (group && group.name === UNCATEGORIZED_GROUP_NAME) {
        console.warn("⚠️ 系統保留群組「未分類」不可修改。");
        return false;
    }

    try {
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (visibility !== undefined) updateData.visibility = visibility;

        const { error } = await supabaseClient
            .from("restaurant_groups")
            .update(updateData)
            .eq("id", id);

        if (error) {
            if (!isMissingGroupTableOrColumnError(error)) {
                console.error("❌ 群組更新至 Supabase 失敗：", error);
            }

            return false;
        }

        return true;
    }
    catch (error) {
        console.error("❌ 群組更新錯誤：", error);
        return false;
    }
}

async function renameGroupInSupabase(id, name) {
    return await updateGroupInSupabase(id, name, undefined);
}


// ==================================================
// Announcement System (Global Scope)
// ==================================================

let announcements = [];
let lastViewedAnnouncements = localStorage.getItem(LAST_VIEWED_ANNOUNCEMENTS_KEY) || new Date(0).toISOString();

async function loadAnnouncements() {
    const cachedAnnouncements = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_CACHE_KEY));
    if (cachedAnnouncements && cachedAnnouncements.length > 0) {
        announcements = cachedAnnouncements;
        renderAnnouncements(announcements);
        updateAnnouncementsBadge();
    }

    try {
        const { data, error } = await supabaseClient
            .from("announcements")
            .select("*")
            .eq("is_published", true)
            .order("is_pinned", { ascending: false })
            .order("published_at", { ascending: false });

        if (error) {
            console.error("Error fetching announcements:", error);
            return;
        }

        if (data && data.length > 0) {
            announcements = data;
            localStorage.setItem(ANNOUNCEMENTS_CACHE_KEY, JSON.stringify(announcements));
            renderAnnouncements(announcements);
            updateAnnouncementsBadge();
        } else if (!cachedAnnouncements) {
            announcementsContent.innerHTML = "<p class='loading-message'>目前沒有任何公告。</p>";
        }
    } catch (error) {
        console.error("Supabase connection error:", error);
    }
}

function renderAnnouncements(announcementsToRender) {
    if (!announcementsToRender || announcementsToRender.length === 0) {
        announcementsContent.innerHTML = "<p class='loading-message'>目前沒有任何公告。</p>";
        return;
    }

    announcementsContent.innerHTML = announcementsToRender.map(function(announcement) {
        const isUnread = new Date(announcement.published_at) > new Date(lastViewedAnnouncements);
        const tagMap = { 'info': '資訊', 'update': '更新', 'event': '活動', 'maintenance': '維護', 'important': '重要' };
        const tagText = tagMap[announcement.type] || '其他';
        const publishedDate = new Date(announcement.published_at).toLocaleDateString('zh-TW');

        return '<div class="announcement-card ' + (isUnread ? 'unread' : '') + '">' +
               '<h3>' + escapeHtml(announcement.title) + '</h3>' +
               '<p>' + escapeHtml(announcement.content).replace(/\n/g, '<br>') + '</p>' +
               '<div class="meta">' +
               '<span class="tag">' + escapeHtml(tagText) + '</span>' +
               '<span>' + escapeHtml(publishedDate) + '</span>' +
               '</div>' +
               '</div>';
    }).join("");
}

function updateAnnouncementsBadge() {
    const hasUnread = announcements.some(a => new Date(a.published_at) > new Date(lastViewedAnnouncements));
    announcementsBadge.classList.toggle("hidden", !hasUnread);
}

function injectMockAnnouncements() {
    announcements = [{
        id: 'mock-1',
        title: '測試公告',
        content: '這是一則測試公告，用來確認功能是否正常運作。',
        type: 'important',
        published_at: new Date().toISOString()
    }];
    renderAnnouncements(announcements);
    updateAnnouncementsBadge();
}

window.initializeAnnouncements = function() {
    if (!announcementsButton) return;
    
    announcementsButton.addEventListener("click", () => {
        announcementsModal.classList.add("show");
        lastViewedAnnouncements = new Date().toISOString();
        localStorage.setItem(LAST_VIEWED_ANNOUNCEMENTS_KEY, lastViewedAnnouncements);
        updateAnnouncementsBadge();
    });

    closeAnnouncementsButton.addEventListener("click", () => announcementsModal.classList.remove("show"));
    announcementsModal.addEventListener("click", e => { if (e.target === announcementsModal) announcementsModal.classList.remove("show"); });

    injectMockAnnouncements();
    loadAnnouncements();
};


// ==================================================
// Initialize
// ==================================================

initialize();


async function initialize() {

    console.log("🚀 餐廳管理系統啟動");

    // ==================================================
    // 初始化 Supabase Auth Session
    // ==================================================

    await initializeAuthSession();

    // ==================================================
    // 執行舊版 Guest Storage 遷移（若新 Namespace 尚無資料）
    // ==================================================

    migrateLegacyGuestStorage();

    // ==================================================
    // 先載入群組（地區隔離層）
    // ==================================================

    loadGroupsFromLocal();

    try {
        await loadGroupsFromSupabase();
    }
    catch (error) {
        console.error("❌ 群組載入錯誤：", error);
    }

    ensureGroupsInitialized();
    updateGroupSwitchButton();

    // 初始化公告系統
    try {
        if (typeof window.initializeAnnouncements === "function") {
            window.initializeAnnouncements();
        } else {
            console.error("❌ initializeAnnouncements 尚未註冊到 window");
        }
    } catch (err) {
        console.error("❌ 公告系統初始化錯誤：", err);
    }

    // 從 Supabase 載入餐廳
    showSkeletonLoading();
    try {
        await loadRestaurants();
    }
    catch (error) {
        console.error("❌ 餐廳資料載入失敗：", error);
        loadRestaurantsFromLocal();
    }
    finally {
        finishAppStartup();
    }

        // 取得 key
        const storageKey = getRestaurantsStorageKey();
        let rawData = localStorage.getItem(storageKey);

        // 【Guest Fallback 機制】
        // 若為 Guest 且沒有資料，嘗試讀取原始 restaurants key
        if (storageKey === "restaurants_guest" && (rawData === null || rawData === "[]")) {
            const oldData = localStorage.getItem("restaurants");
            if (oldData) {
                rawData = oldData;
            }
        }

        const savedRestaurants = JSON.parse(rawData || "[]");

}

function loadRestaurantsFromLocal() {
    try {
        const savedRestaurants = JSON.parse(
            localStorage.getItem(getRestaurantsStorageKey()) || "[]"
        );

        restaurants = Array.isArray(savedRestaurants)
            ? savedRestaurants.map(restaurant => ({
                ...restaurant,
                id: String(restaurant.id),
                menuImages: Array.isArray(restaurant.menuImages)
                    ? restaurant.menuImages.filter(Boolean)
                    : [],
                hours: normalizeWeeklyHours(restaurant.hours)
            }))
            : [];
    }
    catch {
        restaurants = [];
    }

    assignMissingGroupIds();
    cleanDisplayOrder();
    renderRestaurants();
randomPickerResultId = null;
}


// ==================================================
// Default Restaurants
// ==================================================

function createDefaultRestaurants() {

    return [

        {

            id:
                String(
                    Date.now()
                ),

            name:
                "山海鍋物",

            category:
                "火鍋",

            rating:
                4.6,

            image:
                "https://images.unsplash.com/photo-1547592180-85f173990554",

            phone:
                "02-1234-5678",

            address:
                "台北市大安區",

            hours:
                "11:30 - 21:30",

            maps:
                "https://www.google.com/maps",

            menuImages: [

                "https://images.unsplash.com/photo-1547592180-85f173990554"

            ],

            description:
                "適合朋友聚餐的火鍋店。",

            favorite:
                false

        },


        {

            id:
                String(
                    Date.now() + 1
                ),

            name:
                "Morning Coffee",

            category:
                "咖啡",

            rating:
                4.8,

            image:
                "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",

            phone:
                "02-2345-6789",

            address:
                "台北市大安區",

            hours:
                "08:00 - 18:00",

            maps:
                "https://www.google.com/maps",

            menuImages:
                [],

            description:
                "適合讀書與工作的咖啡廳。",

            favorite:
                false

        }

    ];

}


// ==================================================
// Load Restaurants From Supabase
// ==================================================

async function loadRestaurantsFromSupabase() {

    try {

        console.log(
            "☁️ 正在從 Supabase 讀取餐廳..."
        );


        const {
            data,
            error
        } =
            await supabaseClient
                .from("restaurants")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (
            error
        ) {

            console.error(
                "❌ Supabase 讀取失敗：",
                error
            );

            supabaseConnected =
                false;

            return false;

        }


        restaurants =
            data.map(
                mapSupabaseToRestaurant
            );


        supabaseConnected =
            true;


        saveRestaurantsLocal();


        console.log(
            `✅ Supabase 讀取成功，共 ${restaurants.length} 間餐廳`
        );


        return true;

    }

    catch (
        error
    ) {

        console.error(
            "❌ Supabase 連線失敗：",
            error
        );


        supabaseConnected =
            false;


        return false;

    }

}


// ==================================================
// Supabase → Frontend
// ==================================================

function mapSupabaseToRestaurant(
    row
) {

    return {

        // ==================================================
        // ID
        // ==================================================

        id:
            String(
                row.id
            ),


        // ==================================================
        // 基本資料
        // ==================================================

        name:
            row.name || "",

        category:
            row.category || "",


        // ==================================================
        // ⭐ 評分
        // ==================================================

        rating:
            row.rating !== null &&
            row.rating !== undefined
                ? Number(
                    row.rating
                )
                : null,


        // ==================================================
        // 🖼️ 餐廳圖片
        // ==================================================

        image:
            row.restaurant_image_url || "",


        // ==================================================
        // ☎️ 電話
        // ==================================================

        phone:
            row.phone || "",


        // ==================================================
        // 📍 地址
        // ==================================================

        address:
            row.address || "",


        // ==================================================
        // 🕐 營業時間
        // ==================================================

        hours:
            normalizeWeeklyHours(row.opening_hours),


        // ==================================================
        // 🗺️ Google Maps
        // ==================================================

        maps:
            row.google_maps_url || "",


        // ==================================================
        // 📖 菜單圖片
        // ==================================================

        menuImages:
            Array.isArray(
                row.menu_images
            )
                ? row.menu_images.filter(Boolean)
                : [],


        // ==================================================
        // 📝 備註
        // ==================================================

        description:
            row.notes || "",


        // ==================================================
        // ❤️ 收藏
        // ==================================================

        favorite:
            row.favorite === true,


        // ==================================================
        // 📍 群組（地區）
        // ==================================================

        groupId:
            row.group_id
                ? String(row.group_id)
                : null

    };

}


// ==================================================
// Map Website Restaurant → Supabase
// ==================================================

function mapRestaurantToSupabase(
    restaurant
) {

    return {

        // ==================================================
        // 基本資料
        // ==================================================

        name:
            restaurant.name || null,

        category:
            restaurant.category || null,


        // ==================================================
        // ⭐ 評分
        // ==================================================

        rating:
            restaurant.rating !== null &&
            restaurant.rating !== undefined &&
            restaurant.rating !== ""
                ? Number(
                    restaurant.rating
                )
                : null,


        // ==================================================
        // 📝 描述
        // ==================================================

        description:
            null,


        // ==================================================
        // ☎️ 電話
        // ==================================================

        phone:
            restaurant.phone || null,


        // ==================================================
        // 🕐 營業時間
        // ==================================================

        opening_hours:
            JSON.stringify(
                normalizeWeeklyHours(restaurant.hours)
            ),


        // ==================================================
        // 🗺️ Google Maps
        // ==================================================

        google_maps_url:
            restaurant.maps || null,


        // ==================================================
        // 🖼️ 餐廳封面圖片
        // ==================================================

        restaurant_image_url:
            restaurant.image || null,


        // ==================================================
        // ❤️ 收藏
        // ==================================================

        favorite:
            Boolean(
                restaurant.favorite
            ),


        // ==================================================
        // 📝 我的備註
        // ==================================================

        notes:
            restaurant.description || null,


        // ==================================================
        // 📍 地址
        // ==================================================

        address:
            restaurant.address || null,


        // ==================================================
        // 📖 菜單圖片
        // ==================================================

        menu_images:
            Array.isArray(
                restaurant.menuImages
            )
                ? restaurant.menuImages
                : [],


        // ==================================================
        // 📍 群組（地區）
        // ==================================================

        group_id:
            restaurant.groupId || null

    };

}


// ==================================================
// LocalStorage
// ==================================================

function saveRestaurantsLocal() {
    try {
        localStorage.setItem(
            getRestaurantsStorageKey(),
            JSON.stringify(restaurants)
        );
    } catch (error) {
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error("❌ LocalStorage 已滿，無法儲存餐廳資料：", error);
            // 嘗試顯示給使用者，但不干擾主要流程
            if (typeof showToast === "function") {
                showToast("⚠️ 本機儲存空間已滿，部分離線資料可能無法同步儲存。", "error");
            }
        } else {
            console.error("❌ 儲存餐廳資料時發生未預期錯誤：", error);
        }
    }
}

function cleanDisplayOrder() {
    const existingIds = new Set(
        restaurants.map(restaurant => String(restaurant.id))
    );

    Object.keys(displaySettings.customOrder).forEach(groupId => {
        displaySettings.customOrder[groupId] =
            (displaySettings.customOrder[groupId] || []).filter(
                id => existingIds.has(String(id))
            );
    });

    saveDisplaySettings();

}


// --------------------------------------------------
// Compatibility
// 保留舊函式，避免其他舊程式碼出錯
// --------------------------------------------------

function saveRestaurants() {

    saveRestaurantsLocal();

}


// ==================================================
// Create Restaurant
// ==================================================

async function createRestaurantInSupabase(
    restaurant
) {

    try {

        const payload =
            mapRestaurantToSupabase(
                restaurant
            );


        let {
            data,
            error
        } =
            await supabaseClient
                .from("restaurants")
                .insert(
                    payload
                )
                .select()
                .single();


        // ==================================================
        // Supabase 尚未新增 group_id 欄位時，
        // 自動退回不含群組欄位的寫入方式，避免整個新增失敗。
        // ==================================================

        if (
            error &&
            isMissingGroupTableOrColumnError(error)
        ) {

            console.warn(
                "⚠️ Supabase 的 restaurants 資料表尚未有 group_id 欄位，先以不含群組的方式新增。請至 Supabase 執行資料庫更新。"
            );

            const { group_id, ...fallbackPayload } = payload;

            ({ data, error } =
                await supabaseClient
                    .from("restaurants")
                    .insert(fallbackPayload)
                    .select()
                    .single());

        }


        if (
            error
        ) {

            console.error(
                "❌ 新增餐廳失敗：",
                error
            );

            return null;

        }


        console.log(
            "✅ 餐廳新增至 Supabase：",
            data
        );


        return mapSupabaseToRestaurant(
            data
        );

    }

    catch (
        error
    ) {

        console.error(
            "❌ 新增餐廳錯誤：",
            error
        );

        return null;

    }

}


// ==================================================
// Update Restaurant
// ==================================================

async function updateRestaurantInSupabase(
    id,
    restaurant
) {

    try {

        const payload =
            mapRestaurantToSupabase(
                restaurant
            );


        let {
            data,
            error
        } =
            await supabaseClient
                .from("restaurants")
                .update(
                    payload
                )
                .eq(
                    "id",
                    id
                )
                .select()
                .single();


        // ==================================================
        // Supabase 尚未新增 group_id 欄位時，
        // 自動退回不含群組欄位的更新方式，避免整個更新失敗。
        // ==================================================

        if (
            error &&
            isMissingGroupTableOrColumnError(error)
        ) {

            console.warn(
                "⚠️ Supabase 的 restaurants 資料表尚未有 group_id 欄位，先以不含群組的方式更新。請至 Supabase 執行資料庫更新。"
            );

            const { group_id, ...fallbackPayload } = payload;

            ({ data, error } =
                await supabaseClient
                    .from("restaurants")
                    .update(fallbackPayload)
                    .eq("id", id)
                    .select()
                    .single());

        }


        if (
            error
        ) {

            console.error(
                "❌ 更新餐廳失敗：",
                error
            );

            return null;

        }


        console.log(
            "✅ 餐廳已更新至 Supabase"
        );


        return mapSupabaseToRestaurant(
            data
        );

    }

    catch (
        error
    ) {

        console.error(
            "❌ 更新餐廳錯誤：",
            error
        );

        return null;

    }

}


// ==================================================
// Delete Restaurant From Supabase
// ==================================================

async function deleteRestaurantFromSupabase(
    id
) {

    try {

        const {
            error
        } =
            await supabaseClient
                .from("restaurants")
                .delete()
                .eq(
                    "id",
                    id
                );


        if (
            error
        ) {

            console.error(
                "❌ Supabase 刪除失敗：",
                error
            );

            return false;

        }


        console.log(
            "✅ Supabase 餐廳已刪除"
        );


        return true;

    }

    catch (
        error
    ) {

        console.error(
            "❌ 刪除餐廳錯誤：",
            error
        );

        return false;

    }

}


// ==================================================
// Render Restaurants
// ==================================================

function renderRestaurants(
    restaurantData = restaurants
) {  

    restaurantList.innerHTML = "";
    applyDisplaySettings();

    // ==================================================
    // 先套用「目前群組」過濾，再依原本順序排序
    // 無論傳入的是全部餐廳、搜尋結果、分類結果或收藏結果，
    // 最終畫面一律只顯示目前群組的餐廳。
    // ==================================================

    const groupScopedRestaurants = getGroupFilteredRestaurants(restaurantData);

    const visibleRestaurants = getOrderedRestaurants(groupScopedRestaurants);


    if (
        visibleRestaurants.length === 0
    ) {

        renderEmptyState(restaurantData);

        return;

    }


visibleRestaurants.forEach(
    restaurant => {

        const card =
            createRestaurantCard(
                restaurant
            );

        if (
            randomPickerResultId &&
            String(restaurant.id) === randomPickerResultId
        ) {
            card.classList.add("random-picker-selected");
        }

        restaurantList.appendChild(card);

    }
);

}

// ==================================================
// Normalize Restaurant Image
// ==================================================

function getRestaurantImageSrc(image) {

    if (!image) {
        return "";
    }

    // 確保一定是字串
    image = String(image).trim();

    if (!image) {
        return "";
    }

    // ------------------------------------------
    // 已經是 Data URL
    // ------------------------------------------

    if (image.startsWith("data:image/")) {
        return image;
    }

    // ------------------------------------------
    // 一般網路圖片
    // ------------------------------------------

    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("blob:")
    ) {
        return image;
    }

    // ------------------------------------------
    // file:/// 或 fakepath
    // 這些不能直接拿來顯示
    // ------------------------------------------

    if (
        image.startsWith("file:///") ||
        image.startsWith("C:\\fakepath\\") ||
        image.startsWith("C:/fakepath/")
    ) {
        return "";
    }

    // ------------------------------------------
    // 純 Base64
    // ------------------------------------------

    // JPEG
    if (
        image.startsWith("/9j/") ||
        image.startsWith("/9J/")
    ) {
        return `data:image/jpeg;base64,${image}`;
    }

    // PNG
    if (
        image.startsWith("iVBORw0KGgo")
    ) {
        return `data:image/png;base64,${image}`;
    }

    // GIF
    if (
        image.startsWith("R0lGOD")
    ) {
        return `data:image/gif;base64,${image}`;
    }

    // WebP
    if (
        image.startsWith("UklGR")
    ) {
        return `data:image/webp;base64,${image}`;
    }

    // ------------------------------------------
    // 如果看起來像 Base64
    // 最後嘗試 JPEG
    // ------------------------------------------

    if (
        image.length > 1000 &&
        /^[A-Za-z0-9+/=\s]+$/.test(image)
    ) {
        return `data:image/jpeg;base64,${image}`;
    }

    // ------------------------------------------
    // 其他情況直接使用原值
    // ------------------------------------------

    return image;
}
// ==================================================
// Restaurant Card
// ==================================================

function createRestaurantCard(
    restaurant
) {

    const article =
        document.createElement(
            "article"
        );


    article.className =
        "restaurant-card";
article.dataset.id = String(restaurant.id);

    const menuCount =
        restaurant.menuImages
            ? restaurant.menuImages.filter(Boolean).length
            : 0;
    const phoneDisplay = restaurant.phone || "";
    const phoneTel = phoneDisplay.replace(/[^\d+]/g, "");
        const restaurantImage =
    getRestaurantImageSrc(restaurant.image);

console.log(
    "🖼️ 餐廳圖片處理後：",
    restaurant.name,
    restaurantImage
);

article.innerHTML = `

    <div class="restaurant-image">

        ${
            restaurantImage
                ? `
                    <img
                        src="${restaurantImage}"
                        alt="${restaurant.name}"
                        class="restaurant-card-image"
                    >

                    <div
                        class="restaurant-image-placeholder"
                        hidden
                    >
                        <span>🍽️</span>
                        <small>圖片無法顯示</small>
                    </div>
                `
                : `
                    <div class="restaurant-image-placeholder">
                        <span>🍽️</span>
                        <small>尚未提供圖片</small>
                    </div>
                `
        }

        <button
            class="
                favorite
                ${restaurant.favorite ? "liked" : ""}
            "
            data-id="${restaurant.id}"
            aria-label="${restaurant.favorite ? "取消收藏" : "收藏"} ${restaurant.name}"
            aria-pressed="${restaurant.favorite}"
        >

            ${restaurant.favorite ? "♥" : "♡"}

        </button>

    </div>




    <div class="restaurant-content">

        <div class="restaurant-title">

            <div>

                <h2>
                    ${restaurant.name}
                </h2>

                <p class="rating">
                    ★
                    ${restaurant.rating || "—"}
                </p>

            </div>

            <span class="tag">
                ${restaurant.category}
            </span>

        </div>


        <p class="location">
            📍
            ${restaurant.address || "尚未提供地址"}
        </p>

            <button
            type="button"
            class="hours"
            data-hours-id="${restaurant.id}"
        >
            ${getHoursSummary(restaurant)}
        </button>
        ${
    phoneDisplay
        ? `
            <a
                href="tel:${phoneTel}"
                class="restaurant-phone"
                aria-label="撥打 ${phoneDisplay}"
            >
                📞
                ${phoneDisplay}
            </a>
        `
        : ""
}




        <div class="card-actions">

            <button
                class="menu-button"
                data-id="${restaurant.id}"
            >
                📖 菜單
                ${
                    menuCount > 0
                        ? ` · ${menuCount} 張`
                        : ""
                }
            </button>


            <button
                class="view-button"
                data-id="${restaurant.id}"
            >
                查看資訊
            </button>

            ${
                canEditCurrentGroup()
                    ? `
                        <button
                            class="edit-button"
                            data-id="${restaurant.id}"
                        >
                            編輯
                        </button>
                        <button
                            class="delete-button"
                            data-id="${restaurant.id}"
                        >
                            刪除
                        </button>
                    `
                    : ""
            }

        </div>

    </div>

`;

const testImage =
    article.querySelector(".restaurant-image img");

if (testImage) {

    testImage.addEventListener(
        "load",
        () => {

            console.log(
                "✅ IMG 成功載入：",
                restaurant.name
            );

            console.log(
                "自然尺寸：",
                testImage.naturalWidth,
                "x",
                testImage.naturalHeight
            );

            console.log(
                "實際 src：",
                testImage.currentSrc
            );

        }
    );

    testImage.addEventListener(
        "error",
        event => {

            console.error(
                "❌ IMG 載入失敗：",
                restaurant.name
            );

            console.error(
                "src：",
                testImage.src
            );

            console.error(
                "currentSrc：",
                testImage.currentSrc
            );

        }
    );

}

    // Favorite

    article
        .querySelector(".favorite")
        .addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                toggleFavorite(
                    restaurant.id,
                    event.currentTarget
                );

            }
        );


    // Menu

    article
        .querySelector(".menu-button")
        .addEventListener(
            "click",
            () => {

                openMenuViewer(
                    restaurant
                );

            }
        );

    article
        .querySelector(".hours")
        .addEventListener(
            "click",
            () => alert(`營業時間\n\n${getWeeklyHoursText(restaurant)}`)
        );


    // Detail

    article
        .querySelector(".view-button")
        .addEventListener(
            "click",
            () => {

                showRestaurantDetail(
                    restaurant
                );

            }
        );


    return article;

}


// ==================================================
// Favorite
// ==================================================

async function toggleFavorite(id, favoriteButton) {

    const index = restaurants.findIndex(
        restaurant =>
            String(restaurant.id) === String(id)
    );

    if (index === -1) {
        return;
    }


    // ==================================================
    // 1. 立即更新畫面
    // ==================================================

    const previousFavorite =
        restaurants[index].favorite === true;

    const newFavorite =
        !previousFavorite;

    restaurants[index].favorite =
        newFavorite;

    favoriteButton.classList.toggle("liked", newFavorite);
    favoriteButton.textContent = newFavorite ? "♥" : "♡";
    favoriteButton.setAttribute("aria-pressed", String(newFavorite));
    favoriteButton.setAttribute(
        "aria-label",
        `${newFavorite ? "取消收藏" : "收藏"} ${restaurants[index].name}`
    );
    favoriteButton.classList.remove("favorite-pop");
    void favoriteButton.offsetWidth;
    favoriteButton.classList.add("favorite-pop");
    showToast(
        newFavorite ? "♥ 已加入收藏" : "♡ 已取消收藏",
        "success"
    );

    const syncVersion =
        (favoriteSyncVersions.get(String(id)) || 0) + 1;

    favoriteSyncVersions.set(
        String(id),
        syncVersion
    );


    // 先儲存本機
    saveRestaurantsLocal();


    const activeCategory =
        document.querySelector(".category.active")?.dataset.category;

    if (
        activeCategory === "收藏" &&
        !newFavorite
    ) {
        renderRestaurants();
randomPickerResultId = null;
    }


    // ==================================================
    // 2. 同步 Supabase
    // ==================================================

    if (supabaseConnected) {


        const {
            error
        } = await supabaseClient
            .from("restaurants")
            .update({
                favorite: newFavorite
            })
            .eq(
                "id",
                id
            );


        if (error) {

            if (
                favoriteSyncVersions.get(String(id)) === syncVersion
            ) {

                restaurants[index].favorite =
                    previousFavorite;

                saveRestaurantsLocal();
                favoriteButton.classList.toggle("liked", previousFavorite);
                favoriteButton.textContent = previousFavorite ? "♥" : "♡";
                favoriteButton.setAttribute("aria-pressed", String(previousFavorite));
                showToast("⚠ 收藏同步失敗，已恢復原狀態", "warning");

                if (
                    activeCategory === "收藏"
                ) {
                    renderRestaurants();
randomPickerResultId = null;
                }

            }

            console.error(
                "❌ 收藏同步失敗：",
                error
            );

        }

        else {

            console.log(
                "☁️ 收藏狀態已同步：",
                newFavorite
            );

        }

    }

}


// ==================================================
// Search
// ==================================================

function performRestaurantSearch() {

    const keyword =
        searchInput.value
            .trim()
            .toLowerCase();


    const filtered =
        restaurants.filter(
            restaurant => {

                return (

                    (
                        restaurant.name || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (
                        restaurant.category || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (
                        restaurant.address || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (
                        restaurant.description || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    JSON.stringify(
                        restaurant.hours || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                );

            }
        );


    renderRestaurants(
        filtered
    );


    clearSearchButton.hidden =
        keyword.length === 0;

}


/* ==================================================
   Normal Text Search
================================================== */

searchInput.addEventListener(
    "input",
    performRestaurantSearch
);


/* ==================================================
   Clear Search
================================================== */

clearSearchButton.addEventListener(
    "click",
    () => {

        searchInput.value = "";

        clearSearchButton.hidden = true;

        renderRestaurants();
randomPickerResultId = null;

        searchInput.focus();

    }
);


/* ==================================================
   Voice Search
================================================== */

const voiceSearchButton =
    document.getElementById(
        "voiceSearchButton"
    );

const voiceSearchStatus =
    document.getElementById(
        "voiceSearchStatus"
    );
if (voiceSearchStatus) {
    voiceSearchStatus.style.display = "none";
}

const voiceSearchStatusText =
    document.getElementById(
        "voiceSearchStatusText"
    );


let speechRecognition = null;

let isVoiceListening = false;


/* ==================================================
   Browser Support
================================================== */

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


if (SpeechRecognition) {

    speechRecognition =
        new SpeechRecognition();


    speechRecognition.lang =
        "zh-TW";


    speechRecognition.continuous =
        false;


    speechRecognition.interimResults =
        true;


    speechRecognition.maxAlternatives =
        1;


    /* ==============================================
       Start
    ============================================== */

    voiceSearchButton.addEventListener(
        "click",
        () => {

            if (isVoiceListening) {

                speechRecognition.stop();

                return;

            }


            try {

                speechRecognition.start();

            } catch (error) {

                console.warn(
                    "語音辨識啟動失敗：",
                    error
                );

            }

        }
    );


    /* ==============================================
       Listening Start
    ============================================== */

    speechRecognition.addEventListener(
        "start",
        () => {

            isVoiceListening = true;


            voiceSearchButton.classList.add(
                "listening"
            );


            voiceSearchButton.setAttribute(
                "aria-label",
                "停止語音搜尋"
            );


            voiceSearchStatus.style.display = "flex";


            voiceSearchStatusText.textContent =
                "正在聆聽…";


            searchInput.placeholder =
                "請說出餐廳名稱、分類或地點…";

        }
    );


    /* ==============================================
       Result
    ============================================== */

    speechRecognition.addEventListener(
        "result",
        event => {

            let transcript = "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                transcript +=
                    event.results[i][0].transcript;

            }


            transcript =
                transcript.trim();


            if (!transcript) {
                return;
            }


            /*
             * 即時顯示辨識文字
             */
            searchInput.value =
                transcript;


            /*
             * 直接使用原本的搜尋系統
             */
            performRestaurantSearch();

        }
    );


    /* ==============================================
       End
    ============================================== */

speechRecognition.addEventListener(
    "end",
    () => {

        isVoiceListening = false;

        voiceSearchButton.classList.remove(
            "listening"
        );

        voiceSearchButton.setAttribute(
            "aria-label",
            "語音搜尋"
        );

        voiceSearchStatus.style.display = "none";

        searchInput.placeholder =
            "搜尋餐廳、分類或地點...";

    }
);


    /* ==============================================
       Error
    ============================================== */

    speechRecognition.addEventListener(
        "error",
        event => {

            console.warn(
                "語音辨識錯誤：",
                event.error
            );


            isVoiceListening = false;


            voiceSearchButton.classList.remove(
                "listening"
            );


            voiceSearchStatus.style.display = "flex";


            switch (event.error) {

                case "not-allowed":

                    voiceSearchStatusText.textContent =
                        "請允許麥克風權限";

                    break;


                case "no-speech":

                    voiceSearchStatusText.textContent =
                        "沒有聽到聲音，請再試一次";

                    break;


                case "audio-capture":

                    voiceSearchStatusText.textContent =
                        "無法使用麥克風";

                    break;


                case "network":

                    voiceSearchStatusText.textContent =
                        "語音辨識需要網路連線";

                    break;


                default:

                    voiceSearchStatusText.textContent =
                        "語音辨識失敗，請再試一次";

            }


            setTimeout(
                () => {

                    voiceSearchStatus.style.display = "none";

                    searchInput.placeholder =
                        "搜尋餐廳、分類或地點...";

                },
                2200
            );

        }
    );

} else {

    /* ==============================================
       Browser Not Supported
    ============================================== */

    voiceSearchButton.addEventListener(
        "click",
        () => {

            voiceSearchStatus.style.display = "flex";


            voiceSearchStatusText.textContent =
                "目前的瀏覽器不支援語音搜尋";


            setTimeout(
                () => {

                    voiceSearchStatus.style.display = "none";

                },
                2500
            );

        }
    );

}


// ==================================================
// Category
// ==================================================

categories.forEach(
    categoryButton => {

        categoryButton.addEventListener(
            "click",
            () => {

                // ==================================================
                // 移除其他分類的 active
                // ==================================================

                categories.forEach(
                    button => {

                        button.classList.remove(
                            "active"
                        );

                    }
                );


                // ==================================================
                // 當前分類加入 active
                // ==================================================

                categoryButton.classList.add(
                    "active"
                );


                // ==================================================
                // 取得分類
                // ==================================================

                const category =
                    categoryButton.dataset.category;


                // ==================================================
                // 全部
                // ==================================================

                if (
    category === "全部"
) {

    randomPickerResultId = null;

    renderRestaurants();
randomPickerResultId = null;

    return;

}


                // ==================================================
                // 收藏
                // ==================================================

                if (
                    category === "收藏"
                ) {

                    const favoriteRestaurants =
                        restaurants.filter(
                            restaurant =>
                                restaurant.favorite === true
                        );


                    renderRestaurants(
                        favoriteRestaurants
                    );


                    return;

                }


                // ==================================================
                // 一般餐廳分類
                // ==================================================

                const filteredRestaurants =
                    restaurants.filter(
                        restaurant =>
                            restaurant.category ===
                            category
                    );


                renderRestaurants(
                    filteredRestaurants
                );

            }
        );

    }
);


// ==================================================
// Open Add Modal
// ==================================================

addRestaurantButton.addEventListener(
    "click",
    () => {

        delete restaurantForm.dataset.editingId;


        restaurantForm.reset();
        restaurantImageInput.dataset.imageRemoved = "false";
        updateRestaurantImagePreview("");
        renderWeeklyHoursEditor();

        // 新增餐廳不需要選擇群組，自動使用目前群組
        const restaurantGroupField = document.getElementById("restaurantGroupField");
        if (restaurantGroupField) {
            restaurantGroupField.hidden = true;
        }

        document.querySelectorAll("[id^='restaurantMenu']").forEach(input => {
            input.dataset.menuRemoved = "false";
        });


        updateMenuPreview(
            1,
            ""
        );

        updateMenuPreview(
            2,
            ""
        );

        updateMenuPreview(
            3,
            ""
        );


        restaurantModal.classList.add(
            "show"
        );

    }
);


// ==================================================
// Close Modal
// ==================================================

closeModal.addEventListener(
    "click",
    closeRestaurantModal
);


restaurantModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            restaurantModal
        ) {

            closeRestaurantModal();

        }

    }
);


function closeRestaurantModal() {

    restaurantModal.classList.remove(
        "show"
    );


    restaurantForm.reset();
    restaurantImageInput.dataset.imageRemoved = "false";
    updateRestaurantImagePreview("");
    renderWeeklyHoursEditor();

    document.querySelectorAll("[id^='restaurantMenu']").forEach(input => {
        input.dataset.menuRemoved = "false";
    });


    delete restaurantForm.dataset.editingId;

    const restaurantGroupFieldOnClose = document.getElementById("restaurantGroupField");
    if (restaurantGroupFieldOnClose) {
        restaurantGroupFieldOnClose.hidden = true;
    }


    updateMenuPreview(
        1,
        ""
    );


    updateMenuPreview(
        2,
        ""
    );


    updateMenuPreview(
        3,
        ""
    );

}


// ==================================================
// Submit Form
// ==================================================

function readFileAsDataUrl(file) {

    return new Promise((resolve, reject) => {

        const image = new Image();
        const imageUrl = URL.createObjectURL(file);

        image.addEventListener("load", () => {

            const maxSize = 1600;
            const ratio = Math.min(
                1,
                maxSize / Math.max(image.naturalWidth, image.naturalHeight)
            );
            const canvas = document.createElement("canvas");

            canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(imageUrl);
            resolve(canvas.toDataURL("image/jpeg", 0.82));

        });

        image.addEventListener("error", () => {
            URL.revokeObjectURL(imageUrl);
            reject(new Error("圖片無法讀取"));
        });

        image.src = imageUrl;

    });

}

function renderWeeklyHoursEditor(value = null) {
    const editor = document.getElementById("weeklyHoursEditor");
    const quickDays = document.getElementById("quickHoursDays");
    const weeklyHours = normalizeWeeklyHours(value);

    editor.innerHTML = weekDays.map(day => {
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

    quickDays.innerHTML = weekDays.map(day => `
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

restaurantForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();
        AppLoading.show("正在幫你存好這家店…");

        const editingId =
            restaurantForm.dataset.editingId;


// ==================================================
// 取得菜單圖片
// ==================================================

const menuInputs = [
    document.getElementById("restaurantMenu1"),
    document.getElementById("restaurantMenu2"),
    document.getElementById("restaurantMenu3")
];

// ==================================================
// 取得目前使用者選擇的圖片 File
// ==================================================

const selectedMenuFiles = menuInputs.map(input =>
    input && input.files && input.files.length > 0
        ? input.files[0]
        : null
);

console.log(
    "📷 使用者選擇的菜單圖片：",
    selectedMenuFiles
);


        // ==================================================
        // 取得表單資料
        // ==================================================
        
        console.log(
    "📍 表單地址：",
    document.getElementById("restaurantAddress").value
);

console.log(
    "⭐ 表單評分：",
    document.getElementById("restaurantRating").value
);
        const existingRestaurant =
            editingId
                ? restaurants.find(
                    restaurant =>
                        String(
                            restaurant.id
                        ) ===
                        String(
                            editingId
                        )
                )
                : null;

        let restaurantImage;
        let menuImages;

        try {
            // 處理主圖
            if (restaurantImageInput.files && restaurantImageInput.files.length > 0) {
                if (currentUser) {
                    restaurantImage = await uploadImageToSupabaseStorage(restaurantImageInput.files[0]);
                } else {
                    restaurantImage = await readFileAsDataUrl(restaurantImageInput.files[0]);
                }
            } else if (restaurantImageInput.dataset.imageRemoved === "true") {
                restaurantImage = "";
            } else {
                restaurantImage = existingRestaurant?.image || "";
            }

            // 處理菜單圖片
            menuImages = await Promise.all(
                selectedMenuFiles.map(async (file, index) => {
                    if (file) {
                        return currentUser ? await uploadImageToSupabaseStorage(file) : await readFileAsDataUrl(file);
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

        let weeklyHours;

        const restaurantData = {

            name:
                document.getElementById(
                    "restaurantName"
                ).value.trim(),

            category:
                document.getElementById(
                    "restaurantCategory"
                ).value,


            // ==================================================
            // 📍 群組（地區）
            // 新增：自動使用目前群組
            // 編輯：使用「所屬群組」下拉選單的值
            // ==================================================

            groupId:
                editingId
                    ? (
                        document.getElementById("restaurantGroup")?.value ||
                        existingRestaurant?.groupId ||
                        currentGroupId
                    )
                    : currentGroupId,


            rating:
                Number(
                    document.getElementById(
                        "restaurantRating"
                    ).value
                ) || null,


            phone:
                document.getElementById(
                    "restaurantPhone"
                ).value.trim(),

            address:
                document.getElementById(
                    "restaurantAddress"
                ).value.trim(),

            hours:
                weeklyHours,

            maps:
                document.getElementById(
                    "restaurantMaps"
                ).value.trim(),

            image:
                restaurantImage,

            menuImages:
                menuImages,

            description:
                document.getElementById(
                    "restaurantDescription"
                ).value.trim()

        };
        console.log("⭐ 表單取得的評分：", document.getElementById("restaurantRating").value);

        // ==================================================
        // EDIT
        // ==================================================

        if (editingId) {

            console.log(
                "✏️ 開始更新餐廳：",
                editingId
            );


            // --------------------------------------------------
            // 更新 Supabase
            // --------------------------------------------------

            if (supabaseConnected) {

                const updatedRestaurant =
                    await updateRestaurantInSupabase(
                        editingId,
                        restaurantData
                    );


                // --------------------------------------------------
                // Supabase 更新失敗
                // --------------------------------------------------

                if (!updatedRestaurant) {

    AppLoading.hide();

    alert(
        "❌ 餐廳更新失敗，請檢查網路連線。"
    );

    return;

}


                    console.log(
                        "☁️ 餐廳已成功更新到 Supabase：",
                        updatedRestaurant
                    );


                    // --------------------------------------------------
                    // 重新從 Supabase 讀取
                    // --------------------------------------------------

                    await loadRestaurants();


                    // --------------------------------------------------
                    // 更新畫面
                    // --------------------------------------------------

                    renderRestaurants();
randomPickerResultId = null;


                    // --------------------------------------------------
                    // 關閉編輯視窗
                    // --------------------------------------------------

                    closeRestaurantModal();


                    alert(
                        "✅ 餐廳資料已更新！"
                    );

                }


                // --------------------------------------------------
                // Supabase 沒連線
                // --------------------------------------------------

                else {

                    const index =
                        restaurants.findIndex(
                            restaurant =>
                                String(
                                    restaurant.id
                                ) ===
                                String(
                                    editingId
                                )
                        );


                    if (index === -1) {

        AppLoading.hide();

        alert(
            "找不到要編輯的餐廳。"
        );

        return;

    }


                    restaurants[index] = {

                        ...restaurants[index],

                        ...restaurantData

                    };


                    saveRestaurantsLocal();

                    renderRestaurants();
randomPickerResultId = null;

                    closeRestaurantModal();


                    alert(
                        "⚠️ Supabase 尚未連線，目前只儲存在本機。"
                    );

                }

            }


            // ==================================================
            // ADD
            // ==================================================

            else {

                const newRestaurant = {

                    id:
                        String(
                            Date.now()
                        ),

                    ...restaurantData,

                    favorite:
                        false

                };


                console.log(
                    "➕ 開始新增餐廳：",
                    newRestaurant
                );


                // --------------------------------------------------
                // Supabase
                // --------------------------------------------------

                if (supabaseConnected) {

                    if (!currentUser) {
                        alert("⚠️ 請先登入帳號後再新增餐廳！");
                        return;
                    }

                    const saved =
                        await createRestaurantInSupabase(
                            newRestaurant
                        );


                    if (saved) {

                        console.log(
                            "☁️ 新餐廳已成功同步到 Supabase：",
                            saved
                        );


                        // 重新從 Supabase 讀取
                        await loadRestaurants();


                        // 更新畫面
                        renderRestaurants();
randomPickerResultId = null;


                        // 關閉視窗
                        closeRestaurantModal();


                        alert(
                            "✅ 餐廳已成功新增！"
                        );

                    }


                    else {

                        restaurants.unshift(
                            newRestaurant
                        );


                        saveRestaurantsLocal();

                        renderRestaurants();
randomPickerResultId = null;

                        closeRestaurantModal();


                        alert(
                            "⚠️ 餐廳已暫存，但無法同步到 Supabase。"
                        );

                    }

                }


                // --------------------------------------------------
                // Local fallback
                // --------------------------------------------------

                else {

                    restaurants.unshift(
                        newRestaurant
                    );


                    saveRestaurantsLocal();

                    renderRestaurants();
randomPickerResultId = null;

                    closeRestaurantModal();


                    alert(
                        "⚠️ Supabase 尚未連線，目前只儲存在本機。"
                    );

                }

            }


        // ==================================================
        // 回到列表頂端
        // ==================================================

                window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

        // 儲存流程完成，關閉 Loading
        AppLoading.hide(300);

    }
);


// ==================================================
// Restaurant Detail
// ==================================================

function showRestaurantDetail(
    restaurant
) {

    const overlay =
        document.createElement(
            "div"
        );


    overlay.className =
        "detail-overlay";


    const menuCount =
        restaurant.menuImages
            ? restaurant.menuImages.length
            : 0;
    
            console.log(
    "========== 餐廳圖片檢查 =========="
);

console.log(
    "餐廳：",
    restaurant.name
);

console.log(
    "image：",
    restaurant.image
);

console.log(
    "image type：",
    typeof restaurant.image
);

console.log(
    "image length：",
    restaurant.image
        ? String(restaurant.image).length
        : 0
);

console.log(
    "=================================="
);

    overlay.innerHTML = `

        <div class="detail-sheet">

            <div class="detail-header">

                <button
                    class="detail-close"
                >
                    ×
                </button>

            </div>


            <div class="detail-main-image">

                <img
                    src="${restaurant.image || ""}"
                    alt="${restaurant.name}"
                >

            </div>


            <div class="detail-content">


                <div class="detail-title-row">

                    <div>

                        <h2>
                            ${restaurant.name}
                        </h2>

                        <p class="detail-rating">

                            ★
                            ${restaurant.rating || "—"}

                        </p>

                    </div>


                    <span class="tag">

                        ${restaurant.category}

                    </span>

                </div>


                <button
                    class="detail-menu-button"
                >

                    <div>

                        <strong>
                            📖 查看菜單
                        </strong>

                        <span>

                            ${
                                menuCount > 0
                                    ? `${menuCount} 張菜單圖片`
                                    : "尚未新增菜單"
                            }

                        </span>

                    </div>


                    <span>
                        →
                    </span>

                </button>


                <div class="info-list">


                    <div class="info-item">

                        <span>
                            📍
                        </span>

                        <div>

                            <small>
                                地址
                            </small>

                            <p>
                                ${
                                    restaurant.address ||
                                    "尚未提供"
                                }
                            </p>

                        </div>

                    </div>


                    <div class="info-item">

                        <span>
                            🕐
                        </span>

                        <div>

                            <small>
                                營業時間
                            </small>

                            <p>
                                ${
                                    getHoursSummary(restaurant)
                                }
                            </p>

                        </div>

                    </div>


                    <div class="info-item">

                        <span>
                            ☎
                        </span>

                        <div>

                            <small>
                                電話
                            </small>

                            <p>
                                ${
                                    restaurant.phone ||
                                    "尚未提供"
                                }
                            </p>

                        </div>

                    </div>

                </div>


                <div class="description">

                    <h3>
                        我的備註
                    </h3>

                    <p>

                        ${
                            restaurant.description ||
                            "尚未新增備註"
                        }

                    </p>

                </div>


                <div class="detail-actions">

                    <button
                        class="detail-map-button"
                    >

                        📍 Google Maps

                    </button>


                    <button
                        class="detail-edit-button"
                    >

                        ✏️ 編輯餐廳

                    </button>


                    <button
                        class="detail-delete-button"
                    >

                        🗑️ 刪除餐廳

                    </button>

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(
        overlay
    );


    // Close

    overlay
        .querySelector(".detail-close")
        .addEventListener(
            "click",
            () => {

                overlay.remove();

            }
        );


    // Menu

    overlay
        .querySelector(".detail-menu-button")
        .addEventListener(
            "click",
            () => {

                if (
                    !restaurant.menuImages ||
                    restaurant.menuImages.length === 0
                ) {

                    alert(
                        "這間餐廳目前還沒有菜單圖片。"
                    );

                    return;

                }


                overlay.remove();


                openMenuViewer(
                    restaurant
                );

            }
        );


    // Maps

    overlay
        .querySelector(".detail-map-button")
        .addEventListener(
            "click",
            () => {

                if (
                    restaurant.maps
                ) {

                    window.open(
                        restaurant.maps,
                        "_blank"
                    );

                }

                else {

                    alert(
                        "尚未設定 Google Maps"
                    );

                }

            }
        );


    // Edit

    overlay
        .querySelector(".detail-edit-button")
        .addEventListener(
            "click",
            () => {

                overlay.remove();


                openEditRestaurant(
                    restaurant
                );

            }
        );


    // Delete

    overlay
        .querySelector(".detail-delete-button")
        .addEventListener(
            "click",
            () => {

                deleteRestaurant(
                    restaurant.id
                );

                overlay.remove();

            }
        );

}


// ==================================================
// Edit Restaurant
// ==================================================

function openEditRestaurant(
    restaurant
) {

    restaurantModal.classList.add(
        "show"
    );


    restaurantForm.dataset.editingId =
        restaurant.id;


    // ==================================================
    // 基本資料
    // ==================================================

    document.getElementById(
        "restaurantName"
    ).value =
        restaurant.name || "";


    document.getElementById(
        "restaurantCategory"
    ).value =
        restaurant.category || "";


    // ==================================================
    // 所屬群組（編輯時才顯示，可移動到其他群組）
    // ==================================================

    const restaurantGroupField =
        document.getElementById("restaurantGroupField");

    const restaurantGroupSelect =
        document.getElementById("restaurantGroup");

    if (restaurantGroupField && restaurantGroupSelect) {

        restaurantGroupSelect.innerHTML = restaurantGroups
            .map(group => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`)
            .join("");

        restaurantGroupSelect.value =
            restaurant.groupId || currentGroupId;

        restaurantGroupField.hidden = false;

    }


    document.getElementById(
        "restaurantRating"
    ).value =
        restaurant.rating ?? "";


    // ==================================================
    // 聯絡資訊
    // ==================================================

    document.getElementById(
        "restaurantPhone"
    ).value =
        restaurant.phone || "";


    document.getElementById(
        "restaurantAddress"
    ).value =
        restaurant.address || "";


    renderWeeklyHoursEditor(restaurant.hours);


    // ==================================================
    // Google Maps
    // ==================================================

    document.getElementById(
        "restaurantMaps"
    ).value =
        restaurant.maps || "";


    // ==================================================
    // 備註
    // ==================================================

    document.getElementById(
        "restaurantDescription"
    ).value =
        restaurant.description || "";


    // ==================================================
    // 菜單圖片
    // ==================================================

   const menuImages =
    restaurant.menuImages || [];


// File input 不能直接填入舊圖片
document.getElementById(
    "restaurantMenu1"
).value = "";

document.getElementById(
    "restaurantMenu2"
).value = "";

document.getElementById(
    "restaurantMenu3"
).value = "";

document.querySelectorAll("[id^='restaurantMenu']").forEach(input => {
    input.dataset.menuRemoved = "false";
});

restaurantImageInput.dataset.imageRemoved = "false";
updateRestaurantImagePreview(restaurant.image || "");


// 顯示目前已儲存的菜單圖片
updateMenuPreview(
    1,
    menuImages[0] || ""
);

updateMenuPreview(
    2,
    menuImages[1] || ""
);

updateMenuPreview(
    3,
    menuImages[2] || ""
);

}


// ==================================================
// Delete Restaurant
// ==================================================

async function deleteRestaurant(id) {
    if (!canEditCurrentGroup()) {
        showToast("唯讀模式，無法刪除餐廳");
        return;
    }


    const restaurant =
        restaurants.find(
            restaurant =>
                String(
                    restaurant.id
                ) ===
                String(id)
        );


    // ==================================================
    // 找不到餐廳
    // ==================================================

    if (
        !restaurant
    ) {

        alert(
            "找不到要刪除的餐廳。"
        );

        return;

    }


    // ==================================================
    // 確認刪除
    // ==================================================

    const confirmed =
        confirm(
            `確定要刪除「${restaurant.name}」嗎？`
        );


    if (
        !confirmed
    ) {

        return;

    }


    // ==================================================
    // Supabase
    // ==================================================

    if (
        supabaseConnected
    ) {

        console.log(
            "🗑️ 開始從 Supabase 刪除：",
            id
        );


        const success =
            await deleteRestaurantFromSupabase(
                id
            );


        // --------------------------------------------------
        // Supabase 刪除失敗
        // --------------------------------------------------

        if (
            !success
        ) {

            alert(
                "❌ 餐廳刪除失敗，請檢查網路連線。"
            );

            return;

        }


        console.log(
            "☁️ 餐廳已成功從 Supabase 刪除：",
            id
        );


        // --------------------------------------------------
        // 重新讀取 Supabase
        // --------------------------------------------------

        await loadRestaurants();


        // --------------------------------------------------
        // 更新畫面
        // --------------------------------------------------

        renderRestaurants();
randomPickerResultId = null;


        alert(
            "✅ 餐廳已成功刪除！"
        );

    }


    // ==================================================
    // Local fallback
    // ==================================================

    else {

        restaurants =
            restaurants.filter(
                restaurant =>
                    String(
                        restaurant.id
                    ) !==
                    String(id)
            );

                cleanDisplayOrder();


        saveRestaurantsLocal();

        renderRestaurants();
randomPickerResultId = null;


        alert(
            "⚠️ Supabase 尚未連線，目前只從本機刪除。"
        );

    }

}


// ==================================================
// Initialize Menu Image Upload
// 點擊灰色菜單框 → 開啟圖片選擇器
// ==================================================

function initializeMenuPreview() {

    const menuInputs = [
        document.getElementById("restaurantMenu1"),
        document.getElementById("restaurantMenu2"),
        document.getElementById("restaurantMenu3")
    ];

    menuInputs.forEach((input, index) => {

        const menuNumber = index + 1;

        console.log(
            `📖 初始化菜單 ${menuNumber}`
        );

        // ------------------------------------------
        // 確認 input
        // ------------------------------------------

        if (!input) {

            console.error(
                `❌ 找不到 restaurantMenu${menuNumber}`
            );

            return;
        }

        // ------------------------------------------
        // 找到對應的灰色預覽框
        // ------------------------------------------

        const preview =
            document.getElementById(
                `menuPreview${menuNumber}`
            );

        if (!preview) {

            console.error(
                `❌ 找不到 menuPreview${menuNumber}`
            );

            return;
        }

        // ------------------------------------------
        // 隱藏原本的檔案選擇器
        // ------------------------------------------

        input.style.display = "none";

        // ------------------------------------------
        // 灰色框可以點擊
        // ------------------------------------------

        preview.style.cursor = "pointer";

        // ------------------------------------------
        // 點擊灰色框
        // ------------------------------------------

        preview.addEventListener(
            "click",
            () => {

                console.log(
                    `📸 點擊菜單 ${menuNumber}`
                );

                input.click();

            }
        );

        // ------------------------------------------
        // 選擇圖片
        // ------------------------------------------

        input.addEventListener(
            "change",
            () => {

                const file =
                    input.files &&
                    input.files.length > 0
                        ? input.files[0]
                        : null;

                console.log(
                    `📷 菜單 ${menuNumber} 選擇圖片：`,
                    file
                );

                if (!file) {
                    return;
                }

                input.dataset.menuRemoved = "false";

                // ----------------------------------
                // 確認是不是圖片
                // ----------------------------------

                if (
                    !file.type.startsWith("image/")
                ) {

                    alert(
                        "請選擇圖片檔案。"
                    );

                    input.value = "";

                    return;
                }

                // ----------------------------------
                // 顯示預覽
                // ----------------------------------

                updateMenuPreview(
                    menuNumber,
                    file
                );

            }
        );

    });

}

// ==================================================
// Update Menu Image Preview
// ==================================================

function updateMenuPreview(
    menuNumber,
    fileOrUrl
) {

    const preview =
        document.getElementById(
            `menuPreview${menuNumber}`
        );

    if (!preview) {

        console.error(
            `❌ 找不到 menuPreview${menuNumber}`
        );

        return;
    }

    // ==================================================
    // 沒有圖片
    // ==================================================

    if (!fileOrUrl) {

        preview.innerHTML = `

            <div class="menu-preview-empty">

                <span class="menu-upload-icon">
                    📖
                </span>

                <p>
                    點擊上傳菜單圖片
                </p>

            </div>

        `;

        return;
    }

    // ==================================================
    // 使用者剛剛選擇的 File
    // ==================================================

    if (
        fileOrUrl instanceof File
    ) {

        console.log(
            `📷 菜單 ${menuNumber} File：`,
            fileOrUrl
        );

        // ----------------------------------------------
        // 建立瀏覽器暫時圖片網址
        // ----------------------------------------------

        const imageURL =
            URL.createObjectURL(
                fileOrUrl
            );

        console.log(
            `🖼️ 菜單 ${menuNumber} 預覽網址：`,
            imageURL
        );

        preview.innerHTML = `

            <img
                src="${imageURL}"
                alt="菜單 ${menuNumber}"
                class="menu-preview-image"
            >

        `;

        return;
    }

    // ==================================================
    // 已經存在的圖片 URL
    // 例如編輯餐廳時使用
    // ==================================================

    if (
        typeof fileOrUrl === "string"
    ) {

        if (
            fileOrUrl.startsWith("C:\\fakepath\\") ||
            fileOrUrl.startsWith("file:///")
        ) {

            updateMenuPreview(menuNumber, "");

            return;
        }

        preview.innerHTML = `

            <img
                src="${fileOrUrl}"
                alt="菜單 ${menuNumber}"
                class="menu-preview-image"
            >

        `;

        return;
    }

}


function updateRestaurantImagePreview(
    fileOrUrl
) {

    if (!restaurantImagePreview) {
        return;
    }

    if (!fileOrUrl) {
        restaurantImagePreview.innerHTML = `

            <div class="menu-preview-empty">

                <span class="menu-upload-icon">
                    🏪
                </span>

                <p>
                    點擊上傳餐廳圖片
                </p>

            </div>

        `;

        return;
    }

    const imageUrl =
        fileOrUrl instanceof File
            ? URL.createObjectURL(fileOrUrl)
            : fileOrUrl;

    restaurantImagePreview.innerHTML = `

        <img
            src="${imageUrl}"
            alt="餐廳圖片預覽"
            class="menu-preview-image"
        >

    `;

}


function initializeRestaurantImageUpload() {

    if (!restaurantImageInput || !restaurantImagePreview) {
        return;
    }

    restaurantImageInput.style.display = "none";
    restaurantImagePreview.style.cursor = "pointer";

    restaurantImagePreview.addEventListener(
        "click",
        () => restaurantImageInput.click()
    );

    restaurantImageInput.addEventListener(
        "change",
        () => {

            const file =
                restaurantImageInput.files &&
                restaurantImageInput.files.length > 0
                    ? restaurantImageInput.files[0]
                    : null;

            if (!file) {
                return;
            }

            if (!file.type.startsWith("image/")) {
                alert("請選擇圖片檔案。");
                restaurantImageInput.value = "";
                return;
            }

            restaurantImageInput.dataset.imageRemoved = "false";
            updateRestaurantImagePreview(file);

        }
    );

    document
        .getElementById("restaurantImageRemove")
        .addEventListener(
            "click",
            event => {

                event.stopPropagation();
                restaurantImageInput.value = "";
                restaurantImageInput.dataset.imageRemoved = "true";
                updateRestaurantImagePreview("");

            }
        );

}



// ==================================================
// Clear Menu Image
// ==================================================

function clearMenuImage(
    menuNumber
) {

    const input =
        document.getElementById(
            `restaurantMenu${menuNumber}`
        );


    if (
        !input
    ) {

        return;

    }


    input.value =
        "";

    input.dataset.menuRemoved = "true";


    updateMenuPreview(
        menuNumber,
        ""
    );

}


// ==================================================
// Menu Remove Buttons
// ==================================================

function initializeMenuRemoveButtons() {

    const buttons =
        document.querySelectorAll(
            "[data-menu-remove]"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const number =
                        button.dataset.menuRemove;


                    clearMenuImage(
                        number
                    );

                }
            );

        }
    );

}


// ==================================================
// Menu Viewer
// ==================================================

function openMenuViewer(
    restaurant
) {

    const menuImages =
        (restaurant.menuImages || []).filter(Boolean);


    if (
        menuImages.length === 0
    ) {

        alert(
            "這間餐廳目前還沒有菜單圖片。"
        );

        return;

    }


    const menuOverlay =
        document.createElement(
            "div"
        );


    menuOverlay.className =
        "menu-viewer";


    menuOverlay.innerHTML = `

        <div class="menu-viewer-header">

            <div>

                <p class="eyebrow">
                    MENU
                </p>

                <h2>
                    ${restaurant.name}
                </h2>

            </div>


            <button
                class="menu-close"
            >
                ×
            </button>

        </div>


        <div class="menu-main-viewer">

            <button
                class="menu-nav menu-prev"
            >
                ‹
            </button>


            <div class="menu-image-stage">

                <img
                    class="menu-main-image"
                    src="${menuImages[0]}"
                    alt="${restaurant.name} 菜單 1"
                >

            </div>


            <button
                class="menu-nav menu-next"
            >
                ›
            </button>

        </div>


        <div class="menu-page-counter">

            <span class="current-page">
                1
            </span>

            <span>
                /
            </span>

            <span>
                ${menuImages.length}
            </span>

        </div>


        <div class="menu-thumbnails">

            ${menuImages.map(
                (image, index) => `

                <button
                    class="
                        menu-thumbnail
                        ${index === 0 ? "active" : ""}
                    "
                    data-index="${index}"
                >

                    <img
                        src="${image}"
                        alt="菜單第 ${index + 1} 頁"
                    >

                </button>

            `).join("")}

        </div>


        <p class="menu-hint">

            左右滑動切換菜單 · 點擊圖片放大

        </p>

    `;


    document.body.appendChild(
        menuOverlay
    );


    const mainImage =
        menuOverlay.querySelector(
            ".menu-main-image"
        );


    const prevButton =
        menuOverlay.querySelector(
            ".menu-prev"
        );


    const nextButton =
        menuOverlay.querySelector(
            ".menu-next"
        );


    const currentPage =
        menuOverlay.querySelector(
            ".current-page"
        );


    const thumbnails =
        menuOverlay.querySelectorAll(
            ".menu-thumbnail"
        );


    const imageStage =
        menuOverlay.querySelector(
            ".menu-image-stage"
        );


    let currentIndex =
        0;


    function updateMenu(
        index
    ) {

        if (
            index < 0 ||
            index >= menuImages.length
        ) {

            return;

        }


        currentIndex =
            index;


        mainImage.src =
            menuImages[currentIndex];


        mainImage.alt =
            `${restaurant.name} 菜單 ${currentIndex + 1}`;


        currentPage.textContent =
            currentIndex + 1;


        thumbnails.forEach(
            (
                thumbnail,
                thumbnailIndex
            ) => {

                thumbnail.classList.toggle(
                    "active",
                    thumbnailIndex ===
                        currentIndex
                );

            }
        );


        prevButton.disabled =
            currentIndex === 0;


        nextButton.disabled =
            currentIndex ===
                menuImages.length - 1;


        if (
            thumbnails[currentIndex]
        ) {

            thumbnails[
                currentIndex
            ].scrollIntoView({

                behavior:
                    "smooth",

                block:
                    "nearest",

                inline:
                    "center"

            });

        }

    }


    prevButton.addEventListener(
        "click",
        () => {

            updateMenu(
                currentIndex - 1
            );

        }
    );


    nextButton.addEventListener(
        "click",
        () => {

            updateMenu(
                currentIndex + 1
            );

        }
    );


    thumbnails.forEach(
        thumbnail => {

            thumbnail.addEventListener(
                "click",
                () => {

                    updateMenu(
                        Number(
                            thumbnail.dataset.index
                        )
                    );

                }
            );

        }
    );


    // ==================================================
    // Swipe
    // ==================================================

    let touchStartX =
        0;


    imageStage.addEventListener(
        "touchstart",
        event => {

            touchStartX =
                event.changedTouches[0]
                    .screenX;

        },
        {
            passive: true
        }
    );


    imageStage.addEventListener(
        "touchend",
        event => {

            const touchEndX =
                event.changedTouches[0]
                    .screenX;


            const distance =
                touchEndX -
                touchStartX;


            if (
                distance < -50
            ) {

                updateMenu(
                    currentIndex + 1
                );

            }


            if (
                distance > 50
            ) {

                updateMenu(
                    currentIndex - 1
                );

            }

        },
        {
            passive: true
        }
    );


    // ==================================================
    // Fullscreen
    // ==================================================

    mainImage.addEventListener(
        "click",
        () => {

            openFullscreenMenuImage(
                menuImages,
                currentIndex,
                restaurant.name
            );

        }
    );


    // ==================================================
    // Close
    // ==================================================

    menuOverlay
        .querySelector(
            ".menu-close"
        )
        .addEventListener(
            "click",
            () => {

                menuOverlay.remove();

            }
        );


    menuOverlay.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                menuOverlay
            ) {

                menuOverlay.remove();

            }

        }
    );


    // ==================================================
    // Keyboard
    // ==================================================

    function keyboardHandler(
        event
    ) {

        if (
            event.key ===
            "ArrowLeft"
        ) {

            updateMenu(
                currentIndex - 1
            );

        }


        if (
            event.key ===
            "ArrowRight"
        ) {

            updateMenu(
                currentIndex + 1
            );

        }


        if (
            event.key ===
            "Escape"
        ) {

            menuOverlay.remove();


            document.removeEventListener(
                "keydown",
                keyboardHandler
            );

        }

    }


    document.addEventListener(
        "keydown",
        keyboardHandler
    );


    updateMenu(0);

}


// ==================================================
// Fullscreen Menu Image
// Real Pinch Zoom + Pan + Double Tap
// ==================================================

function openFullscreenMenuImage(
    images,
    startIndex,
    restaurantName
) {

    let currentIndex =
        startIndex;


    let scale =
        1;


    let translateX =
        0;


    let translateY =
        0;


    const MIN_SCALE =
        1;


    const MAX_SCALE =
        4;


    let touches =
        [];


    let isPinching =
        false;


    let isDragging =
        false;


    let lastTouchX =
        0;


    let lastTouchY =
        0;


    let pinchStartDistance =
        0;


    let pinchStartScale =
        1;


    let pinchCenterX =
        0;


    let pinchCenterY =
        0;


    let lastTapTime =
        0;


    const fullscreen =
        document.createElement(
            "div"
        );


    fullscreen.className =
        "menu-fullscreen";


    fullscreen.innerHTML = `

        <button
            class="fullscreen-close"
            aria-label="關閉"
        >
            ×
        </button>


        <button
            class="fullscreen-prev"
            aria-label="上一張"
        >
            ‹
        </button>


        <div class="fullscreen-image-wrapper">

            <img
                class="fullscreen-image"
                src="${images[currentIndex]}"
                alt="${restaurantName} 菜單"
            >

        </div>


        <button
            class="fullscreen-next"
            aria-label="下一張"
        >
            ›
        </button>


        <div class="fullscreen-counter">

            ${currentIndex + 1}
            /
            ${images.length}

        </div>





        <div class="zoom-indicator">

            100%

        </div>

    `;


    document.body.appendChild(
        fullscreen
    );


    const image =
        fullscreen.querySelector(
            ".fullscreen-image"
        );


    const imageWrapper =
        fullscreen.querySelector(
            ".fullscreen-image-wrapper"
        );


    const prev =
        fullscreen.querySelector(
            ".fullscreen-prev"
        );


    const next =
        fullscreen.querySelector(
            ".fullscreen-next"
        );


    const counter =
        fullscreen.querySelector(
            ".fullscreen-counter"
        );


    const zoomIndicator =
        fullscreen.querySelector(
            ".zoom-indicator"
        );


    function applyTransform(
        animate = false
    ) {

        image.style.transition =
            animate
                ? "transform 0.25s ease"
                : "none";


        image.style.transform = `
            translate(
                calc(-50% + ${translateX}px),
                calc(-50% + ${translateY}px)
            )
            scale(${scale})
        `;

    }


    let zoomIndicatorTimer;


    function showZoomIndicator() {

        zoomIndicator.textContent =
            `${Math.round(scale * 100)}%`;


        zoomIndicator.classList.add(
            "show"
        );


        clearTimeout(
            zoomIndicatorTimer
        );


        zoomIndicatorTimer =
            setTimeout(
                () => {

                    zoomIndicator.classList.remove(
                        "show"
                    );

                },
                900
            );

    }


    function resetZoom(
        animate = true
    ) {

        scale =
            1;


        translateX =
            0;


        translateY =
            0;


        applyTransform(
            animate
        );


        updateNavigation();

    }


    function clampPosition() {

        if (
            scale <= 1
        ) {

            translateX =
                0;

            translateY =
                0;

            return;

        }


        const wrapperWidth =
            imageWrapper.clientWidth;


        const wrapperHeight =
            imageWrapper.clientHeight;


        const imageWidth =
            image.offsetWidth *
            scale;


        const imageHeight =
            image.offsetHeight *
            scale;


        const maxX =
            Math.max(
                0,
                (
                    imageWidth -
                    wrapperWidth
                ) / 2
            );


        const maxY =
            Math.max(
                0,
                (
                    imageHeight -
                    wrapperHeight
                ) / 2
            );


        translateX =
            Math.max(
                -maxX,
                Math.min(
                    maxX,
                    translateX
                )
            );


        translateY =
            Math.max(
                -maxY,
                Math.min(
                    maxY,
                    translateY
                )
            );

    }


    function setZoom(
        newScale,
        centerX =
            imageWrapper.clientWidth / 2,
        centerY =
            imageWrapper.clientHeight / 2
    ) {

        const oldScale =
            scale;


        newScale =
            Math.max(
                MIN_SCALE,
                Math.min(
                    MAX_SCALE,
                    newScale
                )
            );


        if (
            newScale ===
            oldScale
        ) {

            return;

        }


        const wrapperRect =
            imageWrapper.getBoundingClientRect();


        const pointX =
            centerX -
            wrapperRect.width / 2;


        const pointY =
            centerY -
            wrapperRect.height / 2;


        const scaleRatio =
            newScale /
            oldScale;


        translateX =
            pointX -
            (
                pointX -
                translateX
            ) *
            scaleRatio;


        translateY =
            pointY -
            (
                pointY -
                translateY
            ) *
            scaleRatio;


        scale =
            newScale;


        clampPosition();

        applyTransform();

        showZoomIndicator();

    }


    function updateNavigation() {

        prev.disabled =
            currentIndex === 0 ||
            scale > 1;


        next.disabled =
            currentIndex ===
                images.length - 1 ||
            scale > 1;

    }


    function updateFullscreen(
        index
    ) {

        if (
            index < 0 ||
            index >= images.length
        ) {

            return;

        }


        currentIndex =
            index;


        resetZoom(
            false
        );


        image.src =
            images[currentIndex];


        image.alt =
            `${restaurantName} 菜單 ${currentIndex + 1}`;


        counter.textContent =
            `${currentIndex + 1} / ${images.length}`;


        updateNavigation();

    }


    prev.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            if (
                scale > 1
            ) {

                return;

            }


            updateFullscreen(
                currentIndex - 1
            );

        }
    );


    next.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            if (
                scale > 1
            ) {

                return;

            }


            updateFullscreen(
                currentIndex + 1
            );

        }
    );


    fullscreen
        .querySelector(
            ".fullscreen-close"
        )
        .addEventListener(
            "click",
            () => {

                fullscreen.remove();

            }
        );


    fullscreen.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                fullscreen
            ) {

                fullscreen.remove();

            }

        }
    );


    // ==================================================
    // Touch Start
    // ==================================================

    imageWrapper.addEventListener(
        "touchstart",
        event => {

            touches =
                Array.from(
                    event.touches
                );


            if (
                touches.length === 2
            ) {

                isPinching =
                    true;


                isDragging =
                    false;


                pinchStartDistance =
                    getDistance(
                        touches[0],
                        touches[1]
                    );


                pinchStartScale =
                    scale;


                const center =
                    getTouchCenter(
                        touches[0],
                        touches[1]
                    );


                pinchCenterX =
                    center.x;


                pinchCenterY =
                    center.y;


                event.preventDefault();


                return;

            }


            if (
                touches.length === 1
            ) {

                isDragging =
                    true;


                isPinching =
                    false;


                lastTouchX =
                    touches[0].clientX;


                lastTouchY =
                    touches[0].clientY;

            }

        },
        {
            passive: false
        }
    );


    // ==================================================
    // Touch Move
    // ==================================================

    imageWrapper.addEventListener(
        "touchmove",
        event => {

            touches =
                Array.from(
                    event.touches
                );


            if (
                touches.length === 2 &&
                isPinching
            ) {

                event.preventDefault();


                const currentDistance =
                    getDistance(
                        touches[0],
                        touches[1]
                    );


                const distanceRatio =
                    currentDistance /
                    pinchStartDistance;


                scale =
                    Math.max(
                        MIN_SCALE,
                        Math.min(
                            MAX_SCALE,
                            pinchStartScale *
                            distanceRatio
                        )
                    );


                const center =
                    getTouchCenter(
                        touches[0],
                        touches[1]
                    );


                const wrapperRect =
                    imageWrapper.getBoundingClientRect();


                const centerX =
                    center.x -
                    wrapperRect.left;


                const centerY =
                    center.y -
                    wrapperRect.top;


                const pointX =
                    centerX -
                    wrapperRect.width / 2;


                const pointY =
                    centerY -
                    wrapperRect.height / 2;


                const ratio =
                    scale /
                    pinchStartScale;


                translateX =
                    pointX -
                    (
                        pointX -
                        translateX
                    ) *
                    ratio;


                translateY =
                    pointY -
                    (
                        pointY -
                        translateY
                    ) *
                    ratio;


                clampPosition();

                applyTransform();

                showZoomIndicator();


                return;

            }


            if (
                touches.length === 1 &&
                isDragging &&
                scale > 1
            ) {

                event.preventDefault();


                const currentX =
                    touches[0].clientX;


                const currentY =
                    touches[0].clientY;


                translateX +=
                    currentX -
                    lastTouchX;


                translateY +=
                    currentY -
                    lastTouchY;


                lastTouchX =
                    currentX;


                lastTouchY =
                    currentY;


                clampPosition();

                applyTransform();

            }

        },
        {
            passive: false
        }
    );


    // ==================================================
    // Touch End
    // ==================================================

    imageWrapper.addEventListener(
        "touchend",
        event => {

            touches =
                Array.from(
                    event.touches
                );


            if (
                isPinching &&
                touches.length < 2
            ) {

                isPinching =
                    false;


                if (
                    scale < 1.05
                ) {

                    resetZoom();

                }

                else {

                    clampPosition();

                    applyTransform(
                        true
                    );

                }

            }


            if (
                touches.length === 0
            ) {

                isDragging =
                    false;

            }

        },
        {
            passive: true
        }
    );


    // ==================================================
    // Touch Cancel
    // ==================================================

    imageWrapper.addEventListener(
        "touchcancel",
        () => {

            touches =
                [];


            isPinching =
                false;


            isDragging =
                false;

        },
        {
            passive: true
        }
    );


    // ==================================================
    // Double Tap
    // ==================================================

    imageWrapper.addEventListener(
        "touchend",
        event => {

            if (
                event.changedTouches.length !== 1
            ) {

                return;

            }


            const now =
                Date.now();


            const timeSinceLastTap =
                now -
                lastTapTime;


            lastTapTime =
                now;


            if (
                timeSinceLastTap < 300
            ) {

                event.preventDefault();


                if (
                    scale > 1
                ) {

                    resetZoom();

                }

                else {

                    const touch =
                        event.changedTouches[0];


                    const rect =
                        imageWrapper.getBoundingClientRect();


                    const x =
                        touch.clientX -
                        rect.left;


                    const y =
                        touch.clientY -
                        rect.top;


                    scale =
                        2;


                    translateX =
                        -(
                            x -
                            rect.width / 2
                        );


                    translateY =
                        -(
                            y -
                            rect.height / 2
                        );


                    clampPosition();

                    applyTransform(
                        true
                    );

                    showZoomIndicator();

                }

            }

        },
        {
            passive: false
        }
    );


    // ==================================================
    // Mouse Wheel
    // ==================================================

    imageWrapper.addEventListener(
        "wheel",
        event => {

            event.preventDefault();


            const rect =
                imageWrapper.getBoundingClientRect();


            const x =
                event.clientX -
                rect.left;


            const y =
                event.clientY -
                rect.top;


            const zoomAmount =
                event.deltaY < 0
                    ? 1.15
                    : 0.87;


            setZoom(
                scale *
                zoomAmount,
                x,
                y
            );

        },
        {
            passive: false
        }
    );


    // ==================================================
    // Keyboard
    // ==================================================

    function keyboardHandler(
        event
    ) {

        if (
            event.key ===
            "Escape"
        ) {

            fullscreen.remove();


            document.removeEventListener(
                "keydown",
                keyboardHandler
            );


            return;

        }


        if (
            event.key ===
            "ArrowLeft"
        ) {

            if (
                scale <= 1
            ) {

                updateFullscreen(
                    currentIndex - 1
                );

            }

        }


        if (
            event.key ===
            "ArrowRight"
        ) {

            if (
                scale <= 1
            ) {

                updateFullscreen(
                    currentIndex + 1
                );

            }

        }


        if (
            event.key === "+" ||
            event.key === "="
        ) {

            setZoom(
                scale + 0.25
            );

        }


        if (
            event.key === "-"
        ) {

            setZoom(
                scale - 0.25
            );

        }


        if (
            event.key === "0"
        ) {

            resetZoom();

        }

    }


    document.addEventListener(
        "keydown",
        keyboardHandler
    );


    image.addEventListener(
        "load",
        () => {

            resetZoom(
                false
            );

        }
    );


    function getDistance(
        touch1,
        touch2
    ) {

        const dx =
            touch1.clientX -
            touch2.clientX;


        const dy =
            touch1.clientY -
            touch2.clientY;


        return Math.sqrt(
            dx * dx +
            dy * dy
        );

    }


    function getTouchCenter(
        touch1,
        touch2
    ) {

        return {

            x:
                (
                    touch1.clientX +
                    touch2.clientX
                ) / 2,

            y:
                (
                    touch1.clientY +
                    touch2.clientY
                ) / 2

        };

    }


    updateFullscreen(
        currentIndex
    );

}


// ==================================================
// Initialize Menu Features
// ==================================================

initializeAuthSystem();

initializeTheme();
initializeDisplaySettings();
initializeGroupSwitching();
initializeRestaurantImageUpload();
initializeWeeklyHours();
initializeMenuPreview();
initializeRandomPicker();
initializeMenuRemoveButtons();

// ==================================================
// Random Picker
// ==================================================

function initializeRandomPicker() {

    const randomPickerButton =
        document.getElementById("randomPickerButton");

    if (!randomPickerButton) {
        return;
    }

    randomPickerButton.addEventListener("click", () => {

        const availableRestaurants =
            getGroupFilteredRestaurants(restaurants);

        if (availableRestaurants.length === 0) {
            showToast("目前群組沒有餐廳可以抽籤", "info");
            return;
        }

        const randomIndex =
            Math.floor(
                Math.random() * availableRestaurants.length
            );

      const selectedRestaurant =
    availableRestaurants[randomIndex];

console.log(
    "🎲 隨機抽中的餐廳：",
    selectedRestaurant
);

randomPickerResultId = String(selectedRestaurant.id);
renderRestaurants();
randomPickerResultId = null;

showToast(
    `🎲 今天吃「${selectedRestaurant.name}」！`,
    "success"
);

const selectedCard =
    restaurantList.querySelector(
        `[data-id="${CSS.escape(String(selectedRestaurant.id))}"]`
    );

selectedCard?.scrollIntoView({
    behavior: "smooth",
    block: "center"
});

setTimeout(() => {

    if (!selectedCard) {
        return;
    }

    const winnerBadge =
        document.createElement("div");

    winnerBadge.className =
        "random-picker-winner-badge";

winnerBadge.textContent =
    `今天吃 ${selectedRestaurant.name}`;

    selectedCard.appendChild(
        winnerBadge
    );

    setTimeout(() => {

        selectedCard.classList.remove(
            "random-picker-selected"
        );

        winnerBadge.remove();

    }, 3000);

}, 300);

    });

}

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {
            navigator.serviceWorker.register(
                "./service-worker.js",
                {
                    scope: "./"
                }
            ).catch(
                error => console.error(
                    "❌ Service Worker 註冊失敗：",
                    error
                )
            );
        }
    );

}

// ==================================================
// Supabase Connection Test
// ==================================================

async function testSupabaseConnection() {

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("restaurants")
                .select("id")
                .limit(1);


        if (
            error
        ) {

            console.error(
                "❌ Supabase 連線 / 查詢失敗：",
                error
            );


            supabaseConnected =
                false;


            return false;

        }


        console.log(
            "✅ Supabase 連線成功！",
            data
        );


        supabaseConnected =
            true;


        return true;

    }

    catch (
        error
    ) {

        console.error(
            "❌ Supabase Failed to Fetch：",
            error
        );


        supabaseConnected =
            false;


        return false;

    }

}

testSupabaseConnection();


// ==================================================
// Load Restaurants From Supabase
// ==================================================

async function loadRestaurants() {

    console.log("☁️ 正在從 Supabase 讀取餐廳資料...");

    const {
        data,
        error
    } = await supabaseClient
        .from("restaurants")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    // ==================================================
    // Supabase 讀取失敗
    // ==================================================

    if (error) {

        console.error(
            "❌ Supabase 讀取餐廳失敗：",
            error
        );

        loadRestaurantsFromLocal();

        return;

    }


    console.log(
        "✅ Supabase 原始資料：",
        data
    );


    // ==================================================
    // 將 Supabase 資料轉換成網站使用的格式
    // ==================================================

    restaurants =
        (data || []).map(
            restaurant => ({

                // ------------------------------------------
                // 基本資料
                // ------------------------------------------

                id:
                    restaurant.id,

                name:
                    restaurant.name || "",

                category:
                    restaurant.category || "",


                // ------------------------------------------
                // ⭐ 評分
                // ------------------------------------------

                rating:
                    restaurant.rating !== null &&
                    restaurant.rating !== undefined
                        ? Number(
                            restaurant.rating
                        )
                        : null,


                // ------------------------------------------
                // 🖼️ 餐廳圖片
                // ------------------------------------------

                image:
                    restaurant.restaurant_image_url || "",


                // ------------------------------------------
                // ☎️ 電話
                // ------------------------------------------

                phone:
                    restaurant.phone || "",


                // ------------------------------------------
                // 📍 地址
                // ------------------------------------------

                address:
                    restaurant.address || "",


                // ------------------------------------------
                // 🕐 營業時間
                // ------------------------------------------

                hours:
                    normalizeWeeklyHours(restaurant.opening_hours),


                // ------------------------------------------
                // 🗺️ Google Maps
                // ------------------------------------------

                maps:
                    restaurant.google_maps_url || "",


                // ------------------------------------------
                // 📖 菜單圖片
                // ------------------------------------------

                menuImages:
                    Array.isArray(
                        restaurant.menu_images
                    )
                        ? restaurant.menu_images.filter(Boolean)
                        : [],


                // ------------------------------------------
                // 📝 備註
                // ------------------------------------------

                description:
                    restaurant.notes || "",


                // ------------------------------------------
                // ❤️ 收藏
                // ------------------------------------------

                favorite:
                    restaurant.favorite === true,


                // ------------------------------------------
                // 📍 群組（地區）
                // ------------------------------------------

                groupId:
                    restaurant.group_id
                        ? String(restaurant.group_id)
                        : null

            })
        );


    console.log(
        "✅ 轉換後的網站餐廳資料：",
        restaurants
    );


    // ==================================================
    // 舊資料沒有 groupId 時，自動歸入「未分類」
    // ==================================================

    assignMissingGroupIds();
    cleanDisplayOrder();


    // ==================================================
    // 更新畫面
    // ==================================================

    renderRestaurants();
randomPickerResultId = null;

}

function initializeDisplaySettings() {
    const closeButton = document.getElementById("closeDisplaySettings");
    const editOrderButton = document.getElementById("editOrderButton");
    const authSettingsButton = document.getElementById("authSettingsButton");

    const openDisplaySettingsModal = () => {
        displaySettingsModal.classList.add("show");
        updateDisplaySettingsControls();
        closeAuthAccountMenu();
    };

    if (displaySettingsButton) {
        displaySettingsButton.addEventListener("click", () => {
            openDisplaySettingsModal();
        });
    }

    if (authSettingsButton) {
        authSettingsButton.addEventListener("click", (e) => {
            e.stopPropagation();
            openDisplaySettingsModal();
        });
    }

    closeButton.addEventListener("click", () => {
        displaySettingsModal.classList.remove("show");
    });

    displaySettingsModal.addEventListener("click", event => {
        if (event.target === displaySettingsModal) {
            displaySettingsModal.classList.remove("show");
        }
    });

    document.querySelectorAll("#fontSizeOptions button").forEach(button => {
        button.addEventListener("click", () => {
            displaySettings.fontSize = button.dataset.fontSize;
            saveDisplaySettings();
            applyDisplaySettings();
            updateDisplaySettingsControls();
        });
    });

    document.querySelectorAll("#viewModeOptions button").forEach(button => {
        button.addEventListener("click", () => {
            displaySettings.viewMode = button.dataset.viewMode;
            saveDisplaySettings();
            renderRestaurants();
randomPickerResultId = null;
            updateDisplaySettingsControls();
        });
    });

    document.querySelectorAll("#themeOptions button").forEach(button => {
        button.addEventListener("click", () => {
            const theme = button.dataset.themeMode;

            localStorage.setItem("theme", theme);
            applyTheme(theme);
            updateDisplaySettingsControls();
        });
    });

    editOrderButton.addEventListener("click", () => {
        displaySettingsModal.classList.remove("show");
        renderOrderEditor();
        orderSettingsModal.classList.add("show");
    });

    document.getElementById("finishOrderButton").addEventListener("click", () => {
        const orderList = document.getElementById("orderList");

        displaySettings.customOrder[currentGroupId] = [...orderList.querySelectorAll("[data-order-id]")]
            .map(item => item.dataset.orderId);
        saveDisplaySettings();
        orderSettingsModal.classList.remove("show");
        renderRestaurants();
randomPickerResultId = null;
    });

    updateDisplaySettingsControls();
}

function updateDisplaySettingsControls() {
    document.querySelectorAll("#fontSizeOptions button").forEach(button => {
        button.classList.toggle("active", button.dataset.fontSize === displaySettings.fontSize);
    });

    document.querySelectorAll("#viewModeOptions button").forEach(button => {
        button.classList.toggle("active", button.dataset.viewMode === displaySettings.viewMode);
    });

    document.querySelectorAll("#themeOptions button").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.themeMode === (localStorage.getItem("theme") || "system")
        );
    });
}


// ==================================================
// 群組切換 / 新增群組 / 修改群組名稱
// ==================================================

function initializeGroupSwitching() {
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

    if (!groupSwitchButton || !groupSheetModal || !groupFormModal || !groupForm) {
        return;
    }

    function closeGroupFormModalHandler() {
        groupFormModal.classList.remove("show");
        groupForm.reset();
        delete groupForm.dataset.editingGroupId;
        if (groupVisibilitySelect) groupVisibilitySelect.value = "private";
    }

    // --------------------------------------------------
    // 開啟 / 關閉「選擇地區」Bottom Sheet
    // --------------------------------------------------

    groupSwitchButton.addEventListener("click", () => {
        renderGroupList();
        groupSheetModal.classList.add("show");
    });

    closeGroupSheet?.addEventListener("click", () => {
        groupSheetModal.classList.remove("show");
    });

    groupSheetModal.addEventListener("click", event => {
        if (event.target === groupSheetModal) {
            groupSheetModal.classList.remove("show");
        }
    });

    // --------------------------------------------------
    // 開啟「新增群組」Modal
    // --------------------------------------------------

    addGroupButton?.addEventListener("click", () => {
        delete groupForm.dataset.editingGroupId;
        groupFormTitle.textContent = "新增群組";
        submitGroupFormButton.textContent = "建立";
        groupNameInput.value = "";
        if (groupVisibilitySelect) groupVisibilitySelect.value = "private";
        groupSheetModal.classList.remove("show");
        groupFormModal.classList.add("show");
        groupNameInput.focus();
    });

    closeGroupFormModal?.addEventListener("click", closeGroupFormModalHandler);
    cancelGroupFormButton?.addEventListener("click", closeGroupFormModalHandler);

    groupFormModal.addEventListener("click", event => {
        if (event.target === groupFormModal) {
            closeGroupFormModalHandler();
        }
    });

    // --------------------------------------------------
    // 送出「新增群組 / 修改群組名稱」表單
    // --------------------------------------------------

    groupForm.addEventListener("submit", event => {
        event.preventDefault();

        const name = groupNameInput.value.trim();
        const visibility = groupVisibilitySelect ? groupVisibilitySelect.value : "private";

        if (!name) {
            return;
        }

        const editingGroupId = groupForm.dataset.editingGroupId;

        if (editingGroupId) {

            // 修改群組名稱與隱私設定（id 保持不變）
            const group = restaurantGroups.find(candidate => candidate.id === editingGroupId);

            if (group) {
                if (group.name === UNCATEGORIZED_GROUP_NAME) {
                    alert("「未分類」群組不能修改。");
                    closeGroupFormModalHandler();
                    return;
                }
                group.name = name;
                group.visibility = visibility;
                saveGroupsLocal();
                updateGroupInSupabase(editingGroupId, name, visibility);
            }

            showToast("✅ 群組設定已更新", "success");

        }
        else {

            // 新增群組並自動切換過去
            const groupUuid = generateUuid();
            const newGroup = {
                id: groupUuid,
                name,
                visibility,
                user_id: currentUser?.id || null,
                created_at: new Date().toISOString()
            };

            restaurantGroups.push(newGroup);
            currentGroupId = groupUuid;
            saveGroupsLocal();

            if (currentUser) {
                createGroupInSupabase(newGroup).then(supabaseId => {
                    if (supabaseId) {
                        const targetGroup = restaurantGroups.find(g => g.id === groupUuid);
                        if (targetGroup) {
                            targetGroup.id = supabaseId;
                        }
                        if (currentGroupId === groupUuid) {
                            currentGroupId = supabaseId;
                        }
                        // 同時更新該群組底下餐廳的 groupId
                        restaurants.forEach(r => {
                            if (r.groupId === groupUuid) {
                                r.groupId = supabaseId;
                            }
                        });
                        saveGroupsLocal();
                        saveRestaurantsLocal();
                        updateGroupSwitchButton();
                        renderRestaurants();
                    }
                });
            }

            showToast(`✅ 已建立並切換到「${name}」`, "success");

        }

        closeGroupFormModalHandler();
        updateGroupSwitchButton();
        renderRestaurants();
        randomPickerResultId = null;

    });

}

function renderGroupList() {
    const groupList = document.getElementById("groupList");

    if (!groupList) {
        return;
    }

    // 分類群組：
    // 「我的群組」＝ group.user_id === currentUser.id，包含自己的 public / private 群組（若 currentUser 為空，則本地建立的未指定 user_id 且非別人的群組也歸類在內）
    // 「公開群組」＝其他使用者的 visibility === 'public'，且自己的公開群組不要重複出現在「公開群組」

    const myGroups = restaurantGroups.filter(group => {
        if (group.name === UNCATEGORIZED_GROUP_NAME) return true;
        if (!currentUser) return !group.user_id || group.user_id === "local";
        return group.user_id === currentUser.id;
    });

    const publicGroups = restaurantGroups.filter(group => {
        if (group.name === UNCATEGORIZED_GROUP_NAME) return false;
        const isPublic = group.visibility === "public";
        const isMine = currentUser ? (group.user_id === currentUser.id) : (!group.user_id || group.user_id === "local");
        return isPublic && !isMine;
    });

    let htmlOutput = "";

    // 渲染「我的群組」
    if (myGroups.length > 0) {
        htmlOutput += `<div class="group-section-title" style="font-size: 11px; font-weight: 700; color: var(--muted, #888); padding: 8px 12px 4px; letter-spacing: 0.5px; text-transform: uppercase;">我的群組</div>`;
        htmlOutput += myGroups.map(group => renderSingleGroupItem(group)).join("");
    }

    // 渲染「公開群組」
    if (publicGroups.length > 0) {
        htmlOutput += `<div class="group-section-title" style="font-size: 11px; font-weight: 700; color: var(--muted, #888); padding: 16px 12px 4px; letter-spacing: 0.5px; text-transform: uppercase;">公開群組</div>`;
        htmlOutput += publicGroups.map(group => renderSingleGroupItem(group, true)).join("");
    }

    groupList.innerHTML = htmlOutput;


    // ==================================================
    // 切換群組
    // ==================================================

    groupList
        .querySelectorAll("[data-select-group-id]")
        .forEach(button => {

            button.addEventListener("click", () => {

                switchGroup(
                    button.dataset.selectGroupId
                );

            });

        });


    // ==================================================
    // 修改群組名稱
    // ==================================================

    groupList
        .querySelectorAll("[data-rename-group-id]")
        .forEach(button => {

            button.addEventListener("click", () => {

                openRenameGroupModal(
                    button.dataset.renameGroupId
                );

            });

        });


    // ==================================================
    // 刪除群組
    // ==================================================

    groupList
        .querySelectorAll("[data-delete-group-id]")
        .forEach(button => {

            button.addEventListener("click", () => {

                deleteGroup(
                    button.dataset.deleteGroupId
                );

            });

        });

}

function renderSingleGroupItem(group, isOthersPublic = false) {
    const isUncategorized = group.name === UNCATEGORIZED_GROUP_NAME;
    const isOwner = currentUser ? (group.user_id === currentUser.id) : (!group.user_id || group.user_id === "local");
    const isReadonly = isOthersPublic;
    const canEdit = !isUncategorized && isOwner && !isOthersPublic;

    // 狀態標籤
    const badges = [];
    if (group.visibility === "public") {
        badges.push(`<span style="font-size: 10px; background: rgba(0,128,0,0.1); color: green; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">🌐 公開</span>`);
    } else {
        badges.push(`<span style="font-size: 10px; background: rgba(128,128,128,0.1); color: gray; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">🔒 私人</span>`);
    }

    if (isReadonly) {
        badges.push(`<span style="font-size: 10px; background: rgba(0,122,255,0.1); color: #007aff; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">👁️ 唯讀</span>`);
    }

    return `
        <div
            class="group-list-item ${group.id === currentGroupId ? "active" : ""}"
            data-group-id="${escapeHtml(group.id)}"
        >

            <span class="group-list-check">
                ${group.id === currentGroupId ? "✓" : ""}
            </span>

            <button
                type="button"
                class="group-list-name"
                data-select-group-id="${escapeHtml(group.id)}"
            >
                ${escapeHtml(group.name)} ${!isUncategorized ? badges.join("") : ""}
            </button>


            ${
                canEdit
                    ? `
                        <button
                            type="button"
                            class="group-rename-button"
                            data-rename-group-id="${escapeHtml(group.id)}"
                            aria-label="修改群組名稱與設定"
                            title="修改群組名稱與設定"
                        >
                            ✎
                        </button>
                        <button
                            type="button"
                            class="group-delete-button"
                            data-delete-group-id="${escapeHtml(group.id)}"
                            aria-label="刪除群組"
                            title="刪除群組"
                        >
                            🗑️
                        </button>
                    `
                    : ""
            }

        </div>
    `;
}
function switchGroup(groupId) {
    // 檢查是否可以切換到此群組（檢查公開/私人邏輯）
    const targetGroup = restaurantGroups.find(g => g.id === groupId);
    
    // 如果群組存在且是私人的，且不是目前使用者擁有的，則顯示唯讀提示 (在後續實作中透過 UI 顯示，此處僅處理切換行為)
    // 這裡我們允許切換以進入唯讀模式
    
    const groupSheetModal = document.getElementById("groupSheetModal");

    if (!groupId || groupId === currentGroupId) {
        groupSheetModal?.classList.remove("show");
        return;
    }

    currentGroupId = groupId;
    saveGroupsLocal();

    groupSheetModal?.classList.remove("show");

    // ==================================================
    // 切換群組後清除搜尋，並回到「全部」分類，
    // 確保畫面只顯示該群組的餐廳。
    // ==================================================

    searchInput.value = "";
    clearSearchButton.hidden = true;

    document.querySelectorAll(".category").forEach(button => {
        button.classList.toggle("active", button.dataset.category === "全部");
    });

    updateGroupSwitchButton();
    renderRestaurants();
    randomPickerResultId = null;
}

function openRenameGroupModal(groupId) {
    const group = restaurantGroups.find(candidate => candidate.id === groupId);

    if (!group) {
        return;
    }

    const groupForm = document.getElementById("groupForm");
    const groupNameInput = document.getElementById("groupNameInput");
    const groupFormTitle = document.getElementById("groupFormTitle");
    const submitGroupFormButton = document.getElementById("submitGroupFormButton");
    const groupSheetModal = document.getElementById("groupSheetModal");
    const groupFormModal = document.getElementById("groupFormModal");

    groupForm.dataset.editingGroupId = groupId;
    groupFormTitle.textContent = "修改群組名稱";
    submitGroupFormButton.textContent = "儲存";
    groupNameInput.value = group.name;

    groupSheetModal?.classList.remove("show");
    groupFormModal?.classList.add("show");
    groupNameInput.focus();
}


// ==================================================
// 刪除群組
// ==================================================
// 安全規則：
// 1. 「未分類」不可刪除
// 2. 群組內的餐廳不刪除
// 3. 群組內餐廳全部移到「未分類」
// 4. 如果刪除的是目前群組，自動切換到「未分類」
// 5. LocalStorage 與 Supabase 都同步
// ==================================================

async function deleteGroup(groupId) {
    if (!canEditCurrentGroup()) {
        showToast("唯讀模式，無法刪除群組");
        return;
    }

    const group =
        restaurantGroups.find(
            candidate =>
                String(candidate.id) === String(groupId)
        );

    // --------------------------------------------------
    // 找不到群組
    // --------------------------------------------------

    if (!group) {

        alert("找不到要刪除的群組。");

        return;
    }


    // --------------------------------------------------
    // 「未分類」禁止刪除
    // --------------------------------------------------

    if (
        group.name === UNCATEGORIZED_GROUP_NAME
    ) {

        alert("「未分類」群組不能刪除。");

        return;
    }


    // --------------------------------------------------
    // 確認刪除
    // --------------------------------------------------

    const restaurantCount =
        restaurants.filter(
            restaurant =>
                String(restaurant.groupId) ===
                String(groupId)
        ).length;


    const message =
        restaurantCount > 0
            ? `確定要刪除「${group.name}」嗎？\n\n此群組中的 ${restaurantCount} 間餐廳不會被刪除，而是會全部移到「未分類」。`
            : `確定要刪除「${group.name}」嗎？`;


    const confirmed =
        confirm(message);


    if (!confirmed) {
        return;
    }


    // ==================================================
    // 找到「未分類」群組
    // ==================================================

    const uncategorizedGroupId =
        getUncategorizedGroupId();


    // ==================================================
    // 把群組內餐廳移到「未分類」
    // ==================================================

    const restaurantsToMove =
        restaurants.filter(
            restaurant =>
                String(restaurant.groupId) ===
                String(groupId)
        );


    for (
        const restaurant
        of restaurantsToMove
    ) {

        restaurant.groupId =
            uncategorizedGroupId;

        // ----------------------------------------------
        // Supabase 更新餐廳群組
        // ----------------------------------------------

        if (
            supabaseConnected
        ) {

            try {

                const payload =
                    mapRestaurantToSupabase(
                        restaurant
                    );


                const {
                    error
                } =
                    await supabaseClient
                        .from("restaurants")
                        .update({
                            group_id:
                                uncategorizedGroupId
                        })
                        .eq(
                            "id",
                            restaurant.id
                        );


                if (error) {

                    console.error(
                        "❌ 餐廳移動到未分類失敗：",
                        error
                    );

                    alert(
                        `「${restaurant.name}」移動到未分類失敗，群組未刪除。`
                    );

                    return;
                }

            }
            catch (error) {

                console.error(
                    "❌ 餐廳群組更新錯誤：",
                    error
                );

                alert(
                    `「${restaurant.name}」移動到未分類失敗，群組未刪除。`
                );

                return;
            }

        }

    }


    // ==================================================
    // Supabase：刪除群組
    // ==================================================

    if (
        supabaseConnected
    ) {
        // [修正] 在執行 CUD 操作前，強制確認當前 Session 是否有效，避免因過期導致變為 anon
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError || !session || !currentUser || session.user.id !== currentUser.id) {
            console.error("❌ 群組刪除失敗：Session 無效或不匹配", { sessionError, hasSession: !!session, hasUser: !!currentUser });
            alert("目前登入狀態已過期，請重新登入後再嘗試刪除。");
            return;
        }

        try {

            const {
                error
            } =
                await supabaseClient
                    .from("restaurant_groups")
                    .delete()
                    .eq(
                        "id",
                        groupId
                    );


            if (error) {

                console.error(
                    "❌ Supabase 群組刪除失敗：",
                    error
                );

                alert(
                    "❌ 群組刪除失敗，請檢查網路連線。"
                );

                return;
            }

        }
        catch (error) {

            console.error(
                "❌ 群組刪除錯誤：",
                error
            );

            alert(
                "❌ 群組刪除失敗。"
            );

            return;
        }

    }


    // ==================================================
    // 從本機 restaurantGroups 移除
    // ==================================================

    restaurantGroups =
        restaurantGroups.filter(
            candidate =>
                String(candidate.id) !==
                String(groupId)
        );


    // ==================================================
    // 如果刪除的是目前群組
    // 自動切換到「未分類」
    // ==================================================

    if (
        String(currentGroupId) ===
        String(groupId)
    ) {

        currentGroupId =
            uncategorizedGroupId;

    }


    // ==================================================
    // 清理已刪除群組的 customOrder
    // ==================================================

    if (
        displaySettings.customOrder &&
        typeof displaySettings.customOrder === "object"
    ) {

        delete displaySettings.customOrder[groupId];

        saveDisplaySettings();

    }


    // ==================================================
    // 儲存群組狀態
    // ==================================================

    saveGroupsLocal();


    // ==================================================
    // 儲存餐廳
    // ==================================================

    saveRestaurantsLocal();


    // ==================================================
    // 更新 UI
    // ==================================================

    updateGroupSwitchButton();

    renderGroupList();

    renderRestaurants();
randomPickerResultId = null;


    showToast(
        `✅ 「${group.name}」已刪除，餐廳已移至「未分類」。`,
        "success"
    );

}

function renderOrderEditor() {
    const orderList = document.getElementById("orderList");
    const orderedRestaurants = getOrderedRestaurants(getGroupFilteredRestaurants(restaurants));

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

function renderEmptyState(restaurantData) {
    const keyword = searchInput.value.trim();
    const activeCategory =
        document.querySelector(".category.active")?.dataset.category;
    const isSearchEmpty = keyword.length > 0;
    const isFavoriteEmpty = activeCategory === "收藏";
    const icon = isSearchEmpty ? "🔍" : isFavoriteEmpty ? "♡" : "🏪";
    const title = isSearchEmpty
        ? "找不到店家"
        : isFavoriteEmpty
            ? "還沒有收藏"
            : "還沒有店家";
    const description = isSearchEmpty
        ? `沒有符合「${escapeHtml(keyword)}」的結果`
        : isFavoriteEmpty
            ? "點擊店家上的愛心，收藏喜歡的店家"
            : "新增你常去的店家，開始建立自己的店家清單";

    restaurantList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <h2>${title}</h2>
            <p>${description}</p>
            ${isSearchEmpty ? "" : `
                <button type="button" class="empty-state-button" data-empty-action="${isFavoriteEmpty ? "all" : "add"}">
                    ${isFavoriteEmpty ? "查看全部店家" : "＋ 新增店家"}
                </button>
            `}
        </div>
    `;

    const action = restaurantList.querySelector("[data-empty-action]");

    action?.addEventListener("click", () => {
        if (action.dataset.emptyAction === "add") {
            addRestaurantButton.click();
            return;
        }

        document.querySelector('[data-category="全部"]')?.click();
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showSkeletonLoading() {
    restaurantList.innerHTML = Array.from({ length: 3 }, () => `
        <article class="skeleton-card" aria-hidden="true">
            <div class="skeleton-block skeleton-image"></div>
            <div class="skeleton-content">
                <div class="skeleton-block skeleton-title"></div>
                <div class="skeleton-block skeleton-line"></div>
                <div class="skeleton-block skeleton-line short"></div>
            </div>
        </article>
    `).join("");
}


function finishAppStartup() {
    const splash = document.getElementById("appSplash");

    if (!splash) {
        return;
    }

    const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;

    if (!isStandalone) {
        splash.remove();
        return;
    }

    splash.classList.add("is-leaving");
    splash.addEventListener("animationend", () => splash.remove(), { once: true });
}