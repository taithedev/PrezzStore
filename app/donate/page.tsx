import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Heart, LockKeyhole, ShieldCheck } from "lucide-react";
import { stripeConfigured } from "@/lib/stripe";
import "./donate.css";

export const dynamic = "force-dynamic";

export default async function DonatePage({
  searchParams
}: {
  searchParams: Promise<{ thanks?: string; canceled?: string; error?: string }>;
}) {
  const params = await searchParams;
  const paymentsReady = stripeConfigured() &&
    Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const errorText = params.error === "amount" ? "Enter an amount between $1 and $500."
    : params.error === "setup" ? "Support payments are not configured yet."
    : params.error === "unavailable" ? "Support checkout is temporarily unavailable. Please try again later."
    : null;

  return <main className="shell donate-page">
    <Link className="back-link" href="/"><ArrowLeft size={16}/> Back to PrezzStore</Link>
    <section className="donate-panel">
      <span className="section-tag"><Heart size={15}/> SUPPORT THE PLATFORM</span>
      <h1>Support PrezzStore.</h1>
      <p className="donate-intro">Optional one-time payments to help cover hosting, development and maintenance for PrezzStore.</p>
      {params.thanks === "1" && <p className="donate-notice" role="status">If you completed the payment, thank you. The payment is confirmed by Stripe separately from this page.</p>}
      {params.canceled === "1" && <p className="donate-notice" role="status">Your support checkout was canceled. No donation was recorded as paid.</p>}
      {errorText && <p className="donate-notice donate-error" role="alert">{errorText}</p>}
      {paymentsReady ? <>
        <h2>Choose an amount</h2>
        <div className="donate-options">
          {[5, 10, 25, 50].map(amount=><form key={amount} method="post" action="/api/donate">
            <input type="hidden" name="amount" value={amount}/>
            <button type="submit" className="donate-choice">${amount} <ArrowUpRight size={17}/></button>
          </form>)}
        </div>
        <form className="donate-custom" method="post" action="/api/donate">
          <label htmlFor="donate-amount">Or enter a custom amount (USD)</label>
          <div className="donate-custom-row">
            <span aria-hidden="true">$</span>
            <input id="donate-amount" type="number" name="amount" min="1" max="500" step="0.01" required placeholder="15.00"/>
            <button className="button button-primary" type="submit">Continue <ArrowUpRight size={17}/></button>
          </div>
        </form>
      </> : <div className="donate-unavailable">Support payments are in setup mode. Please check back once Stripe sandbox and the donation database are configured.</div>}
      <p className="donate-disclaimer"><ShieldCheck size={16}/> Payments are securely processed by Stripe. Contributions go to PrezzStore, not marketplace sellers. They are voluntary, not charitable tax-deductible donations, and do not affect access to products.</p>
      <div className="donate-bottom"><LockKeyhole size={15}/> Stripe handles your payment details. PrezzStore never stores your card number.</div>
    </section>
  </main>;
}
