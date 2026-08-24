// ==================================================
// Restaurant Management System
// ==================================================


// ==================================================
// Restaurant Data
// ==================================================

let restaurants =
    JSON.parse(
        localStorage.getItem("restaurants")
    ) || [];


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


function initialize() {

    if (
        restaurants.length === 0
    ) {

        restaurants = [

            {

                id: Date.now(),

                name: "山海鍋物",

                category: "火鍋",

                rating: 4.6,

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

                favorite: false

            },


            {

                id: Date.now() + 1,

                name: "Morning Coffee",

                category: "咖啡",

                rating: 4.8,

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

                menuImages: [],

                description:
                    "適合讀書與工作的咖啡廳。",

                favorite: false

            }

        ];


        saveRestaurants();

    }


    renderRestaurants();

}


// ==================================================
// LocalStorage
// ==================================================

function saveRestaurants() {

    localStorage.setItem(
        "restaurants",
        JSON.stringify(restaurants)
    );

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

function toggleFavorite(
    id
) {

    restaurants =
        restaurants.map(
            restaurant => {

                if (
                    restaurant.id === id
                ) {

                    return {

                        ...restaurant,

                        favorite:
                            !restaurant.favorite

                    };

                }


                return restaurant;

            }
        );


    saveRestaurants();

    renderRestaurants();

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
    event => {

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
            url => url !== ""
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


        // Edit

        if (
            editingId
        ) {

            restaurants =
                restaurants.map(
                    restaurant => {

                        if (
                            restaurant.id ==
                            editingId
                        ) {

                            return {

                                ...restaurant,

                                ...restaurantData

                            };

                        }


                        return restaurant;

                    }
                );

        }


        // Add

        else {

            restaurants.unshift({

                id:
                    Date.now(),

                ...restaurantData,

                favorite:
                    false

            });

        }


        saveRestaurants();

        renderRestaurants();

        closeRestaurantModal();


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

function deleteRestaurant(
    id
) {

    const restaurant =
        restaurants.find(
            restaurant =>
                restaurant.id === id
        );


    if (!restaurant) {
        return;
    }


    const confirmed =
        confirm(
            `確定要刪除「${restaurant.name}」嗎？`
        );


    if (!confirmed) {
        return;
    }


    restaurants =
        restaurants.filter(
            restaurant =>
                restaurant.id !== id
        );


    saveRestaurants();

    renderRestaurants();

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

            if (!input) {
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


    if (!preview) {
        return;
    }


    if (!imageUrl) {

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


    image.onload = () => {

        preview.innerHTML = "";

        image.alt =
            `菜單 ${menuNumber}`;

        image.className =
            "menu-preview-image";

        preview.appendChild(
            image
        );

    };


    image.onerror = () => {

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


    if (!input) {
        return;
    }


    input.value = "";


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


    let currentIndex = 0;


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
            `${restaurant.name} 菜單 ${
                currentIndex + 1
            }`;


        currentPage.textContent =
            currentIndex + 1;


        thumbnails.forEach(
            (thumbnail, thumbnailIndex) => {

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

                behavior: "smooth",

                block: "nearest",

                inline: "center"

            });

        }

    }


    // Previous

    prevButton.addEventListener(
        "click",
        () => {

            updateMenu(
                currentIndex - 1
            );

        }
    );


    // Next

    nextButton.addEventListener(
        "click",
        () => {

            updateMenu(
                currentIndex + 1
            );

        }
    );


    // Thumbnail

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


    // Swipe

    let touchStartX = 0;


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


    // Fullscreen

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


    // Close

    menuOverlay
        .querySelector(".menu-close")
        .addEventListener(
            "click",
            () => {

                menuOverlay.remove();

            }
        );


    // Background close

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


    // Keyboard

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
// ==================================================

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


    // ==================================================
    // Zoom State
    // ==================================================

    let scale = 1;

    let translateX = 0;

    let translateY = 0;


    const MIN_SCALE = 1;

    const MAX_SCALE = 4;


    // ==================================================
    // Touch State
    // ==================================================

    let touches = [];

    let isPinching = false;

    let isDragging = false;

    let lastTouchX = 0;

    let lastTouchY = 0;

    let pinchStartDistance = 0;

    let pinchStartScale = 1;

    let pinchCenterX = 0;

    let pinchCenterY = 0;


    // ==================================================
    // Double Tap
    // ==================================================

    let lastTapTime = 0;


    // ==================================================
    // Create Viewer
    // ==================================================

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


    // ==================================================
    // DOM
    // ==================================================

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


    // ==================================================
    // Apply Transform
    // ==================================================

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


    // ==================================================
    // Show Zoom Indicator
    // ==================================================

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


    // ==================================================
    // Reset Zoom
    // ==================================================

    function resetZoom(
        animate = true
    ) {

        scale = 1;

        translateX = 0;

        translateY = 0;


        applyTransform(
            animate
        );


        updateNavigation();

    }


    // ==================================================
    // Clamp Position
    // ==================================================

    function clampPosition() {

        if (
            scale <= 1
        ) {

            translateX = 0;

            translateY = 0;

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
                (imageWidth -
                    wrapperWidth) /
                    2
            );


        const maxY =
            Math.max(
                0,
                (imageHeight -
                    wrapperHeight) /
                    2
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


    // ==================================================
    // Set Zoom
    // ==================================================

    function setZoom(
        newScale,
        centerX = imageWrapper.clientWidth / 2,
        centerY = imageWrapper.clientHeight / 2
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
            newScale === oldScale
        ) {

            return;

        }


        // Zoom toward touch point

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


    // ==================================================
    // Update Navigation
    // ==================================================

    function updateNavigation() {

        prev.disabled =
            currentIndex === 0 ||
            scale > 1;


        next.disabled =
            currentIndex ===
                images.length - 1 ||
            scale > 1;

    }


    // ==================================================
    // Update Image
    // ==================================================

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
            `${restaurantName} 菜單 ${
                currentIndex + 1
            }`;


        counter.textContent =
            `${currentIndex + 1} / ${images.length}`;


        updateNavigation();

    }


    // ==================================================
    // Previous
    // ==================================================

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


    // ==================================================
    // Next
    // ==================================================

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


    // ==================================================
    // Close
    // ==================================================

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


    // ==================================================
    // Background Close
    // ==================================================

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


            // ------------------------------------------
            // Two fingers
            // ------------------------------------------

            if (
                touches.length === 2
            ) {

                isPinching = true;

                isDragging = false;


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


            // ------------------------------------------
            // One finger
            // ------------------------------------------

            if (
                touches.length === 1
            ) {

                isDragging = true;

                isPinching = false;


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


            // ------------------------------------------
            // Pinch
            // ------------------------------------------

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


                const newScale =
                    pinchStartScale *
                    distanceRatio;


                scale =
                    Math.max(
                        MIN_SCALE,
                        Math.min(
                            MAX_SCALE,
                            newScale
                        )
                    );


                // Move zoom center

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


                const oldScale =
                    pinchStartScale;


                const pointX =
                    centerX -
                    wrapperRect.width / 2;


                const pointY =
                    centerY -
                    wrapperRect.height / 2;


                const ratio =
                    scale /
                    oldScale;


                translateX =
                    pinchCenterX -
                    wrapperRect.left -
                    wrapperRect.width / 2;


                translateY =
                    pinchCenterY -
                    wrapperRect.top -
                    wrapperRect.height / 2;


                if (
                    oldScale !== 1
                ) {

                    translateX *=
                        ratio;

                    translateY *=
                        ratio;

                }


                clampPosition();

                applyTransform();

                showZoomIndicator();


                return;

            }


            // ------------------------------------------
            // One finger drag
            // ------------------------------------------

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


                const deltaX =
                    currentX -
                    lastTouchX;


                const deltaY =
                    currentY -
                    lastTouchY;


                translateX +=
                    deltaX;


                translateY +=
                    deltaY;


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


            // ------------------------------------------
            // Finish pinch
            // ------------------------------------------

            if (
                isPinching &&
                touches.length < 2
            ) {

                isPinching = false;


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


            // ------------------------------------------
            // Finish dragging
            // ------------------------------------------

            if (
                touches.length === 0
            ) {

                isDragging = false;

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

            touches = [];

            isPinching = false;

            isDragging = false;

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


                    scale = 2;


                    const pointX =
                        x -
                        rect.width / 2;


                    const pointY =
                        y -
                        rect.height / 2;


                    translateX =
                        -pointX;


                    translateY =
                        -pointY;


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
    // Mouse Wheel Zoom
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
                scale * zoomAmount,
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
            event.key ===
            "+"
            ||
            event.key ===
            "="
        ) {

            setZoom(
                scale + 0.25
            );

        }


        if (
            event.key ===
            "-"
        ) {

            setZoom(
                scale - 0.25
            );

        }


        if (
            event.key ===
            "0"
        ) {

            resetZoom();

        }

    }


    document.addEventListener(
        "keydown",
        keyboardHandler
    );


    // ==================================================
    // Image Load
    // ==================================================

    image.addEventListener(
        "load",
        () => {

            resetZoom(
                false
            );

        }
    );


    // ==================================================
    // Helpers
    // ==================================================

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


    // ==================================================
    // Initial
    // ==================================================

    updateFullscreen(
        currentIndex
    );

}


// ==================================================
// Initialize Menu Features
// ==================================================

initializeMenuPreview();

initializeMenuRemoveButtons();