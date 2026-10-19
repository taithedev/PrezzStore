"use client";
import {useState} from "react";
import Link from "next/link";
import {createBrowserClient} from "@supabase/ssr";
import {ImagePlus,Save,UserRound,ExternalLink} from "lucide-react";
import {SUPABASE_URL,SUPABASE_KEY} from "@/lib/public-supabase";
export type ProfileIdentityData={username:string;display_name:string;bio:string;avatar_url:string|null;banner_url:string|null;website_url:string|null};
export default function ProfileIdentity({userId,initial}:{userId:string;initial:ProfileIdentityData}){
 const [profile,setProfile]=useState(initial);
 const [name,setName]=useState(initial.display_name),[username,setUsername]=useState(initial.username);
 const [bio,setBio]=useState(initial.bio),[website,setWebsite]=useState(initial.website_url||"");
 const [avatar,setAvatar]=useState<File|null>(null),[banner,setBanner]=useState<File|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function upload(file:File){
  if(!SUPABASE_URL||!SUPABASE_KEY)throw new Error("Image uploads are not configured");
  if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)||file.size>5242880)
   throw new Error("Use a JPG, PNG, WebP or GIF under 5 MB");
  const path=userId+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-z0-9._-]/gi,"-").slice(-70);
  const client=createBrowserClient(SUPABASE_URL,SUPABASE_KEY);
  const {error}=await client.storage.from("prezzstore_assets").upload(path,file,{contentType:file.type});
  if(error)throw error;
  return path;
 }
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   const [avatar_path,banner_path]=await Promise.all([avatar?upload(avatar):null,banner?upload(banner):null]);
   const r=await fetch("/api/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    display_name:name,username,bio,website_url:website,
    ...(avatar_path?{avatar_path}:{}),...(banner_path?{banner_path}:{})
   })});
   const body=await r.json();if(!r.ok)throw new Error(body.error||"Could not save your profile");
   setProfile(body.profile);setAvatar(null);setBanner(null);setMessage("Profile saved.");
  }catch(e){setError(e instanceof Error?e.message:"Could not save your profile");}finally{setBusy(false);}
 }
 return <section className="studio-panel profile-identity">
  <div className="identity-preview" style={profile.banner_url?{backgroundImage:`linear-gradient(90deg,#08080b88,#08080b44),url("${profile.banner_url}")`}:{}}>
   <div className="identity-avatar">{profile.avatar_url?<img src={profile.avatar_url} alt="Your avatar"/>:<UserRound size={28}/>}</div>
  </div>
  <div className="identity-heading"><div><h2>Public profile</h2><p className="muted-text">Choose how your profile appears to other people. Your email stays private.</p></div>
   <Link className="text-link" href={"/u/"+profile.username}>View profile <ExternalLink size={14}/></Link></div>
  <form className="form-stack" onSubmit={save}>
   <div className="form-columns"><label>Display name<input required minLength={2} maxLength={50} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Username<input required minLength={3} maxLength={30} pattern="[a-z][a-z0-9_]{2,29}" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))}/></label></div>
   <label>Bio<textarea maxLength={600} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Tell buyers about yourself"/></label>
   <label>Website (optional)<input type="url" maxLength={300} placeholder="https://example.com" value={website} onChange={e=>setWebsite(e.target.value)}/></label>
   <div className="form-columns"><label className="file-field"><ImagePlus size={17}/> Profile picture<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setAvatar(e.target.files?.[0]||null)}/><span>{avatar?.name||"Choose image"}</span></label>
    <label className="file-field"><ImagePlus size={17}/> Profile banner<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setBanner(e.target.files?.[0]||null)}/><span>{banner?.name||"Choose image"}</span></label></div>
   {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="form-success" role="status">{message}</p>}
   <button type="submit" disabled={busy} className="button button-primary"><Save size={16}/>{busy?"Saving…":"Save profile"}</button>
  </form>
 </section>;
}
