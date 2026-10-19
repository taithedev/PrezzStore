import Link from "next/link";
import {Store,ArrowUpRight,BadgeCheck} from "lucide-react";
import type {Store as StoreData} from "@/lib/types";
export default function ShopDirectory({stores}:{stores:StoreData[]}){
 const ordered=[...stores].sort((a,b)=>(a.slug==="zuzify"?-1:b.slug==="zuzify"?1:0)||b.created_at.localeCompare(a.created_at));
 return <section id="shops" className="shop-directory">
  <div className="section-heading"><div><span className="section-tag"><Store size={14}/> THE SHOPS</span><h2>Explore every storefront</h2><p>Every active shop has a page, even before its first product is published.</p></div><Link className="text-link" href="/dashboard">Open your shop <ArrowUpRight size={16}/></Link></div>
  <div className="shop-grid">{ordered.map(s=><Link className="shop-card" href={"/shop/"+s.slug} key={s.id}>
   <div className="shop-card-cover" style={s.banner_url?{backgroundImage:`url("${s.banner_url}")`}:{}}/>
   <div className="shop-card-avatar" style={{borderColor:s.accent}}>{s.avatar_url?<img src={s.avatar_url} alt=""/>:<Store size={23}/>}</div>
   <span className="shop-card-meta">{s.slug==="zuzify"?"OFFICIAL SHOP":s.verified?<><BadgeCheck size={13}/> VERIFIED SHOP</>:"CREATOR SHOP"}</span>
   <h3>{s.name}</h3><p>{s.description||"A new shop is taking shape."}</p><span className="text-link">Visit shop <ArrowUpRight size={15}/></span>
  </Link>)}</div>
  {!ordered.length&&<p className="muted-text">The first shops are on their way.</p>}
 </section>;
}
