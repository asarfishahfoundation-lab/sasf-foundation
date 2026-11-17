

const contactForm =
    document.getElementById("contactForm");

const formMessage =
    document.getElementById("formMessage");

const contactSubmitButton =
    document.getElementById("contactSubmitButton");


contactForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const name =
            document.getElementById("name")
                .value
                .trim();

        const email =
            document.getElementById("email")
                .value
                .trim();

        const subject =
            document.getElementById("subject")
                .value
                .trim();

        const message =
            document.getElementById("message")
                .value
                .trim();


        /*
         * Basic browser-side validation.
         * The backend performs the important
         * security validation as well.
         */

        if (!name || !email || !message) {

            formMessage.textContent =
                "Please fill in all required fields.";

            return;
        }


        if (name.length > 100) {

            formMessage.textContent =
                "Your name is too long.";

            return;
        }


        if (email.length > 254) {

            formMessage.textContent =
                "Please enter a valid email address.";

            return;
        }


        if (subject.length > 200) {

            formMessage.textContent =
                "Your subject is too long.";

            return;
        }


        if (message.length > 5000) {

            formMessage.textContent =
                "Your message is too long.";

            return;
        }


        formMessage.textContent =
            "Sending message...";


        contactSubmitButton.disabled = true;

        contactSubmitButton.textContent =
            "SENDING...";


        try {

            /*
             * Same-origin request.
             *
             * This is intentionally NOT:
             * http://localhost:3000/api/contact
             *
             * Using /api/contact allows the same
             * website to work when deployed online.
             */

            const response =
                await fetch(
                    "/api/contact",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        credentials: "same-origin",

                        body: JSON.stringify({
                            name: name,
                            email: email,
                            subject: subject,
                            message: message
                        })
                    }
                );


            let data = {};

            try {

                data =
                    await response.json();

            } catch (jsonError) {

                data = {};

            }


            if (
                response.ok &&
                data.success
            ) {

                formMessage.textContent =
                    "Thank you! Your message has been received.";

                contactForm.reset();

            } else {

                formMessage.textContent =
                    data.message ||
                    data.error ||
                    "Something went wrong. Please try again.";

            }


        } catch (error) {

            console.error(
                "Contact form error:",
                error
            );

            formMessage.textContent =
                "Unable to connect to the server. Please try again later.";

        } finally {

            contactSubmitButton.disabled = false;

            contactSubmitButton.textContent =
                "SEND MESSAGE";

        }

    }
);
