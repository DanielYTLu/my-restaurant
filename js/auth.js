/* ==================================================
   Authentication System
================================================== */

import { resetGroupState } from './group.js';

import { loadGroupsFromSupabase } from './group.js';
import { supabaseClient } from './supabase.js';
import { showToast } from './utils.js';
import { setCurrentUser, getCurrentUser } from './storage.js';

// Auth state
let authSessionInitializedFlag = false;
let isPasswordRecoveryMode = false;
let authReloadSequence = 0;

// Initialize auth session
export async function initializeAuthSession() {
    try {
        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("❌ 取得 Auth Session 失敗：", error);
            setCurrentUser(null);
        } else {
            setCurrentUser(session?.user || null);
        }

        console.log("🔒 Auth Session:", getCurrentUser());
    } catch (err) {
        console.error("❌ 初始化 Auth Session 發生例外：", err);
        setCurrentUser(null);
    } finally {
        authSessionInitializedFlag = true;
    }
}

// Handle auth state changes
export async function handleAuthUserChanged(user) {
    setCurrentUser(user || null);
    console.log("🔄 Auth State Changed:", getCurrentUser());
    updateAuthUI();
    // 強制觸發並等待群組重新載入
    await loadGroupsFromSupabase();

    await reloadUserScopedLocalData();
}

import AppLoading from './loading.js';

// Reload user-scoped local data
export async function reloadUserScopedLocalData() {
    const currentSeq = ++authReloadSequence;
    try {
        console.log("🔄 正在重新載入使用者 Scoped 資料與狀態 (包含雲端)");
        
        // This will be handled by the main app module
        // Trigger event for other modules to respond
        window.dispatchEvent(new CustomEvent('authStateChanged', { 
            detail: { user: getCurrentUser() }
        }));

        if (currentSeq !== authReloadSequence) {
            console.log("⚡ 偵測到更新的 Auth Reload 請求，放棄本次過期渲染");
            return;
        }

        console.log("✅ 使用者 Scoped 本地與雲端資料重新載入完成");
    } catch (err) {
        console.error("❌ 重新載入使用者 Scoped 資料發生錯誤：", err);
    }
}

// Login function
export async function login(email, password) {
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

    AppLoading.show("正在準備你的餐點...");

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
            setCurrentUser(data.user);
            showToast("✅ 登入成功", "success");

            // Ensure data loads before switching
            await handleAuthUserChanged(data.user);

            history.pushState({}, "", "/");
            handleRoute();
        }
    } catch (err) {
        console.error("登入發生例外：", err);
        showToast("登入發生錯誤，請稍後再試", "error");
    } finally {
        AppLoading.hide(500);
    }
}

// Signup function
export async function signup(email, password) {
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

// Logout function
export async function logout() {
    AppLoading.show("正在收拾餐具...");
    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            console.error("❌ 登出失敗：", error);
            showToast("登出失敗，請稍後再試", "error");
            return false;
        }

        console.log("✅ 登出成功");
        showToast("已成功登出", "success");
        await handleAuthUserChanged(null);
        await resetGroupState();

        return true;
    } catch (err) {
        console.error("❌ 登出發生例外：", err);
        showToast("登出發生錯誤，請稍後再試", "error");
        return false;
    } finally {
        AppLoading.hide(500);
    }
}

// Forgot password function
export async function forgotPassword(email) {
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

// Update user profile
export async function updateUserProfile(nickname) {
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
        showToast("暱稱不能為空白", "error");
        return false;
    }

    if (trimmedNickname.length > 3) {
        showToast("暱稱限制 1～3 個字", "error");
        return false;
    }

    try {
        const { data, error } = await supabaseClient.auth.updateUser({
            data: { nickname: trimmedNickname }
        });

        if (error) {
            console.error("❌ 更新個人資料失敗：", error);
            showToast(error.message || "更新個人資料失敗，請稍後再試", "error");
            return false;
        }

        if (data && data.user) {
            setCurrentUser(data.user);
        }

        updateAuthUI();
        showToast("✅ 個人資料更新成功", "success");
        return true;
    } catch (err) {
        console.error("❌ 更新個人資料發生例外：", err);
        showToast("發生錯誤，請稍後再試", "error");
        return false;
    }
}

// Update auth UI
function updateAuthUI() {
    const currentUser = getCurrentUser();
    const authButtonLabel = document.getElementById("authButtonLabel");
    const authAccountTitle = document.getElementById("authAccountTitle");
    const authOpenButton = document.getElementById("authOpenButton");
    const addGroupButton = document.getElementById("addGroupButton");

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
        if (addGroupButton) {
            addGroupButton.style.display = "";
        }
    } else {
        if (authButtonLabel) authButtonLabel.textContent = "登入";
        if (authAccountTitle) authAccountTitle.textContent = "👤 使用者";
        if (authOpenButton) {
            authOpenButton.title = "使用者登入";
        }
        if (addGroupButton) {
            addGroupButton.style.display = "none";
        }
        if (authAccountMenu) {
            closeAuthAccountMenu();
        }
    }
    
    // Trigger event for other modules to respond
    window.dispatchEvent(new CustomEvent('authUIUpdated', { 
        detail: { user: currentUser }
    }));
}

// Close auth account menu
function closeAuthAccountMenu() {
    const authAccountMenu = document.getElementById("authAccountMenu");
    const authOpenButton = document.getElementById("authOpenButton");

    if (authAccountMenu && !authAccountMenu.hidden) {
        if (authOpenButton) {
            authOpenButton.focus();
            authOpenButton.setAttribute("aria-expanded", "false");
        }
        authAccountMenu.hidden = true;
        authAccountMenu.setAttribute("aria-hidden", "true");
    }
}

// Route handling for auth views
function handleRoute() {
    const path = window.location.pathname;
    const loginView = document.getElementById("loginView");
    const registerView = document.getElementById("registerView");
    const forgotView = document.getElementById("forgotView");
    const recoveryView = document.getElementById("recoveryView");
    const authModalTitle = document.getElementById("authModalTitle");
    const authRouteContainer = document.getElementById("authRouteContainer");

    if (!authRouteContainer) return;

    // Hide all auth views
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
        // Main app "/"
        if (authRouteContainer && authRouteContainer.contains(document.activeElement)) {
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

// Initialize auth system UI
export function initializeAuthSystem() {
    const authOpenButton = document.getElementById("authOpenButton");
    const authRouteContainer = document.getElementById("authRouteContainer");
    const closeAuthModal = document.getElementById("closeAuthModal");
    const loginForm = document.getElementById("loginForm");
    const loginEmail = document.getElementById("loginEmail");
    const loginPassword = document.getElementById("loginPassword");

    if (authOpenButton) {
        authOpenButton.addEventListener("click", (e) => {
            e.stopPropagation();
            const currentUser = getCurrentUser();
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

            const currentUser = getCurrentUser();
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

            const success = await updateUserProfile(trimmedNickname);
            
            if (success) {
                closeProfileModalHandler();
            }

            if (submitProfileButton) {
                submitProfileButton.disabled = false;
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

// Set up auth state change listener
export function setupAuthStateListener() {
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
}

// Export functions and state
export {
    authSessionInitializedFlag,
    isPasswordRecoveryMode,
    authReloadSequence,
    updateAuthUI,
    closeAuthAccountMenu,
    handleRoute
};