const path = require("path");
const fs = require("fs");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const session = require("express-session");

const SQLiteStore =
    require("better-sqlite3-session-store")(
        session
    );

const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const nodemailer = require("nodemailer");


const app = express();

const PORT =
    Number(process.env.PORT) || 3000;

const NODE_ENV =
    process.env.NODE_ENV || "development";

const TRUST_PROXY_HOPS =
    process.env.TRUST_PROXY_HOPS === undefined
        ? (NODE_ENV === "production" ? 1 : 0)
        : Number(process.env.TRUST_PROXY_HOPS);


// ==================================================
// BASIC SECURITY
// ==================================================

app.disable(
    "x-powered-by"
);

if (
    Number.isInteger(TRUST_PROXY_HOPS) &&
    TRUST_PROXY_HOPS >= 0
) {
    app.set("trust proxy", TRUST_PROXY_HOPS);
} else {
    console.error("TRUST_PROXY_HOPS must be a non-negative integer.");
    process.exit(1);
}


// One Helmet configuration.
// CSP remains enabled.
// Inline JavaScript is NOT allowed.
// External scripts from this server ARE allowed.
app.use(
    helmet()
);


// ==================================================
// ENVIRONMENT VALIDATION
// ==================================================

if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32
) {

    console.error(
        "SESSION_SECRET is missing or too short. Use a random secret of at least 32 characters."
    );

    process.exit(1);
}


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


// ==================================================
// GMAIL / EMAIL
// ==================================================

const mailTransporter =
    nodemailer.createTransport({

        host:
            process.env.SMTP_HOST,

        port:
            Number(
                process.env.SMTP_PORT
            ),

        secure:
            process.env.SMTP_SECURE ===
            "true",

        auth: {

            user:
                process.env.SMTP_USER,

            pass:
                process.env.SMTP_PASS
        },

        // Fail promptly when Gmail cannot be reached so login requests
        // do not leave the administrator form stuck in its loading state.
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000
    });


mailTransporter.verify(
    (error) => {

        if (error) {

            console.error(
                "Gmail SMTP connection failed:",
                error.message
            );

        } else {

            console.log(
                "Gmail SMTP connection verified successfully."
            );
        }
    }
);


// ==================================================
// DATABASE
// ==================================================

const dbPath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(__dirname, "foundation.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });


const db =
    new Database(
        dbPath
    );


db.pragma(
    "foreign_keys = ON"
);

db.pragma("busy_timeout = 5000");

db.pragma(
    "journal_mode = WAL"
);

db.pragma("synchronous = NORMAL");
db.pragma("wal_autocheckpoint = 1000");


// ==================================================
// DATABASE TABLES
// ==================================================

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


// ==================================================
// ADMIN WEBSITE CONTENT PERMISSIONS
// ==================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS admin_content_permissions (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        admin_user_id INTEGER NOT NULL,

        section_key TEXT NOT NULL,

        can_edit INTEGER NOT NULL DEFAULT 0,

        can_grant INTEGER NOT NULL DEFAULT 0,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (
            admin_user_id,
            section_key
        ),

        FOREIGN KEY (
            admin_user_id
        )
        REFERENCES admin_users(id)
        ON DELETE CASCADE
    )
`);


// ==================================================
// DATABASE MIGRATION
//
// Older versions of the database only had:
//
// can_edit
//
// The new permission system also requires:
//
// can_grant
//
// Existing can_edit permissions are preserved.
// Existing users receive can_grant = 0.
// ==================================================

const permissionColumns =
    db.prepare(`
        PRAGMA table_info(
            admin_content_permissions
        )
    `).all();


const hasCanGrantColumn =
    permissionColumns.some(
        column =>
            column.name ===
            "can_grant"
    );


if (
    !hasCanGrantColumn
) {

    db.exec(`
        ALTER TABLE
            admin_content_permissions
        ADD COLUMN
            can_grant INTEGER NOT NULL DEFAULT 0
    `);
}


db.exec(`
    CREATE INDEX IF NOT EXISTS
    idx_admin_content_permissions_user
    ON admin_content_permissions(
        admin_user_id
    )
`);


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


db.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_challenges (
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


db.prepare(`
    CREATE TABLE IF NOT EXISTS site_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_key TEXT NOT NULL UNIQUE,
        content_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();


// ==================================================
// DATABASE INDEXES
// ==================================================

db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_admin_users_email
    ON admin_users(email)
`).run();


db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_otp_admin_user
    ON otp_challenges(admin_user_id)
`).run();


db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_otp_expiry
    ON otp_challenges(expires_at)
`).run();


db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_password_reset_admin_user
    ON password_reset_challenges(admin_user_id)
`).run();


db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_password_reset_expiry
    ON password_reset_challenges(expires_at)
`).run();


db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_contacts_created_at
    ON contacts(created_at)
`).run();


db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_subscribers_subscribed_at
    ON subscribers(subscribed_at)
`).run();


// ==================================================
// WEBSITE CONTENT DEFAULTS
// ==================================================

const WEBSITE_CONTENT_DEFAULTS = {

    // ----------------------------------------------
    // FOUNDATION
    // ----------------------------------------------

    foundation_name:
        "Shree Asarfi Shah Foundation",

    foundation_short_name:
        "SASF",

    managed_by:
        "Nayak IT Foundation",

    home_intro:
        "Shree Asarfi Shah Foundation is committed to creating meaningful opportunities, supporting communities, and contributing toward a better and more equitable future.",

    about_description:
        "Shree Asarfi Shah Foundation is a people-focused foundation working toward meaningful social development, education, community support, and opportunities for individuals and communities.",


    // ----------------------------------------------
    // ABOUT HERO
    // ----------------------------------------------

    about_hero_intro:
        "Shree Asarfi Shah Foundation is a people-focused foundation committed to creating opportunities, supporting communities, and contributing toward a better and more equitable future.",


    // ----------------------------------------------
    // OUR STORY
    // ----------------------------------------------

    about_story_1:
        "",

    about_story_2:
        "",

    about_story_3:
        "",


    // ----------------------------------------------
    // FOUNDER
    // ----------------------------------------------

    founder_name:
        "Er. Raghbendra Kumar Shah",

    founder_email:
        "raghben.shah@gmail.com",

    founder_phone:
        "",

    founder_social_links:
        JSON.stringify([
            {
                label: "Facebook",
                url: "https://www.facebook.com/Raghbenn"
            },
            {
                label: "LinkedIn",
                url: "https://www.linkedin.com/in/raghbendra-shah/"
            }
        ]),

    founder_bio:
        "Electrical engineer, investor and social worker.",

    founder_background:
        "",

    founder_vision:
        "Through the foundation, his vision is to contribute toward communities by supporting education, social development, vulnerable individuals, and initiatives that can create meaningful opportunities for future generations.",


    // ----------------------------------------------
    // WHAT DRIVES US
    // ----------------------------------------------

    about_vision:
        "To contribute toward a society where every individual has access to opportunity, dignity, education, support, and the ability to build a better future.",

    about_mission:
        "To support meaningful initiatives in education, community development, health, social support, and care while encouraging people to become part of positive change.",

    about_approach:
        "We focus on practical action, compassion, cooperation, and long-term thinking so that our work can create benefits that continue beyond a single initiative.",


    // ----------------------------------------------
    // OUR VALUES
    // ----------------------------------------------

    about_values_intro:
        "Our values shape the way we think, the way we work, and the way we engage with communities.",

    about_value_compassion:
        "We believe people deserve to be treated with kindness, empathy, and respect.",

    about_value_dignity:
        "We believe support should strengthen dignity, confidence, and independence.",

    about_value_opportunity:
        "Education and opportunity can open doors that change the direction of an entire life.",

    about_value_responsibility:
        "We believe meaningful change requires commitment, accountability, and action.",


    // ----------------------------------------------
    // MANAGEMENT
    // ----------------------------------------------

    management_description:
        "Supporting the foundation's organizational, technological, and operational development.",


    // ----------------------------------------------
    // CONTACT
    // ----------------------------------------------

    contact_email:
        "",

    contact_phone:
        "",

    whatsapp_primary:
        "",

    whatsapp_secondary:
        "",

    address:
        "Kathmandu, Nepal"
};


// ==================================================
// PUBLIC CONTENT KEYS
// ==================================================

const PUBLIC_CONTENT_KEYS =
    Object.keys(
        WEBSITE_CONTENT_DEFAULTS
    );


// ==================================================
// WEBSITE CONTENT PERMISSION SECTIONS
// ==================================================

const WEBSITE_CONTENT_SECTIONS = {

    homepage: [
        "foundation_name",
        "foundation_short_name",
        "managed_by",
        "home_intro"
    ],

    about: [
        "about_description",
        "about_hero_intro",
        "about_story_1",
        "about_story_2",
        "about_story_3",
        "about_vision",
        "about_mission",
        "about_approach",
        "about_values_intro",
        "about_value_compassion",
        "about_value_dignity",
        "about_value_opportunity",
        "about_value_responsibility",
        "management_description"
    ],

    founder: [
        "founder_name",
        "founder_email",
        "founder_phone",
        "founder_social_links",
        "founder_bio",
        "founder_background",
        "founder_vision"
    ],

    contact: [
        "contact_email",
        "contact_phone",
        "whatsapp_primary",
        "whatsapp_secondary",
        "address"
    ],

    work: [],

    get_involved: []
};


// Image slots map each uploaded picture to every page that uses it.
// Reused pictures require edit access to every affected website section.
const WEBSITE_IMAGE_SLOTS = [
    {
        id: "hero-nepal",
        label: "Hero photograph",
        filename: "hero-nepal.jpg",
        pages: ["Homepage", "Work", "Get Involved"],
        sections: ["homepage", "work", "get_involved"]
    },
    {
        id: "education-nepal",
        label: "Education photograph",
        filename: "education-nepal.jpg",
        pages: ["Homepage", "About", "Work", "Get Involved"],
        sections: ["homepage", "about", "work", "get_involved"]
    },
    {
        id: "motive-community",
        label: "Community photograph",
        filename: "motive-community.jpg",
        pages: ["Homepage", "About", "Work", "Get Involved"],
        sections: ["homepage", "about", "work", "get_involved"]
    },
    {
        id: "support",
        label: "Support photograph",
        filename: "support.jpg",
        pages: ["Homepage", "Work", "Get Involved"],
        sections: ["homepage", "work", "get_involved"]
    },
    {
        id: "village",
        label: "Village photograph",
        filename: "village.jpg",
        pages: ["Homepage", "About", "Work", "Get Involved"],
        sections: ["homepage", "about", "work", "get_involved"]
    },
    {
        id: "about-hero",
        label: "About page hero",
        filename: "about-hero.jpg",
        pages: ["About"],
        sections: ["about"]
    },
    {
        id: "founder",
        label: "Founder portrait",
        filename: "founder.jpg.jpeg",
        pages: ["About"],
        sections: ["founder"]
    },
    {
        id: "children-reading",
        label: "Contact page photograph",
        filename: "children-reading.jpg",
        pages: ["Contact"],
        sections: ["contact"]
    }
];


// ==================================================
// SEED WEBSITE CONTENT
// ==================================================

const insertContent =
    db.prepare(`
        INSERT INTO site_content
        (
            content_key,
            content_value
        )
        VALUES (?, ?)
    `);


const contentExists =
    db.prepare(`
        SELECT id
        FROM site_content
        WHERE content_key = ?
        LIMIT 1
    `);


const seedContentTransaction =
    db.transaction(
        () => {

            for (
                const [
                    key,
                    value
                ]
                of Object.entries(
                    WEBSITE_CONTENT_DEFAULTS
                )
            ) {

                const existing =
                    contentExists.get(
                        key
                    );


                if (!existing) {

                    insertContent.run(
                        key,
                        value
                    );
                }
            }
        }
    );


seedContentTransaction();

// Bring legacy saved copy in line with the current foundation branding.
// This is safe to run repeatedly and keeps previously saved content editable.
const legacyBrandRows = db.prepare(`
    SELECT content_key, content_value
    FROM site_content
