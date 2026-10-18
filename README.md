# PrezzStore

A Next.js creator marketplace for digital products, customizable shops and monthly memberships. Deployed using Vercel and backed by the shared **zuzify** Supabase project.

## Isolation from existing apps

- Supabase project: zuzify, ref wfqudstuncdldsvxqveu
- Tables: prezzstore_stores, prezzstore_products, prezzstore_orders
- Storage: prezzstore_assets (public image covers), prezzstore_deliveries (private downloadable files)
- Tables use RLS to restrict seller changes and buyer purchase histories; webhook writes are server-only.
- Authentication uses the shared Supabase Auth users, not a separate identity pool.

The schema from supabase/migrations/001_prezzstore.sql was applied to the shared project. Do not run it again unless you are migrating a different environment.

## Hosting setup

Deploy GitHub repo taithedev/PrezzStore to Vercel (Next.js preset, default root). Configure:

- NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY: publishable key
- SUPABASE_SERVICE_ROLE_KEY: server-only backend key, never put it in NEXT_PUBLIC
- NEXT_PUBLIC_SITE_URL: HTTPS base URL of the live app
- STRIPE_SECRET_KEY: restricted **Stripe sandbox** key during development
- STRIPE_WEBHOOK_SECRET: signing secret for /api/stripe/webhook (required before checkout is enabled)
- PREZZSTORE_PLATFORM_FEE_BPS: optional, 800 by default for 8% fee
- STRIPE_CONNECT_COUNTRY: us by default

Use Vercel sensitive environment variables for server secrets. No private keys belong in GitHub source.

In Supabase Auth settings, allow the Vercel domain plus /auth/callback and /auth/reset as redirect URLs. Configure an SMTP sender for production email delivery.

In Stripe sandbox, set the webhook destination to https://YOUR_DOMAIN/api/stripe/webhook. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed, and charge.refunded. Enable the Billing Portal for customers to manage subscriptions.

## Features

Marketplace, search, category filters, sorting, digital listings, file uploads, storefront themes and banner images, subscriptions, Stripe Connect seller onboarding, protected downloads, checkout, order history, billing portal, password recovery and account signup.

## Production readiness

Stripe live payments are NOT automatically enabled. Seller onboarding and payouts require eligibility and identity verification; for sellers under age 18, Stripe may require a parent or guardian as account representative. Before opening a public marketplace, implement and test moderation, malware scanning, seller reporting, webhook idempotency, refunds/chargeback processes, subscription lifecycle handling, tax setup and relevant legal policies. Never bypass age verification.

Run npm install, npm run typecheck, and npm run build to test locally. GitHub Actions performs these checks on pushes.


## Stripe sandbox readiness checklist

1. In the Stripe sandbox Dashboard, enable Connect for marketplace payments.
2. In Vercel > PrezzStore > Settings > Environment Variables, add the **restricted Stripe sandbox key** as `STRIPE_SECRET_KEY` (server-side only) and the private Supabase service-role key as `SUPABASE_SERVICE_ROLE_KEY`. Use sensitive variables. Do not put them in GitHub.
3. Deploy a valid HTTPS URL. Set `NEXT_PUBLIC_SITE_URL` to the exact deployed origin (for example, https://your-domain.example). Preview and production deployments should use their actual origins.
4. Create a Stripe webhook destination pointing at `https://YOUR-DOMAIN/api/stripe/webhook`. Copy the destination signing secret to Vercel as `STRIPE_WEBHOOK_SECRET`.
5. Send `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, and `charge.refunded` events to that endpoint.
6. Enable the Stripe Billing customer portal for membership subscription management in the sandbox Dashboard.
7. Create a test creator account, visit Creator studio > Payments, and complete Stripe sandbox onboarding. The dashboard will show status `active` only when Stripe reports that the seller can receive transfers.
8. With a **different** test buyer account, make a Stripe test purchase. Verify the signed webhook changes the database order to `paid` and only the buyer can download a privately stored file. Check subscription updates, cancellation, and failed payments in the sandbox.
9. Refunds/disputes require additional operations tooling and transfer reversal controls before offering live marketplace sales.

The app blocks Checkout until the restricted key, signing secret, and database service key are all configured. It refuses live Stripe keys by default unless a separate explicit live launch switch is set after eligibility, adult account ownership where required, legal review, seller risk controls, and testing. Stripe may require a legal guardian to participate in account setup for sellers under 18. There is no workaround for identity verification.

## Troubleshooting

- **Stripe setup required** in Creator studio: Vercel has not been given all server-only credentials.
- **Seller payments aren't ready**: the Stripe v2 recipient transfer capability is not active; complete onboarding and revisit Payments for status.
- **Signed webhook failures**: confirm the event destination URL and its unique signing secret; don't reuse a CLI secret on Vercel.
- **Orders stay pending**: verify the webhook is subscribed and reachable; Checkout return URLs alone never mark an order paid.
- **Membership management unavailable**: enable Billing customer portal for the sandbox.
- **Vercel app not deployed**: import the GitHub repository into the intended Vercel team and grant deployment permissions; no billing credentials should be put in source files.
