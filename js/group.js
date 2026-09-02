/* ==================================================
   Group Management System
================================================== */

import { UNCATEGORIZED_GROUP_NAME } from './config.js';
import { supabaseClient, isMissingGroupTableOrColumnError, isSupabaseConnected } from './supabase.js';
import { getCurrentUser } from './storage.js';
import { generateUuid, showToast } from './utils.js';
import { mapRestaurantToSupabase } from './restaurant.js';

// Group state
let restaurantGroups = [];
let currentGroupId = null;

// Load groups from Supabase
export async function loadGroupsFromSupabase() {
    try {
        const currentUser = getCurrentUser();
        console.log("🔍 [loadGroupsFromSupabase] 當前使用者：", currentUser?.email, "ID:", currentUser?.id);

        const { data, error } = await supabaseClient
            .from("restaurant_groups")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) {
            if (!isMissingGroupTableOrColumnError(error)) {
                console.error("❌ 群組讀取失敗：", error);
            } else {
                console.warn("⚠️ Supabase 尚未建立 restaurant_groups 資料表，改用本機群組資料。");
            }
            return false;
        }

        console.log("📋 [loadGroupsFromSupabase] 從資料庫獲取的原始資料：", data);

        if (Array.isArray(data) && data.length > 0) {
            let fetchedGroups = data.map(row => ({
                id: String(row.id),
                name: row.name || UNCATEGORIZED_GROUP_NAME,
                visibility: row.visibility || "private",
                user_id: row.user_id || null,
                created_at: row.created_at || null
            }));

            // Filter groups based on auth status
            if (!currentUser) {
                console.log("👤 當前為匿名狀態，只顯示公開群組與未分類");
                fetchedGroups = fetchedGroups.filter(g => g.visibility === "public" || g.name === UNCATEGORIZED_GROUP_NAME);
            } else {
                // 如果已登入，顯示公開群組以及「我自己的群組」
                console.log("👤 當前已登入：", currentUser.email);
                fetchedGroups = fetchedGroups.filter(g => 
                    g.visibility === "public" || 
                    g.user_id === currentUser.id ||
                    g.name === UNCATEGORIZED_GROUP_NAME
                );
            }

            console.log("📊 [loadGroupsFromSupabase] 篩選後的群組：", fetchedGroups);
            restaurantGroups = fetchedGroups;

            // Ensure uncategorized group exists
            if (!restaurantGroups.some(g => g.name === UNCATEGORIZED_GROUP_NAME)) {
                restaurantGroups.unshift({
                    id: "uncategorized-default",
                    name: UNCATEGORIZED_GROUP_NAME,
                    visibility: "private",
                    user_id: currentUser?.id || null,
                    created_at: null
                });
            }

            return true;
        } else {
            // If no groups, ensure uncategorized exists
            if (!restaurantGroups.some(g => g.name === UNCATEGORIZED_GROUP_NAME)) {
                restaurantGroups = [{
                    id: "uncategorized-default",
                    name: UNCATEGORIZED_GROUP_NAME,
                    visibility: "private",
                    user_id: getCurrentUser()?.id || null,
                    created_at: null
                }];
            }
            return true;
        }
    } catch (error) {
        console.error("❌ 群組連線失敗：", error);
        return false;
    }
}

// Create group in Supabase
export async function createGroupInSupabase(group) {
    const payload = {
        id: group.id,
        name: group.name,
        visibility: group.visibility || "private",
        user_id: getCurrentUser()?.id || null,
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
    } catch (error) {
        console.error("❌ [createGroupInSupabase] 發生未預期例外錯誤 (Catch)：", error);
        return null;
    }
}

// Update group in Supabase
export async function updateGroupInSupabase(id, name, visibility) {
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
    } catch (error) {
        console.error("❌ 群組更新錯誤：", error);
        return false;
    }
}

// Rename group in Supabase
export async function renameGroupInSupabase(id, name) {
    return await updateGroupInSupabase(id, name, undefined);
}

// Ensure groups are initialized with uncategorized group
export function ensureGroupsInitialized() {
    if (restaurantGroups.length === 0 || !restaurantGroups.some(g => g.name === UNCATEGORIZED_GROUP_NAME)) {
        if (!restaurantGroups.some(g => g.name === UNCATEGORIZED_GROUP_NAME)) {
            restaurantGroups.unshift({
                id: "uncategorized-default",
                name: UNCATEGORIZED_GROUP_NAME,
                created_at: null
            });
        }
    }

    const validIds = new Set(restaurantGroups.map(group => group.id));

    if (!currentGroupId || !validIds.has(currentGroupId)) {
        currentGroupId = restaurantGroups[0].id;
    }
}

// Get uncategorized group ID
export function getUncategorizedGroupId() {
    let group = restaurantGroups.find(
        candidate => candidate.name === UNCATEGORIZED_GROUP_NAME
    );

    if (!group) {
        return restaurantGroups[0]?.id || null;
    }

    return group.id;
}

// Assign missing group IDs to restaurants
export function assignMissingGroupIds(restaurants) {
    let changed = false;

    restaurants.forEach(restaurant => {
        if (!restaurant.groupId) {
            restaurant.groupId = getUncategorizedGroupId();
            changed = true;
        }
    });

    return changed;
}

