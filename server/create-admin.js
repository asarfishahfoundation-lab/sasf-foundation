const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const readline = require("readline");
const path = require("path");

const dbPath = path.join(__dirname, "foundation.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

function askHidden(question) {
    return new Promise((resolve) => {
        process.stdout.write(question);

        const stdin = process.stdin;

        stdin.resume();
        stdin.setRawMode(true);
        stdin.setEncoding("utf8");

        let password = "";

        function onData(char) {
            if (char === "\u0003") {
                process.exit();
            }

            if (char === "\r" || char === "\n") {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener("data", onData);

                process.stdout.write("\n");
                resolve(password);

                return;
            }

            if (char === "\u007f") {
                if (password.length > 0) {
                    password = password.slice(0, -1);
                }
                return;
            }

            password += char;
        }

        stdin.on("data", onData);
    });
}

async function createAdmin() {
    console.log("");
    console.log("======================================");
    console.log(" ASF FOUNDATION ADMIN CREATOR");
    console.log("======================================");
    console.log("");

    const name = await ask("Full name: ");
    const email = await ask("Email address: ");
    const phone = await ask("Phone number: ");
    const password = await askHidden("Password: ");

    if (!name || !email || !phone || !password) {
        console.log("");
        console.log("All fields are required.");
        rl.close();
        db.close();
        process.exit(1);
    }

    if (password.length < 12) {
        console.log("");
        console.log("Password must contain at least 12 characters.");
        rl.close();
        db.close();
        process.exit(1);
    }

    const existing = db.prepare(`
        SELECT id, role
        FROM admin_users
        WHERE LOWER(email) = LOWER(?)
    `).get(email);

    if (existing) {
        console.log("");
        console.log("An account with this email already exists.");
        rl.close();
        db.close();
        process.exit(1);
    }

    const superAdminCount = db.prepare(`
        SELECT COUNT(*) AS count
        FROM admin_users
        WHERE role = 'super_admin'
    `).get().count;

    let role;

    if (superAdminCount < 2) {
        role = "super_admin";
        console.log("");
        console.log(`Creating Super Admin ${superAdminCount + 1} of 2...`);
    } else {
        role = await ask(
            "Role (admin / staff_admin): "
        );

        if (!["admin", "staff_admin"].includes(role)) {
            console.log("");
            console.log("Invalid role.");
            console.log("Use: admin OR staff_admin");

            rl.close();
            db.close();
            process.exit(1);
        }
    }

    const passwordHash = await bcrypt.hash(password, 12);

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
        email.toLowerCase(),
        phone,
        passwordHash,
        role
    );

    console.log("");
    console.log("======================================");
    console.log(" ADMIN ACCOUNT CREATED");
    console.log("======================================");
    console.log("");
    console.log(`Name : ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Role : ${role}`);
    console.log("");

    if (role === "super_admin") {
        console.log(
            `Super Admins currently created: ${superAdminCount + 1}/2`
        );
    }

    console.log("");

    rl.close();
    db.close();
}

createAdmin().catch((error) => {
    console.error("");
    console.error("Unable to create administrator.");
    console.error(error.message);

    rl.close();
    db.close();

    process.exit(1);
});