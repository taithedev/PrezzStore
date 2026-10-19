"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
export default function AnnouncementBanner({items}:{items:{id:string;title:string;body:string;category:string}[]}){
 const [dismissed,setDismissed]=useState<string[]>([]);
 useEffect(()=>{try{setDismissed(JSON.parse(localStorage.getItem("prezzstore_dismissed_announcements")||"[]"));}catch{}},[]);
 const visible=items.find(item=>!dismissed.includes(item.id));
 if(!visible)return null;
 function dismiss(){
  if(!visible)return;
  const next=[...dismissed,visible.id].slice(-100);
  setDismissed(next);try{localStorage.setItem("prezzstore_dismissed_announcements",JSON.stringify(next));}catch{}
 }
 return <aside className="announcement-banner" role={visible.category==="alert"?"alert":"status"}>
  <Bell size={17}/><div><strong>{visible.title}</strong><span>{visible.body}</span></div>
  <Link href="/updates">News & updates</Link>
  <button onClick={dismiss} type="button" aria-label="Dismiss announcement"><X size={16}/></button>
 </aside>;
}