// Get group filtered restaurants
export function getGroupFilteredRestaurants(source) {
    if (!currentGroupId) {
        return source;
    }

    const validGroupIds = new Set(restaurantGroups.map(group => String(group.id)));
    const uncatId = getUncategorizedGroupId();

    return source.filter(restaurant => {
        let rGroupId = restaurant.groupId ? String(restaurant.groupId) : null;

        // If restaurant's groupId is not in valid group IDs, treat as uncategorized
        if (!rGroupId || !validGroupIds.has(rGroupId)) {
            rGroupId = uncatId;
        }

        return rGroupId === currentGroupId;
    });
}

// Get current group name
export function getCurrentGroupName() {
    const group = restaurantGroups.find(candidate => candidate.id === currentGroupId);
    return group?.name || UNCATEGORIZED_GROUP_NAME;
}

// Get current group
export function getCurrentGroup() {
    return restaurantGroups.find(candidate => candidate.id === currentGroupId);
}

// Check if current group can be edited
export function canEditCurrentGroup() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return false;
    }
    
    const group = getCurrentGroup();
    if (!group || group.id === "uncategorized-default" || group.name === UNCATEGORIZED_GROUP_NAME) {
        return true;
    }
    
    return group.user_id === currentUser.id;
}

// Delete group
export async function deleteGroup(groupId, restaurants) {
    if (!canEditCurrentGroup()) {
        showToast("唯讀模式，無法刪除群組");
        return;
    }

    const group = restaurantGroups.find(
        candidate => String(candidate.id) === String(groupId)
    );

    if (!group) {
        alert("找不到要刪除的群組。");
        return;
    }

    if (group.name === UNCATEGORIZED_GROUP_NAME) {
        alert("「未分類」群組不能刪除。");
        return;
    }

    const restaurantCount = restaurants.filter(
        restaurant => String(restaurant.groupId) === String(groupId)
    ).length;

    const message = restaurantCount > 0
        ? `確定要刪除「${group.name}」嗎？\n\n此群組中的 ${restaurantCount} 間餐廳不會被刪除，而是會全部移到「未分類」。`
        : `確定要刪除「${group.name}」嗎？`;

    if (!confirm(message)) {
        return;
    }

    const uncategorizedGroupId = getUncategorizedGroupId();

    // Move restaurants to uncategorized
    const restaurantsToMove = restaurants.filter(
        restaurant => String(restaurant.groupId) === String(groupId)
    );

    for (const restaurant of restaurantsToMove) {
        restaurant.groupId = uncategorizedGroupId;

        if (isSupabaseConnected()) {
            try {
                const { error } = await supabaseClient
                    .from("restaurants")
                    .update({ group_id: uncategorizedGroupId })
                    .eq("id", restaurant.id);

                if (error) {
                    console.error("❌ 餐廳移動到未分類失敗：", error);
                    alert(`「${restaurant.name}」移動到未分類失敗，群組未刪除。`);
                    return;
                }
            } catch (error) {
                console.error("❌ 餐廳群組更新錯誤：", error);
                alert(`「${restaurant.name}」移動到未分類失敗，群組未刪除。`);
                return;
            }
        }
    }

    // Delete group from Supabase
    if (isSupabaseConnected()) {
        try {
            const { error } = await supabaseClient
                .from("restaurant_groups")
                .delete()
                .eq("id", groupId);

            if (error) {
                console.error("❌ Supabase 群組刪除失敗：", error);
                alert("❌ 群組刪除失敗，請檢查網路連線。");
                return;
            }
        } catch (error) {
            console.error("❌ 群組刪除錯誤：", error);
            alert("❌ 群組刪除失敗。");
            return;
        }
    }

    // Remove from local groups
    restaurantGroups = restaurantGroups.filter(
        candidate => String(candidate.id) !== String(groupId)
    );

    // Update current group if needed
    if (String(currentGroupId) === String(groupId)) {
        currentGroupId = uncategorizedGroupId;
    }

    showToast(`✅ 「${group.name}」已刪除，餐廳已移至「未分類」。`, "success");
    
    // Trigger event for UI update
    window.dispatchEvent(new CustomEvent('groupsUpdated', { 
        detail: { groups: restaurantGroups, currentGroupId }
    }));
}

// Switch to different group
export function switchGroup(groupId) {
    const targetGroup = restaurantGroups.find(g => g.id === groupId);
    
    if (!groupId || groupId === currentGroupId) {
        return;
    }

    currentGroupId = groupId;

    // Trigger event for UI update
    window.dispatchEvent(new CustomEvent('groupSwitched', { 
        detail: { groupId, groupName: targetGroup?.name }
    }));
}

// Get groups data
export function getGroups() {
    return restaurantGroups;
}

// Set groups data
export function setGroups(groups) {
    restaurantGroups = groups;
}

// Get current group ID
export function getCurrentGroupId() {
    return currentGroupId;
}

// Set current group ID
export function setCurrentGroupId(groupId) {
    currentGroupId = groupId;
}

// Reset group state
export function resetGroupState() {
    currentGroupId = getUncategorizedGroupId();
    // 重新載入群組以過濾掉已登入才能看的群組
    loadGroupsFromSupabase().then(() => {
        window.dispatchEvent(new CustomEvent('groupSwitched', { 
            detail: { groupId: currentGroupId, groupName: "未分類" }
        }));
    });
}
