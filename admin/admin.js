// ==========================================
// 黑白呷 (MY RESTAURANTS) - 獨立 Admin 後台邏輯
// 完全解耦，不依賴使用者端 script.js / index.html
// ==========================================

const SUPABASE_URL = "https://rcyqxzerhpdneagmjwjf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UykY-RJm0HyKtmJkkE9CWg_CDFpwlHJ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutButton = document.getElementById('logout-button');

    checkAuth();

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            loginError.classList.add('d-none');

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;

                const user = data.user;
                const profile = await fetchUserProfile(user.id);

                // 檢查權限與狀態
                if (!profile) {
                    await supabaseClient.auth.signOut();
                    throw new Error('找不到使用者資料');
                }
                
                if (profile.status === 'suspended') {
                    await supabaseClient.auth.signOut();
                    throw new Error('您的帳號已被停權，請聯絡管理員');
                }

                if (profile.role !== 'admin' && profile.role !== 'developer') {
                    await supabaseClient.auth.signOut();
                    throw new Error('權限不足：您不是系統管理員');
                }

                showDashboard(user, profile);
            } catch (err) {
                loginError.textContent = err.message || '登入失敗';
                loginError.classList.remove('d-none');
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            showLogin();
        });
    }

    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const panelName = link.getAttribute('data-panel');
            document.querySelectorAll('.admin-panel').forEach(panel => {
                panel.classList.add('d-none');
            });
            const targetPanel = document.getElementById(`${panelName}-panel`);
            if (targetPanel) {
                targetPanel.classList.remove('d-none');
                loadPanelData(panelName);
            }
        });
    });

    // 綁定新增公告按鈕與儲存公告按鈕事件
    const openAnnouncementBtn = document.getElementById('open-announcement-modal-btn');
    if (openAnnouncementBtn) {
        openAnnouncementBtn.addEventListener('click', () => {
            document.getElementById('announcement-id').value = '';
            document.getElementById('announcement-title').value = '';
            document.getElementById('announcement-type').value = 'info';
            document.getElementById('announcement-content').value = '';
            document.getElementById('announcement-pinned').checked = false;
            document.getElementById('announcement-published').checked = true;
            document.getElementById('announcementModalTitle').textContent = '新增公告';
            
            const modalEl = document.getElementById('announcementModal');
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        });
    }

    const saveAnnouncementBtn = document.getElementById('save-announcement-btn');
    if (saveAnnouncementBtn) {
        saveAnnouncementBtn.addEventListener('click', async () => {
            const id = document.getElementById('announcement-id').value;
            const title = document.getElementById('announcement-title').value.trim();
            const type = document.getElementById('announcement-type').value;
            const content = document.getElementById('announcement-content').value.trim();
            const is_pinned = document.getElementById('announcement-pinned').checked;
            const is_published = document.getElementById('announcement-published').checked;

            if (!title || !content) {
                alert('請填寫標題與內容');
                return;
            }

            const payload = {
                title,
                type,
                content,
                is_pinned,
                is_published,
                published_at: is_published ? new Date() : null
            };

            let error;
            if (id) {
                const res = await supabaseClient.from('announcements').update(payload).eq('id', id);
                error = res.error;
            } else {
                const res = await supabaseClient.from('announcements').insert([payload]);
                error = res.error;
            }

            if (error) {
                alert('儲存公告失敗: ' + error.message);
            } else {
                alert('公告儲存成功！');
                const modalEl = document.getElementById('announcementModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                loadAnnouncements();
            }
        });
    }
});

async function checkAuth() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) {
            showLogin();
            return;
        }
        const user = session.user;
        const profile = await fetchUserProfile(user.id);

        if (!profile || (profile.role !== 'admin' && profile.role !== 'developer') || profile.status === 'suspended') {
            await supabaseClient.auth.signOut();
            showLogin();
            return;
        }
        showDashboard(user, profile);
    } catch (err) {
        showLogin();
    }
}
async function fetchUserProfile(userId) {
    const { data, error } = await supabaseClient.from('user_profiles').select('*').eq('id', userId).single();
    if (error) return null;
    return data;
}

