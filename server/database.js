const Database = require("better-sqlite3");

const db = new Database("foundation.db");

// ===============================
// CONTACT MESSAGES
// ===============================

db.prepare(
    "CREATE TABLE IF NOT EXISTS contacts (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "name TEXT NOT NULL, " +
    "email TEXT NOT NULL, " +
    "subject TEXT, " +
    "message TEXT NOT NULL, " +
    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
    ")"
).run();


// ===============================
// NEWSLETTER SUBSCRIBERS
// ===============================

db.prepare(
    "CREATE TABLE IF NOT EXISTS subscribers (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "email TEXT NOT NULL UNIQUE, " +
    "subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
    ")"
).run();


// ===============================
// WEBSITE CONTENT
// ===============================

db.prepare(
    "CREATE TABLE IF NOT EXISTS site_content (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "content_key TEXT NOT NULL UNIQUE, " +
    "content_value TEXT NOT NULL, " +
    "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
    ")"
).run();


// ===============================
// DEFAULT WEBSITE CONTENT
// ===============================

const defaultContent = [
    {
        key: "foundation_name",
        value: "Shree Asarfi Shah Foundation"
    },
    {
        key: "foundation_short_name",
        value: "SASF"
    },
    {
        key: "managed_by",
        value: "Nayak IT Foundation"
    },
    {
        key: "home_intro",
        value: "Building a better future through meaningful social work, community support, education, and sustainable development."
    },
    {
        key: "about_description",
        value: "Shree Asarfi Shah Foundation is committed to creating positive change through community-focused initiatives, social responsibility, education, and support for people in need."
    },
    {
        key: "founder_name",
        value: "Er. Raghbendra Kumar Shah"
    },
    {
        key: "founder_bio",
        value: "Er. Raghbendra Kumar Shah is an electrical engineer currently residing in the United States, an investor and social worker who has been involved in social work since 2010. He graduated from Dhaka, Bangladesh and Janakpur, Nepal."
    },
    {
        key: "contact_email",
        value: "raghben.shah@gmail.com"
    },
    {
        key: "contact_phone",
        value: "+977-9801088875"
    },
    {
        key: "whatsapp_primary",
        value: "+977-9801088875"
    },
    {
        key: "whatsapp_secondary",
        value: "+977-9812035423"
    },
    {
        key: "address",
        value: "Kathmandu, Nepal"
    }
];


// ===============================
// INSERT DEFAULT CONTENT
// ONLY IF IT DOES NOT EXIST
// ===============================

const insertContent = db.prepare(
    "INSERT OR IGNORE INTO site_content (content_key, content_value) VALUES (?, ?)"
);

const insertDefaults = db.transaction(() => {
    for (const item of defaultContent) {
        insertContent.run(item.key, item.value);
    }
});

insertDefaults();


// ===============================
// DATABASE STATUS
// ===============================

console.log("Database connected successfully.");
console.log("Website content system ready.");

module.exports = db;
