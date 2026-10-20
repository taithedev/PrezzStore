"use client";
import {SUPABASE_URL,SUPABASE_KEY} from "@/lib/public-supabase";
import {useEffect,useState} from "react";
import {createBrowserClient} from "@supabase/ssr";
import Link from "next/link";
export default function Reset(){
 const [password,setPassword]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{
  let mounted=true;
  const code=new URLSearchParams(location.search).get("code");
  if(code){location.replace("/auth/callback?code="+encodeURIComponent(code)+"&next=/auth/reset");return;}
  (async()=>{
   try{
    const db=createBrowserClient(SUPABASE_URL,SUPABASE_KEY);
    const {data,error}=await db.auth.getUser();
    if(!mounted)return;
    setReady(Boolean(data.user)&&!error);
    if(error||!data.user)setMsg("Open the password recovery link sent to your email.");
   }catch{if(mounted)setMsg("Account verification could not finish. Please request another recovery link.");}
  })();
  return ()=>{mounted=false;};
 },[]);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy||!ready)return;setBusy(true);setMsg("");
  try{
   const {error}=await createBrowserClient(SUPABASE_URL,SUPABASE_KEY).auth.updateUser({password});
   if(error)throw error;setPassword("");setMsg("Password changed. Your account is ready.");setReady(false);
  }catch(error){setMsg(error instanceof Error?error.message:"Could not change your password. Please try again.");}
  finally{setBusy(false);}
 }
 return <div className="shell page-top narrow"><h1>Set a new password</h1>
 <p className="muted-text">Choose a secure password using your recovery link.</p>
 <form onSubmit={submit} className="form-stack"><label>New password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
 <button className="button button-primary" disabled={busy||!ready}>{busy?"Updating…":"Update password"}</button>{msg&&<p role="status">{msg}</p>}</form>
 <Link className="text-link" href="/login">Back to login</Link></div>;
}
