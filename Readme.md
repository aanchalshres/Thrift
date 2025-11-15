## E‑commerce Web (Client + Server)

Polished e‑commerce demo with React + Vite (client) and Express + MySQL (server). Includes themed UI, wishlist/cart, checkout with eSewa/Khalti/COD, admin analytics, and a minimal payment ledger/verification endpoint for reconciliation discussion.

### Tech stack
- Client: React 18, Vite, TypeScript, Tailwind, shadcn/ui, lucide-react
- Server: Node/Express, MySQL (mysql2/promise)
- Payments: eSewa (sandbox), Khalti (sandbox), Cash on Delivery (COD)

### 🌐 Live Deployment
- **Frontend**: Deployed on Vercel
- **Backend**: Deployed on Railway at `https://thrift-production-af9f.up.railway.app`
- **Database**: MySQL on Railway

---

## Quick start

### Local Development

Prerequisites:
- Node.js 18+
- MySQL 8.x (or compatible MariaDB)

1) **Server setup**
- Copy `Server/.env.example` to `Server/.env` and fill values (DB, JWT, payments). At minimum set DB creds and JWT_SECRET.
- From repo root:

```cmd
cd Server
npm install
npm start
```

The server will:
- Ensure DB and tables exist (see `Server/config/initDb.js`)
- Serve API at http://localhost:5000
- Expose uploads at http://localhost:5000/uploads

2) **Client setup**
- Copy `Client/.env.example` to `Client/.env` (defaults to `VITE_API_URL=http://localhost:5000`).

```cmd
cd Client
npm install
npm run dev
```

Client runs at http://localhost:5173 (default Vite port). Make sure `VITE_API_URL` points to the server.

### Production Deployment

