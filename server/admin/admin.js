

        // ==================================================
        // GLOBAL STATE
        // ==================================================
let currentAdmin = null;
let canGrantPermissions = false;
let grantableSections = [];
let editableSections = [];
let selectedRoleUserId = null;
let selectedPermissionUserId = null;
let selectedPermissionUser = null;

        // ==================================================
        // ELEMENTS
        // ==================================================

        const welcomeTitle =
            document.getElementById(
                "welcomeTitle"
            );

        const globalMessage =
            document.getElementById(
                "globalMessage"
            );

        const userManagementSection =
            document.getElementById(
                "userManagementSection"
            );

        const contentManagementSection =
            document.getElementById(
                "contentManagementSection"
            );

        const pictureManagementSection =
            document.getElementById("pictureManagementSection");

        const picturePageGroups =
            document.getElementById("picturePageGroups");

        const picturePermissionNotice =
            document.getElementById("picturePermissionNotice");

        const founderSocialRows =
            document.getElementById("founderSocialRows");

        const addFounderSocialLinkButton =
            document.getElementById("addFounderSocialLink");

        const saveFounderSocialLinksButton =
            document.getElementById("saveFounderSocialLinks");

        const usersTableBody =
            document.getElementById(
                "usersTableBody"
            );

        const contactCount =
            document.getElementById(
                "contactCount"
            );

        const subscriberCount =
            document.getElementById(
                "subscriberCount"
            );

        const adminCount =
            document.getElementById(
                "adminCount"
            );

        const openAddAdminButton =
            document.getElementById(
                "openAddAdminButton"
            );

        const contentPermissionNotice =
            document.getElementById(
                "contentPermissionNotice"
            );

        // ==================================================
        // MESSAGE
        // ==================================================

        function showMessage(
            text,
            type = "success"
        ) {

            globalMessage.textContent =
                text;

            globalMessage.className =
                `message show ${type}`;

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            setTimeout(() => {

                globalMessage.className =
                    "message";

            }, 5000);

        }

        // ==================================================
        // HTML ESCAPE
        // ==================================================

        function escapeHtml(value) {

            return String(
                value ?? ""
            )
                .replace(
                    /&/g,
                    "&amp;"
                )
                .replace(
                    /</g,
                    "&lt;"
                )
                .replace(
                    />/g,
                    "&gt;"
                )
                .replace(
                    /"/g,
                    "&quot;"
                )
                .replace(
                    /'/g,
                    "&#039;"
                );

        }

        // ==================================================
        // DATE FORMAT
        // ==================================================

        function formatDate(
            value
        ) {

            if (!value) {
                return "—";
            }

            const date =
                new Date(
                    value.replace(
                        " ",
                        "T"
                    ) + "Z"
                );

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return value;
            }

            return date.toLocaleString(
                undefined,
                {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                }
            );

        }

        // ==================================================
        // ROLE BADGE
        // ==================================================

        function getRoleBadge(
            role
        ) {

            if (
                role === "super_admin"
            ) {

                return `
                    <span class="badge badge-super">
                        Super Admin
                    </span>
                `;

            }

            if (
                role === "admin"
            ) {

                return `
                    <span class="badge badge-admin">
                        Admin
                    </span>
                `;

            }

            return `
                <span class="badge badge-staff">
                    Staff Admin
                </span>
            `;

        }

        // ==================================================
        // STATUS BADGE
        // ==================================================

        function getStatusBadge(
            isActive
        ) {

            if (
                Number(isActive) === 1
            ) {

                return `
                    <span class="badge badge-active">
                        Active
                    </span>
                `;

            }

            return `
                <span class="badge badge-inactive">
                    Disabled
                </span>
            `;

        }

        // ==================================================
        // WEBSITE SECTION LABELS
        // ==================================================

        const sectionLabels = {

            homepage:
                "Homepage",

            about:
                "About Page",

            founder:
                "Founder",

            contact:
                "Contact Information",

            work:
                "Our Work",

            get_involved:
                "Get Involved"

        };

        // ==================================================
        // CONTENT SECTION PERMISSION HELPERS
        // ==================================================

       const contentSectionKeys = {

    homepage: [
        "foundation_name",
        "foundation_short_name",
        "managed_by",
        "home_intro"
    ],

    about: [
        "about_description",
        "about_hero_intro"
    ],

    founder: [
        "founder_name",
        "founder_bio",
        "founder_background"
    ],

    contact: [
        "contact_email",
        "contact_phone",
        "whatsapp_primary",
        "whatsapp_secondary",
        "address"
    ]

};

function isSuperAdmin() {

    return Boolean(
        currentAdmin &&
        currentAdmin.role ===
            "super_admin"
    );

}

function hasEditPermission(
    section
) {

    return Boolean(
        currentAdmin &&
        ["super_admin", "admin", "staff_admin"].includes(
            currentAdmin.role
        ) &&
        editableSections.includes(section)
    );

}

function hasFullWebsiteContentAccess() {

    return Boolean(
        currentAdmin &&
        Object.keys(contentSectionKeys).every(
            section => editableSections.includes(section)
        )
    );

}

function hasAnyContentEditPermission() {

    return Object.keys(
        contentSectionKeys
    ).some(
        section =>
            editableSections.includes(
                section
            )
    );

}

        // ==================================================
        // APPLY CONTENT PERMISSIONS
        // ==================================================

       function applyContentPermissions() {

    const contentCategories =
        document.querySelectorAll(
            "[data-content-section]"
        );

    const contentFields =
        document.querySelectorAll(
            "[data-permission-section]"
        );

    if (hasFullWebsiteContentAccess()) {

        contentManagementSection.style.display =
            "block";

        contentPermissionNotice.style.display =
            "none";

        contentCategories.forEach(
            category => {

                category.style.display =
                    "";

            }
        );

        contentFields.forEach(
            field => {

                field.style.display =
                    "";

                const input =
                    field.querySelector(
                        "input, textarea"
                    );

                const button =
                    field.querySelector(
                        ".save-content-button"
                    );

                if (input) {

                    input.disabled =
                        false;

                }

                if (button) {

                    button.style.display =
                        "";

                }

                field.querySelectorAll(".founder-social-editor-actions button, .founder-social-row input").forEach(control => {
                    control.disabled = false;
                    control.style.display = "";
                });

            }
        );

        return;

    }

    if (
        !hasAnyContentEditPermission()
    ) {

        contentManagementSection.style.display =
            "none";

        return;

    }

    contentManagementSection.style.display =
        "block";

    contentPermissionNotice.style.display =
        "block";

    contentPermissionNotice.innerHTML = `
        <strong>Limited content access:</strong>
        You can edit only the website sections that have
        been granted to your administrator account.
    `;

    contentFields.forEach(
        field => {

            const section =
                field.dataset.permissionSection;

            const allowed =
                editableSections.includes(
                    section
                );

            field.style.display =
                allowed
                    ? ""
                    : "none";

            const input =
                field.querySelector(
                    "input, textarea"
                );

            const button =
                field.querySelector(
                    ".save-content-button"
                );

            if (input) {

                input.disabled =
                    !allowed;

            }

            if (button) {

                button.style.display =
                    allowed
                        ? ""
                        : "none";

            }

            field.querySelectorAll(".founder-social-editor-actions button, .founder-social-row input").forEach(control => {
                control.disabled = !allowed;
                control.style.display = allowed ? "" : "none";
            });

        }
    );

    contentCategories.forEach(
        category => {

            const categoryFields =
                category.querySelectorAll(
                    "[data-permission-section]"
                );

            const hasVisibleField =
                Array.from(
                    categoryFields
                ).some(
                    field =>
                        field.style.display !==
                        "none"
                );

            category.style.display =
                hasVisibleField
                    ? ""
                    : "none";

        }
    );

}

        // ==================================================
        // LOAD CURRENT ADMIN
        // ==================================================

       
