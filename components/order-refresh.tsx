"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
export default function OrderRefresh({pending}:{pending:boolean}){
 const router=useRouter(),[waiting,setWaiting]=useState(false);
 useEffect(()=>{
  if(!pending)return;
  setWaiting(true);let attempts=0;
  const timer=setInterval(()=>{if(++attempts>=20){clearInterval(timer);setWaiting(false);}router.refresh();},3000);
  return ()=>clearInterval(timer);
 },[pending,router]);
 if(!pending)return null;
 return <p role="status" className="form-alert">{waiting?"Waiting for payment confirmation. This page updates automatically.":"Payment is still pending. You can return later or refresh to check again."} <button type="button" className="text-link" onClick={()=>router.refresh()}>Refresh purchases</button></p>;
}
