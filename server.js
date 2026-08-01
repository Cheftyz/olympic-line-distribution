// ===== Olympic Line Distribution — server =====
try { require("dotenv").config(); } catch (_) { /* dotenv optional */ }

const express = require("express");
const path = require("path");
const createStore = require("./store");

const PORT = process.env.PORT || 3000;

// Admin credentials (override in production via environment variables)
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
if (ADMIN_PASSWORD === "changeme") {
  console.warn(
    "\n[!] ADMIN_PASSWORD is not set — using default 'changeme'. Set ADMIN_PASSWORD before going live.\n"
  );
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (user === ADMIN_USER && pass === ADMIN_PASSWORD) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Olympic Line Admin", charset="UTF-8"');
  return res.status(401).send("Authentication required.");
}

function cleanText(value, max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

async function main() {
  const store = await createStore({ dataDir: path.join(__dirname, "data") });
  console.log(`[store] driver: ${store.driver}`);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ---- API ----
  // Public: list products
  app.get("/api/products", async (req, res) => {
    try {
      res.json(await store.getProducts());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load products." });
    }
  });

  // Admin: add a product
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

  // Admin: delete a product
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

  // ---- Pages ----
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.get("/catalog", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "catalog.html"));
  });

  // Admin page is protected so only authenticated admins can load it
  app.get("/admin", requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "views", "admin.html"));
  });

  app.listen(PORT, () => {
    console.log(`Olympic Line Distribution running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
