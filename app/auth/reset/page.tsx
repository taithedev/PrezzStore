"use client";
import {SUPABASE_URL,SUPABASE_KEY} from "@/lib/public-supabase";

import {useEffect,useState} from "react";
import {createBrowserClient} from "@supabase/ssr";
import Link from "next/link";
export default function Reset(){
 const [password,setPassword]=useState("");const [msg,setMsg]=useState("");const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);
 const url=SUPABASE_URL;const key=SUPABASE_KEY;
 useEffect(()=>{if(!url||!key)return;const db=createBrowserClient(url,key);const code=new URLSearchParams(location.search).get("code");
 (async()=>{if(code){const {error}=await db.auth.exchangeCodeForSession(code);if(error){setMsg(error.message);return;}history.replaceState(null,"",location.pathname);}const {data}=await db.auth.getSession();setReady(Boolean(data.session));if(!data.session)setMsg("Open the password recovery link sent to your email.");})();},[url,key]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);if(!url||!key){setMsg("Supabase is not configured");setBusy(false);return;}const {error}=await createBrowserClient(url,key).auth.updateUser({password});setMsg(error?error.message:"Password changed. You can sign in now.");setBusy(false);}
 return <div className="shell page-top narrow"><h1>Set a new password</h1><p className="muted-text">Choose a secure password using your recovery link.</p><form onSubmit={submit} className="form-stack"><label>New password<input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="button button-primary" disabled={busy||!ready}>{busy?"Updating…":"Update password"}</button>{msg&&<p role="status">{msg}</p>}</form><Link className="text-link" href="/login">Back to login</Link></div>;}