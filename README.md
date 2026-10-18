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
- STRIPE_WEBHOOK_SECRET: signing secret for /api/stripe/webhook
- PREZZSTORE_PLATFORM_FEE_BPS: optional, 800 by default for 8% fee
- STRIPE_CONNECT_COUNTRY: us by default

Use Vercel sensitive environment variables for server secrets. No private keys belong in GitHub source.

In Supabase Auth settings, allow the Vercel domain plus /auth/callback and /auth/reset as redirect URLs. Configure an SMTP sender for production email delivery.

In Stripe sandbox, set the webhook destination to https://YOUR_DOMAIN/api/stripe/webhook. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, customer.subscription.updated, customer.subscription.deleted and charge.refunded. Enable the Billing Portal for customers to manage subscriptions.

## Features

Marketplace, search, category filters, sorting, digital listings, file uploads, storefront themes and banner images, subscriptions, Stripe Connect seller onboarding, protected downloads, checkout, order history, billing portal, password recovery and account signup.

## Production readiness

Stripe live payments are NOT automatically enabled. Seller onboarding and payouts require eligibility and identity verification; for sellers under age 18, Stripe may require a parent or guardian as account representative. Before opening a public marketplace, implement and test moderation, malware scanning, seller reporting, webhook idempotency, refunds/chargeback processes, subscription lifecycle handling, tax setup and relevant legal policies. Never bypass age verification.

Run npm install, npm run typecheck, and npm run build to test locally. GitHub Actions performs these checks on pushes.
