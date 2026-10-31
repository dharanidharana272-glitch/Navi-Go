"use strict";
/* Navi Go AI backend - Node 22+, no npm packages. Run: node server.js  (PORT, DB_PATH, ADMIN_EMAIL, COOKIE_SECURE) */
const http = require("node:http"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
let DatabaseSync; try { ({ DatabaseSync } = require("node:sqlite")); } catch (e) { console.error("Navi Go AI needs Node.js 22.13 or newer (you have " + process.version + "). Install the LTS version from nodejs.org."); process.exit(1); }
const PORT = +process.env.PORT || 3000, ROOT = __dirname;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "storage", "navigo.db");
const ADMIN = (process.env.ADMIN_EMAIL || "").toLowerCase();
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, uid TEXT, name TEXT, email TEXT UNIQUE, gender TEXT, dob TEXT, ph TEXT, role TEXT DEFAULT 'user', created INTEGER);
CREATE TABLE IF NOT EXISTS sessions(th TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, exp INTEGER);
CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, dest TEXT, created INTEGER, PRIMARY KEY(user_id,dest));
CREATE TABLE IF NOT EXISTS trips(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title TEXT, dest TEXT, start TEXT, notes TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, dest TEXT, rating INTEGER, body TEXT, created INTEGER, UNIQUE(user_id,dest));`);
const q = (s, ...a) => db.prepare(s).all(...a), one = (s, ...a) => db.prepare(s).get(...a), run = (s, ...a) => db.prepare(s).run(...a);
const now = () => Date.now(), sha = s => crypto.createHash("sha256").update(s).digest("hex");

function hashPw(p) { const s = crypto.randomBytes(16); return "s1$" + s.toString("hex") + "$" + crypto.scryptSync(p, s, 64).toString("hex"); }
function checkPw(p, h) { const [, s, k] = h.split("$"); const a = crypto.scryptSync(p, Buffer.from(s, "hex"), 64), b = Buffer.from(k, "hex"); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function ageOf(iso) { const d = new Date(iso + "T00:00:00Z"); if (isNaN(d) || d > new Date()) return null; const n = new Date(); let a = n.getUTCFullYear() - d.getUTCFullYear(); if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--; return a; }
const pub = u => ({ id: u.uid, name: u.name, email: u.email, gender: u.gender, dob: u.dob, age: ageOf(u.dob), role: u.role });

const fails = new Map(); // login lockout per ip+email
const lockLeft = k => Math.max(0, Math.ceil((((fails.get(k) || {}).until || 0) - now()) / 1000));
function failed(k) { const o = fails.get(k) || { n: 0, until: 0 }; o.n++; if (o.n >= 5) o.until = now() + Math.min(300, 30 * 2 ** (o.n - 5)) * 1000; fails.set(k, o); }
const hits = new Map(); // generic per-IP rate limit: 120 req/min
function limited(ip) { const t = Math.floor(now() / 60000), o = hits.get(ip); if (!o || o.t !== t) { hits.set(ip, { t, n: 1 }); return false } return ++o.n > 120; }
setInterval(() => { const t = Math.floor(now() / 60000); for (const [k, v] of hits) if (v.t < t) hits.delete(k); for (const [k, v] of fails) if (v.until < now() - 600000) fails.delete(k); run("DELETE FROM sessions WHERE exp<?", now()); }, 600000).unref();

const HEAD = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.open-meteo.com https://open.er-api.com https://en.wikipedia.org https://cdn.jsdelivr.net; frame-ancestors 'none'" };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".json": "application/json", ".svg": "image/svg+xml" };

function send(res, code, obj, extra) { const b = JSON.stringify(obj); res.writeHead(code, { ...HEAD, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); res.end(b); }
const readBody = req => new Promise((ok, no) => { let n = 0, c = []; req.on("data", d => { n += d.length; if (n > 20000) { no(new Error("big")); req.destroy() } else c.push(d) }); req.on("end", () => { try { ok(JSON.parse(Buffer.concat(c).toString() || "{}")) } catch (e) { no(e) } }); });
const cookieOf = (req, k) => (req.headers.cookie || "").split(/;\s*/).map(x => x.split("=")).find(x => x[0] === k)?.[1];
const user = req => { const t = cookieOf(req, "sid"); if (!t) return null; return one("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.th=? AND s.exp>?", sha(t), now()) || null; };
const secure = req => process.env.COOKIE_SECURE === "1" || req.headers["x-forwarded-proto"] === "https";
function startSession(req, res, u) { const t = crypto.randomBytes(32).toString("hex"), life = 14 * 864e5; run("INSERT INTO sessions VALUES(?,?,?)", sha(t), u.id, now() + life); return "sid=" + t + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + life / 1000 + (secure(req) ? "; Secure" : ""); }
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const destOk = d => typeof d === "string" && d.length > 2 && d.length < 120 && d.includes("|");

const routes = {
  "POST /api/register": async (req, res, b) => {
    const name = clean(b.name, 60), email = clean(b.email, 120).toLowerCase(), pw = String(b.password || ""), dob = clean(b.dob, 10);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: "email" });
    if (pw.length < 8 || pw.length > 200 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return send(res, 400, { error: "pw" });
    const age = ageOf(dob); if (age === null || age > 120) return send(res, 400, { error: "dob" });
    if (age < 18) return send(res, 403, { error: "under18" });
    if (one("SELECT 1 x FROM users WHERE email=?", email)) return send(res, 409, { error: "exists" });
    const role = (ADMIN && email === ADMIN) || !one("SELECT 1 x FROM users LIMIT 1") && !ADMIN ? "admin" : "user";
    const r = run("INSERT INTO users(uid,name,email,gender,dob,ph,role,created) VALUES(?,?,?,?,?,?,?,?)", "NGA-" + crypto.randomInt(100000, 999999), name, email, clean(b.gender, 20), dob, hashPw(pw), role, now());
    const u = one("SELECT * FROM users WHERE id=?", r.lastInsertRowid);
    send(res, 201, { user: pub(u) }, { "Set-Cookie": startSession(req, res, u) });
  },
  "POST /api/login": async (req, res, b) => {
    const email = clean(b.email, 120).toLowerCase(), k = req.socket.remoteAddress + "|" + email, left = lockLeft(k);
    if (left) return send(res, 429, { error: "locked", seconds: left });
    const u = one("SELECT * FROM users WHERE email=?", email);
    if (!u) { crypto.scryptSync("x", "y", 64); return send(res, 404, { error: "noacct" }) }
    if (!checkPw(String(b.password || ""), u.ph)) { failed(k); const l = lockLeft(k); return send(res, l ? 429 : 401, l ? { error: "locked", seconds: l } : { error: "wrong" }) }
    fails.delete(k); send(res, 200, { user: pub(u) }, { "Set-Cookie": startSession(req, res, u) });
  },
  "POST /api/logout": async (req, res) => { const t = cookieOf(req, "sid"); if (t) run("DELETE FROM sessions WHERE th=?", sha(t)); send(res, 200, { ok: 1 }, { "Set-Cookie": "sid=; HttpOnly; Path=/; Max-Age=0" }); },
  "GET /api/me": async (req, res, b, u) => u ? send(res, 200, { user: pub(u) }) : send(res, 401, { error: "auth" }),
  "GET /api/favorites": async (req, res, b, u) => send(res, 200, { items: q("SELECT dest FROM favorites WHERE user_id=? ORDER BY created DESC", u.id).map(r => r.dest) }),
  "POST /api/favorites": async (req, res, b, u) => {
    if (!destOk(b.dest)) return send(res, 400, { error: "dest" });
    if (one("SELECT 1 x FROM favorites WHERE user_id=? AND dest=?", u.id, b.dest)) { run("DELETE FROM favorites WHERE user_id=? AND dest=?", u.id, b.dest); return send(res, 200, { saved: false }) }
    run("INSERT INTO favorites VALUES(?,?,?)", u.id, b.dest, now()); send(res, 200, { saved: true });
  },
  "GET /api/trips": async (req, res, b, u) => send(res, 200, { items: q("SELECT id,title,dest,start,notes FROM trips WHERE user_id=? ORDER BY created DESC", u.id) }),
  "POST /api/trips": async (req, res, b, u) => {
    if (!destOk(b.dest)) return send(res, 400, { error: "dest" });
    if (one("SELECT COUNT(*) c FROM trips WHERE user_id=?", u.id).c >= 100) return send(res, 400, { error: "limit" });
    const r = run("INSERT INTO trips(user_id,title,dest,start,notes,created) VALUES(?,?,?,?,?,?)", u.id, clean(b.title, 80) || b.dest.split("|")[0], b.dest, clean(b.start, 10), clean(b.notes, 1000), now());
    send(res, 201, { id: +r.lastInsertRowid });
  },
  "GET /api/reviews": async (req, res, b, u, url) => {
    const d = url.searchParams.get("dest") || ""; if (!destOk(d)) return send(res, 400, { error: "dest" });
    const s = one("SELECT COUNT(*) n, ROUND(AVG(rating),1) avg FROM reviews WHERE dest=?", d);
    send(res, 200, { count: s.n, avg: s.avg, items: q("SELECT r.id,r.rating,r.body,r.created,u.name,(r.user_id=?) mine FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.dest=? ORDER BY r.created DESC LIMIT 50", u ? u.id : 0, d) });
  },
  "POST /api/reviews": async (req, res, b, u) => {
    const rt = +b.rating; if (!destOk(b.dest) || !(rt >= 1 && rt <= 5) || !Number.isInteger(rt)) return send(res, 400, { error: "bad" });
    run("INSERT INTO reviews(user_id,dest,rating,body,created) VALUES(?,?,?,?,?) ON CONFLICT(user_id,dest) DO UPDATE SET rating=excluded.rating,body=excluded.body,created=excluded.created", u.id, b.dest, rt, clean(b.body, 800), now());
    send(res, 200, { ok: 1 });
  },
  "GET /api/admin/stats": async (req, res, b, u) => send(res, 200, { users: one("SELECT COUNT(*) c FROM users").c, trips: one("SELECT COUNT(*) c FROM trips").c, reviews: one("SELECT COUNT(*) c FROM reviews").c, favorites: one("SELECT COUNT(*) c FROM favorites").c, recentUsers: q("SELECT uid,name,email,role,created FROM users ORDER BY created DESC LIMIT 20"), recentReviews: q("SELECT id,dest,rating,body FROM reviews ORDER BY created DESC LIMIT 20") }),
  "POST /api/admin/delete-review": async (req, res, b) => { run("DELETE FROM reviews WHERE id=?", +b.id | 0); send(res, 200, { ok: 1 }) },
};
const needAuth = new Set(["GET /api/favorites", "POST /api/favorites", "GET /api/trips", "POST /api/trips", "POST /api/reviews"]);

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x"), ip = req.socket.remoteAddress;
    if (limited(ip)) return send(res, 429, { error: "rate" });
    if (url.pathname.startsWith("/api/")) {
      const key = req.method + " " + url.pathname, h = routes[key];
      if (!h) return send(res, 404, { error: "notfound" });
      if (req.method === "POST" && req.headers["x-requested-with"] !== "navigo") return send(res, 403, { error: "csrf" });
      const u = user(req);
      if (needAuth.has(key) && !u) return send(res, 401, { error: "auth" });
      if (key.includes("/admin/") && (!u || u.role !== "admin")) return send(res, 403, { error: "admin" });
      const b = req.method === "POST" ? await readBody(req) : {};
      return h(req, res, b, u, url);
    }
    if (url.pathname === "/healthz") return send(res, 200, { ok: 1 });
    let p = decodeURIComponent(url.pathname); if (p === "/" || p === "") p = "/index.html"; if (p === "/admin") p = "/admin.html";
    const f = path.normalize(path.join(ROOT, p)), rel = path.relative(ROOT, f);
    const blocked = rel.startsWith("..") || /^(storage|tools|node_modules)/.test(rel) || /^(server\.js|package.*\.json|README\.md|Dockerfile)$/.test(rel) || !MIME[path.extname(f)];
    if (blocked || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404, HEAD); return res.end("Not found"); }
    res.writeHead(200, { ...HEAD, "Content-Type": MIME[path.extname(f)], "Cache-Control": f.endsWith(".html") || f.endsWith("sw.js") ? "no-cache" : "public, max-age=3600" });
    fs.createReadStream(f).pipe(res);
  } catch (e) { if (!res.headersSent) send(res, e.message === "big" ? 413 : 400, { error: "bad" }); else res.end(); }
}).listen(PORT, () => console.log("Navi Go AI running on http://localhost:" + PORT));
