/* ==================================================
   Announcements System
================================================== */

import { loadAnnouncementsData, saveAnnouncementsData } from './storage.js';
import { supabaseClient } from './supabase.js';
import { escapeHtml } from './utils.js';

// DOM Elements
const announcementsButton = document.getElementById("announcementsButton");
const announcementsBadge = document.getElementById("announcementsBadge");
const announcementsModal = document.getElementById("announcementsModal");
const closeAnnouncementsButton = document.getElementById("closeAnnouncements");
const announcementsContent = document.getElementById("announcementsContent");

// Announcements state
let announcements = [];
let lastViewedAnnouncements = new Date(0).toISOString();

// Load announcements
export async function loadAnnouncements() {
    const { cached, lastViewed } = loadAnnouncementsData();
    
    if (cached && cached.length > 0) {
        announcements = cached;
        lastViewedAnnouncements = lastViewed;
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
            saveAnnouncementsData(announcements, lastViewedAnnouncements);
            renderAnnouncements(announcements);
            updateAnnouncementsBadge();
        } else if (!cached) {
            announcementsContent.innerHTML = "<p class='loading-message'>目前沒有任何公告。</p>";
        }
    } catch (error) {
        console.error("Supabase connection error:", error);
    }
}

// Render announcements
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

// Update announcements badge
function updateAnnouncementsBadge() {
    const hasUnread = announcements.some(a => new Date(a.published_at) > new Date(lastViewedAnnouncements));
    announcementsBadge.classList.toggle("hidden", !hasUnread);
}

// Initialize announcements system
export function initializeAnnouncements() {
    if (!announcementsButton) return;
    
    announcementsButton.addEventListener("click", () => {
        announcementsModal.classList.add("show");
        lastViewedAnnouncements = new Date().toISOString();
        saveAnnouncementsData(announcements, lastViewedAnnouncements);
        updateAnnouncementsBadge();
    });

    closeAnnouncementsButton.addEventListener("click", () => announcementsModal.classList.remove("show"));
    announcementsModal.addEventListener("click", e => { 
        if (e.target === announcementsModal) announcementsModal.classList.remove("show"); 
    });

    loadAnnouncements();
}

// Inject mock announcements for testing
export function injectMockAnnouncements() {
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