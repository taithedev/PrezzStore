import Link from "next/link";
import { ArrowLeft, ShieldCheck, Wallet } from "lucide-react";
export default async function CheckoutUnavailable({searchParams}:{searchParams:Promise<{reason?:string}>}) {
 const reason=(await searchParams).reason;
 const message=reason==="setup"
  ? "Payments are not available yet. The marketplace's Stripe sandbox and verified webhook need to be configured before checkout can start."
  :reason==="seller"
  ? "This creator is still completing payment onboarding. No payment was taken."
  :"We couldn't start checkout. No payment was taken. Please try again later.";
 return <section className="shell page-top narrow">
  <span className="section-tag"><ShieldCheck size={15}/> SECURE CHECKOUT</span>
  <h1>Checkout isn't ready.</h1>
  <p className="muted-text">{message}</p>
  <p className="muted-text">If you're the store owner, open your studio's Payments section to see connection status.</p>
  <div className="hero-buttons"><Link href="/explore" className="button button-primary"><ArrowLeft size={17}/> Browse products</Link>
  <Link href="/dashboard" className="button button-secondary"><Wallet size={17}/> Creator studio</Link></div>
 </section>;
}