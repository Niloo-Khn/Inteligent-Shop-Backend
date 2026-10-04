# Inteligent-Shop Backend

Generic multi-shop commerce-management API. A seller can connect many storefronts and manage products, orders, buyer details, promotions, incidents, refunds, and homepage recommendations without Nix-Shop-specific domain logic.

## Architecture

- TypeScript with service classes and repository interfaces.
- SQLite persistence for the first deployment; the repository boundary can later move to PostgreSQL.
- Every shop-owned operation verifies the authenticated seller owns that shop.
- Products retain optional provider-neutral source metadata (`provider`, `externalId`, `sourceUrl`) for future Amazon, AliExpress, or other catalog adapters.
- Buyer details are derived from the seller's own shop orders and are never available across shops.

## API

- `POST /accounts/register`, `POST /accounts/login`, `GET /accounts/me`
- `GET/POST /shops`
- `GET/POST /shops/:shopId/products`, `GET/PUT /shops/:shopId/products/:id`
- `GET/POST /shops/:shopId/orders`, `GET/PUT /shops/:shopId/orders/:id`
- `POST /shops/:shopId/orders/:id/incidents`
- `POST /shops/:shopId/orders/:id/refunds`
- `GET /shops/:shopId/buyers`
- `GET/POST /shops/:shopId/promotions`
- `GET/PUT /shops/:shopId/recommendations`

The order `POST` endpoint is the generic ingestion contract for connected storefronts. Production connectors must authenticate with scoped channel credentials; the current seller token is suitable for dashboard development only.

AI catalog discovery is intentionally separated from product publishing. Future provider adapters should return normalized import previews; a seller then edits and publishes the selected preview through the existing product API. Do not scrape Amazon or AliExpress without an approved API and compliant usage terms.

## Run

```bash
cp .env.example .env
npm install --cache .npm-cache
npm run build
npm start
```

The API uses port `4100`. Generate `AUTH_SECRET` with `openssl rand -hex 32` and never commit `.env`.

```bash
npm test
npm run test:integration
```
# Inteligent Shop Backend

Generic, multi-shop seller platform written in TypeScript. Nix-Shop is one possible sales channel; no domain rule is tied to it. Every commerce record carries a `shopId`, and every seller request is checked tables scoped to the authenticated owner.

## Run locally

```bash
cp .env.example .env
npm install --cache .npm-cache
npm run build
npm start
```

The API listens on `http://localhost:4100`. Generate `AUTH_SECRET` with `openssl rand -hex 32`. SQLite data is stored in `data/platform.sqlite`.

## API groups

- Account: `POST /accounts/register`, `POST /accounts/login`, `GET /accounts/me`
- Shop: `GET/POST /shops`
- Product: `GET/POST /shops/:shopId/products`, `GET/PUT /shops/:shopId/products/:id`
- Order: `GET/POST /shops/:shopId/orders`, `GET/PUT /shops/:shopId/orders/:id`
- Order care: `POST /shops/:shopId/orders/:id/incidents`, `POST /shops/:shopId/orders/:id/refunds`
- Buyers: `GET /shops/:shopId/buyers`
- Promotion: `GET/POST /shops/:shopId/promotions`
- Homepage: `GET/PUT /shops/:shopId/recommendations`
- AliExpress discovery: `POST /shops/:shopId/catalog/aliexpress/search`
- AI copy review: `POST /shops/:shopId/catalog/enrich`

All routes except health, registration, and login require a bearer token. Ownership is checked again at the shop boundary to prevent cross-seller access.

Products support editable source metadata: `provider`, `externalId`, and `sourceUrl`. The AliExpress connector uses the official Affiliate Product Query API over HTTPS with TOP HMAC signing. Search results are previews: the seller must review price, delivery, stock, claims, and images before publishing. The affiliate search does not provide reliable inventory quantity, so imported products start with quantity `0` and status `draft`.

Optional OpenAI enrichment rewrites the supplier title and description using Structured Outputs. It is instructed to use only supplied facts and cannot change pricing, source data, inventory, or shipping. Both provider keys remain server-side.

Configure `.env`:

```env
ALIEXPRESS_APP_KEY=your-app-key
ALIEXPRESS_APP_SECRET=your-app-secret
ALIEXPRESS_TRACKING_ID=your-affiliate-tracking-id
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
```

Create an AliExpress Open Platform application, retrieve its App Key/App Secret, and request the relevant affiliate API permission before searching. Do not use unofficial scraping endpoints.

## Important next production work

- Add official supplier connectors and an AI-assisted normalization/review queue.
- Add signed inbound webhooks and idempotency for connected storefront orders.
- Add role-based team access, pagination, audit logs, encryption/retention policy for buyer PII, rate limiting, and HTTPS gateway deployment.
- Move from SQLite to PostgreSQL when running multiple API instances.

```bash
npm test
npm run test:integration
```
