/* ==================================================
   Supabase Client Configuration
================================================== */

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// Supabase connection status
let supabaseConnected = false;

// Check if error is related to missing group table/column
export function isMissingGroupTableOrColumnError(error) {
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

// Test Supabase connection
export async function testSupabaseConnection() {
    try {
        const {
            data,
            error
        } = await supabaseClient
            .from("restaurants")
            .select("id")
            .limit(1);

        if (error) {
            console.error("❌ Supabase 連線 / 查詢失敗：", error);
            supabaseConnected = false;
            return false;
        }

        console.log("✅ Supabase 連線成功！", data);
        supabaseConnected = true;
        return true;
    } catch (error) {
        console.error("❌ Supabase Failed to Fetch：", error);
        supabaseConnected = false;
        return false;
    }
}

// Get connection status
export function isSupabaseConnected() {
    return supabaseConnected;
}

// Set connection status
export function setSupabaseConnected(status) {
    supabaseConnected = status;
}

// Export supabase client
export { supabaseClient };