function showLogin() {
    document.getElementById('login-section').classList.remove('d-none');
    document.getElementById('dashboard-section').classList.add('d-none');
}

function showDashboard(user, profile) {
    document.getElementById('login-section').classList.add('d-none');
    document.getElementById('dashboard-section').classList.remove('d-none');
    document.getElementById('admin-user-email').textContent = `${user.email} (${profile.role})`;

    // Admin 權限控制：隱藏使用者管理選單
    const usersNavLink = document.querySelector('.navbar-nav .nav-link[data-panel="users"]');
    if (profile.role === 'admin') {
        if (usersNavLink) {
            usersNavLink.parentElement.style.display = 'none';
        }
    } else {
        if (usersNavLink) {
            usersNavLink.parentElement.style.display = '';
        }
    }

    loadPanelData('overview');
}

async function loadOverview() {
    try {
        const [resRest, resUsers, resGroups, resAnnounce] = await Promise.all([
            supabaseClient.from('restaurants').select('*', { count: 'exact', head: true }),
            supabaseClient.from('user_profiles').select('*', { count: 'exact', head: true }),
            supabaseClient.from('restaurant_groups').select('*', { count: 'exact', head: true }),
            supabaseClient.from('announcements').select('*', { count: 'exact', head: true })
        ]);

        const statRestaurants = document.getElementById('stat-restaurants');
        const statUsers = document.getElementById('stat-users');
        const statGroups = document.getElementById('stat-groups');
        const statAnnouncements = document.getElementById('stat-announcements');

        if (statRestaurants) statRestaurants.textContent = resRest.count !== null ? resRest.count : 0;
        if (statUsers) statUsers.textContent = resUsers.count !== null ? resUsers.count : 0;
        if (statGroups) statGroups.textContent = resGroups.count !== null ? resGroups.count : 0;
        if (statAnnouncements) statAnnouncements.textContent = resAnnounce.count !== null ? resAnnounce.count : 0;
    } catch (err) {
        console.error('載入總覽儀表板失敗:', err);
    }
}

async function loadPanelData(panelName) {
    if (panelName === 'overview') await loadOverview();
    else if (panelName === 'users') await loadUsers();
    else if (panelName === 'restaurants') await loadRestaurants();
    else if (panelName === 'groups') await loadGroups();
    else if (panelName === 'announcements') await loadAnnouncements();
}
async function loadUsers() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">載入中...</td></tr>';

    const { data, error } = await supabaseClient.from('user_profiles').select('*').order('created_at', { ascending: false });
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">載入失敗: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(u => {
        console.log('User Profile Data:', u); // 除錯用
        return `
        <tr>
            <td><code>${u.id.substring(0, 8)}...</code></td>
            <td>${u.email || 'N/A'}</td>
            <td>
                <select class="form-select form-select-sm user-role-select" data-id="${u.id}">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                    <option value="developer" ${u.role === 'developer' ? 'selected' : ''}>developer</option>
                </select>
            </td>
            <td>
                <select class="form-select form-select-sm user-status-select" data-id="${u.id}">
                    <option value="active" ${u.status === 'active' ? 'selected' : ''}>active</option>
                    <option value="suspended" ${u.status === 'suspended' ? 'selected' : ''}>suspended</option>
                </select>
            </td>
            <td>
                <button class="btn btn-sm btn-primary save-user-btn" data-id="${u.id}">儲存</button>
            </td>
        </tr>
    `}).join('');

    tbody.querySelectorAll('.save-user-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const userId = e.target.getAttribute('data-id');
            const row = e.target.closest('tr');
            const newRole = row.querySelector('.user-role-select').value;
            const newStatus = row.querySelector('.user-status-select').value;

            const { error } = await supabaseClient
                .from('user_profiles')
                .update({ role: newRole, status: newStatus, updated_at: new Date() })
                .eq('id', userId);

            if (error) {
                alert('更新失敗: ' + error.message);
            } else {
                alert('更新成功！');
                loadUsers();
            }
        });
    });
}

