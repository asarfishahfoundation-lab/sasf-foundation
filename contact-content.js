async function loadSiteContent() {

    try {

        const content = await window.getFoundationSiteContent();
        if (!content) return;

/*
         * =====================================
         * HELPER FUNCTIONS
         * =====================================
         */

        function getContent(key, fallback) {

            const value =
                content[key];

            if (
                typeof value === "string" &&
                value.trim() !== ""
            ) {

                return value.trim();

            }

            return fallback;

        }


        function setText(
            elementId,
            value
        ) {

            const element =
                document.getElementById(
                    elementId
                );


            if (element) {

                element.textContent =
                    value;

            }

        }


        function setLink(
            elementId,
            href
        ) {

            const element =
                document.getElementById(
                    elementId
                );


            if (element) {

                element.href =
                    href;

                if (href.startsWith("https://mail.google.com/")) {
                    element.target = "_blank";
                    element.rel = "noopener noreferrer";
                }

            }

        }


        /*
         * =====================================
         * FOUNDATION INFORMATION
         * =====================================
         */

        const foundationName =
            getContent(
                "foundation_name",
                "Shree Asarfi Shah Foundation"
            );


        const managedBy =
            getContent(
                "managed_by",
                "Nayak IT Foundation"
            );


        const address =
            getContent(
                "address",
                "Kathmandu, Nepal"
            );


        const email =
            getContent(
                "contact_email",
                "raghben.shah@gmail.com"
            );


        const primaryWhatsapp =
            getContent(
                "whatsapp_primary",
                "+977-9801088875"
            );


        const secondaryWhatsapp =
            getContent(
                "whatsapp_secondary",
                "+977-9812035423"
            );


        /*
         * =====================================
         * FOUNDER INFORMATION
         * =====================================
         */

        /*
         * =====================================
         * CLEAN WHATSAPP NUMBERS
         * =====================================
         *
         * Converts:
         *
         * +977-9801088875
         *
         * into:
         *
         * 9779801088875
         *
         * for WhatsApp URLs.
         */

        const primaryWhatsappUrl =
            "https://wa.me/" +
            primaryWhatsapp.replace(
                /[^0-9]/g,
                ""
            );


        const secondaryWhatsappUrl =
            "https://wa.me/" +
            secondaryWhatsapp.replace(
                /[^0-9]/g,
                ""
            );


        /*
         * =====================================
         * UPDATE FOUNDATION NAME
         * =====================================
         */

        setText(
            "contactHeaderFoundationName",
            foundationName
        );


        setText(
            "contactFooterFoundationName",
            foundationName
        );


        setText(
            "contactCopyrightFoundation",
            foundationName
        );


        /*
         * =====================================
         * UPDATE MANAGED BY
         * =====================================
         */

        setText(
            "contactManagedByText",
            managedBy
        );


        setText(
            "contactFooterManagedBy",
            managedBy
        );


        /*
         * =====================================
         * UPDATE ADDRESS
         * =====================================
         */

        setText(
            "contactAddressText",
            address
        );


        setText(
            "contactFooterAddress",
            address
        );


        /*
         * =====================================
         * UPDATE EMAIL
         * =====================================
         */

        setText(
            "contactEmailText",
            email
        );


        setText(
            "contactFooterEmail",
            email
        );


        setLink(
            "contactEmailLink",
            "https://mail.google.com/mail/?view=cm&fs=1&to=" +
                encodeURIComponent(email)
        );


        setLink(
            "contactFinalEmailLink",
            "https://mail.google.com/mail/?view=cm&fs=1&to=" +
                encodeURIComponent(email)
        );


        setLink(
            "contactFooterEmailLink",
            "https://mail.google.com/mail/?view=cm&fs=1&to=" +
                encodeURIComponent(email)
        );


        /*
         * =====================================
         * UPDATE WHATSAPP 1
         * =====================================
         */

        setText(
            "contactWhatsappPrimaryText",
            primaryWhatsapp
        );


        setLink(
            "contactWhatsappPrimaryLink",
            primaryWhatsappUrl
        );


        /*
         * =====================================
         * UPDATE WHATSAPP 2
         * =====================================
         */

        setText(
            "contactWhatsappSecondaryText",
            secondaryWhatsapp
        );


        setLink(
            "contactWhatsappSecondaryLink",
            secondaryWhatsappUrl
        );


        /*
         * =====================================
         * UPDATE PAGE TITLE
         * =====================================
         */

        document.title =
            "Contact | " +
            foundationName;


    } catch (error) {

        console.error(
            "Unable to load website content:",
            error
        );

    }

}


/*
 * Load database content after
 * the page has loaded.
 */

loadSiteContent();

