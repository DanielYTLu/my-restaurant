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

export default AppLoading;