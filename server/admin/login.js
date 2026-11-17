const loginForm =
    document.getElementById("loginForm");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const passwordToggle =
    document.getElementById("passwordToggle");

const loginButton =
    document.getElementById("loginButton");

const message =
    document.getElementById("message");


// ==================================================
// CHECK REQUIRED ELEMENTS
// ==================================================

if (
    !loginForm ||
    !emailInput ||
    !passwordInput ||
    !passwordToggle ||
    !loginButton ||
    !message
) {

    console.error(
        "ASF login page: required elements are missing."
    );

} else {


    // ==================================================
    // SHOW / HIDE PASSWORD
    // ==================================================

    passwordToggle.addEventListener(
        "click",
        function () {

            if (
                passwordInput.type ===
                "password"
            ) {

                passwordInput.type =
                    "text";

                passwordToggle.setAttribute(
                    "aria-label",
                    "Hide password"
                );

                passwordToggle.setAttribute(
                    "title",
                    "Hide password"
                );

            } else {

                passwordInput.type =
                    "password";

                passwordToggle.setAttribute(
                    "aria-label",
                    "Show password"
                );

                passwordToggle.setAttribute(
                    "title",
                    "Show password"
                );
            }
        }
    );


    // ==================================================
    // LOGIN
    // ==================================================

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            message.className =
                "message";

            message.textContent =
                "";


            const email =
                String(
                    emailInput.value || ""
                ).trim();


            const password =
                String(
                    passwordInput.value || ""
                );


            // ------------------------------------------
            // VALIDATE
            // ------------------------------------------

            if (
                email.length === 0 ||
                password.length === 0
            ) {

                message.className =
                    "message error";

                message.textContent =
                    "Please enter your email and password.";

                return;
            }


            // ------------------------------------------
            // DISABLE BUTTON
            // ------------------------------------------

            loginButton.disabled =
                true;

            loginButton.textContent =
                "Signing In...";


            try {

                // --------------------------------------
                // SEND LOGIN REQUEST
                // --------------------------------------

                const controller = new AbortController();
                const requestTimeout = window.setTimeout(
                    () => controller.abort(),
                    30000
                );

                let response;

                try {
                    response = await fetch(
                        "/api/admin/login",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                "Accept":
                                    "application/json"
                            },

                            credentials:
                                "include",

                            signal:
                                controller.signal,

                            body:
                                JSON.stringify({
                                    email:
                                        email,

                                    password:
                                        password
                                })
                        }
                    );
                } finally {
                    window.clearTimeout(requestTimeout);
                }


                // --------------------------------------
                // READ RESPONSE
                // --------------------------------------

                let data = {};


                try {

                    data =
                        await response.json();

                } catch (
                    jsonError
                ) {

                    console.error(
                        "ASF login: invalid server response.",
                        jsonError
                    );

                    data = {};
                }


                // --------------------------------------
                // LOGIN FAILED
                // --------------------------------------

                if (
                    !response.ok
                ) {

                    message.className =
                        "message error";

                    message.textContent =
                        data.error ||
                        "Invalid email or password.";

                    return;
                }


                // --------------------------------------
                // OTP REQUIRED
                // --------------------------------------

                if (
                    data.requiresOtp !==
                    true
                ) {

                    message.className =
                        "message error";

                    message.textContent =
                        "Login response was incomplete. Please try again.";

                    return;
                }


                // --------------------------------------
                // PASSWORD VERIFIED
                // --------------------------------------

                message.className =
                    "message success";

                message.textContent =
                    "Password verified. OTP required.";


                // --------------------------------------
                // OPEN OTP PAGE
                // --------------------------------------

                window.location.href =
                    "/admin/verify-otp";
            }


            catch (
                error
            ) {

                console.error(
                    "ASF admin login error:",
                    error
                );

                message.className =
                    "message error";

                message.textContent =
                    error && error.name === "AbortError"
                        ? "The login request timed out. Please try again."
                        : "Unable to connect to the server.";
            }


            finally {

                loginButton.disabled =
                    false;

                loginButton.textContent =
                    "Sign In";
            }
        }
    );
}
