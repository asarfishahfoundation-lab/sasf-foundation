const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "foundation.db");
const db = new Database(dbPath);

console.log("Connecting to ASF Foundation database...");

db.pragma("foreign_keys = ON");

// --------------------------------------------------
// ADMIN USERS
// --------------------------------------------------

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


// --------------------------------------------------
// OTP CHALLENGES
// --------------------------------------------------

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
// SECURITY INDEXES
// --------------------------------------------------

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_admin_users_email
    ON admin_users(email)
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_otp_admin_user
    ON otp_challenges(admin_user_id)
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_otp_expiry
    ON otp_challenges(expires_at)
`).run();

console.log("");
console.log("======================================");
console.log(" ASF FOUNDATION ADMIN SYSTEM READY");
console.log("======================================");
console.log("");
console.log("Created / verified:");
console.log("• admin_users");
console.log("• otp_challenges");
console.log("• security indexes");
console.log("");
console.log("Existing contacts and subscribers were NOT deleted.");
console.log("");

db.close();