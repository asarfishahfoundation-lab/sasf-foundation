

/*
    ==========================================
    PUBLIC WEBSITE CONTENT
    ==========================================
*/


async function loadPublicContent() {

    const managedByText =
        document.getElementById("managedByText");


    if (!managedByText) {
        return;
    }


    try {

        const content = await window.getFoundationSiteContent();
        if (!content) return;

/*
            The backend returns:

            {
                success: true,
                content: {
                    managed_by: "..."
                }
            }

            Therefore we read:
            content.managed_by
        */

        if (
            content &&
            typeof content.managed_by === "string" &&
            content.managed_by.trim() !== ""
        ) {

            managedByText.textContent =
                content.managed_by.trim();

        }

    } catch (error) {

        /*
            If the API is unavailable,
            the fallback text remains visible.
        */

        console.error(
            "Public content loading error:",
            error
        );

    }

}



/*
    Load editable website content
    when the page opens.
*/

loadPublicContent();




