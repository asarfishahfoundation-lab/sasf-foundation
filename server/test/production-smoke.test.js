"use strict";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

let child;
let origin;
let testDatabasePath;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function reservePort() {
  const probe = net.createServer();
  return new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

before(async () => {
  const port = await reservePort();
  origin = "http://127.0.0.1:" + port;
  testDatabasePath = path.join(os.tmpdir(), "sasf-smoke-" + process.pid + "-" + Date.now() + ".db");
  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "production",
    TRUST_PROXY_HOPS: "1",
    DATABASE_PATH: testDatabasePath,
    SESSION_SECRET: "test-only-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "1",
    SMTP_SECURE: "false",
    SMTP_USER: "local-smoke-test",
    SMTP_PASS: "local-smoke-test"
  };
  child = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env,
    stdio: "ignore"
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Smoke-test server exited before it became ready.");
    try {
      const response = await fetch(origin + "/healthz");
      if (response.status === 200) return;
    } catch {}
    await wait(100);
  }
  child.kill();
  throw new Error("Smoke-test server did not become ready within 15 seconds.");
});

after(async () => {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => child.once("exit", resolve)),
      wait(3000)
    ]);
  }
  if (testDatabasePath) {
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        await fs.unlink(testDatabasePath + suffix);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
});

test("public pages and referenced local assets load", async () => {
  const pages = [
    ["index.html", "/"],
    ["about.html", "/about.html"],
    ["work.html", "/work.html"],
    ["contact.html", "/contact.html"],
    ["get-involved.html", "/get-involved.html"],
    ["server/admin/login.html", "/admin/login"],
    ["server/admin/forgot-password.html", "/admin/forgot-password"],
    ["server/admin/verify-otp.html", "/admin/verify-otp"],
    ["server/admin/admin.html", "/admin/dashboard"]
  ];
  const targets = new Set(["/", "/about.html", "/work.html", "/contact.html", "/get-involved.html"]);
  for (const [file, route] of pages) {
    const html = await fs.readFile(path.join(__dirname, "..", "..", file), "utf8");
    for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const ref = match[1];
      if (/^(?:#|https?:|mailto:|tel:|data:|javascript:)/i.test(ref)) continue;
      const url = new URL(ref, origin + route);
      if (url.origin === origin) targets.add(url.pathname);
    }
  }
  const results = await Promise.all([...targets].map(async route => {
    const response = await fetch(origin + route, { redirect: "manual" });
    await response.arrayBuffer();
    return [route, response.status];
  }));
  assert.deepEqual(results.filter(([, status]) => status !== 200), []);
});

test("public content is cacheable and a shared IP burst is not throttled too early", async () => {
  const response = await fetch(origin + "/api/site-content");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") || "", /public.*max-age=30/);
  assert.match(response.headers.get("cdn-cache-control") || "", /public.*max-age=60/);
  assert.equal(response.headers.get("set-cookie"), null);
  const data = await response.json();
  assert.equal(data.content.foundation_name, "Shree Asarfi Shah Foundation");
  assert.equal(data.content.foundation_short_name, "SASF");

  const statuses = await Promise.all(Array.from({ length: 150 }, async () => {
    const result = await fetch(origin + "/api/site-content");
    await result.arrayBuffer();
    return result.status;
  }));
  assert.equal(statuses.filter(status => status === 200).length, 150);
});

test("admin and health responses stay out of shared caches; private files stay blocked", async () => {
  for (const route of ["/admin/login", "/admin/forgot-password", "/admin/verify-otp", "/admin/dashboard", "/api/admin/me"]) {
    const response = await fetch(origin + route, { redirect: "manual" });
    assert.equal(response.headers.get("cache-control"), "no-store", route);
    assert.equal(response.headers.get("cdn-cache-control"), "no-store", route);
  }
  const adminApi = await fetch(origin + "/api/admin/me");
  assert.equal(adminApi.status, 401);
  for (const route of ["/healthz", "/readyz"]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  for (const route of ["/server/server.js", "/server/foundation.db", "/server/.env"]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 404, route);
  }
});

test("contact and newsletter reject empty submissions", async () => {
  const contact = await fetch(origin + "/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "", email: "", subject: "", message: "" })
  });
  assert.equal(contact.status, 400);

  const newsletter = await fetch(origin + "/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "" })
  });
  assert.equal(newsletter.status, 400);
});