async function loadCurrentAdmin() {

    try {

        const response =
            await fetch(
                "/api/admin/me",
                {
                    credentials:
                        "include"
                }
            );

        if (
            response.status === 401
        ) {

            window.location.href =
                "/admin/login";

            return;

        }

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.user
        ) {

            throw new Error(
                "Unable to load administrator information."
            );

        }

        currentAdmin =
            data.user;

        canGrantPermissions =
            Boolean(
                data.canGrantPermissions
            );

        grantableSections =
            Array.isArray(
                data.grantableSections
            )
                ? data.grantableSections
                : [];

        editableSections =
            Array.isArray(
                data.editableSections
            )
                ? data.editableSections
                : [];

        welcomeTitle.textContent =
            `Welcome, ${currentAdmin.name}`;

        const canViewCommunicationData =
            ["super_admin", "admin"].includes(currentAdmin.role);

        document
            .querySelectorAll("[data-sensitive-dashboard]")
            .forEach(element => {
                element.hidden = !canViewCommunicationData;
            });


        /*
         * SUPER ADMIN
         *
         * Full dashboard access.
         */
        if (
            currentAdmin.role ===
            "super_admin"
        ) {

            userManagementSection.style.display =
                "block";

            contentManagementSection.style.display =
                "block";

            openAddAdminButton.style.display =
                "inline-flex";

            return;

        }


        /*
         * ADMIN WITH GRANT PERMISSION
         *
         * This administrator may manage
         * Staff Admin permissions.
         *
         * Content access is controlled separately
         * through editableSections.
         */
        if (
            currentAdmin.role === "admin" &&
            canGrantPermissions
        ) {

            userManagementSection.style.display =
                "block";

            openAddAdminButton.style.display =
                "none";

        } else {

            userManagementSection.style.display =
                "none";

            openAddAdminButton.style.display =
                "none";

        }


        /*
         * WEBSITE CONTENT ACCESS
         *
         * Admins and Staff Admins can see the
         * content-management area only when they
         * have at least one editable section.
         */
        if (
            hasAnyContentEditPermission()
        ) {

            contentManagementSection.style.display =
                "block";

        } else {

            contentManagementSection.style.display =
                "none";

        }

    } catch (error) {

        console.error(
            "Current admin error:",
            error
        );

        welcomeTitle.textContent =
            "Welcome, Admin";

    }

}
        // ==================================================
        // LOGOUT
        // ==================================================

        document
            .getElementById(
                "logoutButton"
            )
            .addEventListener(
                "click",
                async () => {

                    try {

                        await fetch(
                            "/api/admin/logout",
                            {
                                method:
                                    "POST",

                                credentials:
                                    "include"
                            }
                        );

                    } catch (error) {

                        console.error(
                            "Logout error:",
                            error
                        );

                    }

                    window.location.href =
                        "/admin/login";

                }
            );

        // ==================================================
        // ADD ADMIN PANEL
        // ==================================================

        const addAdminPanel =
            document.getElementById(
                "addAdminPanel"
            );

        openAddAdminButton
            .addEventListener(
                "click",
                () => {

                    if (
                        !isSuperAdmin()
                    ) {
                        return;
                    }

                    addAdminPanel.classList.add(
                        "show"
                    );

                    document
                        .getElementById(
                            "adminName"
                        )
                        .focus();

                }
            );

        document
            .getElementById(
                "cancelAddAdminButton"
            )
            .addEventListener(
                "click",
                () => {

                    addAdminPanel.classList.remove(
                        "show"
                    );

                    document
                        .getElementById(
                            "addAdminForm"
                        )
                        .reset();

                }
            );

        // ==================================================
        // ADD ADMIN
        // ==================================================

        document
            .getElementById(
                "addAdminForm"
            )
            .addEventListener(
                "submit",
                async (event) => {

                    event.preventDefault();

                    if (
                        !isSuperAdmin()
                    ) {

                        showMessage(
                            "Only Super Admin can create administrator accounts.",
                            "error"
                        );

                        return;

                    }

                    const name =
                        document
                            .getElementById(
                                "adminName"
                            )
                            .value
                            .trim();

                    const email =
                        document
                            .getElementById(
                                "adminEmail"
                            )
                            .value
                            .trim();

                    const phone =
                        document
                            .getElementById(
                                "adminPhone"
                            )
                            .value
                            .trim();

                    const role =
                        document
                            .getElementById(
                                "adminRole"
                            )
                            .value;

                    const password =
                        document
                            .getElementById(
                                "adminPassword"
                            )
                            .value;

                    try {

                        const response =
                            await fetch(
                                "/api/admin/users",
                                {
                                    method:
                                        "POST",

                                    credentials:
                                        "include",

                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },

                                    body:
                                        JSON.stringify({
                                            name,
                                            email,
                                            phone,
                                            role,
                                            password
                                        })
                                }
                            );

                        const data =
                            await response.json();

                        if (
                            response.status ===
                            401
                        ) {

                            window.location.href =
                                "/admin/login";

                            return;

                        }

                        if (
                            !response.ok
                        ) {

                            throw new Error(
                                data.error ||
                                "Unable to create administrator."
                            );

                        }

                        showMessage(
                            "Administrator account created successfully.",
                            "success"
                        );

                        document
                            .getElementById(
                                "addAdminForm"
                            )
                            .reset();

                        addAdminPanel.classList.remove(
                            "show"
                        );

                        await loadUsers();

                    } catch (error) {

                        console.error(
                            "Add admin error:",
                            error
                        );

                        showMessage(
                            error.message,
                            "error"
                        );

                    }

                }
            );

        // ==================================================
        // LOAD USERS
        // ==================================================

        async function loadUsers() {

            /*
             * Only Super Admin and an Admin with
             * grant permission should load the
             * administrator management table.
             */
            if (
                !isSuperAdmin() &&
                !(
                    currentAdmin &&
                    currentAdmin.role === "admin" &&
                    canGrantPermissions
                )
            ) {

                return;

            }

            try {

                const response =
                    await fetch(
                        "/api/admin/users",
                        {
                            credentials:
                                "include"
                        }
                    );

                if (
                    response.status === 401
                ) {

                    window.location.href =
                        "/admin/login";

                    return;

                }

                if (
                    response.status === 403
                ) {

                    userManagementSection.style.display =
                        "none";

                    return;

                }

                const data =
                    await response.json();

                if (
                    !response.ok
                ) {

                    throw new Error(
                        data.error ||
                        "Unable to load users."
                    );

                }

                const users =
                    Array.isArray(
                        data.users
                    )
                        ? data.users
                        : [];

                adminCount.textContent =
                    users.length;

                if (
                    users.length === 0
                ) {

                    usersTableBody.innerHTML = `
                        <tr>
                            <td
                                colspan="7"
                                class="table-message"
                            >
                                No administrator accounts found.
                            </td>
                        </tr>
                    `;

                    return;

                }

                const renderedRows =
                    users
                        .map(
                            user =>
                                renderUserRow(
                                    user
                                )
                        )
                        .filter(
                            row =>
                                row !== ""
                        )
                        .join("");

                usersTableBody.innerHTML =
                    renderedRows ||
                    `
                        <tr>
                            <td
                                colspan="7"
                                class="table-message"
                            >
                                No administrator accounts are available to manage.
                            </td>
                        </tr>
                    `;

            } catch (error) {

                console.error(
                    "Users error:",
                    error
                );

                usersTableBody.innerHTML = `
                    <tr>
                        <td
                            colspan="7"
                            class="table-message"
                        >
                            Unable to load administrator accounts.
                        </td>
                    </tr>
                `;

                showMessage(
                    error.message,
                    "error"
                );

            }

        }

        // ==================================================
        // RENDER USER ROW
        // ==================================================

        function renderUserRow(
            user
        ) {

            const isCurrentUser =
                currentAdmin &&
                Number(user.id) ===
                Number(currentAdmin.id);

            /*
             * CURRENT USER
             *
             * Never allow the dashboard to expose
             * self-management controls.
             */
            if (
                isCurrentUser
            ) {

                return `
                    <tr>

                        <td>
                            <div class="user-name">
                                ${escapeHtml(user.name)}
                            </div>
                        </td>

                        <td>
                            <div class="user-email">
                                ${escapeHtml(user.email)}
                            </div>
                        </td>

                        <td>
                            ${escapeHtml(user.phone)}
                        </td>

                        <td>
                            ${getRoleBadge(user.role)}
                        </td>

                        <td>
                            ${getStatusBadge(user.is_active)}
                        </td>

                        <td>
                            ${formatDate(user.created_at)}
                        </td>

                        <td class="actions-cell">

                            <span class="protected-label">

                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.8"
                                    aria-hidden="true"
                                >
                                    <rect
                                        x="5"
                                        y="10"
                                        width="14"
                                        height="10"
                                        rx="2"
                                    />

                                    <path
                                        d="M8 10V7a4 4 0 0 1 8 0v3"
                                    />

                                </svg>

                                Protected

                            </span>

                        </td>

                    </tr>
                `;

            }

            /*
             * ==================================================
             * SUPER ADMIN
             * ==================================================
             *
             * Super Admin can:
             * - Grant Permissions
             * - Change Role
             * - Enable / Disable
             *
             * Super Admin cannot use Grant Permissions
             * on another Super Admin.
             */
            if (
                currentAdmin &&
                currentAdmin.role ===
                    "super_admin"
            ) {

                const permissionButton =
                    user.role !==
                        "super_admin"
                        ? `
                            <button
                                type="button"
                                class="action-button permission"
                                data-action="permissions"
                                data-user-id="${Number(user.id)}"
                            >

                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.8"
                                    aria-hidden="true"
                                >
                                    <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
                                    <path d="M9 12l2 2 4-4" />
                                </svg>

                                Grant Permissions

                            </button>
                        `
                        : "";

                const statusButton =
                    Number(
                        user.is_active
                    ) === 1
                        ? `
                            <button
                                type="button"
                                class="action-button disable"
                                data-action="user-status"
                                data-user-id="${Number(user.id)}"
                                data-active="false"
                            >

                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.8"
                                    aria-hidden="true"
                                >
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="8"
                                    />

                                    <path d="M8 12h8" />

                                </svg>

                                Disable

                            </button>
                        `
                        : `
                            <button
                                type="button"
                                class="action-button enable"
                                data-action="user-status"
                                data-user-id="${Number(user.id)}"
                                data-active="true"
                            >

                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.8"
                                    aria-hidden="true"
                                >
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="8"
                                    />

                                    <path d="M12 8v8" />
                                    <path d="M8 12h8" />

                                </svg>

                                Enable

                            </button>
                        `;

                return `
                    <tr>

                        <td>
                            <div class="user-name">
                                ${escapeHtml(user.name)}
                            </div>
                        </td>

                        <td>
                            <div class="user-email">
                                ${escapeHtml(user.email)}
                            </div>
                        </td>

                        <td>
                            ${escapeHtml(user.phone)}
                        </td>

                        <td>
                            ${getRoleBadge(user.role)}
                        </td>

                        <td>
                            ${getStatusBadge(user.is_active)}
                        </td>

                        <td>
                            ${formatDate(user.created_at)}
                        </td>

                        <td class="actions-cell">

                            <div class="action-group">

                                ${permissionButton}

                                <button
                                    type="button"
                                    class="action-button role"
                                    data-action="role"
                                    data-user-id="${Number(user.id)}"
                                >

                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="1.8"
                                        aria-hidden="true"
                                    >
                                        <path d="M12 3v18" />
                                        <path d="M5 7h14" />
                                        <path d="M7 7l-3 5a3 3 0 0 0 6 0L7 7" />
                                        <path d="M17 7l-3 5a3 3 0 0 0 6 0l-3-5" />
                                    </svg>

                                    Change Role

                                </button>

                                ${statusButton}

                            </div>

                        </td>

                    </tr>
                `;

            }

            /*
             * ==================================================
             * ADMIN WITH GRANT PERMISSION
             * ==================================================
             *
             * Admin can ONLY:
             * - See Staff Admin accounts
             * - Grant permissions to Staff Admins
             *
             * Admin cannot:
             * - Change roles
             * - Disable accounts
             * - Enable accounts
             * - Manage other Admins
             * - Manage Super Admins
             */
            if (
                currentAdmin &&
                currentAdmin.role === "admin" &&
                canGrantPermissions
            ) {

                if (
                    user.role !==
                    "staff_admin"
                ) {

                    return "";

                }

                return `
                    <tr>

                        <td>
                            <div class="user-name">
                                ${escapeHtml(user.name)}
                            </div>
                        </td>

                        <td>
                            <div class="user-email">
                                ${escapeHtml(user.email)}
                            </div>
                        </td>

                        <td>
                            ${escapeHtml(user.phone)}
                        </td>

                        <td>
                            ${getRoleBadge(user.role)}
                        </td>

                        <td>
                            ${getStatusBadge(user.is_active)}
                        </td>

                        <td>
                            ${formatDate(user.created_at)}
                        </td>

                        <td class="actions-cell">

                            <div class="action-group">

                                <button
                                    type="button"
                                    class="action-button permission"
                                    data-action="permissions"
                                    data-user-id="${Number(user.id)}"
                                >

                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="1.8"
                                        aria-hidden="true"
                                    >
                                        <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
                                        <path d="M9 12l2 2 4-4" />
                                    </svg>

                                    Grant Permissions

                                </button>

                            </div>

                        </td>

                    </tr>
                `;

            }

            return "";

        }

        // ==================================================
        // TOGGLE USER STATUS
        // ==================================================

        async function toggleUserStatus(
            userId,
            isActive
        ) {

            /*
             * Only Super Admin may enable or disable
             * administrator accounts.
             */
            if (
                !isSuperAdmin()
            ) {

                showMessage(
                    "Only Super Admin can change administrator account status.",
                    "error"
                );

                return;

            }

            const action =
                isActive
                    ? "enable"
                    : "disable";

            const confirmed =
                window.confirm(
                    `Are you sure you want to ${action} this administrator?`
                );

            if (!confirmed) {
                return;
            }

            try {

                const response =
                    await fetch(
                        `/api/admin/users/${userId}/status`,
                        {
                            method:
                                "PATCH",

                            credentials:
                                "include",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    is_active:
                                        Boolean(
                                            isActive
                                        )
                                })
                        }
                    );

                const data =
                    await response.json();

                if (
                    response.status === 401
                ) {

                    window.location.href =
                        "/admin/login";

                    return;

                }

                if (
                    !response.ok
                ) {

                    throw new Error(
                        data.error ||
                        `Unable to ${action} administrator.`
                    );

                }

                showMessage(
                    `Administrator ${action}d successfully.`,
                    "success"
                );

                await loadUsers();

            } catch (error) {

                console.error(
                    "Status update error:",
                    error
                );

                showMessage(
                    error.message,
                    "error"
                );

            }

        }

        // ==================================================
        // ROLE MODAL
        // ==================================================

        const roleModal =
            document.getElementById(
                "roleModal"
            );

        const roleModalUser =
            document.getElementById(
                "roleModalUser"
            );

        const roleSelect =
            document.getElementById(
                "roleSelect"
            );

        const saveRoleButton =
            document.getElementById(
                "saveRoleButton"
            );

        async function openRoleModal(
            userId
        ) {

            /*
             * Role management belongs exclusively
             * to Super Admin.
             */
            if (
                !isSuperAdmin()
            ) {

                showMessage(
                    "Only Super Admin can change administrator roles.",
                    "error"
                );

                return;

            }

            selectedRoleUserId =
                Number(userId);

            try {

                const response =
                    await fetch(
                        "/api/admin/users",
                        {
                            credentials:
                                "include"
                        }
                    );

                if (
                    response.status === 401
                ) {

                    window.location.href =
                        "/admin/login";

                    return;

                }

                const data =
                    await response.json();

                if (
                    !response.ok
                ) {

                    throw new Error(
                        data.error ||
                        "Unable to load administrator."
                    );

                }

                const user =
                    data.users.find(
                        item =>
                            Number(item.id) ===
                            selectedRoleUserId
                    );

                if (!user) {

                    throw new Error(
                        "Administrator account not found."
                    );

                }

                roleModalUser.innerHTML = `
                    <strong>
                        ${escapeHtml(user.name)}
                    </strong>

                    <span>
                        ${escapeHtml(user.email)}
                    </span>
                `;

                roleSelect.value =
                    user.role;

                roleModal.classList.add(
                    "show"
                );

                roleSelect.focus();

            } catch (error) {

                console.error(
                    "Role modal error:",
                    error
                );

                showMessage(
                    error.message,
                    "error"
                );

                selectedRoleUserId =
                    null;

            }

        }

        function closeRoleModal() {

            roleModal.classList.remove(
                "show"
            );

            selectedRoleUserId =
                null;

            saveRoleButton.disabled =
                false;

            saveRoleButton.textContent =
                "Save Role";

        }

        document
            .getElementById(
                "closeRoleModalButton"
            )
            .addEventListener(
                "click",
                closeRoleModal
            );

        document
            .getElementById(
                "cancelRoleButton"
            )
            .addEventListener(
                "click",
                closeRoleModal
            );

        roleModal.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    roleModal
                ) {

                    closeRoleModal();

                }

            }
        );

        // ==================================================
        // SAVE ROLE
        // ==================================================

        saveRoleButton.addEventListener(
            "click",
            async () => {

                if (
                    !isSuperAdmin()
                ) {

                    showMessage(
                        "Only Super Admin can change administrator roles.",
                        "error"
                    );

                    closeRoleModal();

                    return;

                }

                if (
                    selectedRoleUserId === null
                ) {

                    showMessage(
                        "No administrator was selected.",
                        "error"
                    );

                    return;

                }

                const userId =
                    Number(
                        selectedRoleUserId
                    );

                const newRole =
                    String(
                        roleSelect.value || ""
                    ).trim();

                const allowedRoles = [
                    "staff_admin",
                    "admin",
                    "super_admin"
                ];

                if (
                    !allowedRoles.includes(
                        newRole
                    )
                ) {

                    showMessage(
                        "Invalid administrator role selected.",
                        "error"
                    );

                    return;

                }

                saveRoleButton.disabled =
                    true;

                saveRoleButton.textContent =
                    "Saving...";

                try {

                    const response =
                        await fetch(
                            `/api/admin/users/${userId}/role`,
                            {
                                method:
                                    "PATCH",

                                credentials:
                                    "include",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    "Accept":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        role:
                                            newRole
                                    })
                            }
                        );

                    const responseText =
                        await response.text();

                    let data = {};

                    if (
                        responseText
                    ) {

                        try {

                            data =
                                JSON.parse(
                                    responseText
                                );

                        } catch {

                            throw new Error(
                                `Server returned an unexpected response (HTTP ${response.status}).`
                            );

                        }

                    }

                    if (
                        response.status ===
                        401
                    ) {

                        window.location.href =
                            "/admin/login";

                        return;

                    }

                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            data.error ||
                            "Unable to change administrator role."
                        );

                    }

                    closeRoleModal();

                    showMessage(
                        data.message ||
                        "Administrator role updated successfully.",
                        "success"
                    );

                    await loadUsers();

                } catch (error) {

                    console.error(
                        "Role update error:",
                        error
                    );

                    showMessage(
                        error.message ||
                        "Unable to change administrator role.",
                        "error"
                    );

                } finally {

                    if (
                        roleModal.classList.contains(
                            "show"
                        )
                    ) {

                        saveRoleButton.disabled =
                            false;

                        saveRoleButton.textContent =
                            "Save Role";

                    }

                }

            }
        );

        // ==================================================
        // PERMISSIONS MODAL
        // ==================================================

        const permissionsModal =
            document.getElementById(
                "permissionsModal"
            );

        const permissionModalUser =
            document.getElementById(
                "permissionModalUser"
            );

        const permissionsContainer =
            document.getElementById(
                "permissionsContainer"
            );

        const savePermissionsButton =
            document.getElementById(
                "savePermissionsButton"
            );

        async function openPermissionsModal(
            userId
        ) {

            if (
                !isSuperAdmin() &&
                !(
                    currentAdmin &&
                    currentAdmin.role === "admin" &&
                    canGrantPermissions
                )
            ) {

                showMessage(
                    "You do not have permission to manage administrator permissions.",
                    "error"
                );

                return;

            }

            selectedPermissionUserId =
                Number(userId);

            try {

                const response =
                    await fetch(
                        `/api/admin/users/${selectedPermissionUserId}/permissions`,
                        {
                            credentials:
                                "include"
                        }
                    );

                if (
                    response.status === 401
                ) {

                    window.location.href =
                        "/admin/login";

                    return;

                }

                const data =
                    await response.json();

                if (
                    !response.ok
                ) {

                    throw new Error(
                        data.error ||
                        "Unable to load permissions."
                    );

                }

                selectedPermissionUser =
                    data.user;

                permissionModalTargetRole =
                    data.user.role;

                /*
                 * Defense in depth:
                 * Admin can only open permission management
                 * for Staff Admin.
                 */
                if (
                    !isSuperAdmin() &&
                    data.user.role !==
                        "staff_admin"
                ) {

                    throw new Error(
                        "Admins can only manage Staff Admin permissions."
                    );

                }

                permissionModalUser.innerHTML = `
                    <strong>
                        ${escapeHtml(data.user.name)}
                    </strong>

                    <span>
                        ${escapeHtml(data.user.email)}
                        &nbsp;•&nbsp;
                        ${escapeHtml(
                            data.user.role === "super_admin"
                                ? "Super Admin"
                                : data.user.role === "admin"
                                    ? "Admin"
                                    : "Staff Admin"
                        )}
                    </span>
                `;

                const sections =
                    Array.isArray(
                        data.sections
                    )
                        ? data.sections
                        : [];

                const permissions =
                    Array.isArray(
                        data.permissions
                    )
                        ? data.permissions
                        : [];

                const permissionMap = {};

                permissions.forEach(
                    permission => {

                        permissionMap[
                            permission.section_key
                        ] = {

                            can_edit:
                                Number(
                                    permission.can_edit
                                ) === 1,

                            can_grant:
                                Number(
                                    permission.can_grant
                                ) === 1

                        };

                    }
                );

                if (
                    sections.length === 0
                ) {

                    permissionsContainer.innerHTML = `
                        <div class="table-message">
                            No permission sections are available.
                        </div>
                    `;

                } else {

                    permissionsContainer.innerHTML =
                        sections
                            .map(
                                section => {

                                    /*
                                     * Admin can only see sections
                                     * that THEY are allowed to grant.
                                     *
                                     * Super Admin sees all sections.
                                     */
                                    if (
                                        !isSuperAdmin() &&
                                        !grantableSections.includes(
                                            section
                                        )
                                    ) {

                                        return "";

                                    }

                                    const existing =
                                        permissionMap[
                                            section
                                        ] || {

                                            can_edit:
                                                false,

                                            can_grant:
                                                false

                                        };

                                    /*
                                     * Only Super Admin can give
                                     * an Admin the separate
                                     * can_grant privilege.
                                     */
                                    const canShowGrant =
                                        isSuperAdmin() &&
                                        permissionModalTargetRole ===
                                            "admin";

                                    return `
                                        <div
                                            class="permission-section-card"
                                        >

                                            <div
                                                class="permission-section-header"
                                            >

                                                <div>

                                                    <strong
                                                        class="permission-section-title"
                                                    >
                                                        ${
                                                            escapeHtml(
                                                                sectionLabels[
                                                                    section
                                                                ] ||
                                                                section
                                                            )
                                                        }
                                                    </strong>

                                                    <span
                                                        class="permission-section-key"
                                                    >
                                                        ${escapeHtml(section)}
                                                    </span>

                                                </div>

                                                <label
                                                    class="permission-checkbox-label"
                                                >

                                                    <input
                                                        type="checkbox"
                                                        class="permission-edit-checkbox"
                                                        data-section="${escapeHtml(section)}"
                                                        ${
                                                            existing.can_edit
                                                                ? "checked"
                                                                : ""
                                                        }
                                                    >

                                                    Can Edit

                                                </label>

                                            </div>

                                            ${
                                                canShowGrant
                                                    ? `
                                                        <div
                                                            class="permission-grant-area"
                                                        >

                                                            <label
                                                                class="permission-checkbox-label permission-grant-label"
                                                            >

                                                                <input
                                                                    type="checkbox"
                                                                    class="permission-grant-checkbox"
                                                                    data-section="${escapeHtml(section)}"
                                                                    ${
                                                                        existing.can_grant
                                                                            ? "checked"
                                                                            : ""
                                                                    }
                                                                >

                                                                Can Grant Permissions

                                                            </label>

                                                            <div
                                                                class="permission-grant-help"
                                                            >
                                                                Allows this Admin to grant
                                                                this section to Staff Admins.
                                                            </div>

                                                        </div>
                                                    `
                                                    : ""
                                            }

                                        </div>
                                    `;

                                }
                            )
                            .filter(
                                html =>
                                    html !== ""
                            )
                            .join("");

                    if (
                        !permissionsContainer.innerHTML.trim()
                    ) {

                        permissionsContainer.innerHTML = `
                            <div class="table-message">
                                No permission sections are available for this administrator.
                            </div>
                        `;

                    }

                }

                permissionsModal.classList.add(
                    "show"
                );

            } catch (error) {

                console.error(
                    "Permissions modal error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Unable to load permissions.",
                    "error"
                );

                selectedPermissionUserId =
                    null;

                selectedPermissionUser =
                    null;

                permissionModalTargetRole =
                    null;

            }

        }

        function closePermissionsModal() {

            permissionsModal.classList.remove(
                "show"
            );

            selectedPermissionUserId =
                null;

            selectedPermissionUser =
                null;

            permissionModalTargetRole =
                null;

            savePermissionsButton.disabled =
                false;

            savePermissionsButton.textContent =
                "Grant Permissions";

        }

        document
            .getElementById(
                "closePermissionsModalButton"
            )
            .addEventListener(
                "click",
                closePermissionsModal
            );

        document
            .getElementById(
                "cancelPermissionsButton"
            )
            .addEventListener(
                "click",
                closePermissionsModal
            );

        permissionsModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    permissionsModal
                ) {

                    closePermissionsModal();

                }

            }
        );

        // ==================================================
        // SAVE PERMISSIONS
        // ==================================================

        savePermissionsButton.addEventListener(
            "click",
            async () => {

                if (
                    selectedPermissionUserId ===
                    null
                ) {

                    showMessage(
                        "No administrator was selected.",
                        "error"
                    );

                    return;

                }

                /*
                 * Determine the sections displayed in
                 * the current modal.
                 */
                const editCheckboxes =
                    document.querySelectorAll(
                        ".permission-edit-checkbox"
                    );

                const grantCheckboxes =
                    document.querySelectorAll(
                        ".permission-grant-checkbox"
                    );

                const grantMap = {};

                grantCheckboxes.forEach(
                    checkbox => {

                        grantMap[
                            checkbox.dataset.section
                        ] =
                            checkbox.checked;

                    }
                );

                const permissions = [];

                editCheckboxes.forEach(
                    checkbox => {

                        const section =
                            checkbox.dataset.section;

                        /*
                         * Admin may only grant sections
                         * that exist in their own grant scope.
                         */
                        if (
                            !isSuperAdmin() &&
                            !grantableSections.includes(
                                section
                            )
                        ) {

                            return;

                        }

                        let canGrant =
                            Boolean(
                                grantMap[
                                    section
                                ]
                            );

                        /*
                         * Only Super Admin can give
                         * can_grant.
                         */
                        if (
                            !isSuperAdmin()
                        ) {

                            canGrant =
                                false;

                        }

                        /*
                         * Staff Admin can NEVER receive
                         * can_grant.
                         */
                        if (
                            selectedPermissionUser &&
                            selectedPermissionUser.role ===
                                "staff_admin"
                        ) {

                            canGrant =
                                false;

                        }

                        permissions.push({

                            section_key:
                                section,

                            can_edit:
                                checkbox.checked,

                            can_grant:
                                canGrant

                        });

                    }
                );

                /*
                 * If Admin is managing Staff Admin,
                 * all submitted sections are within
                 * the Admin's grantable scope.
                 */
                if (
                    !isSuperAdmin() &&
                    (
                        !selectedPermissionUser ||
                        selectedPermissionUser.role !==
                            "staff_admin"
                    )
                ) {

                    showMessage(
                        "Admins may only manage Staff Admin permissions.",
                        "error"
                    );

                    return;

                }

                savePermissionsButton.disabled =
                    true;

                savePermissionsButton.textContent =
                    "Saving...";

                try {

                    const response =
                        await fetch(
                            `/api/admin/users/${selectedPermissionUserId}/permissions`,
                            {
                                method:
                                    "PATCH",

                                credentials:
                                    "include",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    "Accept":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        permissions
                                    })
                            }
                        );

                    const responseText =
                        await response.text();

                    let data = {};

                    if (
                        responseText
                    ) {

                        try {

                            data =
                                JSON.parse(
                                    responseText
                                );

                        } catch {

                            throw new Error(
                                `Server returned an unexpected response (HTTP ${response.status}).`
                            );

                        }

                    }

                    if (
                        response.status === 401
                    ) {

                        window.location.href =
                            "/admin/login";

                        return;

                    }

                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            data.error ||
                            "Unable to save permissions."
                        );

                    }

                    closePermissionsModal();

                    showMessage(
                        data.message ||
                        "Administrator permissions updated successfully.",
                        "success"
                    );

                    await loadUsers();

                } catch (error) {

                    console.error(
                        "Save permissions error:",
                        error
                    );

                    showMessage(
                        error.message ||
                        "Unable to save permissions.",
                        "error"
                    );

                } finally {

                    if (
                        permissionsModal.classList.contains(
                            "show"
                        )
                    ) {

                        savePermissionsButton.disabled =
                            false;

                        savePermissionsButton.textContent =
                            "Grant Permissions";

                    }

                }

            }
        );

        // ==================================================
        // WEBSITE CONTENT
        // ==================================================

        const contentFields =
            document.querySelectorAll(
                "[data-content-key]"
            );

        function addFounderSocialRow(link = {}) {
            if (!founderSocialRows || founderSocialRows.children.length >= 20) {
                showMessage("You can add up to 20 founder links.", "error");
                return;
            }

            const row = document.createElement("div");
            row.className = "founder-social-row";
            row.innerHTML = `
                <input type="text" maxlength="40" aria-label="Link name" placeholder="Link name" value="${escapeHtml(link.label || "")}">
                <input type="url" maxlength="1000" aria-label="Link address" placeholder="https://…" value="${escapeHtml(link.url || "")}">
                <button type="button" class="secondary-button" data-remove-founder-link>Remove</button>
            `;
            founderSocialRows.appendChild(row);
        }

        function renderFounderSocialRows(serializedLinks) {
            if (!founderSocialRows) {
                return;
            }

            let links = [];
            try {
                const parsed = JSON.parse(serializedLinks || "[]");
                if (Array.isArray(parsed)) {
                    links = parsed.filter(link =>
                        link &&
                        typeof link.label === "string" &&
                        typeof link.url === "string"
                    ).slice(0, 20);
                }
            } catch (error) {
                console.error("Unable to read founder links:", error);
            }

            founderSocialRows.replaceChildren();
            links.forEach(addFounderSocialRow);
        }

        if (addFounderSocialLinkButton) {
            addFounderSocialLinkButton.addEventListener("click", () => {
                if (hasEditPermission("founder")) {
                    addFounderSocialRow();
                }
            });
        }

        if (founderSocialRows) {
            founderSocialRows.addEventListener("click", event => {
                const removeButton = event.target.closest("[data-remove-founder-link]");
                if (removeButton && hasEditPermission("founder")) {
                    removeButton.closest(".founder-social-row").remove();
                }
            });
        }

        if (saveFounderSocialLinksButton) {
            saveFounderSocialLinksButton.addEventListener("click", async () => {
                if (!hasEditPermission("founder")) {
                    showMessage("You do not have permission to edit founder details.", "error");
                    return;
                }

                const links = Array.from(founderSocialRows.querySelectorAll(".founder-social-row"))
                    .map(row => ({
                        label: row.querySelector('input[aria-label="Link name"]').value.trim(),
                        url: row.querySelector('input[aria-label="Link address"]').value.trim()
                    }));

                if (links.some(link => !link.label || !link.url)) {
                    showMessage("Enter both a name and a link address, or remove the empty row.", "error");
                    return;
                }

                saveFounderSocialLinksButton.disabled = true;
                saveFounderSocialLinksButton.textContent = "Saving…";

                try {
                    const response = await fetch("/api/admin/content", {
                        method: "PATCH",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify({
                            content_key: "founder_social_links",
                            content_value: JSON.stringify(links)
                        })
                    });

                    const data = await response.json();
                    if (response.status === 401) {
                        window.location.href = "/admin/login";
                        return;
                    }
                    if (!response.ok || !data.success) {
                        throw new Error(data.error || "Unable to save founder links.");
                    }
                    showMessage("Founder links saved successfully.", "success");
                } catch (error) {
                    showMessage(error.message || "Unable to save founder links.", "error");
                } finally {
                    saveFounderSocialLinksButton.disabled = false;
                    saveFounderSocialLinksButton.textContent = "Save links";
                }
            });
        }

        async function loadWebsiteContent() {

            /*
             * Super Admin always has access.
             *
             * Other administrators need at least
             * one editable website section.
             */
            if (
                !currentAdmin
            ) {

                return;

            }

            if (
                !isSuperAdmin() &&
                !hasAnyContentEditPermission()
            ) {

                contentManagementSection.style.display =
                    "none";

                return;

            }

            try {

                const response =
                    await fetch(
                        "/api/admin/content",
                        {
                            credentials:
                                "include"
                        }
                    );

                if (
                    response.status === 401
                ) {

                    window.location.href =
                        "/admin/login";

                    return;

                }

                if (
                    response.status === 403
                ) {

                    contentManagementSection.style.display =
                        "none";

                    return;

                }

                const data =
                    await response.json();

                if (
                    !response.ok
                ) {

                    throw new Error(
                        data.error ||
                        "Unable to load website content."
                    );

                }

                const content =
                    Array.isArray(
                        data.content
                    )
                        ? data.content
                        : [];

                const contentMap = {};

                content.forEach(
                    item => {

                        contentMap[
                            item.content_key
                        ] =
                            item.content_value;

                    }
                );

                contentFields.forEach(
                    field => {

                        const key =
                            field.dataset.contentKey;

                        if (
                            Object.prototype.hasOwnProperty.call(
                                contentMap,
                                key
                            )
                        ) {

                            field.value =
                                contentMap[key];

                        }

                    }
                );

                renderFounderSocialRows(
                    contentMap.founder_social_links || "[]"
                );

                applyContentPermissions();

            } catch (error) {

                console.error(
                    "Website content error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Unable to load website content.",
                    "error"
                );

            }

        }

        // ==================================================
        // WEBSITE PICTURES
        // ==================================================

        function renderWebsitePictures(images) {
            const pageNames = [
                "Homepage",
                "About",
                "Work",
                "Get Involved",
                "Contact"
            ];

            const groups = pageNames.map(page => ({
                page,
                images: images.filter(image => image.pages.includes(page))
            })).filter(group => group.images.length > 0);

            if (groups.length === 0) {
                picturePermissionNotice.textContent =
                    "No picture slots are available for your account. Shared pictures are shown only when you have edit permission for every page where they appear.";
                picturePermissionNotice.style.display = "block";
                picturePageGroups.innerHTML = "";
                return;
            }

            picturePermissionNotice.style.display = "none";
            picturePageGroups.innerHTML = groups.map((group, groupIndex) => `
                <section class="picture-page-group">
                    <h3 class="picture-page-title">${escapeHtml(group.page)}</h3>
                    <p class="picture-page-note">
                        Upload a JPEG picture to replace an image on this page. Shared images update every page where they appear.
                    </p>
                    <div class="picture-card-grid">
                        ${group.images.map(image => `
                            <article class="picture-card" data-picture-id="${escapeHtml(image.id)}">
                                <img
                                    class="picture-card-preview"
                                    data-picture-preview="${escapeHtml(image.id)}"
                                    src="${escapeHtml(image.url)}"
                                    alt="${escapeHtml(image.label)}"
                                    loading="lazy"
                                >
                                <div class="picture-card-content">
                                    <h4 class="picture-card-title">${escapeHtml(image.label)}</h4>
                                    <span class="picture-card-filename">${escapeHtml(image.filename)}</span>
                                    <label class="picture-upload-label">
                                        <input
                                            class="picture-upload-input"
                                            type="file"
                                            accept="image/jpeg,.jpg,.jpeg"
                                            data-picture-upload
                                            data-image-id="${escapeHtml(image.id)}"
                                            data-group-index="${groupIndex}"
                                        >
                                        Upload picture
                                    </label>
                                    <p class="picture-upload-status" data-picture-status="${escapeHtml(image.id)}"></p>
                                </div>
                            </article>
                        `).join("")}
                    </div>
                </section>
            `).join("");
        }

        async function loadWebsitePictures() {
            if (!currentAdmin) {
                return;
            }

            try {
                const response = await fetch("/api/admin/images", {
                    credentials: "include"
                });

                if (response.status === 401) {
                    window.location.href = "/admin/login";
                    return;
                }

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Unable to load website pictures.");
                }

                renderWebsitePictures(Array.isArray(data.images) ? data.images : []);
                pictureManagementSection.classList.remove("csp-hidden");
                pictureManagementSection.style.display = "block";
            } catch (error) {
                console.error("Website pictures error:", error);
                picturePageGroups.innerHTML = `
                    <p class="picture-loading">${escapeHtml(error.message || "Unable to load website pictures.")}</p>
                `;
                pictureManagementSection.classList.remove("csp-hidden");
                pictureManagementSection.style.display = "block";
            }
        }

        picturePageGroups.addEventListener("change", async event => {
            const input = event.target.closest("[data-picture-upload]");
            if (!input || !input.files || !input.files[0]) {
                return;
            }

            const imageId = input.dataset.imageId;
            const file = input.files[0];
            const statusElements = picturePageGroups.querySelectorAll(
                `[data-picture-status="${imageId}"]`
            );
            const setStatus = (message, type = "") => {
                statusElements.forEach(status => {
                    status.textContent = message;
                    status.className = `picture-upload-status ${type}`.trim();
                });
            };

            if (file.type !== "image/jpeg") {
                setStatus("Choose a JPEG image (.jpg or .jpeg).", "error");
                input.value = "";
                return;
            }

            input.disabled = true;
            setStatus("Uploading picture…");

            try {
                const response = await fetch(
                    `/api/admin/images/${encodeURIComponent(imageId)}`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "image/jpeg" },
                        body: file
                    }
                );

                const data = await response.json();
                if (response.status === 401) {
                    window.location.href = "/admin/login";
                    return;
                }
                if (!response.ok || !data.success) {
                    throw new Error(data.error || "Unable to upload this picture.");
                }

                picturePageGroups
                    .querySelectorAll(`[data-picture-preview="${imageId}"]`)
                    .forEach(preview => {
                        preview.src = data.url;
                    });
                setStatus(data.message || "Picture updated successfully.", "success");
            } catch (error) {
                setStatus(error.message || "Unable to upload this picture.", "error");
            } finally {
                input.disabled = false;
                input.value = "";
            }
        });

        // ==================================================
        // SAVE WEBSITE CONTENT
        // ==================================================

        document
            .querySelectorAll(
                ".save-content-button"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            const key =
                                button.dataset.saveKey;

                            const field =
                                document.querySelector(
                                    `[data-content-key="${key}"]`
                                );

                            if (!field) {
                                return;
                            }

                            const permissionField =
                                field.closest(
                                    "[data-permission-section]"
                                );

                            if (
                                !permissionField ||
                                !hasEditPermission(
                                    permissionField.dataset.permissionSection
                                )
                            ) {

                                showMessage(
                                    "You do not have permission to edit this website section.",
                                    "error"
                                );

                                return;

                            }

                            const value =
                                field.value.trim();

                            if (
                                !value &&
                                !["founder_email", "founder_phone"].includes(key)
                            ) {

                                showMessage(
                                    "Content cannot be empty.",
                                    "error"
                                );

                                field.focus();

                                return;

                            }

                            button.disabled =
                                true;

                            button.textContent =
                                "Saving...";

                            try {

                                const response =
                                    await fetch(
                                        "/api/admin/content",
                                        {
                                            method:
                                                "PATCH",

                                            credentials:
                                                "include",

                                            headers: {
                                                "Content-Type":
                                                    "application/json",

                                                "Accept":
                                                    "application/json"
                                            },

                                            body:
                                                JSON.stringify({
                                                    content_key:
                                                        key,

                                                    content_value:
                                                        value
                                                })
                                        }
                                    );

                                const responseText =
                                    await response.text();

                                let data = {};

                                if (
                                    responseText
                                ) {

                                    try {

                                        data =
                                            JSON.parse(
                                                responseText
                                            );

                                    } catch {

                                        throw new Error(
                                            `Server returned an unexpected response (HTTP ${response.status}).`
                                        );

                                    }

                                }

                                if (
                                    response.status ===
                                    401
                                ) {

                                    window.location.href =
                                        "/admin/login";

                                    return;

                                }

                                if (
                                    response.status ===
                                    403
                                ) {

                                    throw new Error(
                                        data.error ||
                                        "You do not have permission to change this website content."
                                    );

                                }

                                if (
                                    !response.ok
                                ) {

                                    throw new Error(
                                        data.error ||
                                        "Unable to save website content."
                                    );

                                }

                                showMessage(
                                    "Website content saved successfully.",
                                    "success"
                                );

                                document.dispatchEvent(
                                    new CustomEvent("website:content-saved", {
                                        detail: { key, value }
                                    })
                                );

                                button.textContent =
                                    "Saved";

                                setTimeout(
                                    () => {

                                        button.textContent =
                                            "Save Changes";

                                    },
                                    1800
                                );

                            } catch (error) {

                                console.error(
                                    "Save content error:",
                                    error
                                );

                                showMessage(
                                    error.message ||
                                    "Unable to save website content.",
                                    "error"
                                );

                            } finally {

                                setTimeout(
                                    () => {

                                        button.disabled =
                                            false;

                                        if (
                                            button.textContent ===
                                            "Saving..."
                                        ) {

                                            button.textContent =
                                                "Save Changes";

                                        }

                                    },
                                    2000
                                );

                            }

                        }
                    );

                }
            );

        // ==================================================
        // LOAD CONTACTS
        // ==================================================

        async function loadContacts() {

            const container =
                document.getElementById(
                    "contactsContainer"
                );

            try {

                const response =
                    await fetch(
                        "/api/admin/contacts",
                        {
                            credentials:
                                "include"
                        }
                    );

                if (
                    response.status === 401
                ) {

                    window.location.href =
                        "/admin/login";

                    return;

                }

                const data =
                    await response.json();

                if (
                    !response.ok
                ) {

                    throw new Error(
                        data.error ||
                        "Unable to load contacts."
                    );

                }

                const contacts =
                    Array.isArray(
                        data.contacts
                    )
                        ? data.contacts
                        : [];

                contactCount.textContent =
                    contacts.length;

                if (
                    contacts.length === 0
                ) {

                    container.innerHTML = `
                        <div class="table-message">
                            No contact messages yet.
                        </div>
                    `;

                    return;

                }

                container.innerHTML =
                    contacts
                        .map(
                            contact => `
                                <div class="contact-card">

                                    <div class="contact-top">

                                        <div>

                                            <p class="contact-name">
                                                ${escapeHtml(contact.name)}
                                            </p>

                                            <p class="contact-email">
                                                ${escapeHtml(contact.email)}
                                            </p>

                                        </div>

                                        <div class="contact-date">
                                            ${formatDate(contact.created_at)}
                                        </div>

                                    </div>

                                    ${
                                        contact.subject
                                            ? `
                                                <p class="contact-subject">
                                                    ${escapeHtml(contact.subject)}
                                                </p>
                                            `
                                            : ""
                                    }

                                    <p class="contact-message">
                                        ${escapeHtml(contact.message)}
                                    </p>

                                </div>
                            `
                        )
                        .join("");

            } catch (error) {

                console.error(
                    "Contacts error:",
                    error
                );

                contactCount.textContent =
                    "—";

                container.innerHTML = `
                    <div class="table-message">
                        Unable to load contact messages.
                    </div>
                `;

            }

        }

        // ==================================================
        // LOAD SUBSCRIBERS
        // ==================================================

        async function loadSubscribers() {

            const container =
                document.getElementById(
                    "subscribersContainer"
                );

            try {

                const response =
                    await fetch(
                        "/api/admin/subscribers",
                        {
                            credentials:
                                "include"
                        }
                    );

                if (
                    response.status === 401
                ) {

                    window.location.href =
                        "/admin/login";

                    return;

                }

                const data =
                    await response.json();

                if (
                    !response.ok
                ) {

                    throw new Error(
                        data.error ||
                        "Unable to load subscribers."
                    );

                }

                const subscribers =
                    Array.isArray(
                        data.subscribers
                    )
                        ? data.subscribers
                        : [];

                subscriberCount.textContent =
                    subscribers.length;

                if (
                    subscribers.length === 0
                ) {

                    container.innerHTML = `
                        <div class="table-message">
                            No newsletter subscribers yet.
                        </div>
                    `;

                    return;

                }

                container.innerHTML =
                    subscribers
                        .map(
                            subscriber => `
                                <div class="subscriber-row">

                                    <div class="subscriber-email">
                                        ${escapeHtml(subscriber.email)}
                                    </div>

                                    <div class="subscriber-date">
                                        ${formatDate(subscriber.subscribed_at)}
                                    </div>

                                </div>
                            `
                        )
                        .join("");

            } catch (error) {

                console.error(
                    "Subscribers error:",
                    error
                );

                subscriberCount.textContent =
                    "—";

                container.innerHTML = `
                    <div class="table-message">
                        Unable to load newsletter subscribers.
                    </div>
                `;

            }

        }

        // ==================================================
        // INITIAL LOAD
        // ==================================================

        async function initializeDashboard() {

            await loadCurrentAdmin();

            if (!currentAdmin) {
                return;
            }

            applyContentPermissions();

            const dashboardLoads = [
                loadUsers(),
                loadWebsiteContent(),
                loadWebsitePictures()
            ];

            if (["super_admin", "admin"].includes(currentAdmin.role)) {
                dashboardLoads.push(
                    loadContacts(),
                    loadSubscribers()
                );
            }

            await Promise.all(dashboardLoads);

        }

        document.addEventListener("click", function (event) {
            const button = event.target.closest("[data-action]");

            if (!button) return;

            const userId = Number(button.dataset.userId);
            if (!Number.isSafeInteger(userId) || userId < 1) return;

            if (button.dataset.action === "permissions") {
                openPermissionsModal(userId);
            } else if (button.dataset.action === "role") {
                openRoleModal(userId);
            } else if (button.dataset.action === "user-status") {
                toggleUserStatus(userId, button.dataset.active === "true");
            }
        });

        initializeDashboard();

    
