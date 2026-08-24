// ==================================================
// Supabase Configuration
// ==================================================

const SUPABASE_URL =
    "https://rcyqxzerhpdneagmjwjf.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_UykY-RjM0HyKtmJkkE9CWg_CDFpwlHJ";

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


// ==================================================
// Supabase Status
// ==================================================

let supabaseConnected = false;


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


// ==================================================
// Initialize
// ==================================================

initialize();


async function initialize() {

    console.log("🚀 餐廳管理系統啟動");

    // 從 Supabase 載入餐廳
    await loadRestaurants();

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

        id:
            String(
                row.id
            ),

        name:
            row.name || "",

        category:
            row.category || "",

        rating:
            row.rating ?? null,

        image:
            row.restaurant_image_url || "",

        phone:
            row.phone || "",

        address:
            row.description || "",

        hours:
            row.opening_hours || "",

        maps:
            row.google_maps_url || "",

        menuImages:
            Array.isArray(
                row.menu_images
            )
                ? row.menu_images
                : [],

        description:
            row.notes || "",

        favorite:
            Boolean(
                row.favorite
            )

    };

}


// ==================================================
// Frontend → Supabase
// ==================================================

function mapRestaurantToSupabase(
    restaurant
) {

    return {

        name:
            restaurant.name,

        category:
            restaurant.category || null,

        description:
            restaurant.address || null,

        phone:
            restaurant.phone || null,

        opening_hours:
            restaurant.hours || null,

        google_maps_url:
            restaurant.maps || null,

        restaurant_image_url:
            restaurant.image || null,

        favorite:
            Boolean(
                restaurant.favorite
            ),

        notes:
            restaurant.description || null,

        menu_images:
            restaurant.menuImages || []

    };

}