#### Backend (Railway)
1. Create a new project on [Railway](https://railway.app)
2. Add MySQL database service
3. Deploy the `Server` directory
4. Set environment variables (see Server/.env.example)
5. Railway will automatically detect and deploy Node.js app

#### Frontend (Vercel)
1. Create a new project on [Vercel](https://vercel.com)
2. Import your GitHub repository
3. Set Root Directory to `Client`
4. Add environment variable: `VITE_API_URL` with your Railway backend URL
5. Deploy

**Note**: All fallback URLs in the codebase are set to the production Railway URL, so the app will work even without environment variables configured.

---

## Environment variables

See example files:
- `Server/.env.example` — DB config, JWT, eSewa, Khalti, client/server base URLs
- `Client/.env.example` — API base URL
- `Client/.env.production` — Production API URL (for Vercel deployment)

### Server Environment Variables (Railway)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` — MySQL connection
- `JWT_SECRET` — Secret for JWT token generation
- `CLIENT_BASE_URL` — Frontend URL (e.g., https://your-app.vercel.app)
- `SERVER_BASE_URL` — Backend URL (Railway auto-provides this)
- `ESEWA_ENV=sandbox`, `ESEWA_MERCHANT_CODE`, `ESEWA_SECRET_KEY`
- `KHALTI_SECRET_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Email configuration

### Client Environment Variables (Vercel)
- `VITE_API_URL` — Backend API URL (https://thrift-production-af9f.up.railway.app)
- `VITE_TAX_RATE` — Tax rate (default: 0)

**Important**: Vercel requires redeployment after environment variable changes as they are baked into the build at deploy time.

---

## Demo credentials

Use these in your demo (if not present, sign up new users and/or set `ADMIN_EMAIL` in `Server/.env` to promote to admin on next server start):

- Admin: admin@example.com / admin123
- Buyer: buyer@example.com / buyer123

Note: If these accounts don’t exist in your DB yet, create them via Sign Up then set `ADMIN_EMAIL=admin@example.com` in server `.env` and restart to promote the admin.

---

## Notable features to demo

- Themed UI: inputs, selects, dropdowns; discount badges; brand styling
- Listings: filters (category, price, sort, brand, condition, size) + quick filters: On Sale, Featured
- Product Detail: Similar items via reusable `ProductCard` (heuristic recommendation)
- Checkout: COD, eSewa, Khalti; idempotent order creation
- Admin: lazy‑loaded analytics chart with small session cache
- Seller UX: toast feedback + drag & drop image upload (up to 8 images)
- Seller Trust (Peer Feedback): buyers review sellers post‑purchase; trust badge on Product Detail; Shop filter label updated to “Trusted Sellers”. Legacy verification endpoints exist but the admin verification UI has been removed.
- Payment ledger: minimal SQL table & generic verification endpoint
- Order audit log: tracks status/payment transitions for traceability
- Admin bulk import: upload CSV on Admin → Products to create many products at once
- Password reset: request link and token-based reset (1h expiry)

---

## Reconciliation talking points

- Table: `payment_ledger` (id, order_id, method, gateway_txn_id, amount, currency, status, raw_payload, created_at)
- Endpoints:
	- POST `/api/payments/verify` — accepts `{ method, orderId?, txn? }`, checks `orders` mappings (eSewa UUID or Khalti pidx), writes a ledger row and returns `{ reconciled, orderId }`
	- GET `/api/payments/ledger` — returns last 50 ledger entries
- Existing flows already map `orders.esewa_transaction_uuid` and `orders.khalti_pidx` during initiation and mark Paid on provider callbacks

---

## Seller Verification

	- POST `/api/sellers/verify/apply` — multipart form with `shop_name` and `documents[]` (images or PDF). Requires auth.
	- GET `/api/sellers/:id/status` — verification status and latest application.
	- Admin:
		- GET `/api/sellers/admin/sellers/pending` — list pending applications
		- PUT `/api/sellers/admin/sellers/:id/approve` — approve, set `users.is_verified_seller=1`
		- PUT `/api/sellers/admin/sellers/:id/reject` — reject with optional notes
	- Page `/apply-verification` to submit/update application.
	- Badge on seller name and a “Verified Sellers” filter in Shop.
	- Sell page blocks publishing until verified (shows CTA to apply).
## Seller Trust (Peer Feedback)

Originally a pre‑listing verification system; now shifted to post‑purchase peer feedback so buyers build seller reputation organically.

### Schema
- `seller_feedback` table: `id, order_id, seller_id, buyer_id, as_described TINYINT(1), rating TINYINT, comment TEXT, created_at`.
- Legacy `users.is_verified_seller` and `seller_verifications` remain for backward compatibility but are no longer enforced for listing.

### Endpoints
- POST `/api/sellers/feedback` — body `{ orderId, sellerId?, rating (1-5), as_described (boolean), comment? }`. Requires buyer auth. One per seller per order.
- GET `/api/sellers/:id/feedback/summary` — returns `{ seller_id, total, positives, percentage, avgRating, recent[] }`.
- GET `/api/sellers/:id/feedback` — list (recent) feedback rows including `order_id` for client dedup.

### Client UX
- Product Detail shows a trust badge once feedback exists: `92% as-described · ★4.6 (42)`.
- Order Detail: after payment, buyer can submit feedback (or sees their existing review instead of the form).
- Shop “Verified Sellers” label repurposed as “Trusted Sellers”. Threshold logic can be added later (e.g., percentage >= 80 with >=5 reviews).

### Future Enhancements
- Add server-side trusted flag in product list based on thresholds.
- Admin moderation (hide abusive comments, aggregate suspicious patterns).
- Time‑decay weighting so recent feedback counts more.

### Legacy Verification (Optional)
Endpoints under `/api/sellers/verify/*` and the `/apply-verification` page still exist but publishing is no longer gated; consider removing when no longer needed.

---

## Scripts

Server:
- `npm start` — start server (with DB init)

Client:
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run preview` — preview build

---

## Troubleshooting

### Local Development
- If images don't load: ensure `Server/public/uploads` exists (it's created automatically) and that product images were uploaded.
- If bulk CSV import skips rows: confirm required headers `title,price` are present and price > 0.
- If payments fail in sandbox: verify keys and base URLs in `.env` match your local ports.
- If tables are missing: restart the server; `initDb.js` creates/patches tables on boot.

### Production Deployment
- **Frontend not connecting to backend**: 
  - Verify `VITE_API_URL` environment variable in Vercel includes `https://` protocol
  - Redeploy on Vercel after changing environment variables
  - Check browser console Network tab for failed API requests
  
- **CORS errors**: 
  - Update `allowedOrigins` array in `Server/app.js` with your Vercel URL
  - Commit and push changes to trigger Railway redeploy
  
- **404 errors on Vercel**: 
  - Ensure Root Directory is set to `Client` in Vercel project settings
  - Check that `vercel.json` rewrites are configured properly
  
- **Railway backend not accessible**: 
  - Check Railway deployment logs for errors
  - Verify MySQL database connection in Railway dashboard
  - Test health endpoint: `https://thrift-production-af9f.up.railway.app/_health`
  
- **Images not loading in production**:
  - Railway ephemeral filesystem: uploaded images are lost on restart
  - Solution: Use Cloudinary free tier (see below)

### Persistent Product Images (Cloudinary Free Tier)
The server supports optional Cloudinary uploads when `CLOUDINARY_CLOUD_NAME` and related env vars are set.

**Setup (No credit card required)**:
1. Sign up at https://cloudinary.com (free tier: 25 credits/month = plenty for small projects)
2. Get credentials from Dashboard → Account Details:
   - Cloud Name
   - API Key
   - API Secret
3. Add to Railway environment variables:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=thrift-products
```
4. Redeploy backend
5. Upload a new product—images will be stored at Cloudinary CDN URLs

**How it works**:
- If Cloudinary vars are present:
  - Switches multer to memory storage (no disk writes)
  - Uploads each image via stream to Cloudinary folder
  - Stores full HTTPS CDN URLs in `product_images.image_url` and `products.image`
- If not configured: falls back to legacy `/uploads/` disk path (ephemeral)

**Migration**:
- Existing products with `/uploads/` images remain broken after redeploy
- Re-edit important products (PUT with `replaceImages=true`) to migrate to Cloudinary

**Free Tier Limits**:
- 25 credits/month (1 credit ≈ 1 transformation or several uploads)
- 25GB storage, 25GB bandwidth
- More than enough for prototype/demo projects

## Bulk import products (CSV)

Admin users can upload a CSV to create many products.

Endpoint: `POST /api/admin/products/bulk` (multipart/form-data, field `file`)

Headers (case-insensitive):
`title,price,originalPrice,brand,category,size,productCondition,location,imageUrl`

Notes:
- `title` (required), `price` (required > 0)
- `imageUrl` can contain multiple absolute URLs separated by `|`; first becomes main image, all stored in `product_images`.
- Rows failing minimal validation are skipped (not aborted).
- Products are attributed to the uploading admin.

Example:
```
title,price,originalPrice,brand,category,size,productCondition,location,imageUrl
Vintage Denim Jacket,2500,4000,Levis,women,M,excellent,Kathmandu,https://example.com/a.jpg|https://example.com/b.jpg
Classic White Tee,800,,Uniqlo,men,L,good,Lalitpur,https://example.com/tee.jpg
```

For SQL-based bulk import, you can craft `INSERT INTO products (...) VALUES (...);` statements; see `Server/config/initDb.js` for column names.

---

## Password Reset Flow

Endpoints:
- POST `/api/auth/forgot` body: `{ email }` → generates a 32-byte hex `reset_token` and `reset_token_expires` (+1h) for the user if it exists. Always returns success to avoid email enumeration.
- POST `/api/auth/reset` body: `{ token, password }` → validates token & expiry, hashes new password (bcrypt), clears token fields.

Client pages:
- `/forgot-password` — enter email to request a reset link.
- `/reset-password?token=...` — set a new password and get redirected to Sign In.

Dev email fallback:
- If SMTP is not configured, the app uses Nodemailer `jsonTransport` to print email content to the server console (look for a JSON object that includes `resetLink`).

### Configure Gmail SMTP (App Password)
Google requires an App Password (with 2‑Step Verification enabled) for SMTP.

1) Enable 2‑Step Verification on your Google account.
2) Create an App Password: https://myaccount.google.com/apppasswords
3) Use these in `Server/.env` (or the Render dashboard):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=your_16_char_app_password
SMTP_FROM=Thriftsy <yourgmail@gmail.com>
CLIENT_BASE_URL=http://localhost:5173
```

Notes:
- Use port 587 (STARTTLS). Port 465 works too (set `SMTP_PORT=465`).
- App Password is different from your normal Gmail password—keep it secret.
- On free hosts, outbound SMTP can be blocked; if so, consider SendGrid/Resend free tiers.

Manual test checklist:
1) Visit `/forgot-password`, submit a known account.
2) Open email (or check server console in dev) and click the link.
3) Set a new password on `/reset-password?token=...`.
4) Sign in with the new password; the old one should fail.

Security considerations:
- Tokens are single-use and expire after 1 hour.
- To harden further, store a hash of the token instead of plaintext.
- Respond generically on `/forgot` to prevent user enumeration.

---

## License

For educational/demo purposes.
