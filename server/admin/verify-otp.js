const otpForm =
    document.getElementById("otpForm");

const otpInput =
    document.getElementById("otp");

const verifyButton =
    document.getElementById("verifyButton");

const status =
    document.getElementById("status");


// ==================================================
// CHECK REQUIRED ELEMENTS
// ==================================================

if (
    !otpForm ||
    !otpInput ||
    !verifyButton ||
    !status
) {

    console.error(
        "ASF OTP page: required elements are missing."
    );

} else {


    // ==================================================
    // OTP INPUT
    // ==================================================

    otpInput.addEventListener(
        "input",
        function () {

            otpInput.value =
                otpInput.value
                    .replace(/\D/g, "")
                    .slice(0, 6);
        }
    );


    // ==================================================
    // VERIFY OTP
    // ==================================================

    otpForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const otp =
                otpInput.value.trim();


            status.textContent =
                "";

            status.className =
                "status";


            // ------------------------------------------
            // VALIDATE OTP
            // ------------------------------------------

            if (
                !/^\d{6}$/.test(
                    otp
                )
            ) {

                status.textContent =
                    "Please enter the six-digit verification code.";

                status.classList.add(
                    "error"
                );

                otpInput.focus();

                return;
            }


            // ------------------------------------------
            // DISABLE BUTTON
            // ------------------------------------------

            verifyButton.disabled =
                true;

            verifyButton.textContent =
                "Verifying...";


            try {

                // --------------------------------------
                // SEND OTP TO SERVER
                // --------------------------------------

                const response =
                    await fetch(
                        "/api/admin/verify-otp",
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

                            body:
                                JSON.stringify({
                                    otp:
                                        otp
                                })
                        }
                    );


                // --------------------------------------
                // READ SERVER RESPONSE
                // --------------------------------------

                let data = {};


                try {

                    data =
                        await response.json();

                } catch (
                    jsonError
                ) {

                    console.error(
                        "ASF OTP: invalid server response.",
                        jsonError
                    );

                    data = {};
                }


                // --------------------------------------
                // VERIFICATION FAILED
                // --------------------------------------

                if (
                    !response.ok
                ) {

                    throw new Error(
                        data.error ||
                        "Verification failed."
                    );
                }


                // --------------------------------------
                // VERIFICATION SUCCESSFUL
                // --------------------------------------

                status.textContent =
                    "Verification successful. Opening dashboard...";

                status.classList.add(
                    "success"
                );


                // --------------------------------------
                // OPEN DASHBOARD
                // --------------------------------------

                setTimeout(
                    function () {

                        window.location.href =
                            "/admin/dashboard";

                    },
                    500
                );


            } catch (
                error
            ) {

                console.error(
                    "ASF OTP verification error:",
                    error
                );


                status.textContent =
                    error.message ||
                    "Unable to verify the code.";

                status.classList.add(
                    "error"
                );


                otpInput.value =
                    "";

                otpInput.focus();


                verifyButton.disabled =
                    false;

                verifyButton.textContent =
                    "Verify & Continue";
            }
        }
    );
}