`).all();
const updateLegacyBrand = db.prepare(`
    UPDATE site_content
    SET content_value = ?, updated_at = CURRENT_TIMESTAMP
    WHERE content_key = ?
`);
for (const row of legacyBrandRows) {
    const brandedValue = row.content_value
        .replace(/\b(?:SHREE\s+)?ASARFI\s+SHAH\s+FOUNDATION\b/gi, match =>
            match === match.toUpperCase()
                ? "SHREE ASARFI SHAH FOUNDATION"
                : "Shree Asarfi Shah Foundation"
        )
        .replace(/\bASF\b/gi, "SASF");
    if (brandedValue !== row.content_value) {
        updateLegacyBrand.run(brandedValue, row.content_key);
    }
}


// ==================================================
// CORS
// ==================================================

const allowedOrigin =
    process.env.FRONTEND_ORIGIN ||
    `http://localhost:${PORT}`;


app.use(
    cors({

        origin:
            allowedOrigin,

        credentials:
            true,

        methods: [
            "GET",
            "POST",
            "PATCH",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Accept"
        ]
    })
);


// ==================================================
// JSON BODY PARSER
// ==================================================

app.use(
    express.json({
        limit: "10kb"
    })
);

app.get("/healthz", (req, res) => {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ status: "ok" });
});

app.get("/readyz", (req, res) => {
    try {
        if (!db.open) throw new Error("Database connection is closed.");
        db.prepare("SELECT 1").get();
        res.set("Cache-Control", "no-store");
        return res.status(200).json({ status: "ready" });
    } catch (error) {
        console.error("Readiness check failed:", error.message);
        res.set("Cache-Control", "no-store");
        return res.status(503).json({ status: "not_ready" });
    }
});


// ==================================================
// SESSION
// ==================================================

app.use(
    session({

        name:
            "asf_admin_session",

        secret:
            process.env.SESSION_SECRET,

        store:
            new SQLiteStore({
                client:
                    db
            }),

        resave:
            false,

        saveUninitialized:
            false,

        cookie: {

            httpOnly:
                true,

            secure:
                NODE_ENV ===
                "production",

            sameSite:
                "lax",

            maxAge:
                4 *
                60 *
                60 *
                1000
        }
    })
);


app.use(
    ["/admin", "/api/admin"],
    (req, res, next) => {
        res.set("Cache-Control", "no-store");
        res.set("CDN-Cache-Control", "no-store");
        next();
    }
);


// ==================================================
// RATE LIMITING
// ==================================================

const loginLimiter =
    rateLimit({

        windowMs:
            15 *
            60 *
            1000,

        max:
            20,

        standardHeaders:
            true,

        legacyHeaders:
            false,

        message: {
            error:
                "Too many login attempts. Please try again later."
        }
    });


const otpLimiter =
    rateLimit({

        windowMs:
            15 *
            60 *
            1000,

        max:
            10,

        standardHeaders:
            true,

        legacyHeaders:
            false,

        message: {
            error:
                "Too many verification attempts. Please try again later."
        }
    });


const passwordResetCaptchaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many CAPTCHA requests. Please try again later." }
});

const passwordResetAttemptLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many password reset attempts. Please try again later." }
});

const passwordResetRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many reset code requests. Please try again later." }
});


const publicContentLimiter =
    rateLimit({

        windowMs:
            60 *
            1000,

        max:
            1000,

        standardHeaders:
            true,

        legacyHeaders:
            false,

        message: {
            error:
                "Too many requests. Please try again later."
        }
    });


const contactLimiter =
    rateLimit({

        windowMs:
            15 *
            60 *
            1000,

        max:
            10,

        standardHeaders:
            true,

        legacyHeaders:
            false,

        message: {
            error:
                "Too many contact submissions. Please try again later."
        }
    });


const newsletterLimiter =
    rateLimit({

        windowMs:
            15 *
            60 *
            1000,

        max:
            10,

        standardHeaders:
            true,

        legacyHeaders:
            false,

        message: {
            error:
                "Too many subscription attempts. Please try again later."
        }
    });


// ==================================================
// HELPER FUNCTIONS
// ==================================================

function normalizeEmail(
    email
) {

    return String(
        email || ""
    )
        .trim()
        .toLowerCase();
}


function isValidEmail(
    email
) {

    return (
        typeof email ===
            "string" &&

        email.length <=
            254 &&

        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email
        )
    );
}


function hashOtp(
    code
) {

    return crypto
        .createHash("sha256")
        .update(code)
        .digest("hex");
}


function hashPasswordResetCode(code) {
    return crypto
        .createHmac("sha256", process.env.SESSION_SECRET)
        .update(String(code))
        .digest("hex");
}


function hashCaptchaAnswer(captchaId, answer) {
    return crypto
        .createHmac("sha256", process.env.SESSION_SECRET)
        .update(`${captchaId}:${String(answer).trim().toUpperCase()}`)
        .digest("hex");
}


function generateCaptchaText() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from(
        { length: 6 },
        () => alphabet[crypto.randomInt(0, alphabet.length)]
    ).join("");
}


