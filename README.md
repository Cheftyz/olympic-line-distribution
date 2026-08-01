# Olympic Line Distribution

Website and product catalog for Olympic Line Distribution, a product distributor.

- **Home** (`/`) — marketing landing page
- **Catalog** (`/catalog`) — public product grid with search + category filter
- **Admin** (`/admin`) — password-protected panel to add/delete products

## Stack

Node.js + Express. Products are stored in **MongoDB** when `MONGODB_URI` is set
(production), otherwise in a local JSON file at `data/products.json` (development).

## Run locally

```bash
npm install
npm start        # http://localhost:3000
```

Copy `.env.example` to `.env` to set `ADMIN_USER` / `ADMIN_PASSWORD` (and
optionally `MONGODB_URI`).

## Deploy (Render + MongoDB Atlas, free)

1. Create a free MongoDB Atlas cluster and copy its connection string.
2. In Render: **New + → Blueprint**, connect this repo (uses `render.yaml`).
3. Set environment variables in Render: `MONGODB_URI`, `ADMIN_USER`, `ADMIN_PASSWORD`.

## Environment variables

| Variable         | Purpose                                             |
|------------------|-----------------------------------------------------|
| `MONGODB_URI`    | MongoDB connection string (enables Mongo storage)   |
| `ADMIN_USER`     | Admin username (default `admin`)                    |
| `ADMIN_PASSWORD` | Admin password (**set before going live**)          |
| `PORT`           | Server port (default `3000`)                        |
