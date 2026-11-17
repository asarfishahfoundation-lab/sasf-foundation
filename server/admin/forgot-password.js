const steps = {
    captcha: document.getElementById("captchaStep"),
    email: document.getElementById("emailStep"),
    code: document.getElementById("codeStep"),
    password: document.getElementById("passwordStep")
};
const message = document.getElementById("message");
const captchaImage = document.getElementById("captchaImage");

function bindPasswordToggle(inputId, buttonId, label) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    if (!input || !button) return;

    button.addEventListener("click", () => {
        const showPassword = input.type === "password";
        input.type = showPassword ? "text" : "password";
        button.setAttribute("aria-label", `${showPassword ? "Hide" : "Show"} ${label}`);
        button.title = `${showPassword ? "Hide" : "Show"} password`;
    });
}

bindPasswordToggle("newPassword", "newPasswordToggle", "new password");
bindPasswordToggle("confirmPassword", "confirmPasswordToggle", "confirmation password");

function showMessage(text, type = "error") {
    message.className = `message ${type}`;
    message.textContent = text;
}

function showStep(name) {
    Object.entries(steps).forEach(([key, element]) => {
        element.hidden = key !== name;
    });
    message.className = "message";
    message.textContent = "";
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to complete this step.");
    return data;
}

async function loadCaptcha() {
    // Load the SVG directly from the same origin. Blob URLs are blocked by
    // the site's restrictive img-src CSP in some browsers.
    captchaImage.src = `/api/admin/password-reset/captcha?fresh=${Date.now()}`;
    document.getElementById("captchaAnswer").value = "";
    showMessage("", "");
}

document.getElementById("captchaRefresh").addEventListener("click", loadCaptcha);

document.getElementById("captchaForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("captchaButton");
    button.disabled = true;
    try {
        await postJson("/api/admin/password-reset/verify-captcha", {
            answer: document.getElementById("captchaAnswer").value
        });
        showStep("email");
        document.getElementById("recoveryEmail").focus();
    } catch (error) {
        showMessage(error.message);
        await loadCaptcha();
    } finally {
        button.disabled = false;
    }
});

document.getElementById("emailForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("emailButton");
    button.disabled = true;
    try {
        const result = await postJson("/api/admin/password-reset/request", {
            email: document.getElementById("recoveryEmail").value.trim()
        });
        showStep("code");
        showMessage(result.message, "success");
        document.getElementById("recoveryCode").focus();
    } catch (error) {
        showMessage(error.message);
    } finally {
        button.disabled = false;
    }
});

document.getElementById("codeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("codeButton");
    button.disabled = true;
    try {
        await postJson("/api/admin/password-reset/verify-code", {
            code: document.getElementById("recoveryCode").value.trim()
        });
        showStep("password");
        document.getElementById("newPassword").focus();
    } catch (error) {
        showMessage(error.message);
    } finally {
        button.disabled = false;
    }
});

document.getElementById("passwordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.getElementById("newPassword").value;
    const confirmation = document.getElementById("confirmPassword").value;
    if (password !== confirmation) {
        showMessage("The passwords do not match.");
        return;
    }
    const button = document.getElementById("passwordButton");
    button.disabled = true;
    try {
        await postJson("/api/admin/password-reset/complete", { password, confirmation });
        showStep("captcha");
        showMessage("Your password has been updated. Sign in with your new password.", "success");
        window.setTimeout(() => { window.location.href = "/admin/login"; }, 2200);
    } catch (error) {
        showMessage(error.message);
    } finally {
        button.disabled = false;
    }
});

loadCaptcha();