function createCaptchaSvg(answer) {
    const letters = answer.split("").map((character, index) => {
        const x = 30 + index * 31;
        const y = 43 + crypto.randomInt(-4, 5);
        const rotation = crypto.randomInt(-16, 17);
        return `<text x="${x}" y="${y}" transform="rotate(${rotation} ${x} ${y})">${character}</text>`;
    }).join("");

    const noise = Array.from({ length: 7 }, () => {
        const x1 = crypto.randomInt(0, 220);
        const y1 = crypto.randomInt(0, 64);
        const x2 = crypto.randomInt(0, 220);
        const y2 = crypto.randomInt(0, 64);
        return `<path d="M${x1} ${y1} L${x2} ${y2}"/>`;
    }).join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="64" viewBox="0 0 220 64" role="img" aria-label="CAPTCHA challenge">
        <rect width="220" height="64" rx="8" fill="#f7f3eb"/>
        <g fill="none" stroke="#b5a47d" stroke-width="1" opacity=".55">${noise}</g>
        <g fill="#123c32" font-family="Arial, sans-serif" font-size="29" font-weight="700" letter-spacing="2">${letters}</g>
    </svg>`;
}


function generateOtp() {

    return crypto
        .randomInt(
            100000,
            1000000
        )
        .toString();
}


function isValidRole(
    role
) {

    return [
        "super_admin",
        "admin",
        "staff_admin"
    ].includes(
        role
    );
}


// ==================================================
// GET WEBSITE CONTENT FROM DATABASE
// ==================================================

function getWebsiteContent() {

    const rows =
        db.prepare(`
            SELECT
                content_key,
                content_value
            FROM site_content
            WHERE content_key IN (
                ${PUBLIC_CONTENT_KEYS
                    .map(
                        () => "?"
                    )
                    .join(",")}
            )
        `).all(
            ...PUBLIC_CONTENT_KEYS
        );


    const content = {
        ...WEBSITE_CONTENT_DEFAULTS
    };


    for (
        const row
        of rows
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                WEBSITE_CONTENT_DEFAULTS,
                row.content_key
            )
        ) {

            content[
                row.content_key
            ] =
                row.content_value;
        }
    }


    // ----------------------------------------------
    // Backward compatibility
    // ----------------------------------------------

    const legacyKeys = {

        about_value_compassion:
            "value_compassion",

        about_value_dignity:
            "value_dignity",

        about_value_opportunity:
            "value_opportunity",

        about_value_responsibility:
            "value_responsibility"
    };


    for (
        const [
            newKey,
            oldKey
        ]
        of Object.entries(
            legacyKeys
        )
    ) {

        const legacy =
            db.prepare(`
                SELECT
                    content_value
                FROM site_content
                WHERE content_key = ?
                LIMIT 1
            `).get(
                oldKey
            );


        const current =
            content[
                newKey
            ];


        const defaultValue =
            WEBSITE_CONTENT_DEFAULTS[
                newKey
            ];


        if (
            legacy &&
            (
                !current ||
                current ===
                    defaultValue
            )
        ) {

            content[
                newKey
            ] =
                legacy.content_value;
        }
    }


    return content;
}


// ==================================================
// SEND ADMIN OTP EMAIL
// ==================================================

async function sendAdminOtpEmail(
    user,
    otp
) {

    const mailOptions = {

        from: {

            name:
                "SASF Foundation",

            address:
                process.env.SMTP_USER
        },

        to:
            user.email,

        subject:
            "SASF Foundation — Administrator Verification Code",

        text:
`SASF FOUNDATION

Administrator Login Verification

Hello ${user.name},

Your SASF Foundation administrator verification code is:

${otp}

This code will expire in 5 minutes.

If you did not attempt to sign in to the SASF Foundation administrator panel, please ignore this email.

SASF Foundation
Kathmandu, Nepal
`,

        html:
`<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>
        SASF Foundation Verification Code
    </title>

</head>

<body style="
    margin:0;
    padding:0;
    background:#f7f3eb;
    font-family:Arial,Helvetica,sans-serif;
    color:#183c32;
">

    <div style="
        width:100%;
        padding:40px 20px;
        box-sizing:border-box;
    ">

        <div style="
            max-width:600px;
            margin:0 auto;
            background:#ffffff;
            border:1px solid #e6ddce;
            border-radius:12px;
            overflow:hidden;
        ">

            <div style="
                background:#123c32;
                padding:30px;
                text-align:center;
            ">

                <div style="
                    color:#c49a55;
                    font-size:14px;
                    font-weight:bold;
                    letter-spacing:3px;
                    text-transform:uppercase;
                ">
                    SASF Foundation
                </div>

                <div style="
                    color:#f7f3eb;
                    font-size:26px;
                    font-weight:bold;
                    margin-top:10px;
                ">
                    Administrator Verification
                </div>

            </div>

            <div style="
                padding:35px 30px;
            ">

                <p style="
                    margin:0 0 18px;
                    font-size:16px;
                    line-height:1.7;
                ">
                    Hello ${user.name},
                </p>

                <p style="
                    margin:0 0 24px;
                    font-size:15px;
                    line-height:1.7;
                    color:#555555;
                ">
                    A sign-in attempt was made for your SASF Foundation administrator account.
                    Use the verification code below to continue.
                </p>

                <div style="
                    background:#f7f3eb;
                    border:1px solid #e2d5c1;
                    border-radius:10px;
                    padding:24px;
                    text-align:center;
                    margin:25px 0;
                ">

                    <div style="
                        color:#777777;
                        font-size:12px;
                        text-transform:uppercase;
                        letter-spacing:2px;
                        margin-bottom:10px;
                    ">
                        Verification Code
                    </div>

                    <div style="
                        color:#123c32;
                        font-size:36px;
                        font-weight:bold;
                        letter-spacing:8px;
                    ">
                        ${otp}
                    </div>

                </div>

                <p style="
                    margin:0 0 12px;
                    font-size:14px;
                    color:#555555;
                    line-height:1.6;
                ">
                    This code expires in
                    <strong>5 minutes</strong>.
                </p>

                <p style="
                    margin:20px 0 0;
                    font-size:13px;
                    color:#777777;
                    line-height:1.6;
                ">
                    If you did not attempt to sign in,
                    you can safely ignore this email.
                </p>

            </div>

            <div style="
                background:#123c32;
                padding:22px 30px;
                text-align:center;
                color:#dfe8e3;
                font-size:12px;
                line-height:1.6;
            ">

                SASF Foundation<br>
                Kathmandu, Nepal

            </div>

        </div>

    </div>

</body>

</html>`
    };


    let timeoutId;

    try {
        await Promise.race([
            mailTransporter.sendMail(mailOptions),
            new Promise((resolve, reject) => {
                timeoutId = setTimeout(() => {
                    const error = new Error(
                        "Timed out while sending administrator verification email."
                    );
                    error.code = "ETIMEDOUT";
                    reject(error);
                }, 15000);
            })
        ]);
    } finally {
        clearTimeout(timeoutId);
    }
}


// ==================================================
// AUTHORIZATION — ADMIN
// ==================================================

async function sendPasswordResetEmail(user, code) {
    const mailOptions = {
        from: {
            name: "SASF Foundation",
            address: process.env.SMTP_USER
        },
        to: user.email,
        subject: "SASF Foundation — Password Reset Code",
        text: `SASF FOUNDATION\n\nA password reset was requested for your administrator account.\n\nYour reset code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this change, you can ignore this email.\n\nSASF Foundation`,
        html: `<!doctype html><html lang="en"><body style="margin:0;background:#f4f1e9;font-family:Arial,sans-serif;color:#26332d"><div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden"><div style="padding:24px;background:#123c32;color:#fff;text-align:center;font-weight:bold;letter-spacing:2px">SASF FOUNDATION</div><div style="padding:32px"><h2 style="margin:0 0 14px;color:#123c32">Administrator password reset</h2><p>A password reset was requested for your administrator account.</p><p>Your reset code:</p><div style="padding:18px;background:#f7f3eb;border-radius:8px;text-align:center;font-size:30px;font-weight:bold;letter-spacing:8px;color:#123c32">${code}</div><p>This code expires in <strong>10 minutes</strong>.</p><p style="color:#6d756f;font-size:13px">If you did not request this change, ignore this email. Your password will not change unless the code is verified.</p></div><div style="padding:18px;background:#123c32;color:#dfe8e3;text-align:center;font-size:12px">SASF Foundation · Kathmandu, Nepal</div></div></body></html>`
    };

    let timeoutId;
    try {
        await Promise.race([
            mailTransporter.sendMail(mailOptions),
            new Promise((resolve, reject) => {
                timeoutId = setTimeout(() => {
                    const error = new Error("Timed out while sending password reset email.");
                    error.code = "ETIMEDOUT";
                    reject(error);
                }, 15000);
            })
        ]);
    } finally {
        clearTimeout(timeoutId);
    }
}

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


    const currentUser =
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
        !currentUser ||
        currentUser.is_active !== 1
    ) {

        req.session.destroy(
            () => {}
        );


        return res.status(401).json({
            error:
                "Your administrator account is no longer active."
        });
    }


    req.session.adminName =
        currentUser.name;

    req.session.adminEmail =
        currentUser.email;

    req.session.role =
        currentUser.role;

    req.currentAdmin =
        currentUser;


    next();
}


// Contact messages and subscriber addresses are available only to
// administrator roles with management responsibility, never Staff Admins.
function requireAdminOrSuperAdmin(
    req,
    res,
    next
) {
    requireAdmin(
        req,
        res,
        () => {
            if (
                !["super_admin", "admin"].includes(
                    req.currentAdmin.role
                )
            ) {
                return res.status(403).json({
                    error:
                        "Administrator role required to view contact and subscriber data."
                });
            }

            next();
        }
    );
}


// ==================================================
// AUTHORIZATION — SUPER ADMIN
// ==================================================