async function loadRestaurants(searchKeyword = '') {
    const tbody = document.getElementById('restaurants-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">載入中...</td></tr>';

    let query = supabaseClient.from('restaurants').select('*').order('created_at', { ascending: false }).limit(100);
    if (searchKeyword) {
        query = query.ilike('name', `%${searchKeyword}%`);
    }

    // 檢查欄位結構的輔助函式
    const logTableStructure = (data) => {
        if (data && data.length > 0) {
            console.log('餐廳資料庫欄位範例:', Object.keys(data[0]));
        }
    };

    const { data, error } = await query;
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">載入失敗: ${error.message}</td></tr>`;
        return;
    }
    
    logTableStructure(data); // 除錯用

    tbody.innerHTML = data.map(r => `
        <tr>
            <td><code>${r.id}</code></td>
            <td><strong>${escapeHtml(r.name || r.restaurant_name || '未命名')}</strong></td>
            <td><span class="badge bg-light text-dark border">${escapeHtml(r.category || '未分類')}</span></td>
            <td>${escapeHtml(r.address || '無地址')}</td>
            <td><span class="text-warning">★</span> ${r.rating || 0}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger delete-restaurant-btn" data-id="${r.id}">刪除</button>
            </td>
        </tr>
    `).join('');

    const searchInput = document.getElementById('restaurant-search-input');
    if (searchInput && !searchInput.hasAttribute('data-bound')) {
        searchInput.setAttribute('data-bound', 'true');
        searchInput.addEventListener('input', (e) => {
            loadRestaurants(e.target.value.trim());
        });
    }

    tbody.querySelectorAll('.delete-restaurant-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if (!confirm(`確定要刪除餐廳 ID #${id} 嗎？`)) return;

            const { error } = await supabaseClient.from('restaurants').delete().eq('id', id);
            if (error) {
                alert('刪除失敗: ' + error.message);
            } else {
                alert('刪除成功');
                loadRestaurants(searchInput ? searchInput.value.trim() : '');
            }
        });
    });
}

async function loadGroups() {
    const tbody = document.getElementById('groups-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">載入中...</td></tr>';

    const { data, error } = await supabaseClient.from('restaurant_groups').select('*').order('created_at', { ascending: false });
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">載入失敗: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(g => `
        <tr>
            <td><code>${g.id}</code></td>
            <td><strong>${escapeHtml(g.name)}</strong></td>
            <td><span class="badge bg-${g.visibility === 'public' ? 'success' : 'secondary'}">${g.visibility}</span></td>
            <td><code>${g.user_id || '系統/公開'}</code></td>
            <td>
                ${!g.is_uncategorized ? `<button class="btn btn-sm btn-danger delete-group-btn" data-id="${g.id}">刪除</button>` : '<span class="text-muted">系統預設</span>'}
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.delete-group-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if (!confirm(`確定要刪除群組 ${id} 嗎？`)) return;

            const { error } = await supabaseClient.from('restaurant_groups').delete().eq('id', id);
            if (error) {
                alert('刪除失敗: ' + error.message);
            } else {
                alert('刪除成功');
                loadGroups();
            }
        });
    });
}

async function loadAnnouncements() {
    const tbody = document.getElementById('announcements-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">載入中...</td></tr>';

    const { data, error } = await supabaseClient.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">載入失敗: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(a => `
        <tr>
            <td><code>${a.id.substring(0, 8)}...</code></td>
            <td><strong>${escapeHtml(a.title)}</strong></td>
            <td><span class="badge bg-info">${a.type}</span></td>
            <td>${a.is_pinned ? '📌 是' : '否'}</td>
            <td>${a.is_published ? '✅ 已發布' : '草稿'}</td>
            <td>
                <button class="btn btn-sm btn-danger delete-announcement-btn" data-id="${a.id}">刪除</button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.delete-announcement-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if (!confirm('確定要刪除此公告嗎？')) return;

            const { error } = await supabaseClient.from('announcements').delete().eq('id', id);
            if (error) {
                alert('刪除失敗: ' + error.message);
            } else {
                alert('刪除成功');
                loadAnnouncements();
            }
        });
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

