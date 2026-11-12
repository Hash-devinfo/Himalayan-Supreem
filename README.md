# HimalayanSupreem

Online store for silajeet, dry fruits and organic oils, selling across Pakistan. It includes a mobile-friendly storefront with guest cash-on-delivery (COD) checkout, and an admin dashboard for products, batches, inventory, orders, delivery and reports.

> **Status:** In development — Release 1 (see [Release plan](#release-plan)).

---

## Tech stack

| Layer          | Technology                                                        |
|----------------|-------------------------------------------------------------------|
| Client         | React + Vite, TypeScript (storefront + lazy-loaded admin section) |
| Server         | Node.js + Express REST API, TypeScript (ES Modules)               |
| Database       | MongoDB Atlas with Mongoose (multi-document transactions)         |
| Images         | Cloudinary (public product photos, private certificate images)    |
| Email          | Nodemailer over SMTP                                              |
| Scheduled jobs | node-cron (Pakistan time, UTC+5)                                  |
| Admin auth     | bcrypt + JWT in a secure httpOnly cookie                          |

---

## Project structure

```
HimalayanSupreem/
├── client/                 React + Vite app
│   └── src/
│       ├── storefront/     Customer pages
│       └── admin/          Admin dashboard (lazy-loaded, login required)
└── server/
    └── src/
        ├── config/         env, db, cloudinary, mailer
        ├── constants/      enums.ts — all allowed values (statuses, types)
        ├── models/         One Mongoose model per collection
        ├── modules/        One folder per feature:
        │                   auth, catalog, inventory, delivery, cart, checkout,
        │                   orders, refunds, notifications, settings, pages,
        │                   analytics, reports
        │                   (each: *.routes.ts, *.controller.ts,
        │                    *.service.ts, *.validation.ts)
        ├── providers/      Swappable providers
        │   ├── notifications/   email.ts, whatsappLink.ts
        │   ├── payments/        cod.ts
        │   └── couriers/        manual.ts
        ├── jobs/           Daily expiry, low-stock and cart jobs
        ├── middleware/     auth, validation, error handling, rate limits
        ├── types/          Shared TypeScript types
        └── utils/          AppError, asyncHandler, money, phone, dates
```

---

## Features

### Customer storefront
- Categories (Silajeet, Dry Fruits, Organic Oils; more can be added), search, and filters for price, size/weight and availability
- Product pages with variants (each size/weight has its own price and stock), ingredients, allergens, storage, usage, origin, batch and expiry details
- View-only, watermarked certificates (no download)
- Server-saved cart
- Guest COD checkout: phone required, email optional, city chosen from a pre-loaded list of Pakistani cities
- Delivery charge and estimate based on the city's zone, with free delivery above a set threshold
- Order number (`ORD-YYMMDD-NNNN`) and confirmation page
- Order status lookup (order number + phone, rate-limited) and cancellation request before packing

### Admin dashboard
- Products, categories, variants, certificates and approved claims
- Batch/lot tracking with expiry, 60-day expiry alerts and a 7-day sell-by cutoff
- Stock movements (received, reserved, packed, adjusted, damaged, expired, returned)
- Low-stock alerts per variant (default threshold: 5)
- Order workflow: three logged confirmation calls → confirm → pack (batch selection, undo packing) → ship (TCS / PostEx / Leopards, manual tracking) → delivered / delivery failed / returned
- COD collection and courier remittance tracking
- Item-level refunds for damaged or incorrect products only
- Invoices and packing slips
- Delivery zones, cities (zone assignment and blocking), settings, notification templates, editable policy pages
- Audit log of important admin actions
- Reports: sales summary, low stock, expiring batches

### Notifications
- Automatic email when the customer gave an email address
- WhatsApp click-to-send (pre-filled message; the admin presses send)
- Every message is logged; failed emails can be retried

---

## Key business rules

- Stock is **reserved** when an order is placed, **released** on cancellation, and **deducted from the chosen batch** at packing.
- Available stock = sellable batch quantity (more than 7 days from expiry) − reserved quantity.
- Two customers cannot both order the last unit.
- Expired batches, and batches within the sell-by cutoff, cannot be sold or packed.
- COD orders must be confirmed by phone call before packing; after three unanswered calls the order can be cancelled.
- Only customers with a delivered order can review the product (Release 2).
- Money is stored as whole rupees (integers). Dates are stored in UTC and reported in Pakistan time (UTC+5).
- Records referenced by orders are archived, never deleted.

---

## Getting started

### Prerequisites
- Node.js (LTS) and npm
- A MongoDB Atlas cluster (the free tier is fine for development)
- A Cloudinary account
- SMTP credentials for sending email

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/HimalayanSupreem.git
cd HimalayanSupreem
```

### 2. Server
```bash
cd server
npm install
cp .env.example .env    # then fill in your own values
npm run dev
```

### 3. Client
```bash
cd client
npm install
cp .env.example .env
npm run dev
```

### Environment variables

Create `server/.env` from `server/.env.example`. **Never commit `.env` files.**

| Variable                   | Purpose                                 |
|----------------------------|-----------------------------------------|
| `NODE_ENV`                 | `development` or `production`           |
| `PORT`                     | API server port                         |
| `MONGODB_URI`              | MongoDB Atlas connection string         |
| `JWT_SECRET`               | Secret for signing admin login tokens   |
| `CLIENT_URL`               | Client URL (for CORS and email links)   |
| `CLOUDINARY_CLOUD_NAME`    | Cloudinary cloud name                   |
| `CLOUDINARY_API_KEY`       | Cloudinary API key                      |
| `CLOUDINARY_API_SECRET`    | Cloudinary API secret                   |
| `SMTP_HOST`                | SMTP server                             |
| `SMTP_PORT`                | SMTP port                               |
| `SMTP_USER`                | SMTP username                           |
| `SMTP_PASS`                | SMTP password                           |
| `MAIL_FROM`                | Sender address for customer emails      |

Client (`client/.env`):

| Variable            | Purpose                |
|---------------------|------------------------|
| `VITE_API_URL`      | Base URL of the API    |

> Adjust these names if your code uses different ones.

### Sample data
Seed data (cities, delivery zones, sample products) is **fictional** and for development only. Replace it with real products, prices and certificates before launch.

---

## Release plan

| Release                       | Scope                                                                                                                                       |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| **1 — Run the store**         | Catalog, variants, certificates, batches and expiry, guest COD checkout, delivery zones, order workflow, packing, manual courier tracking, refunds, email + WhatsApp click-to-send, audit log, basic reports |
| **2 — Grow**                  | Delivered-order reviews, optional customer accounts (phone + password), welcome discount, Member Deals, discount codes, profit report, report export, analytics dashboard |
| **3 — Integrations**          | Automated WhatsApp (Business API), online payment gateway, courier API tracking, bundles, loyalty and seasonal offers                       |

---

## Before production launch

These need a business decision or an external account. Placeholders are used until then.

- [ ] Store name, logo, support hours, business email and WhatsApp number
- [ ] Product photos, final descriptions, certificates and approved product claims
- [ ] Refund, privacy, delivery, terms and review-rules wording (reviewed by the business)
- [ ] Delivery zones, charges, estimates, free-delivery threshold and blocked cities
- [ ] Courier merchant accounts: TCS, PostEx, Leopards
- [ ] Domain, hosting and HTTPS
- [ ] Production MongoDB Atlas cluster with backups and a recovery procedure
- [ ] Tax treatment on prices and invoices
- [ ] COD refund payout method
- [ ] (Release 3) WhatsApp Business API approval and message templates; payment gateway approval

---

## Security

- Admin area protected by login, with lockout after repeated failed attempts
- HTTPS required in deployment
- No card numbers or security codes are ever stored; future online payments go through an approved provider
- Secrets live only in environment variables, never in source code
- Customer data is limited to what is needed for orders, support, notifications, reviews and analytics

---

## Documentation

- Requirements Specification v1.7
- System Design — Release 1, Parts 1–3 (architecture, database, key workflows)

---

## License

Private — all rights reserved.