function requireSuperAdmin(
    req,
    res,
    next
) {

    requireAdmin(
        req,
        res,
        () => {

            if (
                !req.currentAdmin ||
                req.currentAdmin.role !==
                    "super_admin"
            ) {

                return res.status(403).json({
                    error:
                        "Super Admin permission required."
                });
            }


            next();
        }
    );
}


// ==================================================
// AUTHORIZATION — PERMISSION MANAGER
// ==================================================

function getGrantableSections(
    adminUserId
) {

    return db.prepare(`
        SELECT
            section_key
        FROM admin_content_permissions
        WHERE
            admin_user_id = ?
        AND
            can_grant = 1
        ORDER BY section_key ASC
    `).all(
        adminUserId
    ).map(
        row =>
            row.section_key
    );
}


function requirePermissionManager(
    req,
    res,
    next
) {

    requireAdmin(
        req,
        res,
        () => {

            if (
                !req.currentAdmin
            ) {

                return res.status(403).json({
                    error:
                        "Permission manager access required."
                });
            }


            if (
                req.currentAdmin.role ===
                "super_admin"
            ) {

                return next();
            }


            if (
                req.currentAdmin.role !==
                "admin"
            ) {

                return res.status(403).json({
                    error:
                        "Only Super Admins and authorized Admins can manage permissions."
                });
            }


            const grantableSections =
                getGrantableSections(
                    req.currentAdmin.id
                );


            if (
                grantableSections.length === 0
            ) {

                return res.status(403).json({
                    error:
                        "Your Admin account has not been granted permission to manage administrator permissions."
                });
            }


            req.grantableSections =
                grantableSections;


            next();
        }
    );
}


// ==================================================
// WEBSITE CONTENT PERMISSION CHECK
// ==================================================

function getContentSection(
    contentKey
) {

    for (
        const [sectionKey, contentKeys]
        of Object.entries(WEBSITE_CONTENT_SECTIONS)
    ) {

        if (contentKeys.includes(contentKey)) {
            return sectionKey;
        }
    }

    return null;
}

// ==================================================
// CHECK WEBSITE CONTENT EDIT PERMISSION
// ==================================================

function requireWebsiteContentPermission(
    req,
    res,
    next
) {

    requireAdmin(
        req,
        res,
        () => {

            const currentAdmin = req.currentAdmin;

            if (
                currentAdmin &&
                currentAdmin.role === "super_admin"
            ) {
                return next();
            }

            const contentKey = String(
                req.body?.content_key || req.query?.content_key || ""
            ).trim();

            if (!contentKey) {
                return res.status(400).json({
                    error: "Content key is required."
                });
            }

            const sectionKey = getContentSection(contentKey);

            if (!sectionKey) {
                return res.status(403).json({
                    error: "This website content is not assigned to an editable section."
                });
            }

            const permission = db.prepare(`
                SELECT can_edit
                FROM admin_content_permissions
                WHERE admin_user_id = ?
                AND section_key = ?
                LIMIT 1
            `).get(currentAdmin.id, sectionKey);

            if (!permission || permission.can_edit !== 1) {
                return res.status(403).json({
                    error: "You do not have permission to edit this website section."
                });
            }

            next();
        }
    );
}


// ==================================================
// PUBLIC WEBSITE CONTENT
// ==================================================

function getEditableImageSections(user) {
    if (user.role === "super_admin") {
        return new Set(Object.keys(WEBSITE_CONTENT_SECTIONS));
    }

    return new Set(db.prepare(`
        SELECT section_key
        FROM admin_content_permissions
        WHERE admin_user_id = ?
        AND can_edit = 1
    `).all(user.id).map(row => row.section_key));
}

function canEditImageSlot(user, slot) {
    if (user.role === "super_admin") {
        return true;
    }

    const editableSections = getEditableImageSections(user);
    return slot.sections.every(section => editableSections.has(section));
}

const imageUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many image uploads. Please try again later." }
});

app.get(
    "/api/admin/images",
    requireAdmin,
    (req, res) => {
        const images = WEBSITE_IMAGE_SLOTS
            .filter(slot => canEditImageSlot(req.currentAdmin, slot))
            .map(slot => ({
                id: slot.id,
                label: slot.label,
                filename: slot.filename,
                url: `/images/${encodeURIComponent(slot.filename)}`,
                pages: slot.pages
            }));

        res.set("Cache-Control", "no-store");
        return res.json({ success: true, images });
    }
);

app.post(
    "/api/admin/images/:imageId",
    requireAdmin,
    imageUploadLimiter,
    express.raw({ type: "image/jpeg", limit: "12mb" }),
    (req, res) => {
        const slot = WEBSITE_IMAGE_SLOTS.find(
            image => image.id === req.params.imageId
        );

        if (!slot) {
            return res.status(404).json({ error: "Picture slot not found." });
        }

        if (!canEditImageSlot(req.currentAdmin, slot)) {
            return res.status(403).json({
                error: "You do not have permission to edit this picture on every page where it appears."
            });
        }

        if (
            !Buffer.isBuffer(req.body) ||
            req.body.length < 4 ||
            req.body[0] !== 0xff ||
            req.body[1] !== 0xd8 ||
            req.body[2] !== 0xff
        ) {
            return res.status(400).json({
                error: "Choose a valid JPEG image (.jpg or .jpeg)."
            });
        }

        const imageDirectory = path.join(__dirname, "..", "images");
        const imagePath = path.join(imageDirectory, slot.filename);
        const temporaryPath = path.join(
            imageDirectory,
            `.${slot.id}-${crypto.randomBytes(8).toString("hex")}.tmp`
        );

        try {
            fs.writeFileSync(temporaryPath, req.body, { flag: "wx" });
            fs.renameSync(temporaryPath, imagePath);

            return res.json({
                success: true,
                message: `${slot.label} updated successfully.`,
                url: `/images/${encodeURIComponent(slot.filename)}?v=${Date.now()}`
            });
        } catch (error) {
            try {
                if (fs.existsSync(temporaryPath)) {
                    fs.unlinkSync(temporaryPath);
                }
            } catch (cleanupError) {
                console.error("Picture upload cleanup error:", cleanupError.message);
            }

            console.error("Picture upload error:", error);
            return res.status(500).json({ error: "Unable to save this picture." });
        }
    }
);

app.get(
    "/api/site-content",
    publicContentLimiter,
    (req, res) => {

        try {

            const content =
                getWebsiteContent();


            res.set(
                "Cache-Control",
                "public, max-age=30, stale-while-revalidate=60"
            );
            res.set(
                "CDN-Cache-Control",
                "public, max-age=60, stale-while-revalidate=120"
            );


            return res.json({

                success:
                    true,

                content

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


// ==================================================
// FRONTEND
// ==================================================

// The project root also contains the private server directory and SQLite
// database. Only the browser assets referenced by the admin HTML may be
// requested from /server; source files, databases, and other files stay private.
const publicServerAssets = new Set([
    "/admin/admin.css",
    "/admin/admin.js",
    "/admin/login.css",
    "/admin/verify-otp.css"
]);

app.use(
    "/server",
    (req, res, next) => {
        if (!publicServerAssets.has(req.path)) {
            return res.status(404).json({
                error: "Not found."
            });
        }

        next();
    }
);

app.use(
    express.static(
        path.join(
            __dirname,
            ".."
        ),
        {
            etag: true,
            lastModified: true,
            maxAge: NODE_ENV === "production" ? "10m" : 0,
            setHeaders(res, filePath) {
                if (path.extname(filePath).toLowerCase() === ".html") {
                    res.setHeader("Cache-Control", "no-cache");
                    res.setHeader(
                        "CDN-Cache-Control",
                        "public, max-age=300, stale-while-revalidate=60"
                    );
                } else if (NODE_ENV === "production") {
                    const assetCacheControl =
                        "public, max-age=600, stale-while-revalidate=3600";
                    res.setHeader("Cache-Control", assetCacheControl);
                    res.setHeader("CDN-Cache-Control", assetCacheControl);
                }
            }
        }
    )
);


// ==================================================
// HOME
// ==================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "..",
                "index.html"
            )
        );
    }
);


// ==================================================
// ADMIN
// ==================================================

app.get(
    "/admin",
    (req, res) => {

        if (
            req.session.authenticated &&
            req.session.twoFactorVerified
        ) {

            return res.redirect(
                "/admin/dashboard"
            );
        }


        return res.redirect(
            "/admin/login"
        );
    }
);


// ==================================================
// ADMIN LOGIN PAGE
// ==================================================

app.get(
    "/admin/login",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "admin",
                "login.html"
            )
        );
    }
);


// ==================================================
// ADMIN LOGIN JAVASCRIPT
//
// IMPORTANT:
// This route must remain above the 404 handler.
// It serves server/admin/login.js.
// ==================================================

