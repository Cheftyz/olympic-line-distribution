/**
 * Storage abstraction for Olympic Line Distribution.
 *
 * One async interface, two interchangeable drivers:
 *   - "mongo": used when MONGODB_URI is set (production on Render's free tier).
 *              Products live in MongoDB, so nothing depends on a persistent disk.
 *   - "file":  used when MONGODB_URI is absent (local dev). Products are a JSON
 *              file. Zero external dependencies.
 *
 * Both expose getProducts / createProduct / deleteProduct, so server.js is
 * identical either way.
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ===========================================================================
// File driver
// ===========================================================================
function createFileStore({ dataDir }) {
  const FILE = path.join(dataDir, "products.json");
  fs.mkdirSync(dataDir, { recursive: true });

  const read = () => {
    try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; }
  };
  const write = (data) => {
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, FILE);
  };

  return {
    driver: "file",
    sessionStore: undefined, // express-session default MemoryStore
    async getProducts() {
      return read().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },
    async createProduct(data) {
      const list = read();
      const product = { id: crypto.randomUUID(), ...data, createdAt: Date.now() };
      list.push(product);
      write(list);
      return product;
    },
    async deleteProduct(id) {
      const list = read();
      const idx = list.findIndex((p) => p.id === id);
      if (idx === -1) return false;
      list.splice(idx, 1);
      write(list);
      return true;
    },
    async close() {},
  };
}

// ===========================================================================
// Mongo driver
// ===========================================================================
async function createMongoStore(uri) {
  const { MongoClient } = require("mongodb");
  const MongoStore = require("connect-mongo");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(); // database name comes from the connection string
  const Products = db.collection("products");
  await Products.createIndex({ createdAt: -1 });

  const strip = (doc) => {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return rest;
  };

  return {
    driver: "mongo",
    sessionStore: MongoStore.create({
      client,
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 7, // 7 days
    }),
    async getProducts() {
      const docs = await Products.find({}).sort({ createdAt: -1 }).toArray();
      return docs.map(strip);
    },
    async createProduct(data) {
      const product = { id: crypto.randomUUID(), ...data, createdAt: Date.now() };
      await Products.insertOne({ ...product });
      return product;
    },
    async deleteProduct(id) {
      const res = await Products.deleteOne({ id });
      return res.deletedCount > 0;
    },
    async close() { await client.close(); },
  };
}

// ===========================================================================
// Factory
// ===========================================================================

// Tolerantly normalize a connection string pasted into a host's env settings.
// Handles common copy-paste slips: whitespace, a stray `MONGODB_URI=` prefix,
// wrapping quotes, and a missing `mongodb+srv://` scheme on an Atlas host.
function normalizeMongoUri(raw) {
  let s = String(raw).trim();
  s = s.replace(/^MONGODB_URI\s*=\s*/i, "");
  s = s.replace(/^['"]+/, "").replace(/['"]+$/, "");
  s = s.trim();

  const hasScheme = /^mongodb(\+srv)?:\/\//i.test(s);
  if (!hasScheme && /\.mongodb\.net/i.test(s)) {
    s = "mongodb+srv://" + s.replace(/^\/+/, "");
  }

  if (!/^mongodb(\+srv)?:\/\//i.test(s)) {
    const preview = s.slice(0, 20).replace(/(mongodb(?:\+srv)?:\/\/[^:@/]*:)[^@/]*/i, "$1****");
    throw new Error(
      'MONGODB_URI is set but is not a valid connection string — it must start ' +
        'with "mongodb+srv://" or "mongodb://".\n' +
        `  What was provided starts with: "${preview}..."\n` +
        '  Fix the value: no quotes, no "MONGODB_URI=" prefix, no leading space.'
    );
  }
  return s;
}

module.exports = async function createStore({ dataDir }) {
  const raw = process.env.MONGODB_URI;
  if (raw && raw.trim()) {
    const uri = normalizeMongoUri(raw);
    return createMongoStore(uri);
  }
  return createFileStore({ dataDir });
};

module.exports.normalizeMongoUri = normalizeMongoUri;
