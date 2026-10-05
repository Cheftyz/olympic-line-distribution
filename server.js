// ===== Olympic Line Distribution — server =====
try { require("dotenv").config(); } catch (_) { /* dotenv optional */ }

const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const path = require("path");
const createStore = require("./store");

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

// Admin credentials (set these in production via environment variables)
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
if (ADMIN_PASSWORD === "changeme") {
  console.warn(
    "\n[!] ADMIN_PASSWORD is not set — using default 'changeme'. Set ADMIN_PASSWORD before going live.\n"
  );
}

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) {
  console.warn(
    "[!] SESSION_SECRET not set — using a random one (logins reset on restart). Set SESSION_SECRET to persist logins."
  );
}

// Timing-safe credential check
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Not signed in." });
  }
  return res.redirect("/admin/login");
}

function cleanText(value, max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

async function buildApp() {
  const store = await createStore({ dataDir: path.join(__dirname, "data") });
  console.log(`[store] driver: ${store.driver}`);

  const app = express();
  if (IS_PROD) app.set("trust proxy", 1); // required for secure cookies behind Render's proxy

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: store.sessionStore, // undefined -> in-memory (dev/file mode)
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: IS_PROD,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    })
  );

  // ---- API ----
  app.get("/api/products", async (req, res) => {
    try {
      res.json(await store.getProducts());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load products." });
    }
  });

  app.post("/api/products", requireAdmin, async (req, res) => {
    const name = cleanText(req.body.name, 120);
    if (!name) return res.status(400).json({ error: "Product name is required." });

    const priceNum = parseFloat(req.body.price);
    try {
      const product = await store.createProduct({
        name,
        category: cleanText(req.body.category, 60),
        sku: cleanText(req.body.sku, 60),
        price: Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : null,
        imageUrl: cleanText(req.body.imageUrl, 600),
        description: cleanText(req.body.description, 1000),
      });
      res.status(201).json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not save the product." });
    }
  });

  app.delete("/api/products/:id", requireAdmin, async (req, res) => {
    try {
      const ok = await store.deleteProduct(req.params.id);
      if (!ok) return res.status(404).json({ error: "Product not found." });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not delete the product." });
    }
  });

  // ---- Auth ----
  app.get("/admin/login", (req, res) => {
    if (req.session && req.session.isAdmin) return res.redirect("/admin");
    res.sendFile(path.join(__dirname, "views", "login.html"));
  });

  app.post("/admin/login", (req, res) => {
    const user = cleanText(req.body.username, 120);
    const pass = String(req.body.password == null ? "" : req.body.password);
    const ok = safeEqual(user, ADMIN_USER) && safeEqual(pass, ADMIN_PASSWORD);
    if (!ok) return res.redirect("/admin/login?error=1");
    req.session.isAdmin = true;
    req.session.user = user;
    res.redirect("/admin");
  });

  app.post("/admin/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/admin/login"));
  });

  // ---- Pages ----
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.get("/catalog", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "catalog.html"));
  });

  app.get("/admin", requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "views", "admin.html"));
  });

  return app;
}

// Vercel serverless entry: build once, reuse across warm invocations.
let appPromise;
module.exports = (req, res) => {
  if (!appPromise) appPromise = buildApp();
  appPromise.then((app) => app(req, res)).catch((err) => {
    console.error("Init failed:", err);
    res.statusCode = 500;
    res.end("Server initialization error");
  });
};

// Local dev / Render: start a real listener only when run directly.
if (require.main === module) {
  buildApp()
    .then((app) => app.listen(PORT, () => console.log(`Olympic Line Distribution running on http://localhost:${PORT}`)))
    .catch((err) => { console.error("Failed to start:", err.message); process.exit(1); });
}