app.get(
    "/admin/login.js",
    (req, res) => {

        const loginJsPath =
            path.join(
                __dirname,
                "admin",
                "login.js"
            );


        res.set(
            "Content-Type",
            "application/javascript; charset=UTF-8"
        );


        res.set(
            "Cache-Control",
            "no-store"
        );


        return res.sendFile(
            loginJsPath
        );
    }
);

app.get("/admin/forgot-password", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname, "admin", "forgot-password.html"));
});

app.get("/admin/forgot-password.js", (req, res) => {
    res.set("Content-Type", "application/javascript; charset=UTF-8");
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname, "admin", "forgot-password.js"));
});
app.get(
    "/admin/verify-otp.js",
    (req, res) => {

        const verifyOtpJsPath =
            path.join(
                __dirname,
                "admin",
                "verify-otp.js"
            );

        res.set(
            "Content-Type",
            "application/javascript; charset=UTF-8"
        );

        res.set(
            "Cache-Control",
            "no-store"
        );

        return res.sendFile(
            verifyOtpJsPath
        );
    }
);

// ==================================================
// ADMIN OTP PAGE
// ==================================================

app.get(
    "/admin/verify-otp",
    (req, res) => {

        if (
            !req.session.pendingAdminUserId
        ) {

            return res.redirect(
                "/admin/login"
            );
        }


        res.sendFile(
            path.join(
                __dirname,
                "admin",
                "verify-otp.html"
            )
        );
    }
);


// ==================================================
// ADMIN DASHBOARD
// ==================================================

app.get(
    "/admin/dashboard",
    (req, res) => {

        if (
            !req.session.authenticated ||
            !req.session.twoFactorVerified ||
            !req.session.adminUserId
        ) {

            return res.redirect(
                "/admin/login"
            );
        }


        const currentUser =
            db.prepare(`
                SELECT
                    id,
                    is_active
                FROM admin_users
                WHERE id = ?
            `).get(
                req.session.adminUserId
            );


        if (
            !currentUser ||
            currentUser.is_active !== 1
        ) {

            req.session.destroy(
                () => {}
            );


            return res.redirect(
                "/admin/login"
            );
        }


        res.sendFile(
            path.join(
                __dirname,
                "admin",
                "admin.html"
            )
        );
    }
);


// ==================================================
// LOGIN — STEP 1
// EMAIL + PASSWORD
// ==================================================

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
                    req.body.password ||
                    ""
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


            if (
                !isValidEmail(
                    email
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid email address."
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


            if (
                !passwordMatches
            ) {

                return res.status(401).json({
                    error:
                        "Invalid email or password."
                });
            }


            // Remove previous OTP challenges.

            db.prepare(`
                DELETE FROM otp_challenges
                WHERE admin_user_id = ?
            `).run(
                user.id
            );


            const otp =
                generateOtp();


            const otpHash =
                hashOtp(
                    otp
                );


            const expiresAt =
                Date.now() +
                (
                    5 *
                    60 *
                    1000
                );


            // Create new OTP challenge.

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


            console.log("");

            console.log(
                "======================================"
            );

            console.log(
                " SASF FOUNDATION LOGIN OTP"
            );

            console.log(
                "======================================"
            );

            console.log(
                "Administrator sign-in challenge created and OTP email sent."
            );

            console.log(
                "Expires in: 5 minutes"
            );

            console.log(
                "======================================"
            );

            console.log("");


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

// ==================================================
// ADMIN PASSWORD RECOVERY
// ==================================================

app.get("/api/admin/password-reset/captcha", passwordResetCaptchaLimiter, (req, res) => {
    const failures = Number(req.session.passwordResetCaptchaFailures || 0);
    if (failures >= 10) {
        return res.status(429).json({ error: "Too many CAPTCHA attempts. Please try again later." });
    }

    const answer = generateCaptchaText();
    const captchaId = crypto.randomBytes(16).toString("hex");
    req.session.passwordResetCaptcha = {
        id: captchaId,
        answerHash: hashCaptchaAnswer(captchaId, answer),
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0
    };
    res.set({
        "Content-Type": "image/svg+xml; charset=UTF-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff"
    });
    return res.send(createCaptchaSvg(answer));
});

app.post("/api/admin/password-reset/verify-captcha", passwordResetAttemptLimiter, (req, res) => {
    const challenge = req.session.passwordResetCaptcha;
    const answer = String(req.body.answer || "").trim().toUpperCase();
    if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5 || !answer) {
        delete req.session.passwordResetCaptcha;
        return res.status(400).json({ error: "CAPTCHA is incorrect or expired. Please try again." });
    }

    const actual = Buffer.from(hashCaptchaAnswer(challenge.id, answer), "hex");
    const expected = Buffer.from(challenge.answerHash, "hex");
    const matches = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    if (!matches) {
        challenge.attempts += 1;
        req.session.passwordResetCaptchaFailures = Number(req.session.passwordResetCaptchaFailures || 0) + 1;
        if (challenge.attempts >= 5 || req.session.passwordResetCaptchaFailures >= 10) {
            delete req.session.passwordResetCaptcha;
        }
        return res.status(400).json({ error: "CAPTCHA is incorrect or expired. Please try again." });
    }

    delete req.session.passwordResetCaptcha;
    req.session.passwordResetCaptchaFailures = 0;
    req.session.passwordResetCaptchaVerifiedAt = Date.now();
    return res.json({ success: true });
});

app.post("/api/admin/password-reset/request", passwordResetRequestLimiter, async (req, res) => {
    const verifiedAt = Number(req.session.passwordResetCaptchaVerifiedAt || 0);
    delete req.session.passwordResetCaptchaVerifiedAt;
    delete req.session.passwordResetPendingUserId;
    delete req.session.passwordResetVerifiedUserId;
    delete req.session.passwordResetVerifiedAt;

    if (!verifiedAt || Date.now() - verifiedAt > 5 * 60 * 1000) {
        return res.status(403).json({ error: "Please complete the CAPTCHA before requesting a reset code." });
    }

    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Enter a valid email address." });
    }

    const user = db.prepare("SELECT id, name, email FROM admin_users WHERE lower(email) = ? AND is_active = 1").get(email);
    if (!user) {
        return res.status(404).json({
            error: "This Gmail is not registered to an active administrator or super administrator account."
        });
    }

    const code = generateOtp();
    db.prepare("DELETE FROM password_reset_challenges WHERE admin_user_id = ?").run(user.id);
    db.prepare(`INSERT INTO password_reset_challenges (admin_user_id, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)`)
        .run(user.id, hashPasswordResetCode(code), Date.now() + 10 * 60 * 1000);
    req.session.passwordResetPendingUserId = user.id;

    try {
        await sendPasswordResetEmail(user, code);
    } catch (error) {
        db.prepare("DELETE FROM password_reset_challenges WHERE admin_user_id = ?").run(user.id);
        delete req.session.passwordResetPendingUserId;
        console.error("Password reset email delivery failed:", error && error.message ? error.message : "Unknown mail error");
        return res.status(502).json({
            error: "This Gmail is registered, but the reset email could not be delivered. Check the server's Gmail SMTP connection and try again."
        });
    }
    return res.json({
        success: true,
        message: `A reset code was sent to the registered administrator email ${user.email}. Check your inbox and spam folder.`
    });
});

app.post("/api/admin/password-reset/verify-code", passwordResetAttemptLimiter, (req, res) => {
    const userId = Number(req.session.passwordResetPendingUserId || 0);
    const code = String(req.body.code || "").trim();
    const invalid = () => res.status(400).json({ error: "The code is invalid or expired. Request a new code and try again." });
    if (!userId || !/^\d{6}$/.test(code)) return invalid();

    const challenge = db.prepare(`SELECT id, code_hash, expires_at, attempts FROM password_reset_challenges WHERE admin_user_id = ? ORDER BY id DESC LIMIT 1`).get(userId);
    if (!challenge || challenge.expires_at < Date.now() || challenge.attempts >= 5) {
        db.prepare("DELETE FROM password_reset_challenges WHERE admin_user_id = ?").run(userId);
        delete req.session.passwordResetPendingUserId;
        return invalid();
    }

    const actual = Buffer.from(hashPasswordResetCode(code), "hex");
    const expected = Buffer.from(challenge.code_hash, "hex");
    const matches = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    if (!matches) {
        db.prepare("UPDATE password_reset_challenges SET attempts = attempts + 1 WHERE id = ?").run(challenge.id);
        if (challenge.attempts + 1 >= 5) {
            db.prepare("DELETE FROM password_reset_challenges WHERE id = ?").run(challenge.id);
            delete req.session.passwordResetPendingUserId;
        }
        return invalid();
    }

    db.prepare("DELETE FROM password_reset_challenges WHERE id = ?").run(challenge.id);
    delete req.session.passwordResetPendingUserId;
    req.session.passwordResetVerifiedUserId = userId;
    req.session.passwordResetVerifiedAt = Date.now();
    return res.json({ success: true });
});

