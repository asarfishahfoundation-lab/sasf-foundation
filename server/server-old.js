require("dotenv").config();

const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const session = require("express-session");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// --------------------------------------------------
// DATABASE
// --------------------------------------------------

const dbPath = path.join(__dirname, "foundation.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

// --------------------------------------------------
// DATABASE TABLES
// --------------------------------------------------

db.prepare(`
    CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff_admin',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS otp_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_user_id INTEGER NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (admin_user_id)
        REFERENCES admin_users(id)
        ON DELETE CASCADE
    )
`).run();

// --------------------------------------------------
// WEBSITE CONTENT
// --------------------------------------------------

db.prepare(`
    CREATE TABLE IF NOT EXISTS site_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_key TEXT NOT NULL UNIQUE,
        content_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// --------------------------------------------------
// DEFAULT WEBSITE CONTENT
// --------------------------------------------------

const existingManagedBy =
    db.prepare(`
        SELECT id
        FROM site_content
        WHERE content_key = ?
    `).get(
        "managed_by"
    );

if (!existingManagedBy) {

    db.prepare(`
        INSERT INTO site_content
        (
            content_key,
            content_value
        )
        VALUES (?, ?)
    `).run(
        "managed_by",
        "Er. Raghbendra Kumar Shah"
    );

}


// --------------------------------------------------
// DEFAULT FOUNDER INFORMATION
// --------------------------------------------------

const existingFounderName =
    db.prepare(`
        SELECT id
        FROM site_content
        WHERE content_key = ?
    `).get(
        "founder_name"
    );

if (!existingFounderName) {

    db.prepare(`
        INSERT INTO site_content
        (
            content_key,
            content_value
        )
        VALUES (?, ?)
    `).run(
        "founder_name",
        "Er. Raghbendra Kumar Shah"
    );

}


const existingFounderBio =
    db.prepare(`
        SELECT id
        FROM site_content
        WHERE content_key = ?
    `).get(
        "founder_bio"
    );

if (!existingFounderBio) {

    db.prepare(`
        INSERT INTO site_content
        (
            content_key,
            content_value
        )
        VALUES (?, ?)
    `).run(
        "founder_bio",
        "Electrical engineer, investor and social worker."
    );

}


// --------------------------------------------------
// SECURITY
// --------------------------------------------------

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

app.use(
    cors({
        origin: "http://localhost:3000",
        credentials: true
    })
);

app.use(
    express.json({
        limit: "10kb"
    })
);

// --------------------------------------------------
// SESSION
// --------------------------------------------------

if (!process.env.SESSION_SECRET) {

    console.error(
        "SESSION_SECRET is missing from .env"
    );

    process.exit(1);
}

app.use(
    session({
        name: "asf_admin_session",

        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 4 * 60 * 60 * 1000
        }
    })
);

// --------------------------------------------------
// RATE LIMITERS
// --------------------------------------------------

const loginLimiter = rateLimit({

    windowMs:
        15 * 60 * 1000,

    max: 20,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
        error:
            "Too many login attempts. Please try again later."
    }

});

const otpLimiter = rateLimit({

    windowMs:
        15 * 60 * 1000,

    max: 10,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
        error:
            "Too many verification attempts. Please try again later."
    }

});

// --------------------------------------------------
// PUBLIC CONTENT RATE LIMITER
// --------------------------------------------------

const publicContentLimiter = rateLimit({

    windowMs:
        60 * 1000,

    max: 120,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
        error:
            "Too many requests. Please try again later."
    }

});

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

function normalizeEmail(email) {

    return String(email || "")
        .trim()
        .toLowerCase();

}

function hashOtp(code) {

    return crypto
        .createHash("sha256")
        .update(code)
        .digest("hex");

}

function generateOtp() {

    return crypto
        .randomInt(100000, 1000000)
        .toString();

}

function isValidRole(role) {

    return [
        "super_admin",
        "admin",
        "staff_admin"
    ].includes(role);

}

// --------------------------------------------------
// GMAIL SMTP
// --------------------------------------------------

if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
) {

    console.error(
        "SMTP settings are missing from .env"
    );

    process.exit(1);

}

const mailTransporter =
    nodemailer.createTransport({

        host:
            process.env.SMTP_HOST,

        port:
            Number(
                process.env.SMTP_PORT
            ),

        secure:
            String(
                process.env.SMTP_SECURE
            ).toLowerCase() === "true",

        auth: {

            user:
                process.env.SMTP_USER,

            pass:
                process.env.SMTP_PASS

        }

    });

// --------------------------------------------------
// VERIFY GMAIL CONNECTION
// --------------------------------------------------

mailTransporter.verify(
    (error) => {

        if (error) {

            console.error(
                "Gmail SMTP verification failed:"
            );

            console.error(
                error.message
            );

            return;

        }

        console.log(
            "Gmail SMTP connection verified successfully."
        );

    }
);

// --------------------------------------------------
// SEND ADMIN OTP EMAIL
// --------------------------------------------------

async function sendAdminOtpEmail(
    user,
    otp
) {

    const fromEmail =
        process.env.SMTP_USER;

    const subject =
        "ASF Foundation — Administrator Verification Code";

    const text = `
ASF FOUNDATION

Administrator Verification

Hello ${user.name},

Your ASF Foundation administrator verification code is:

${otp}

This verification code will expire in 5 minutes.

If you did not attempt to sign in to the ASF Foundation administrator dashboard, please ignore this email.

ASF Foundation
Kathmandu, Nepal
`.trim();

    const html = `
<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>
        ASF Foundation Verification
    </title>

</head>

<body
    style="
        margin:0;
        padding:0;
        background:#f7f3eb;
        font-family:Arial,Helvetica,sans-serif;
        color:#26352f;
    "
>

    <div
        style="
            max-width:620px;
            margin:40px auto;
            padding:20px;
        "
    >

        <div
            style="
                background:#123c32;
                padding:28px 30px;
                border-radius:14px 14px 0 0;
                text-align:center;
            "
        >

            <div
                style="
                    color:#c49a55;
                    font-size:13px;
                    font-weight:bold;
                    letter-spacing:3px;
                    margin-bottom:8px;
                "
            >
                ASF FOUNDATION
            </div>

            <div
                style="
                    color:#f7f3eb;
                    font-size:25px;
                    font-weight:bold;
                "
            >
                Administrator Verification
            </div>

        </div>

        <div
            style="
                background:#ffffff;
                padding:38px 34px;
                border-left:1px solid #e4ddd1;
                border-right:1px solid #e4ddd1;
            "
        >

            <p
                style="
                    margin-top:0;
                    font-size:16px;
                    line-height:1.7;
                "
            >
                Hello ${user.name},
            </p>

            <p
                style="
                    font-size:16px;
                    line-height:1.7;
                "
            >
                Your verification code for the ASF Foundation
                administrator dashboard is:
            </p>

            <div
                style="
                    margin:30px 0;
                    padding:24px;
                    background:#f7f3eb;
                    border:1px solid #e1d2b7;
                    border-radius:12px;
                    text-align:center;
                "
            >

                <div
                    style="
                        color:#6f756f;
                        font-size:12px;
                        font-weight:bold;
                        letter-spacing:2px;
                        margin-bottom:10px;
                    "
                >
                    VERIFICATION CODE
                </div>

                <div
                    style="
                        color:#123c32;
                        font-size:36px;
                        font-weight:bold;
                        letter-spacing:9px;
                    "
                >
                    ${otp}
                </div>

            </div>

            <p
                style="
                    font-size:14px;
                    line-height:1.7;
                    color:#666;
                "
            >
                This verification code expires in
                <strong>5 minutes</strong>.
            </p>

            <p
                style="
                    font-size:14px;
                    line-height:1.7;
                    color:#666;
                "
            >
                If you did not attempt to sign in to the
                ASF Foundation administrator dashboard,
                you can safely ignore this email.
            </p>

        </div>

        <div
            style="
                background:#123c32;
                padding:22px 30px;
                border-radius:0 0 14px 14px;
                text-align:center;
                color:#d9ddd9;
                font-size:12px;
                line-height:1.7;
            "
        >

            <div
                style="
                    color:#c49a55;
                    font-weight:bold;
                    margin-bottom:5px;
                "
            >
                ASF FOUNDATION
            </div>

            Kathmandu, Nepal

        </div>

    </div>

</body>

</html>
`;

    await mailTransporter.sendMail({

        from:
            `"ASF Foundation" <${fromEmail}>`,

        to:
            user.email,

        subject,

        text,

        html

    });

}

// --------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// --------------------------------------------------

function requireAdmin(
    req,
    res,
    next
) {

    if (
        !req.session.authenticated ||
        !req.session.adminUserId ||
        !req.session.twoFactorVerified
    ) {

        return res.status(401).json({

            error:
                "Authentication required."

        });

    }

    const user =
        db.prepare(`
            SELECT
                id,
                name,
                email,
                phone,
                role,
                is_active
            FROM admin_users
            WHERE id = ?
        `).get(
            req.session.adminUserId
        );

    if (
        !user ||
        !user.is_active
    ) {

        return req.session.destroy(
            () => {

                return res.status(401).json({

                    error:
                        "Authentication required."

                });

            }
        );

    }

    req.currentAdmin =
        user;

    next();

}

function requireSuperAdmin(
    req,
    res,
    next
) {

    if (
        !req.session.authenticated ||
        !req.session.adminUserId ||
        !req.session.twoFactorVerified
    ) {

        return res.status(401).json({

            error:
                "Authentication required."

        });

    }

    const user =
        db.prepare(`
            SELECT
                id,
                name,
                email,
                phone,
                role,
                is_active
            FROM admin_users
            WHERE id = ?
        `).get(
            req.session.adminUserId
        );

    if (
        !user ||
        !user.is_active
    ) {

        return req.session.destroy(
            () => {

                return res.status(401).json({

                    error:
                        "Authentication required."

                });

            }
        );

    }

    if (
        user.role !== "super_admin"
    ) {

        return res.status(403).json({

            error:
                "Super Admin permission required."

        });

    }

    req.currentAdmin =
        user;

    next();

}

// --------------------------------------------------
// PUBLIC WEBSITE CONTENT API
// --------------------------------------------------
//
// ADMIN DASHBOARD
//       ↓
// site_content DATABASE
//       ↓
// /api/site-content
//       ↓
// PUBLIC WEBSITE
//
// Only approved public content is returned.
// --------------------------------------------------

app.get(
    "/api/site-content",
    publicContentLimiter,
    (req, res) => {

        try {

            const managedBy =
                db.prepare(`
                    SELECT
                        content_value
                    FROM site_content
                    WHERE content_key = ?
                    LIMIT 1
                `).get(
                    "managed_by"
                );


            const founderName =
                db.prepare(`
                    SELECT
                        content_value
                    FROM site_content
                    WHERE content_key = ?
                    LIMIT 1
                `).get(
                    "founder_name"
                );


            const founderBio =
                db.prepare(`
                    SELECT
                        content_value
                    FROM site_content
                    WHERE content_key = ?
                    LIMIT 1
                `).get(
                    "founder_bio"
                );


            const founderBackground =
                db.prepare(`
                    SELECT
                        content_value
                    FROM site_content
                    WHERE content_key = ?
                    LIMIT 1
                `).get(
                    "founder_background"
                );


            res.set(
                "Cache-Control",
                "no-store"
            );


            return res.json({

                success:
                    true,

                content: {

                    managed_by:
                        managedBy
                            ? managedBy.content_value
                            : "Nayak IT Foundation",


                    founder_name:
                        founderName
                            ? founderName.content_value
                            : "Er. Raghbendra Kumar Shah",


                    founder_bio:
                        founderBio
                            ? founderBio.content_value
                            : "Electrical engineer, investor and social worker.",


                    founder_background:
                        founderBackground
                            ? founderBackground.content_value
                            : ""

                }

            });

        } catch (error) {

            console.error(
                "Public website content error:",
                error
            );

            return res.status(500).json({

                error:
                    "Unable to load website content."

            });

        }

    }
);
// --------------------------------------------------
// LOGIN — STEP 1
// --------------------------------------------------

app.post(
    "/api/admin/login",
    loginLimiter,
    async (req, res) => {

        try {

            const email =
                normalizeEmail(
                    req.body.email
                );

            const password =
                String(
                    req.body.password || ""
                );

            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    error:
                        "Email and password are required."

                });

            }

            const user =
                db.prepare(`
                    SELECT
                        id,
                        name,
                        email,
                        phone,
                        password_hash,
                        role,
                        is_active
                    FROM admin_users
                    WHERE email = ?
                `).get(
                    email
                );

            if (
                !user ||
                !user.is_active
            ) {

                return res.status(401).json({

                    error:
                        "Invalid email or password."

                });

            }

            const passwordMatches =
                await bcrypt.compare(
                    password,
                    user.password_hash
                );

            if (!passwordMatches) {

                return res.status(401).json({

                    error:
                        "Invalid email or password."

                });

            }

            db.prepare(`
                DELETE FROM otp_challenges
                WHERE admin_user_id = ?
            `).run(
                user.id
            );

            const otp =
                generateOtp();

            const otpHash =
                hashOtp(otp);

            const expiresAt =
                Date.now() +
                (
                    5 *
                    60 *
                    1000
                );

            db.prepare(`
                INSERT INTO otp_challenges
                (
                    admin_user_id,
                    code_hash,
                    expires_at,
                    attempts
                )
                VALUES (?, ?, ?, 0)
            `).run(
                user.id,
                otpHash,
                expiresAt
            );

            req.session.authenticated =
                false;

            req.session.twoFactorVerified =
                false;

            req.session.pendingAdminUserId =
                user.id;

            try {

                await sendAdminOtpEmail(
                    user,
                    otp
                );

            } catch (emailError) {

                console.error(
                    "OTP email delivery failed:",
                    emailError
                );

                db.prepare(`
                    DELETE FROM otp_challenges
                    WHERE admin_user_id = ?
                `).run(
                    user.id
                );

                return res.status(500).json({

                    error:
                        "Unable to send the verification code. Please try again later."

                });

            }

            console.log(
                `OTP email sent successfully to ${user.email}.`
            );

            return res.json({

                success:
                    true,

                requiresOtp:
                    true,

                message:
                    "Verification code sent to your registered email address."

            });

        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            return res.status(500).json({

                error:
                    "Unable to process login."

            });

        }

    }
);

// --------------------------------------------------
// VERIFY OTP — STEP 2
// --------------------------------------------------

app.post(
    "/api/admin/verify-otp",
    otpLimiter,
    async (req, res) => {

        try {

            const otp =
                String(
                    req.body.otp || ""
                ).trim();

            if (
                !/^\d{6}$/.test(otp)
            ) {

                return res.status(400).json({

                    error:
                        "Enter the 6-digit verification code."

                });

            }

            const pendingUserId =
                req.session.pendingAdminUserId;

            if (!pendingUserId) {

                return res.status(401).json({

                    error:
                        "Verification session expired. Please log in again."

                });

            }

            const challenge =
                db.prepare(`
                    SELECT
                        id,
                        admin_user_id,
                        code_hash,
                        expires_at,
                        attempts
                    FROM otp_challenges
                    WHERE admin_user_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                `).get(
                    pendingUserId
                );

            if (!challenge) {

                return res.status(401).json({

                    error:
                        "Verification code expired. Please log in again."

                });

            }

            if (
                Date.now() >
                challenge.expires_at
            ) {

                db.prepare(`
                    DELETE FROM otp_challenges
                    WHERE id = ?
                `).run(
                    challenge.id
                );

                return res.status(401).json({

                    error:
                        "Verification code expired. Please log in again."

                });

            }

            if (
                challenge.attempts >= 5
            ) {

                db.prepare(`
                    DELETE FROM otp_challenges
                    WHERE id = ?
                `).run(
                    challenge.id
                );

                return res.status(429).json({

                    error:
                        "Too many incorrect codes. Please log in again."

                });

            }

            const suppliedHash =
                hashOtp(otp);

            if (
                suppliedHash !==
                challenge.code_hash
            ) {

                db.prepare(`
                    UPDATE otp_challenges
                    SET attempts = attempts + 1
                    WHERE id = ?
                `).run(
                    challenge.id
                );

                return res.status(401).json({

                    error:
                        "Incorrect verification code."

                });

            }

            const user =
                db.prepare(`
                    SELECT
                        id,
                        name,
                        email,
                        phone,
                        role,
                        is_active
                    FROM admin_users
                    WHERE id = ?
                `).get(
                    pendingUserId
                );

            if (
                !user ||
                !user.is_active
            ) {

                req.session.destroy(
                    () => {}
                );

                return res.status(401).json({

                    error:
                        "This account is no longer active."

                });

            }

            db.prepare(`
                DELETE FROM otp_challenges
                WHERE id = ?
            `).run(
                challenge.id
            );

            req.session.regenerate(
                (error) => {

                    if (error) {

                        console.error(
                            "Session regeneration error:",
                            error
                        );

                        return res.status(500).json({

                            error:
                                "Unable to create secure session."

                        });

                    }

                    req.session.authenticated =
                        true;

                    req.session.twoFactorVerified =
                        true;

                    req.session.adminUserId =
                        user.id;

                    req.session.adminName =
                        user.name;

                    req.session.adminEmail =
                        user.email;

                    req.session.role =
                        user.role;

                    return res.json({

                        success:
                            true,

                        authenticated:
                            true,

                        role:
                            user.role,

                        name:
                            user.name

                    });

                }
            );

        } catch (error) {

            console.error(
                "OTP verification error:",
                error
            );

            return res.status(500).json({

                error:
                    "Unable to verify the code."

            });

        }

    }
);

// --------------------------------------------------
// CURRENT ADMIN
// --------------------------------------------------

app.get(
    "/api/admin/me",
    requireAdmin,
    (req, res) => {

        const user =
            db.prepare(`
                SELECT
                    id,
                    name,
                    email,
                    phone,
                    role,
                    is_active,
                    created_at
                FROM admin_users
                WHERE id = ?
            `).get(
                req.session.adminUserId
            );

        if (!user) {

            return res.status(404).json({

                error:
                    "Admin account not found."

            });

        }

        res.json({
            user
        });

    }
);

// --------------------------------------------------
// LOGOUT
// --------------------------------------------------

app.post(
    "/api/admin/logout",
    requireAdmin,
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                    return res.status(500).json({

                        error:
                            "Unable to log out."

                    });

                }

                res.clearCookie(
                    "asf_admin_session"
                );

                res.json({
                    success: true
                });

            }
        );

    }
);

// --------------------------------------------------
// CONTACT FORM
// --------------------------------------------------

app.post(
    "/api/contact",
    async (req, res) => {

        try {

            const name =
                String(
                    req.body.name || ""
                ).trim();

            const email =
                normalizeEmail(
                    req.body.email
                );

            const subject =
                String(
                    req.body.subject || ""
                ).trim();

            const message =
                String(
                    req.body.message || ""
                ).trim();

            if (
                !name ||
                !email ||
                !message
            ) {

                return res.status(400).json({

                    error:
                        "Name, email and message are required."

                });

            }

            if (
                email.length > 254
            ) {

                return res.status(400).json({

                    error:
                        "Invalid email address."

                });

            }

            if (
                message.length > 5000
            ) {

                return res.status(400).json({

                    error:
                        "Message is too long."

                });

            }

            db.prepare(`
                INSERT INTO contacts
                (
                    name,
                    email,
                    subject,
                    message
                )
                VALUES (?, ?, ?, ?)
            `).run(
                name,
                email,
                subject,
                message
            );

            res.json({

                success:
                    true,

                message:
                    "Your message has been received."

            });

        } catch (error) {

            console.error(
                "Contact error:",
                error
            );

            res.status(500).json({

                error:
                    "Unable to submit your message."

            });

        }

    }
);

// --------------------------------------------------
// NEWSLETTER
// --------------------------------------------------

app.post(
    "/api/subscribe",
    async (req, res) => {

        try {

            const email =
                normalizeEmail(
                    req.body.email
                );

            if (!email) {

                return res.status(400).json({

                    error:
                        "Email address is required."

                });

            }

            if (
                email.length > 254
            ) {

                return res.status(400).json({

                    error:
                        "Invalid email address."

                });

            }

            try {

                db.prepare(`
                    INSERT INTO subscribers
                    (
                        email
                    )
                    VALUES (?)
                `).run(
                    email
                );

            } catch (error) {

                if (
                    String(error.message)
                        .includes(
                            "UNIQUE constraint failed"
                        )
                ) {

                    return res.json({

                        success:
                            true,

                        message:
                            "You are already subscribed."

                    });

                }

                throw error;

            }

            res.json({

                success:
                    true,

                message:
                    "You have been subscribed successfully."

            });

        } catch (error) {

            console.error(
                "Newsletter error:",
                error
            );

            res.status(500).json({

                error:
                    "Unable to subscribe."

            });

        }

    }
);

// --------------------------------------------------
// ADMIN — CONTACTS
// --------------------------------------------------

app.get(
    "/api/admin/contacts",
    requireAdmin,
    (req, res) => {

        const contacts =
            db.prepare(`
                SELECT
                    id,
                    name,
                    email,
                    subject,
                    message,
                    created_at
                FROM contacts
                ORDER BY id DESC
            `).all();

        res.json({
            contacts
        });

    }
);

// --------------------------------------------------
// ADMIN — SUBSCRIBERS
// --------------------------------------------------

app.get(
    "/api/admin/subscribers",
    requireAdmin,
    (req, res) => {

        const subscribers =
            db.prepare(`
                SELECT
                    id,
                    email,
                    subscribed_at
                FROM subscribers
                ORDER BY id DESC
            `).all();

        res.json({
            subscribers
        });

    }
);

// ==================================================
// WEBSITE CONTENT MANAGEMENT
// ==================================================

// --------------------------------------------------
// GET WEBSITE CONTENT
// SUPER ADMIN ONLY
// --------------------------------------------------

app.get(
    "/api/admin/content",
    requireSuperAdmin,
    (req, res) => {

        try {

            const content =
                db.prepare(`
                    SELECT
                        id,
                        content_key,
                        content_value,
                        updated_at
                    FROM site_content
                    ORDER BY id ASC
                `).all();

            return res.json({

                success:
                    true,

                content

            });

        } catch (error) {

            console.error(
                "Load website content error:",
                error
            );

            return res.status(500).json({

                error:
                    "Unable to load website content."

            });

        }

    }
);

// --------------------------------------------------
// UPDATE WEBSITE CONTENT
// SUPER ADMIN ONLY
// --------------------------------------------------

app.patch(
    "/api/admin/content",
    requireSuperAdmin,
    (req, res) => {

        try {

            const contentKey =
                String(
                    req.body.content_key || ""
                ).trim();

            const contentValue =
                String(
                    req.body.content_value || ""
                ).trim();

            if (!contentKey) {

                return res.status(400).json({

                    error:
                        "Content key is required."

                });

            }

            if (!contentValue) {

                return res.status(400).json({

                    error:
                        "Content value is required."

                });

            }

            if (
                contentKey.length > 100
            ) {

                return res.status(400).json({

                    error:
                        "Content key is too long."

                });

            }

            if (
                contentValue.length > 20000
            ) {

                return res.status(400).json({

                    error:
                        "Content value is too long."

                });

            }

            const existing =
                db.prepare(`
                    SELECT
                        id
                    FROM site_content
                    WHERE content_key = ?
                `).get(
                    contentKey
                );

            if (existing) {

                db.prepare(`
                    UPDATE site_content
                    SET
                        content_value = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE content_key = ?
                `).run(
                    contentValue,
                    contentKey
                );

            } else {

                db.prepare(`
                    INSERT INTO site_content
                    (
                        content_key,
                        content_value
                    )
                    VALUES (?, ?)
                `).run(
                    contentKey,
                    contentValue
                );

            }

            return res.json({

                success:
                    true,

                message:
                    "Website content updated successfully."

            });

        } catch (error) {

            console.error(
                "Update website content error:",
                error
            );

            return res.status(500).json({

                error:
                    "Unable to update website content."

            });

        }

    }
);

// --------------------------------------------------
// ADMIN — USER LIST
// SUPER ADMIN ONLY
// --------------------------------------------------

app.get(
    "/api/admin/users",
    requireSuperAdmin,
    (req, res) => {

        const users =
            db.prepare(`
                SELECT
                    id,
                    name,
                    email,
                    phone,
                    role,
                    is_active,
                    created_at
                FROM admin_users
                ORDER BY
                    CASE role
                        WHEN 'super_admin' THEN 1
                        WHEN 'admin' THEN 2
                        WHEN 'staff_admin' THEN 3
                        ELSE 4
                    END,
                    id ASC
            `).all();

        res.json({
            users
        });

    }
);

// --------------------------------------------------
// ADMIN — ADD USER
// SUPER ADMIN ONLY
// --------------------------------------------------

app.post(
    "/api/admin/users",
    requireSuperAdmin,
    async (req, res) => {

        try {

            const name =
                String(
                    req.body.name || ""
                ).trim();

            const email =
                normalizeEmail(
                    req.body.email
                );

            const phone =
                String(
                    req.body.phone || ""
                ).trim();

            const password =
                String(
                    req.body.password || ""
                );

            const role =
                String(
                    req.body.role ||
                    "staff_admin"
                );

            if (
                !name ||
                !email ||
                !phone ||
                !password
            ) {

                return res.status(400).json({

                    error:
                        "Name, email, phone and password are required."

                });

            }

            if (
                name.length > 100
            ) {

                return res.status(400).json({

                    error:
                        "Name is too long."

                });

            }

            if (
                email.length > 254
            ) {

                return res.status(400).json({

                    error:
                        "Email address is too long."

                });

            }

            if (
                phone.length > 30
            ) {

                return res.status(400).json({

                    error:
                        "Phone number is too long."

                });

            }

            if (
                !isValidRole(role)
            ) {

                return res.status(400).json({

                    error:
                        "Invalid role."

                });

            }

            if (
                password.length < 12
            ) {

                return res.status(400).json({

                    error:
                        "Password must contain at least 12 characters."

                });

            }

            if (
                role === "super_admin"
            ) {

                const count =
                    db.prepare(`
                        SELECT COUNT(*) AS count
                        FROM admin_users
                        WHERE role = 'super_admin'
                        AND is_active = 1
                    `).get().count;

                if (
                    count >= 2
                ) {

                    return res.status(400).json({

                        error:
                            "There can only be two active Super Admins."

                    });

                }

            }

            const existing =
                db.prepare(`
                    SELECT id
                    FROM admin_users
                    WHERE email = ?
                `).get(
                    email
                );

            if (existing) {

                return res.status(409).json({

                    error:
                        "An account with this email already exists."

                });

            }

            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );

            const result =
                db.prepare(`
                    INSERT INTO admin_users
                    (
                        name,
                        email,
                        phone,
                        password_hash,
                        role,
                        is_active
                    )
                    VALUES (?, ?, ?, ?, ?, 1)
                `).run(
                    name,
                    email,
                    phone,
                    passwordHash,
                    role
                );

            res.status(201).json({

                success:
                    true,

                id:
                    result.lastInsertRowid

            });

        } catch (error) {

            console.error(
                "Create admin error:",
                error
            );

            res.status(500).json({

                error:
                    "Unable to create admin account."

            });

        }

    }
);

// --------------------------------------------------
// ADMIN — EDIT USER INFORMATION
// SUPER ADMIN ONLY
// --------------------------------------------------

app.patch(
    "/api/admin/users/:id",
    requireSuperAdmin,
    (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {

                return res.status(400).json({

                    error:
                        "Invalid user ID."

                });

            }

            if (
                userId ===
                req.session.adminUserId
            ) {

                return res.status(400).json({

                    error:
                        "You cannot edit your own account from administrator management."

                });

            }

            const name =
                String(
                    req.body.name || ""
                ).trim();

            const email =
                normalizeEmail(
                    req.body.email
                );

            const phone =
                String(
                    req.body.phone || ""
                ).trim();

            if (
                !name ||
                !email ||
                !phone
            ) {

                return res.status(400).json({

                    error:
                        "Name, email and phone are required."

                });

            }

            if (
                name.length > 100
            ) {

                return res.status(400).json({

                    error:
                        "Name is too long."

                });

            }

            if (
                email.length > 254
            ) {

                return res.status(400).json({

                    error:
                        "Email address is too long."

                });

            }

            if (
                phone.length > 30
            ) {

                return res.status(400).json({

                    error:
                        "Phone number is too long."

                });

            }

            const target =
                db.prepare(`
                    SELECT
                        id,
                        name,
                        email,
                        phone,
                        role,
                        is_active
                    FROM admin_users
                    WHERE id = ?
                `).get(
                    userId
                );

            if (!target) {

                return res.status(404).json({

                    error:
                        "Admin account not found."

                });

            }

            const existingEmail =
                db.prepare(`
                    SELECT
                        id
                    FROM admin_users
                    WHERE email = ?
                    AND id != ?
                `).get(
                    email,
                    userId
                );

            if (existingEmail) {

                return res.status(409).json({

                    error:
                        "Another administrator is already using this email address."

                });

            }

            db.prepare(`
                UPDATE admin_users
                SET
                    name = ?,
                    email = ?,
                    phone = ?
                WHERE id = ?
            `).run(
                name,
                email,
                phone,
                userId
            );

            return res.json({

                success:
                    true,

                message:
                    "Administrator information updated successfully."

            });

        } catch (error) {

            console.error(
                "Edit admin error:",
                error
            );

            if (
                String(error.message)
                    .includes(
                        "UNIQUE constraint failed"
                    )
            ) {

                return res.status(409).json({

                    error:
                        "Another administrator is already using this email address."

                });

            }

            return res.status(500).json({

                error:
                    "Unable to update administrator information."

            });

        }

    }
);

// --------------------------------------------------
// ADMIN — DISABLE / ENABLE USER
// SUPER ADMIN ONLY
// --------------------------------------------------

app.patch(
    "/api/admin/users/:id/status",
    requireSuperAdmin,
    (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );

            if (
                typeof req.body.is_active !==
                "boolean"
            ) {

                return res.status(400).json({

                    error:
                        "is_active must be true or false."

                });

            }

            const isActive =
                req.body.is_active
                    ? 1
                    : 0;

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {

                return res.status(400).json({

                    error:
                        "Invalid user ID."

                });

            }

            if (
                userId ===
                req.session.adminUserId
            ) {

                return res.status(400).json({

                    error:
                        "You cannot disable your own account."

                });

            }

            const target =
                db.prepare(`
                    SELECT
                        id,
                        role,
                        is_active
                    FROM admin_users
                    WHERE id = ?
                `).get(
                    userId
                );

            if (!target) {

                return res.status(404).json({

                    error:
                        "Admin account not found."

                });

            }

            if (
                target.role === "super_admin" &&
                isActive === 0
            ) {

                const activeSuperAdmins =
                    db.prepare(`
                        SELECT COUNT(*) AS count
                        FROM admin_users
                        WHERE role = 'super_admin'
                        AND is_active = 1
                    `).get().count;

                if (
                    activeSuperAdmins <= 1
                ) {

                    return res.status(400).json({

                        error:
                            "At least one active Super Admin must remain."

                    });

                }

            }

            db.prepare(`
                UPDATE admin_users
                SET is_active = ?
                WHERE id = ?
            `).run(
                isActive,
                userId
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "Update admin status error:",
                error
            );

            res.status(500).json({

                error:
                    "Unable to update admin status."

            });

        }

    }
);

// --------------------------------------------------
// ADMIN — CHANGE USER ROLE
// SUPER ADMIN ONLY
// --------------------------------------------------

app.patch(
    "/api/admin/users/:id/role",
    requireSuperAdmin,
    (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );

            const newRole =
                String(
                    req.body.role || ""
                ).trim();

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {

                return res.status(400).json({

                    error:
                        "Invalid user ID."

                });

            }

            if (
                !isValidRole(newRole)
            ) {

                return res.status(400).json({

                    error:
                        "Invalid administrator role."

                });

            }

            const target =
                db.prepare(`
                    SELECT
                        id,
                        name,
                        email,
                        role,
                        is_active
                    FROM admin_users
                    WHERE id = ?
                `).get(
                    userId
                );

            if (!target) {

                return res.status(404).json({

                    error:
                        "Admin account not found."

                });

            }

            if (
                target.id ===
                req.session.adminUserId
            ) {

                return res.status(400).json({

                    error:
                        "You cannot change your own role."

                });

            }

            if (
                target.role === newRole
            ) {

                return res.json({

                    success:
                        true,

                    message:
                        "The administrator already has this role."

                });

            }

            if (
                newRole === "super_admin"
            ) {

                const activeSuperAdmins =
                    db.prepare(`
                        SELECT COUNT(*) AS count
                        FROM admin_users
                        WHERE role = 'super_admin'
                        AND is_active = 1
                    `).get().count;

                if (
                    target.is_active === 1 &&
                    activeSuperAdmins >= 2
                ) {

                    return res.status(400).json({

                        error:
                            "There can only be two active Super Admins."

                    });

                }

            }

            if (
                target.role === "super_admin" &&
                target.is_active === 1 &&
                newRole !== "super_admin"
            ) {

                const activeSuperAdmins =
                    db.prepare(`
                        SELECT COUNT(*) AS count
                        FROM admin_users
                        WHERE role = 'super_admin'
                        AND is_active = 1
                    `).get().count;

                if (
                    activeSuperAdmins <= 1
                ) {

                    return res.status(400).json({

                        error:
                            "At least one active Super Admin must remain."

                    });

                }

            }

            db.prepare(`
                UPDATE admin_users
                SET role = ?
                WHERE id = ?
            `).run(
                newRole,
                userId
            );

            return res.json({

                success:
                    true,

                message:
                    "Administrator role updated successfully."

            });

        } catch (error) {

            console.error(
                "Update admin role error:",
                error
            );

            res.status(500).json({

                error:
                    "Unable to update administrator role."

            });

        }

    }
);

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use(
    (req, res) => {

        res.status(404).json({

            error:
                "Not found."

        });

    }
);

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use(
    (error, req, res, next) => {

        console.error(
            "Server error:",
            error
        );

        res.status(500).json({

            error:
                "An unexpected server error occurred."

        });

    }
);

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "======================================"
        );

        console.log(
            " ASF FOUNDATION SERVER"
        );

        console.log(
            "======================================"
        );

        console.log("");

        console.log(
            `Server running at http://localhost:${PORT}`
        );

        console.log("");

        console.log(
            "Admin login:"
        );

        console.log(
            `http://localhost:${PORT}/admin/login`
        );

        console.log("");

        console.log(
            "Public website content:"
        );

        console.log(
            `http://localhost:${PORT}/api/site-content`
        );

        console.log("");

        console.log(
            "Authentication:"
        );

        console.log(
            "• Individual admin accounts"
        );

        console.log(
            "• Password authentication"
        );

        console.log(
            "• One-time 6-digit OTP"
        );

        console.log(
            "• OTP expires after 5 minutes"
        );

        console.log(
            "• Maximum 5 OTP attempts"
        );

        console.log(
            "• Role-based access"
        );

        console.log("");

        console.log(
            "OTP delivery:"
        );

        console.log(
            "• Gmail SMTP"
        );

        console.log(
            `• Sender: ${process.env.SMTP_USER}`
        );

        console.log("");

    }
);