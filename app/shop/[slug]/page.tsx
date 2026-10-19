import {notFound} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,BadgeCheck,Store as ShopIcon} from "lucide-react";
import MarketGrid from "@/components/market-grid";
import {server} from "@/lib/supabase";
import {storeBySlug} from "@/lib/catalog";
import {creatorPlusStatus} from "@/lib/creator-plus";
import type {Product} from "@/lib/types";
export const dynamic="force-dynamic";
export default async function Shop({params}:{params:Promise<{slug:string}>}){const s=await storeBySlug((await params).slug);if(!s)notFound();const tier=await creatorPlusStatus(s.id);const {data}=await (await server())!.from("prezzstore_products").select("*").eq("store_id",s.id).eq("published",true).is("removed_at",null).order("created_at",{ascending:false});return <div className="shell page-top" style={{["--store-accent" as string]:s.accent}}><Link href="/explore" className="back-link"><ArrowLeft size={16}/> Explore marketplace</Link><section className="store-banner" style={s.banner_url?{backgroundImage:"linear-gradient(90deg,#0d0c14e8,#0d0c1488),url("+s.banner_url+")"}:{}}><div className="store-emblem">{s.avatar_url?<img src={s.avatar_url} alt=""/>:<ShopIcon size={34}/>}</div><div><span className="section-tag bright">{s.verified?<BadgeCheck size={15} fill="#ae8aff" color="#fff"/>:<ShopIcon size={14}/>} {s.verified?"VERIFIED STOREFRONT":"CREATOR STOREFRONT"}</span>{tier.qualified&&<span className="creator-plus-badge"><BadgeCheck size={15}/> PrezzCreator+</span>}<h1>{s.name}</h1><p>{s.description||"Independent ideas, extraordinary work."}</p></div></section><MarketGrid items={(data||[]).map(p=>({...p,store:s})) as Product[]} title={"From "+s.name}/></div>}