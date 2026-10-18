# PrezzStore

A creator marketplace for digital products and monthly memberships. Built with Next.js, Supabase and Stripe.

## Setup
1. Install Node 22 or newer. Run npm install.
2. Copy .env.example into .env.local and fill public Supabase URL and publishable key.
3. Create a Supabase project. Run the SQL migration in supabase/migrations/001_prezzstore.sql in its SQL editor.
4. Set SUPABASE_SERVICE_ROLE_KEY server-side only. Never publish secret keys or commit environment files.
5. Configure Supabase Auth allowed redirect URLs for /auth/callback and /auth/reset. Set up production SMTP.
6. Use a Stripe sandbox for testing. Add a restricted Stripe key and a webhook signing secret. Point your webhook to https://YOUR-SITE/api/stripe/webhook and subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, customer.subscription.updated, customer.subscription.deleted, and charge.refunded.
7. Set NEXT_PUBLIC_SITE_URL to your HTTPS site, including for Connect onboarding (HTTPS is required).
8. Run npm run dev or deploy to Vercel from GitHub. Test sign up, listings, uploads, seller verification, payments, webhooks, and downloads before launch.

## Pages
- / — landing page and catalog
- /explore — searchable listings
- /products/[id] — product and membership page
- /shop/[slug] — seller storefront with custom accent and banner
- /login — email account registration, login, password recovery
- /dashboard — seller studio, listings, design, and Stripe onboarding
- /orders — buyer purchase history and protected downloads

## Payments
Stripe Checkout Sessions are created server-side, with the amount read from the database (never from browser requests). Only one seller per checkout is supported; destination charges pay that seller after successful payment. Default marketplace commission: 8% before Stripe processing fees. The platform pays Stripe processing fees and is liable for negative connected-account balances under this configuration. Verify fee economics and refunds before launch.

Stripe Connect uses Accounts v2 recipient configuration and Express dashboard. Every checkout verifies seller transfer capability. Seller onboarding uses one-time Stripe Account Links, and Stripe handles the identity collection. The private download endpoint signs a temporary URL only after checking ownership and paid order status.

Memberships use monthly Stripe subscriptions and optional downloadable content. Additional Patreon-style features such as tiers, feed posts, comments, and subscriber management are a subsequent phase.

## Launch limitations
This is an initial application foundation, not yet a fully verified production marketplace. Production launch requires live payment approval, compliance review, terms, privacy and refund policies, moderation and malware scanning, seller payout/refund/dispute tools and security tests. Do not sell prohibited items or upload files without rights. Review Stripe Tax registrations before enabling automatic tax.

Stripe may require a parent or legal guardian to assume the role of account owner for sellers under 18. Do not bypass age or identity requirements.

Supabase tables and storage buckets are prefixed with prezz_ or prezz- to avoid collisions with other applications. Sample catalog items only appear in unconfigured preview mode and are not purchasable.