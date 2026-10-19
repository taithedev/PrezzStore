import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowLeft,Settings2} from "lucide-react";
import CreatorJoin from "@/components/creator-join";
import {creatorEnrolled} from "@/lib/authority";
import {currentUser} from "@/lib/supabase";
export const dynamic="force-dynamic";
export const metadata={title:"Account settings"};
export default async function AccountSettings(){
 const user=await currentUser();if(!user)redirect("/login?next=/account/settings");
 const creator=await creatorEnrolled(user);
 return <div className="shell page-top">
  <Link href="/account" className="back-link"><ArrowLeft size={15}/> My account</Link>
  <div className="inner-hero compact"><span className="section-tag"><Settings2 size={15}/> ACCOUNT SETTINGS</span>
   <h1>Account settings</h1><p>Choose whether to use PrezzStore as a buyer or publish through the free Creator Program.</p></div>
  <CreatorJoin enrolled={creator}/>
  <section className="studio-panel" style={{maxWidth:800}}><h2>Creator Program vs. PrezzCreator+</h2>
   <p className="muted-text">The regular Creator Program is free and enables seller tools. PrezzCreator+ is an additional earned tier that lowers marketplace commission for eligible active stores.</p>
   {creator&&<Link href="/creator-plus" className="text-link">See PrezzCreator+ requirements</Link>}
  </section>
 </div>;
}