app.post("/api/admin/password-reset/complete", passwordResetAttemptLimiter, async (req, res) => {
    const userId = Number(req.session.passwordResetVerifiedUserId || 0);
    const verifiedAt = Number(req.session.passwordResetVerifiedAt || 0);
    const password = String(req.body.password || "");
    const confirmation = String(req.body.confirmation || "");
    if (!userId || !verifiedAt || Date.now() - verifiedAt > 10 * 60 * 1000) {
        return res.status(403).json({ error: "Please verify a current reset code first." });
    }
    if (password.length < 12 || password.length > 200 || password !== confirmation) {
        return res.status(400).json({ error: "Passwords must match and be between 12 and 200 characters." });
    }

    const user = db.prepare("SELECT id FROM admin_users WHERE id = ? AND is_active = 1").get(userId);
    if (!user) return res.status(400).json({ error: "This administrator account is unavailable." });

    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ? AND is_active = 1").run(passwordHash, userId);
    db.prepare("DELETE FROM password_reset_challenges WHERE admin_user_id = ?").run(userId);
    try {
        db.prepare("DELETE FROM sessions WHERE json_extract(sess, '$.adminUserId') = ?").run(userId);
    } catch (error) {
        console.error("Could not revoke administrator sessions after password reset.", error.message);
    }

    return req.session.regenerate((error) => {
        if (error) {
            console.error("Could not rotate session after password reset.", error.message);
            return res.status(500).json({ error: "Password changed, but the session could not be cleared. Please return to login." });
        }
        return res.json({ success: true });
    });
});


// ==================================================
// VERIFY OTP — STEP 2
// ==================================================

app.post(
    "/api/admin/verify-otp",
    otpLimiter,
    (req, res) => {

        try {

            const otp =
                String(
                    req.body.otp ||
                    ""
                ).trim();


            if (
                !/^\d{6}$/.test(
                    otp
                )
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
                challenge.attempts >=
                5
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
                hashOtp(
                    otp
                );


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


// ==================================================
// CURRENT ADMIN
// ==================================================

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


        const editableSections =
            user.role === "super_admin"
                ? Object.keys(WEBSITE_CONTENT_SECTIONS)
                : db.prepare(`
                    SELECT section_key
                    FROM admin_content_permissions
                    WHERE admin_user_id = ?
                    AND can_edit = 1
                    ORDER BY section_key ASC
                `).all(user.id).map(row => row.section_key);


        const grantableSections =
            user.role ===
                "super_admin"

                ? Object.keys(
                    WEBSITE_CONTENT_SECTIONS
                )

                : getGrantableSections(
                    user.id
                );


        res.json({

            user,

            canGrantPermissions:
                user.role ===
                    "super_admin" ||
                grantableSections.length >
                    0,

            grantableSections,

            editableSections

        });
    }
);


// ==================================================
// LOGOUT
// ==================================================

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
                    "asf_admin_session",
                    {

                        httpOnly:
                            true,

                        secure:
                            NODE_ENV ===
                            "production",

                        sameSite:
                            "lax"
                    }
                );


                res.json({
                    success:
                        true
                });
            }
        );
    }
);


// ==================================================
// CONTACT FORM
// ==================================================

