import { server } from "@/lib/supabase";
import { Bell, CalendarDays } from "lucide-react";
export const dynamic="force-dynamic";
export const metadata={title:"Updates"};
export default async function Updates(){
 const db=await server();
 const {data,error}=db?await db.from("prezzstore_announcements").select("id,title,body,category,created_at")
 .eq("published",true).order("created_at",{ascending:false}).limit(60):{data:[],error:null};
 return <div className="shell page-top"><div className="inner-hero compact"><span className="section-tag">PREZZSTORE / CHANGELOG</span>
 <h1>News & updates.</h1><p>Marketplace announcements, improvements and important alerts.</p></div>
 <div className="studio-panel">{error?<p>News cannot be loaded right now.</p>:data?.length?data.map(item=>
 <article className="news-entry" key={item.id}><span className="section-tag"><Bell size={14}/> {item.category.toUpperCase()}</span>
 <h2>{item.title}</h2><p>{item.body}</p><small><CalendarDays size={13}/> {new Date(item.created_at).toLocaleDateString()}</small></article>):<p>No news published yet.</p>}</div></div>;
}
