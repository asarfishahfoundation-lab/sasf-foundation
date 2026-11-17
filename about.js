

async function loadSiteContent() {

    try {

        const content = await window.getFoundationSiteContent();
        if (!content) return;

/* --------------------------------
           ABOUT HERO INTRODUCTION
        -------------------------------- */

        const aboutHeroIntroText =
            document.getElementById(
                "aboutHeroIntroText"
            );

        if (
            aboutHeroIntroText &&
            content.about_hero_intro
        ) {

            aboutHeroIntroText.textContent =
                content.about_hero_intro;

        }


        /* --------------------------------
           ABOUT STORY — PARAGRAPH 1
        -------------------------------- */

        const aboutStory1Text =
            document.getElementById(
                "aboutStory1Text"
            );

        if (
            aboutStory1Text &&
            content.about_story_1
        ) {

            aboutStory1Text.textContent =
                content.about_story_1;

        }


        /* --------------------------------
           ABOUT STORY — PARAGRAPH 2
        -------------------------------- */

        const aboutStory2Text =
            document.getElementById(
                "aboutStory2Text"
            );

        if (
            aboutStory2Text &&
            content.about_story_2
        ) {

            aboutStory2Text.textContent =
                content.about_story_2;

        }


        /* --------------------------------
           ABOUT STORY — PARAGRAPH 3
        -------------------------------- */

        const aboutStory3Text =
            document.getElementById(
                "aboutStory3Text"
            );

        if (
            aboutStory3Text &&
            content.about_story_3
        ) {

            aboutStory3Text.textContent =
                content.about_story_3;

        }


        /* --------------------------------
           MANAGED BY
        -------------------------------- */

        const managedBy =
            content.managed_by;


        const managedByText =
            document.getElementById(
                "managedByText"
            );


        const managedByDescriptionName =
            document.getElementById(
                "managedByDescriptionName"
            );


        if (
            managedBy &&
            managedByText
        ) {

            managedByText.textContent =
                managedBy + ".";

        }


        if (
            managedBy &&
            managedByDescriptionName
        ) {

            managedByDescriptionName.textContent =
                managedBy;

        }


        /* --------------------------------
           MANAGEMENT DESCRIPTION
        -------------------------------- */

        const managementDescription =
            document.getElementById(
                "managedByDescription"
            );


        if (
            managementDescription &&
            content.management_description
        ) {

            managementDescription.textContent =
                content.management_description;

        }


        /* --------------------------------
           FOUNDER NAME
        -------------------------------- */

        const founderNameText =
            document.getElementById(
                "founderNameText"
            );


        if (
            founderNameText &&
            content.founder_name
        ) {

            founderNameText.textContent =
                content.founder_name;

        }


        /* --------------------------------
           FOUNDER BIOGRAPHY
        -------------------------------- */

        const founderBioText =
            document.getElementById(
                "founderBioText"
            );


        if (
            founderBioText &&
            content.founder_bio
        ) {

            founderBioText.textContent =
                content.founder_bio;

        }


        /* --------------------------------
           FOUNDER BACKGROUND
        -------------------------------- */

        const founderBackgroundText =
            document.getElementById(
                "founderBackgroundText"
            );


        if (
            founderBackgroundText &&
            content.founder_background
        ) {

            founderBackgroundText.textContent =
                content.founder_background;

        }


        /* --------------------------------
           FOUNDER VISION
        -------------------------------- */

        const founderVisionText =
            document.getElementById(
                "founderVisionText"
            );


        if (
            founderVisionText &&
            content.founder_vision
        ) {

            founderVisionText.textContent =
                content.founder_vision;

        }


        const founderSocialLinks =
            document.getElementById("founderSocialLinks");

        if (founderSocialLinks) {
            founderSocialLinks.replaceChildren();

            let socialLinks = [];
            try {
                const parsedLinks = JSON.parse(content.founder_social_links || "[]");
                if (Array.isArray(parsedLinks)) {
                    socialLinks = parsedLinks;
                }
            } catch (error) {
                console.error("Unable to read founder links:", error);
            }

            socialLinks.forEach(link => {
                if (!link || typeof link.label !== "string" || typeof link.url !== "string") {
                    return;
                }

                try {
                    const url = new URL(link.url);
                    if (url.protocol !== "https:") {
                        return;
                    }

                    const anchor = document.createElement("a");
                    anchor.href = url.href;
                    anchor.textContent = link.label;
                    anchor.target = "_blank";
                    anchor.rel = "noopener noreferrer";
                    founderSocialLinks.appendChild(anchor);
                } catch (error) {
                    console.error("Skipping invalid founder link:", error);
                }
            });

            const founderEmail = String(content.founder_email || "").trim();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(founderEmail)) {
                const emailLink = document.createElement("a");
                emailLink.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(founderEmail)}`;
                emailLink.textContent = "Gmail";
                emailLink.target = "_blank";
                emailLink.rel = "noopener noreferrer";
                founderSocialLinks.appendChild(emailLink);
            }

            const founderPhone = String(content.founder_phone || "").trim();
            const dialablePhone = founderPhone.replace(/[^0-9+*#;,]/g, "");
            if (/[0-9]/.test(dialablePhone)) {
                const phoneLink = document.createElement("a");
                phoneLink.href = `tel:${dialablePhone}`;
                phoneLink.textContent = "Call";
                founderSocialLinks.appendChild(phoneLink);
            }

            founderSocialLinks.closest(".founder-social-section").hidden =
                founderSocialLinks.childElementCount === 0;
        }


        /* --------------------------------
           OUR VISION
        -------------------------------- */

        const aboutVisionText =
            document.getElementById(
                "aboutVisionText"
            );


        if (
            aboutVisionText &&
            content.about_vision
        ) {

            aboutVisionText.textContent =
                content.about_vision;

        }


        /* --------------------------------
           OUR MISSION
        -------------------------------- */

        const aboutMissionText =
            document.getElementById(
                "aboutMissionText"
            );


        if (
            aboutMissionText &&
            content.about_mission
        ) {

            aboutMissionText.textContent =
                content.about_mission;

        }


        /* --------------------------------
           OUR APPROACH
        -------------------------------- */

        const aboutApproachText =
            document.getElementById(
                "aboutApproachText"
            );


        if (
            aboutApproachText &&
            content.about_approach
        ) {

            aboutApproachText.textContent =
                content.about_approach;

        }


        /* --------------------------------
           VALUES INTRODUCTION
        -------------------------------- */

        const aboutValuesIntroText =
            document.getElementById(
                "aboutValuesIntroText"
            );


        if (
            aboutValuesIntroText &&
            content.about_values_intro
        ) {

            aboutValuesIntroText.textContent =
                content.about_values_intro;

        }


        /* --------------------------------
           COMPASSION
        -------------------------------- */

        const valueCompassionText =
            document.getElementById(
                "valueCompassionText"
            );


        if (
            valueCompassionText &&
            content.about_value_compassion
        ) {

            valueCompassionText.textContent =
                content.about_value_compassion;

        }


        /* --------------------------------
           DIGNITY
        -------------------------------- */

        const valueDignityText =
            document.getElementById(
                "valueDignityText"
            );


        if (
            valueDignityText &&
            content.about_value_dignity
        ) {

            valueDignityText.textContent =
                content.about_value_dignity;

        }


        /* --------------------------------
           OPPORTUNITY
        -------------------------------- */

        const valueOpportunityText =
            document.getElementById(
                "valueOpportunityText"
            );


        if (
            valueOpportunityText &&
            content.about_value_opportunity
        ) {

            valueOpportunityText.textContent =
                content.about_value_opportunity;

        }


        /* --------------------------------
           RESPONSIBILITY
        -------------------------------- */

        const valueResponsibilityText =
            document.getElementById(
                "valueResponsibilityText"
            );


        if (
            valueResponsibilityText &&
            content.about_value_responsibility
        ) {

            valueResponsibilityText.textContent =
                content.about_value_responsibility;

        }

    } catch (error) {

        console.error(
            "Unable to load website content:",
            error
        );

    }

}


loadSiteContent();