app.post(
    "/api/contact",
    contactLimiter,
    (req, res) => {

        try {

            const name =
                String(
                    req.body.name ||
                    ""
                ).trim();


            const email =
                normalizeEmail(
                    req.body.email
                );


            const subject =
                String(
                    req.body.subject ||
                    ""
                ).trim();


            const message =
                String(
                    req.body.message ||
                    ""
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
                name.length >
                150
            ) {

                return res.status(400).json({
                    error:
                        "Name is too long."
                });
            }


            if (
                !isValidEmail(
                    email
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid email address."
                });
            }


            if (
                subject.length >
                250
            ) {

                return res.status(400).json({
                    error:
                        "Subject is too long."
                });
            }


            if (
                message.length >
                5000
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


            return res.json({

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


            return res.status(500).json({
                error:
                    "Unable to submit your message."
            });
        }
    }
);


// ==================================================
// NEWSLETTER
// ==================================================

app.post(
    "/api/subscribe",
    newsletterLimiter,
    (req, res) => {

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
                !isValidEmail(
                    email
                )
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
                    String(
                        error.message
                    ).includes(
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


            return res.json({

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


            return res.status(500).json({
                error:
                    "Unable to subscribe."
            });
        }
    }
);


// ==================================================
// ADMIN — CONTACTS
// ==================================================

app.get(
    "/api/admin/contacts",
    requireAdminOrSuperAdmin,
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


// ==================================================
// ADMIN — SUBSCRIBERS
// ==================================================

app.get(
    "/api/admin/subscribers",
    requireAdminOrSuperAdmin,
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
// ADMIN — WEBSITE CONTENT
// ==================================================

app.get(
    "/api/admin/content",
    requireAdmin,
    (req, res) => {

        try {
            const currentAdmin = req.currentAdmin;

            if (
                currentAdmin &&
                currentAdmin.role === "super_admin"
            ) {
                const content = db.prepare(`
                    SELECT content_key, content_value, updated_at
                    FROM site_content
                    ORDER BY content_key ASC
                `).all();

                return res.json({ success: true, content });
            }

            const permissions = db.prepare(`
                SELECT section_key
                FROM admin_content_permissions
                WHERE admin_user_id = ?
                AND can_edit = 1
                ORDER BY section_key ASC
            `).all(currentAdmin.id);

            const allowedContentKeys = permissions.flatMap(
                permission => WEBSITE_CONTENT_SECTIONS[permission.section_key] || []
            );

            let content = [];
            if (allowedContentKeys.length > 0) {
                const placeholders = allowedContentKeys.map(() => "?").join(", ");
                content = db.prepare(`
                    SELECT content_key, content_value, updated_at
                    FROM site_content
                    WHERE content_key IN (${placeholders})
                    ORDER BY content_key ASC
                `).all(...allowedContentKeys);
            }


            return res.json({

                success:
                    true,

                content

            });

        } catch (error) {

            console.error(
                "Get website content error:",
                error
            );


            return res.status(500).json({
                error:
                    "Unable to load website content."
            });
        }
    }
);


// ==================================================
// UPDATE WEBSITE CONTENT
// ==================================================

app.patch(
    "/api/admin/content",
    requireWebsiteContentPermission,
    (req, res) => {

        try {

            const contentKey =
                String(
                    req.body.content_key ||
                    ""
                ).trim();


            const contentValue =
                String(
                    req.body.content_value ||
                    ""
                ).trim();


            if (!contentKey) {

                return res.status(400).json({
                    error:
                        "Content key is required."
                });
            }


            if (
                contentKey.length >
                100
            ) {

                return res.status(400).json({
                    error:
                        "Content key is too long."
                });
            }


            if (
                contentValue.length >
                20000
            ) {

                return res.status(400).json({
                    error:
                        "Content value is too long."
                });
            }


            if (
                !PUBLIC_CONTENT_KEYS.includes(
                    contentKey
                )
            ) {

                return res.status(400).json({
                    error:
                        "This website content field is not allowed."
                });
            }

            if (contentKey === "foundation_name" && (!contentValue || contentValue.length > 200)) {
                return res.status(400).json({
                    error: "Enter a foundation name no longer than 200 characters."
                });
            }

            if (contentKey === "foundation_short_name" && (!contentValue || contentValue.length > 40)) {
                return res.status(400).json({
                    error: "Enter a foundation short name no longer than 40 characters."
                });
            }

            if (
                ["founder_email", "contact_email"].includes(contentKey) &&
                contentValue &&
                !isValidEmail(contentValue)
            ) {
                return res.status(400).json({
                    error: "Enter a valid email address."
                });
            }

            if (contentKey === "founder_social_links") {
                let links;
                try {
                    links = JSON.parse(contentValue);
                } catch {
                    return res.status(400).json({
                        error: "Founder links must be valid JSON."
                    });
                }

                const validLinks = Array.isArray(links) &&
                    links.length <= 20 &&
                    links.every(link => {
                        if (
                            !link ||
                            typeof link.label !== "string" ||
                            !link.label.trim() ||
                            link.label.trim().length > 40 ||
                            typeof link.url !== "string" ||
                            link.url.length > 1000
                        ) {
                            return false;
                        }

                        try {
                            return new URL(link.url).protocol === "https:";
                        } catch {
                            return false;
                        }
                    });

                if (!validLinks) {
                    return res.status(400).json({
                        error: "Add up to 20 links with a name and a valid HTTPS address."
                    });
                }
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


// ==================================================
// ADMIN — VIEW USERS
// ==================================================

app.get(
    "/api/admin/users",
    requirePermissionManager,
    (req, res) => {

        const currentAdmin =
            req.currentAdmin;


        let users;


        // SUPER ADMIN

        if (
            currentAdmin.role ===
            "super_admin"
        ) {

            users =
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

        }


        // ADMIN

        else if (
            currentAdmin.role ===
            "admin"
        ) {

            users =
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
                    WHERE role = 'staff_admin'
                    ORDER BY id ASC
                `).all();

        }


        // STAFF ADMIN

        else {

            return res.status(403).json({
                error:
                    "You do not have permission to view administrator accounts."
            });
        }


        return res.json({
            users
        });
    }
);


// ==================================================
// SUPER ADMIN — ADD USER
// ==================================================

app.post(
    "/api/admin/users",
    requireSuperAdmin,
    async (req, res) => {

        try {

            const name =
                String(
                    req.body.name ||
                    ""
                ).trim();


            const email =
                normalizeEmail(
                    req.body.email
                );


            const phone =
                String(
                    req.body.phone ||
                    ""
                ).trim();


            const password =
                String(
                    req.body.password ||
                    ""
                );


            const role =
                String(
                    req.body.role ||
                    "staff_admin"
                ).trim();


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
                name.length >
                150
            ) {

                return res.status(400).json({
                    error:
                        "Name is too long."
                });
            }


            if (
                phone.length >
                50
            ) {

                return res.status(400).json({
                    error:
                        "Phone number is too long."
                });
            }


            if (
                !isValidEmail(
                    email
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid email address."
                });
            }


            if (
                !isValidRole(
                    role
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid role."
                });
            }


            if (
                password.length <
                12
            ) {

                return res.status(400).json({
                    error:
                        "Password must contain at least 12 characters."
                });
            }


            if (
                password.length >
                200
            ) {

                return res.status(400).json({
                    error:
                        "Password is too long."
                });
            }


            if (
                role ===
                "super_admin"
            ) {

                const count =
                    db.prepare(`
                        SELECT
                            COUNT(*) AS count
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
                    SELECT
                        id
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


            return res.status(201).json({

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


            return res.status(500).json({
                error:
                    "Unable to create admin account."
            });
        }
    }
);


// ==================================================
// SUPER ADMIN — ENABLE / DISABLE USER
// ==================================================

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
                !Number.isInteger(
                    userId
                ) ||
                userId <= 0
            ) {

                return res.status(400).json({
                    error:
                        "Invalid user ID."
                });
            }


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
                Number(userId) ===
                Number(
                    req.session.adminUserId
                )
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
                target.role ===
                    "super_admin" &&
                target.is_active === 1 &&
                isActive === 0
            ) {

                const activeSuperAdmins =
                    db.prepare(`
                        SELECT
                            COUNT(*) AS count
                        FROM admin_users
                        WHERE role = 'super_admin'
                        AND is_active = 1
                    `).get().count;


                if (
                    activeSuperAdmins <=
                    1
                ) {

                    return res.status(400).json({
                        error:
                            "At least one active Super Admin must remain."
                    });
                }
            }


            const result =
                db.prepare(`
                    UPDATE admin_users
                    SET is_active = ?
                    WHERE id = ?
                `).run(
                    isActive,
                    userId
                );


            if (
                result.changes !==
                1
            ) {

                return res.status(500).json({
                    error:
                        "The administrator status could not be updated."
                });
            }


            return res.json({

                success:
                    true,

                message:
                    isActive === 1
                        ? "Administrator account enabled successfully."
                        : "Administrator account disabled successfully."

            });

        } catch (error) {

            console.error(
                "Update admin status error:",
                error
            );


            return res.status(500).json({
                error:
                    "Unable to update admin status."
            });
        }
    }
);


// ==================================================
// SUPER ADMIN — CHANGE USER ROLE
// ==================================================

app.patch(
    "/api/admin/users/:id/role",
    requireSuperAdmin,
    (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(
                    userId
                ) ||
                userId <= 0
            ) {

                return res.status(400).json({
                    error:
                        "Invalid user ID."
                });
            }


            const newRole =
                String(
                    req.body.role ||
                    ""
                ).trim();


            if (
                !isValidRole(
                    newRole
                )
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
                        phone,
                        role,
                        is_active,
                        created_at
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
                Number(target.id) ===
                Number(
                    req.session.adminUserId
                )
            ) {

                return res.status(400).json({
                    error:
                        "You cannot change your own role."
                });
            }


            if (
                target.role ===
                newRole
            ) {

                return res.json({

                    success:
                        true,

                    message:
                        "The administrator already has this role.",

                    user: {

                        id:
                            target.id,

                        name:
                            target.name,

                        email:
                            target.email,

                        phone:
                            target.phone,

                        role:
                            target.role,

                        is_active:
                            target.is_active,

                        created_at:
                            target.created_at
                    }

                });
            }


            if (
                newRole ===
                    "super_admin" &&
                target.is_active === 1
            ) {

                const activeSuperAdmins =
                    db.prepare(`
                        SELECT
                            COUNT(*) AS count
                        FROM admin_users
                        WHERE role = 'super_admin'
                        AND is_active = 1
                    `).get().count;


                if (
                    activeSuperAdmins >=
                    2
                ) {

                    return res.status(400).json({
                        error:
                            "There can only be two active Super Admins."
                    });
                }
            }


            if (
                target.role ===
                    "super_admin" &&
                target.is_active === 1 &&
                newRole !==
                    "super_admin"
            ) {

                const activeSuperAdmins =
                    db.prepare(`
                        SELECT
                            COUNT(*) AS count
                        FROM admin_users
                        WHERE role = 'super_admin'
                        AND is_active = 1
                    `).get().count;


                if (
                    activeSuperAdmins <=
                    1
                ) {

                    return res.status(400).json({
                        error:
                            "At least one active Super Admin must remain."
                    });
                }
            }


            const updateRole = db.transaction(() => {
                const result = db.prepare(`
                    UPDATE admin_users
                    SET role = ?
                    WHERE id = ?
                `).run(
                    newRole,
                    userId
                );

                if (result.changes === 1) {
                    db.prepare(`
                        DELETE FROM admin_content_permissions
                        WHERE admin_user_id = ?
                    `).run(userId);
                }

                return result;
            });

            const result = updateRole();


            if (
                result.changes !==
                1
            ) {

                return res.status(500).json({
                    error:
                        "The administrator role could not be updated."
                });
            }


            return res.json({

                success:
                    true,

                message:
                    "Administrator role updated successfully.",

                user: {

                    id:
                        target.id,

                    name:
                        target.name,

                    email:
                        target.email,

                    phone:
                        target.phone,

                    role:
                        newRole,

                    is_active:
                        target.is_active,

                    created_at:
                        target.created_at
                }

            });

        } catch (error) {

            console.error(
                "Update admin role error:",
                error
            );


            return res.status(500).json({
                error:
                    "Unable to update administrator role."
            });
        }
    }
);


// ==================================================
// ADMIN — GET USER WEBSITE PERMISSIONS
// ==================================================

app.get(
    "/api/admin/users/:id/permissions",
    requirePermissionManager,
    (req, res) => {

        try {

            const currentAdmin =
                req.currentAdmin;


            const userId =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(
                    userId
                ) ||
                userId <= 0
            ) {

                return res.status(400).json({
                    error:
                        "Invalid user ID."
                });
            }


            const user =
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


            if (!user) {

                return res.status(404).json({
                    error:
                        "Admin account not found."
                });
            }


            if (
                user.role ===
                "super_admin"
            ) {

                return res.status(403).json({
                    error:
                        "Super Admin permissions cannot be managed."
                });
            }


            if (
                currentAdmin.role ===
                    "admin" &&
                user.role !==
                    "staff_admin"
            ) {

                return res.status(403).json({
                    error:
                        "Admins can only manage permissions for Staff Admin accounts."
                });
            }


            let manageableSections;


            if (
                currentAdmin.role ===
                "super_admin"
            ) {

                manageableSections =
                    Object.keys(
                        WEBSITE_CONTENT_SECTIONS
                    );

            } else {

                const grantPermissions =
                    db.prepare(`
                        SELECT
                            section_key
                        FROM admin_content_permissions
                        WHERE
                            admin_user_id = ?
                        AND
                            can_grant = 1
                        ORDER BY section_key ASC
                    `).all(
                        currentAdmin.id
                    );


                manageableSections =
                    grantPermissions.map(
                        permission =>
                            permission.section_key
                    );
            }


            let permissions =
                [];


            if (
                currentAdmin.role ===
                "super_admin"
            ) {

                permissions =
                    db.prepare(`
                        SELECT
                            section_key,
                            can_edit,
                            can_grant
                        FROM admin_content_permissions
                        WHERE
                            admin_user_id = ?
                        ORDER BY section_key ASC
                    `).all(
                        userId
                    );

            } else {

                if (
                    manageableSections.length ===
                    0
                ) {

                    permissions = [];

                } else {

                    const placeholders =
                        manageableSections
                            .map(
                                () => "?"
                            )
                            .join(", ");


                    permissions =
                        db.prepare(`
                            SELECT
                                section_key,
                                can_edit,
                                can_grant
                            FROM admin_content_permissions
                            WHERE
                                admin_user_id = ?
                            AND
                                section_key IN (${placeholders})
                            ORDER BY section_key ASC
                        `).all(
                            userId,
                            ...manageableSections
                        );
                }
            }


            return res.json({

                success:
                    true,

                user,

                sections:
                    manageableSections,

                permissions

            });

        } catch (error) {

            console.error(
                "Get website permissions error:",
                error
            );


            return res.status(500).json({
                error:
                    "Unable to load website permissions."
            });
        }
    }
);


// ==================================================
// ADMIN — UPDATE USER WEBSITE PERMISSIONS
// ==================================================

app.patch(
    "/api/admin/users/:id/permissions",
    requirePermissionManager,
    (req, res) => {

        try {

            const currentAdmin =
                req.currentAdmin;


            const userId =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(
                    userId
                ) ||
                userId <= 0
            ) {

                return res.status(400).json({
                    error:
                        "Invalid user ID."
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


            // Super Admin permissions cannot be changed.

            if (
                target.role ===
                "super_admin"
            ) {

                return res.status(403).json({
                    error:
                        "Super Admin permissions cannot be managed."
                });
            }


            // Admin can manage Staff Admin only.

            if (
                currentAdmin.role ===
                    "admin" &&
                target.role !==
                    "staff_admin"
            ) {

                return res.status(403).json({
                    error:
                        "Admins can only manage permissions for Staff Admin accounts."
                });
            }


            const permissions =
                req.body.permissions;


            if (
                !Array.isArray(
                    permissions
                )
            ) {

                return res.status(400).json({
                    error:
                        "Permissions must be provided as an array."
                });
            }


            // Determine manageable sections.

            let manageableSections;


            if (
                currentAdmin.role ===
                "super_admin"
            ) {

                manageableSections =
                    Object.keys(
                        WEBSITE_CONTENT_SECTIONS
                    );

            } else {

                const grantPermissions =
                    db.prepare(`
                        SELECT
                            section_key
                        FROM admin_content_permissions
                        WHERE
                            admin_user_id = ?
                        AND
                            can_grant = 1
                    `).all(
                        currentAdmin.id
                    );


                manageableSections =
                    grantPermissions.map(
                        permission =>
                            permission.section_key
                    );
            }


            const manageableSectionSet =
                new Set(
                    manageableSections
                );


            const receivedSections =
                new Set();


            for (
                const permission
                of permissions
            ) {

                if (
                    !permission ||
                    typeof permission !==
                        "object"
                ) {

                    return res.status(400).json({
                        error:
                            "Invalid permission entry."
                    });
                }


                const sectionKey =
                    String(
                        permission.section_key ||
                        ""
                    ).trim();


                if (
                    !Object.keys(
                        WEBSITE_CONTENT_SECTIONS
                    ).includes(
                        sectionKey
                    )
                ) {

                    return res.status(400).json({
                        error:
                            "Invalid website section: " +
                            sectionKey
                    });
                }


                if (
                    receivedSections.has(
                        sectionKey
                    )
                ) {

                    return res.status(400).json({
                        error:
                            "Duplicate website section: " +
                            sectionKey
                    });
                }


                receivedSections.add(
                    sectionKey
                );


                if (
                    !manageableSectionSet.has(
                        sectionKey
                    )
                ) {

                    return res.status(403).json({
                        error:
                            "You do not have permission to grant access to the " +
                            sectionKey +
                            " section."
                    });
                }


                if (
                    typeof permission.can_edit !==
                        "boolean"
                ) {

                    return res.status(400).json({
                        error:
                            "can_edit must be true or false."
                    });
                }


                if (
                    typeof permission.can_grant !==
                        "boolean"
                ) {

                    return res.status(400).json({
                        error:
                            "can_grant must be true or false."
                    });
                }


                // Staff Admin can NEVER receive
                // grant authority.

                if (
                    target.role ===
                        "staff_admin" &&
                    permission.can_grant
                ) {

                    return res.status(403).json({
                        error:
                            "Staff Admin accounts cannot be granted permission-management authority."
                    });
                }
            }


            // Admin cannot grant another Admin.

            if (
                currentAdmin.role ===
                    "admin" &&
                target.role !==
                    "staff_admin"
            ) {

                return res.status(403).json({
                    error:
                        "Admins can only grant permissions to Staff Admin accounts."
                });
            }


            // ------------------------------------------
            // SUPER ADMIN
            //
            // Super Admin replaces complete
            // permission set.
            // ------------------------------------------

            if (
                currentAdmin.role ===
                "super_admin"
            ) {

                const updatePermissions =
                    db.transaction(
                        () => {

                            db.prepare(`
                                DELETE FROM
                                    admin_content_permissions
                                WHERE
                                    admin_user_id = ?
                            `).run(
                                userId
                            );


                            const insertPermission =
                                db.prepare(`
                                    INSERT INTO
                                        admin_content_permissions
                                    (
                                        admin_user_id,
                                        section_key,
                                        can_edit,
                                        can_grant
                                    )
                                    VALUES (?, ?, ?, ?)
                                `);


                            for (
                                const permission
                                of permissions
                            ) {

                                insertPermission.run(

                                    userId,

                                    String(
                                        permission.section_key
                                    ).trim(),

                                    permission.can_edit
                                        ? 1
                                        : 0,

                                    permission.can_grant
                                        ? 1
                                        : 0
                                );
                            }
                        }
                    );


                updatePermissions();


                return res.json({

                    success:
                        true,

                    message:
                        "Website permissions granted successfully."

                });
            }


            // ------------------------------------------
            // ADMIN
            //
            // Admin can modify only sections where
            // the Admin has can_grant = 1.
            //
            // Permissions outside those sections
            // remain unchanged.
            // ------------------------------------------

            const updateAdminPermissions =
                db.transaction(
                    () => {

                        for (
                            const permission
                            of permissions
                        ) {

                            const sectionKey =
                                String(
                                    permission.section_key
                                ).trim();


                            db.prepare(`
                                INSERT INTO
                                    admin_content_permissions
                                (
                                    admin_user_id,
                                    section_key,
                                    can_edit,
                                    can_grant
                                )
                                VALUES (?, ?, ?, 0)

                                ON CONFLICT (
                                    admin_user_id,
                                    section_key
                                )
                                DO UPDATE SET
                                    can_edit = excluded.can_edit,
                                    can_grant = 0
                            `).run(

                                userId,

                                sectionKey,

                                permission.can_edit
                                    ? 1
                                    : 0
                            );
                        }
                    }
                );


            updateAdminPermissions();


            return res.json({

                success:
                    true,

                message:
                    "Website permissions granted successfully."

            });

        } catch (error) {

            console.error(
                "Update website permissions error:",
                error
            );


            return res.status(500).json({
                error:
                    "Unable to update website permissions."
            });
        }
    }
);


// ==================================================
// 404
// ==================================================

app.use(
    (req, res) => {

        res.status(404).json({
            error:
                "Not found."
        });
    }
);


// ==================================================
// ERROR HANDLER
// ==================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        if (res.headersSent) {
            return next(error);
        }

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


// ==================================================
// START SERVER
// ==================================================

const httpServer = app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "======================================"
        );

        console.log(
            " SASF FOUNDATION SERVER"
        );

        console.log(
            "======================================"
        );

        console.log("");

        // This tells us which server.js file
        // is actually running.

        console.log(
            `Loaded server file: ${__filename}`
        );

        console.log("");

        console.log(
            `Server running at http://localhost:${PORT}`
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
            "Admin login:"
        );

        console.log(
            `http://localhost:${PORT}/admin/login`
        );

        console.log("");

        console.log(
            "Authentication:"
        );

        console.log(
            "Individual admin accounts"
        );

        console.log(
            "Password authentication"
        );

        console.log(
            "One-time 6-digit OTP"
        );

        console.log(
            "OTP expires after 5 minutes"
        );

        console.log(
            "Maximum 5 OTP attempts"
        );

        console.log(
            "Role-based access"
        );

        console.log("");

        console.log(
            "Website content management:"
        );

        console.log(
            `${PUBLIC_CONTENT_KEYS.length} approved content fields`
        );

        console.log(
            "About-page content included"
        );

        console.log(
            "Founder content included"
        );

        console.log(
            "Values content included"
        );

        console.log(
            "Contact content included"
        );

        console.log("");

        console.log(
            "OTP delivery:"
        );

        console.log(
            "Gmail SMTP"
        );

        console.log(
            `Sender: ${process.env.SMTP_USER}`
        );

        console.log("");
    }
);

httpServer.keepAliveTimeout = 65000;
httpServer.headersTimeout = 66000;
httpServer.requestTimeout = 120000;

let isShuttingDown = false;
function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received; closing the server gracefully.`);

    const forceExitTimer = setTimeout(() => {
        console.error("Graceful shutdown timed out; closing active connections.");
        if (typeof httpServer.closeAllConnections === "function") {
            httpServer.closeAllConnections();
        }
        process.exit(1);
    }, 15000);
    forceExitTimer.unref();

    httpServer.close(() => {
        try {
            db.pragma("wal_checkpoint(PASSIVE)");
        } catch (error) {
            console.error("Database checkpoint during shutdown failed:", error.message);
        }
        mailTransporter.close();
        if (db.open) db.close();
        clearTimeout(forceExitTimer);
        console.log("Server shutdown complete.");
    });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
