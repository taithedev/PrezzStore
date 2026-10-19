"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
export default function AnnouncementBanner({items}:{items:{id:string;title:string;body:string;category:string}[]}){
 const [dismissed,setDismissed]=useState<string[]>([]);
 const [announcements,setAnnouncements]=useState(items);
 useEffect(()=>{
  let mounted=true;
  async function refresh(){
   try{
    const response=await fetch("/api/announcements",{cache:"no-store"});
    if(response.ok){const data=await response.json();if(mounted&&Array.isArray(data.items))setAnnouncements(data.items);}
   }catch{}
  }
  refresh();
  const timer=setInterval(refresh,45000);
  return ()=>{mounted=false;clearInterval(timer);};
 },[]);
 useEffect(()=>{try{setDismissed(JSON.parse(localStorage.getItem("prezzstore_dismissed_announcements")||"[]"));}catch{}},[]);
 const visible=announcements.find(item=>!dismissed.includes(item.id));
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
