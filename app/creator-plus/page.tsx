import Link from "next/link";
import { ArrowLeft,CheckCircle2,Store,Users,Percent,ShieldCheck } from "lucide-react";
export const metadata={title:"PrezzCreator+"};
export default function CreatorPlus(){
 return <main className="shell page-top narrow">
  <Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Creator studio</Link>
  <span className="creator-plus-kicker">PREZZCREATOR+</span>
  <h1>Lower fees for active sellers.</h1>
  <p className="muted-text">PrezzCreator+ is an earned tier. No subscription purchase is required. Eligibility is calculated from each store's completed sales and current account standing.</p>
  <div className="creator-plus-benefits">
   <div><Percent size={22}/><strong>5% marketplace commission</strong><p>Qualifying stores receive a 5% platform fee on new eligible checkouts, or the regular rate if lower. Payment processing fees remain separate.</p></div>
   <div><Users size={22}/><strong>10 studio collaborators</strong><p>Up to 10 managers, reviewers and creators instead of the standard 3.</p></div>
   <div><Store size={22}/><strong>PrezzCreator+ storefront label</strong><p>Visitors can see which storefronts currently qualify for the program.</p></div>
  </div>
  <section className="studio-panel"><h2><ShieldCheck size={20}/> Eligibility requirements</h2>
   <p className="muted-text">Evaluated automatically using a rolling 30-day window:</p>
   <ul className="creator-plus-requirements">
    <li><CheckCircle2 size={17}/> At least $50 of completed, nonrefunded paid sales in the previous 30 days</li>
    <li><CheckCircle2 size={17}/> At least 3 completed paid orders from 2 different buyers</li>
    <li><CheckCircle2 size={17}/> At least 2 published listings</li>
    <li><CheckCircle2 size={17}/> Store at least 14 days old</li>
    <li><CheckCircle2 size={17}/> Store currently active and not suspended</li>
   </ul>
   <p className="muted-text">Free orders and refunded transactions do not count. Benefits apply to new checkouts and can change as rolling sales fall outside the window. Existing subscription pricing is not rewritten automatically.</p>
   <Link href="/dashboard" className="button button-primary">Check my store</Link>
  </section>
 </main>;
}