// ==================================================
// Compatibility
// ==================================================

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


        const {
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


        const {
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


    if (
        restaurantData.length === 0
    ) {

        restaurantList.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    🍽️
                </div>

                <h2>
                    還沒有餐廳
                </h2>

                <p>
                    點擊右下角 ＋ 新增你的第一間餐廳
                </p>

            </div>

        `;

        return;

    }


    restaurantData.forEach(
        restaurant => {

            restaurantList.appendChild(
                createRestaurantCard(
                    restaurant
                )
            );

        }
    );

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


    const menuCount =
        restaurant.menuImages
            ? restaurant.menuImages.length
            : 0;


    article.innerHTML = `

        <div class="restaurant-image">

            <img
                src="${restaurant.image || ""}"
                alt="${restaurant.name}"
            >

            <button
                class="
                    favorite
                    ${restaurant.favorite ? "liked" : ""}
                "
                data-id="${restaurant.id}"
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


            <p class="hours">

                🕐
                ${restaurant.hours || "尚未提供營業時間"}

            </p>


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

            </div>

        </div>

    `;


    // Favorite

    article
        .querySelector(".favorite")
        .addEventListener(
            "click",
            () => {

                toggleFavorite(
                    restaurant.id
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

async function toggleFavorite(
    id
) {

    const index =
        restaurants.findIndex(
            restaurant =>
                String(
                    restaurant.id
                ) ===
                String(id)
        );


    if (
        index === -1
    ) {

        return;

    }


    restaurants[index].favorite =
        !restaurants[index].favorite;


    saveRestaurantsLocal();

    renderRestaurants();


    // Supabase

    if (
        supabaseConnected
    ) {

        const {
            error
        } =
            await supabaseClient
                .from("restaurants")
                .update({

                    favorite:
                        restaurants[index]
                            .favorite

                })
                .eq(
                    "id",
                    id
                );


        if (
            error
        ) {

            console.error(
                "❌ 收藏同步失敗：",
                error
            );

        }

        else {

            console.log(
                "☁️ 收藏狀態已同步"
            );

        }

    }

}


// ==================================================
// Search
// ==================================================

searchInput.addEventListener(
    "input",
    () => {

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

                    );

                }
            );


        renderRestaurants(
            filtered
        );

    }
);


// ==================================================
// Category
// ==================================================

categories.forEach(
    categoryButton => {

        categoryButton.addEventListener(
            "click",
            () => {

                categories.forEach(
                    button => {

                        button.classList.remove(
                            "active"
                        );

                    }
                );


                categoryButton.classList.add(
                    "active"
                );


                const category =
                    categoryButton.dataset.category;


                if (
                    category === "全部"
                ) {

                    renderRestaurants();

                    return;

                }


                const filtered =
                    restaurants.filter(
                        restaurant =>
                            restaurant.category ===
                            category
                    );


                renderRestaurants(
                    filtered
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


    delete restaurantForm.dataset.editingId;


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

restaurantForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const editingId =
            restaurantForm.dataset.editingId;


        const menuImages = [

            document.getElementById(
                "restaurantMenu1"
            ).value.trim(),

            document.getElementById(
                "restaurantMenu2"
            ).value.trim(),

            document.getElementById(
                "restaurantMenu3"
            ).value.trim()

        ].filter(
            url =>
                url !== ""
        );


        const restaurantData = {

            name:
                document.getElementById(
                    "restaurantName"
                ).value.trim(),

            category:
                document.getElementById(
                    "restaurantCategory"
                ).value,

            rating:
                Number(
                    document.getElementById(
                        "restaurantRating"
                    ).value
                ) || null,

            image:
                document.getElementById(
                    "restaurantImage"
                ).value.trim(),

            phone:
                document.getElementById(
                    "restaurantPhone"
                ).value.trim(),

            address:
                document.getElementById(
                    "restaurantAddress"
                ).value.trim(),

            hours:
                document.getElementById(
                    "restaurantHours"
                ).value.trim(),

            maps:
                document.getElementById(
                    "restaurantMaps"
                ).value.trim(),

            menuImages:
                menuImages,

            description:
                document.getElementById(
                    "restaurantDescription"
                ).value.trim()

        };


        // ==================================================
        // EDIT
        // ==================================================

        if (
            editingId
        ) {

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


            if (
                index === -1
            ) {

                alert(
                    "找不到要編輯的餐廳。"
                );

                return;

            }


            const updatedRestaurant = {

                ...restaurants[index],

                ...restaurantData

            };


            // 先更新畫面

            restaurants[index] =
                updatedRestaurant;


            saveRestaurantsLocal();

            renderRestaurants();

            closeRestaurantModal();


            // 雲端更新

            if (
                supabaseConnected
            ) {

                const result =
                    await updateRestaurantInSupabase(
                        editingId,
                        updatedRestaurant
                    );


                if (
                    !result
                ) {

                    alert(
                        "餐廳已更新，但雲端同步失敗，請檢查網路連線。"
                    );

                }

                else {

                    console.log(
                        "☁️ 編輯資料已同步到 Supabase"
                    );

                }

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


            // Supabase

            if (
                supabaseConnected
            ) {

                const saved =
                    await createRestaurantInSupabase(
                        newRestaurant
                    );


                if (
                    saved
                ) {

                    restaurants.unshift(
                        saved
                    );


                    console.log(
                        "☁️ 新餐廳已同步到 Supabase"
                    );

                }

                else {

                    restaurants.unshift(
                        newRestaurant
                    );


                    alert(
                        "餐廳已暫存，但無法同步到 Supabase。"
                    );

                }

            }


            // Local fallback

            else {

                restaurants.unshift(
                    newRestaurant
                );

            }


            saveRestaurantsLocal();

            renderRestaurants();

            closeRestaurantModal();

        }


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

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
                                    restaurant.hours ||
                                    "尚未提供"
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


    document.getElementById(
        "restaurantName"
    ).value =
        restaurant.name || "";


    document.getElementById(
        "restaurantCategory"
    ).value =
        restaurant.category || "";


    document.getElementById(
        "restaurantRating"
    ).value =
        restaurant.rating || "";


    document.getElementById(
        "restaurantImage"
    ).value =
        restaurant.image || "";


    document.getElementById(
        "restaurantPhone"
    ).value =
        restaurant.phone || "";


    document.getElementById(
        "restaurantAddress"
    ).value =
        restaurant.address || "";


    document.getElementById(
        "restaurantHours"
    ).value =
        restaurant.hours || "";


    document.getElementById(
        "restaurantMaps"
    ).value =
        restaurant.maps || "";


    document.getElementById(
        "restaurantDescription"
    ).value =
        restaurant.description || "";


    const menuImages =
        restaurant.menuImages || [];


    document.getElementById(
        "restaurantMenu1"
    ).value =
        menuImages[0] || "";


    document.getElementById(
        "restaurantMenu2"
    ).value =
        menuImages[1] || "";


    document.getElementById(
        "restaurantMenu3"
    ).value =
        menuImages[2] || "";


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

async function deleteRestaurant(
    id
) {

    const restaurant =
        restaurants.find(
            restaurant =>
                String(
                    restaurant.id
                ) ===
                String(id)
        );


    if (
        !restaurant
    ) {

        return;

    }


    const confirmed =
        confirm(
            `確定要刪除「${restaurant.name}」嗎？`
        );


    if (
        !confirmed
    ) {

        return;

    }


    // Local

    restaurants =
        restaurants.filter(
            restaurant =>
                String(
                    restaurant.id
                ) !==
                String(id)
        );


    saveRestaurantsLocal();

    renderRestaurants();


    // Supabase

    if (
        supabaseConnected
    ) {

        const success =
            await deleteRestaurantFromSupabase(
                id
            );


        if (
            !success
        ) {

            alert(
                "本機已刪除，但雲端刪除失敗。"
            );

        }

    }

}


// ==================================================
// Menu Image Preview
// ==================================================

function initializeMenuPreview() {

    const menuInputs = [

        document.getElementById(
            "restaurantMenu1"
        ),

        document.getElementById(
            "restaurantMenu2"
        ),

        document.getElementById(
            "restaurantMenu3"
        )

    ];


    menuInputs.forEach(
        (input, index) => {

            if (
                !input
            ) {

                return;

            }


            input.addEventListener(
                "input",
                () => {

                    updateMenuPreview(
                        index + 1,
                        input.value.trim()
                    );

                }
            );

        }
    );

}


// ==================================================
// Update Menu Preview
// ==================================================

function updateMenuPreview(
    menuNumber,
    imageUrl
) {

    const preview =
        document.getElementById(
            `menuPreview${menuNumber}`
        );


    if (
        !preview
    ) {

        return;

    }


    if (
        !imageUrl
    ) {

        preview.innerHTML = `

            <div class="menu-preview-empty">

                <span>
                    📖
                </span>

                <p>
                    尚未加入菜單圖片
                </p>

            </div>

        `;

        return;

    }


    preview.innerHTML = `

        <div class="menu-preview-empty">

            <span>
                ⏳
            </span>

            <p>
                圖片載入中...
            </p>

        </div>

    `;


    const image =
        new Image();


    image.onload =
        () => {

            preview.innerHTML =
                "";


            image.alt =
                `菜單 ${menuNumber}`;


            image.className =
                "menu-preview-image";


            preview.appendChild(
                image
            );

        };


    image.onerror =
        () => {

            preview.innerHTML = `

                <div class="menu-preview-error">

                    <div
                        class="menu-preview-error-icon"
                    >
                        ⚠️
                    </div>

                    <div
                        class="menu-preview-error-title"
                    >
                        圖片無法載入
                    </div>

                    <div
                        class="menu-preview-error-text"
                    >
                        請確認圖片網址是否正確
                    </div>

                </div>

            `;

        };


    image.src =
        imageUrl;

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
        restaurant.menuImages || [];


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

initializeMenuPreview();

initializeMenuRemoveButtons();


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

    console.log("正在從 Supabase 讀取餐廳資料...");

    const {
        data,
        error
    } = await supabaseClient
        .from("restaurants")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error(
            "❌ Supabase 讀取餐廳失敗：",
            error
        );

        alert(
            "無法讀取 Supabase 餐廳資料，請開啟 F12 查看錯誤。"
        );

        return;

    }

    console.log(
        "✅ Supabase 餐廳資料：",
        data
    );

    restaurants =
        (data || []).map(
            restaurant => ({

                id:
                    restaurant.id,

                name:
                    restaurant.name || "",

                category:
                    restaurant.category || "",

                rating:
                    restaurant.rating || null,

                image:
                    restaurant.restaurant_image_url || "",

                phone:
                    restaurant.phone || "",

                address:
                    restaurant.address || "",

                hours:
                    restaurant.opening_hours || "",

                maps:
                    restaurant.google_maps_url || "",

                menuImages:
                    Array.isArray(
                        restaurant.menu_images
                    )
                        ? restaurant.menu_images
                        : [],

                description:
                    restaurant.description || "",

                favorite:
                    restaurant.favorite || false

            })
        );

    console.log(
        "✅ 網站餐廳資料已更新：",
        restaurants
    );

    renderRestaurants();

}