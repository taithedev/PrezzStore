"use client";
import {SUPABASE_URL,SUPABASE_KEY} from "@/lib/public-supabase";

import {useEffect,useState} from "react";
import {createBrowserClient} from "@supabase/ssr";
import Link from "next/link";
import {ArrowRight,ArrowUpRight,Check,ExternalLink,FileUp,ImagePlus,LoaderCircle,PackageOpen,Palette,Plus,Store as StoreIcon,Wallet,LogOut} from "lucide-react";
import type {Product,Store} from "@/lib/types";
import SellerSales,{type SellerSale} from "@/components/seller-sales";
import ListingEditor from "@/components/listing-editor";
import ListingExtras,{emptyExtras,extrasPayload} from "@/components/listing-extras";
import {LayoutGrid,Users,Medal,ClipboardCheck,UserRound,Settings2} from "lucide-react";
import StudioTeam from "@/components/studio-team";
import StudioRemoval from "@/components/studio-removal";
import CreatorStatus from "@/components/creator-status";
import type {CreatorPlusStatus} from "@/lib/creator-plus";
import type {StudioRole} from "@/lib/authority";
let browser:ReturnType<typeof createBrowserClient>|null=null;
function db(){const url=SUPABASE_URL,key=SUPABASE_KEY;if(!url||!key)throw new Error("Configure Supabase.");if(!browser)browser=createBrowserClient(url,key);return browser;}
const slugify=(x:string)=>x.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
const categories=["Design","Software","Templates","Video","Music","Other"];
export default function Studio({userId,userEmail,initialStore,initialStores,platformRole,studioAccess,plusStatus,baseBps,initialProducts,initialSales}:{userId:string|null;userEmail:string;initialStore:Store|null;initialStores:Store[];platformRole:"owner"|"admin"|null;studioAccess:StudioRole|null;plusStatus:CreatorPlusStatus|null;baseBps:number;initialProducts:Product[];initialSales:SellerSale[]}) {
 const [store,setStore]=useState(initialStore);const [products,setProducts]=useState(initialProducts);const [tab,setTab]=useState<"products"|"appearance"|"payouts"|"sales"|"team"|"creatorPlus"|"settings">("products");
 const canEdit=studioAccess==="owner"||studioAccess==="manager";
 const canReview=canEdit||studioAccess==="reviewer";
 const canCreate=canEdit||studioAccess==="creator";
 const isOwner=studioAccess==="owner";
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [stripeStatus,setStripeStatus]=useState<"checking"|"not_configured"|"not_connected"|"pending"|"active"|"inactive"|"error">("checking");
 useEffect(()=>{
   if(tab!=="payouts"||!userId||!store)return;
   let current=true;
   setStripeStatus("checking");
   fetch("/api/stripe/status?store_id="+encodeURIComponent(store.id),{cache:"no-store"}).then(async res=>{
     const result=await res.json();
     if(current)setStripeStatus(res.ok?(result.status||"error"):"error");
   }).catch(()=>{if(current)setStripeStatus("error");});
   return ()=>{current=false;};
 },[tab,userId,store?.id]);
 const [shopName,setShopName]=useState(initialStore?.name||"");const [shopSlug,setShopSlug]=useState("");const [shopDesc,setShopDesc]=useState(initialStore?.description||"");
 const [extras,setExtras]=useState(emptyExtras);const [gallery,setGallery]=useState<File[]>([]);
 const [stock,setStock]=useState("");const [moderationOverride,setModerationOverride]=useState(false);const [publishNow,setPublishNow]=useState(true);const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [price,setPrice]=useState("");const [kind,setKind]=useState<"digital"|"membership"|"service">("digital");const [category,setCategory]=useState("Design");const [image,setImage]=useState<File|null>(null);const [file,setFile]=useState<File|null>(null);
 const [accent,setAccent]=useState(initialStore?.accent||"#9271ff");const [banner,setBanner]=useState<File|null>(null);const [avatar,setAvatar]=useState<File|null>(null);
 async function upload(bucket:string,item:File){
  if(!userId)throw new Error("Sign in first.");
  const safe=item.name.replace(/[^a-z0-9._-]/gi,"-").slice(-80);
  const path=userId+"/"+crypto.randomUUID()+"-"+safe;
  const {error}=await db().storage.from(bucket).upload(path,item,{upsert:false,contentType:item.type||"application/octet-stream"});
  if(error)throw error;return path;
 }
 async function createStore(e:React.FormEvent) {
  e.preventDefault();if(!userId)return;setBusy(true);setError("");setNotice("");
  try{
   const slug=slugify(shopSlug||shopName);if(slug.length<3)throw new Error("Shop URL needs 3+ characters.");
   const {data,error}=await db().from("prezzstore_stores").insert({owner_id:userId,name:shopName.trim(),slug,description:shopDesc}).select().single();
   if(error)throw error;setStore(data as Store);setNotice("Store created successfully.");
  }catch(e){setError(e instanceof Error?e.message:"Failed to create store");}finally{setBusy(false);}
 }
 async function createProduct(e:React.FormEvent) {
  e.preventDefault();if(!store)return;setBusy(true);setError("");setNotice("");
  try {
   const cents=Math.round(Number(price)*100);if(!Number.isSafeInteger(cents)||cents<0||cents>50000000||(kind==="membership"&&cents===0))throw new Error("Price must be $0–$500,000; memberships need a positive price.");
   if(image&&(!["image/jpeg","image/png","image/webp","image/gif"].includes(image.type)||image.size>5242880))throw new Error("Cover image must be JPG, PNG, WebP or GIF under 5 MB.");
   if(file&&file.size>52428800)throw new Error("Downloads must be under 50 MB.");
   if(kind==="digital"&&!file)throw new Error("Upload a file for your digital download.");
   if(gallery.length>5||gallery.some(f=>!["image/jpeg","image/png","image/webp","image/gif"].includes(f.type)||f.size>5242880))throw new Error("Use up to five JPG, PNG, WebP or GIF gallery images under 5 MB each.");
   const galleryPaths=await Promise.all(gallery.map(f=>upload("prezzstore_assets",f)));
   const imagePath=image?await upload("prezzstore_assets",image):null;
   const path=file?await upload("prezzstore_deliveries",file):null;
   const response=await fetch("/api/studio/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      store_id:store.id,title:title.trim(),description,price_cents:cents,
      category:kind==="membership"?"Memberships":category,kind,stock_quantity:stock===""?null:Number(stock),moderationOverride,image_path:imagePath,
      file_path:path,published:publishNow,gallery_paths:galleryPaths,...extrasPayload(extras)
   })});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Could not save product");
   setProducts(old=>[result.product as Product,...old]);setTitle("");setDescription("");setPrice("");setStock("");setImage(null);setFile(null);setExtras(emptyExtras);setGallery([]);
   setNotice(studioAccess==="creator"?"Submitted for review.":publishNow?"Product published and saved.":"Draft saved to Supabase.");
  }catch(e){setError(e instanceof Error?e.message:"Upload failed");}finally{setBusy(false);}
 }
 async function saveAppearance(e:React.FormEvent) {
  e.preventDefault();if(!store)return;setBusy(true);setError("");setNotice("");
  try{
   for(const image of [banner,avatar])if(image&&(!["image/png","image/jpeg","image/webp","image/gif"].includes(image.type)||image.size>5242880))throw new Error("Images must be JPG, PNG, WebP or GIF under 5 MB.");
   const [banner_path,avatar_path]=await Promise.all([banner?upload("prezzstore_assets",banner):null,avatar?upload("prezzstore_assets",avatar):null]);
   const response=await fetch("/api/store-appearance",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({store_id:store.id,name:shopName,description:shopDesc,accent,moderationOverride,...(banner_path?{banner_path}:{}),...(avatar_path?{avatar_path}:{})})});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Could not update appearance");
   const data=payload.store as Store;
   setStore(data as Store);setBanner(null);setAvatar(null);setNotice("Appearance saved.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save");}finally{setBusy(false);}
 }
 async function connect() {
  setBusy(true);setError("");try{const result=await fetch("/api/stripe/connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({store_id:store?.id})});const data=await result.json();if(!result.ok||!data.url)throw new Error(data.error||"Stripe unavailable");window.location.assign(data.url);}catch(e){setError(e instanceof Error?e.message:"Onboarding failed");setBusy(false);}
 }
 async function reviewProduct(product:Product,decision:"approve"|"request_changes"){
  if(!canReview||!store)return;setBusy(true);setError("");setNotice("");
  try{const response=await fetch("/api/studio/products/"+product.id+"/review",{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,override:moderationOverride})});
   const json=await response.json();
   if(!response.ok)throw new Error(json.error||"Unable to review listing");
   setProducts(old=>old.map(row=>row.id===product.id?json.product as Product:row));
   setNotice(decision==="approve"?"Listing approved and published.":"Changes requested from creator.");
  }catch(e){setError(e instanceof Error?e.message:"Review failed");}finally{setBusy(false);}
 }
 async function signOut(){await db().auth.signOut();window.location.assign("/");}
 if(!userId)return <div className="shell page-top narrow"><h1>Studio setup</h1><p className="muted-text">Connect Supabase to enable accounts, uploads and stores.</p><Link className="button button-primary" href="/login">View account page <ArrowRight size={16}/></Link></div>;
 return <div className="shell dashboard page-top"><div className="dash-header"><div><span className="section-tag">CREATOR STUDIO / PREZZSTORE</span><h1>{store?"Your store dashboard.":"Create a store."}</h1><p>Create products, customize your brand and manage seller payments.</p></div><div className="dash-head-actions"><Link className="button button-outline" href="/account"><UserRound size={16}/> My account</Link>{store&&<Link className="button button-outline" href={"/shop/"+store.slug}>View store <ExternalLink size={16}/></Link>}<button className="button button-ghost" onClick={signOut}><LogOut size={16}/> Sign out</button></div></div>
 {platformRole&&<div className="operator-shortcut"><Link className="button button-outline" href="/control">Marketplace controls · {platformRole==="owner"?"Owner":"Admin"}</Link></div>}
 {initialStores.length>1&&<div className="store-switcher"><label>Manage store <select value={store?.id||""} onChange={e=>window.location.assign("/dashboard?store="+encodeURIComponent(e.target.value))}>{initialStores.map(s=><option key={s.id} value={s.id}>{s.name} · /shop/{s.slug}</option>)}</select></label></div>}
 {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-success" role="status">{notice}</p>}
 {!store?<div className="setup-card"><div className="setup-icon"><StoreIcon size={30}/></div><h2>Set up your store.</h2><p>Choose a store name, URL and description.</p><form className="form-stack" onSubmit={createStore}><label>Store name<input required minLength={2} maxLength={70} value={shopName} onChange={e=>{setShopName(e.target.value);setShopSlug(slugify(e.target.value))}} placeholder="Northstar Studio"/></label><label>Store link<div className="input-prefix"><span>prezzstore / </span><input required pattern="[a-z0-9-]+" minLength={3} value={shopSlug} onChange={e=>setShopSlug(slugify(e.target.value))}/></div></label><label>Description<textarea maxLength={1500} value={shopDesc} onChange={e=>setShopDesc(e.target.value)} placeholder="What will you create?"/></label><button className="button button-primary" disabled={busy}>{busy?"Creating…":"Create my storefront"} <ArrowUpRight size={16}/></button></form></div>:
 <div className="studio-layout"><aside className="studio-sidebar"><div className="studio-shop"><span className="studio-avatar" style={{background:store.accent}}><StoreIcon size={18}/></span><div><strong>{store.name}</strong><small>/shop/{store.slug}</small></div></div><button onClick={()=>setTab("products")} className={tab==="products"?"studio-tab selected":"studio-tab"}><PackageOpen size={17}/> Products</button>
 {canEdit&&<button onClick={()=>setTab("appearance")} className={tab==="appearance"?"studio-tab selected":"studio-tab"}><Palette size={17}/> Appearance</button>}
 {canEdit&&<button onClick={()=>setTab("sales")} className={tab==="sales"?"studio-tab selected":"studio-tab"}><LayoutGrid size={17}/> Sales</button>}
 {isOwner&&<button onClick={()=>setTab("payouts")} className={tab==="payouts"?"studio-tab selected":"studio-tab"}><Wallet size={17}/> Payments</button>}
 <button onClick={()=>setTab("team")} className={tab==="team"?"studio-tab selected":"studio-tab"}><Users size={17}/> Collaborators</button>
 <button onClick={()=>setTab("creatorPlus")} className={tab==="creatorPlus"?"studio-tab selected":"studio-tab"}><Medal size={17}/> PrezzCreator+</button>
 {isOwner&&<button onClick={()=>setTab("settings")} className={tab==="settings"?"studio-tab selected":"studio-tab"}><Settings2 size={17}/> Studio settings</button>}<div className="sidebar-bottom"><span>Signed in as</span><small>{userEmail}</small></div></aside>
 <div className="studio-content">{tab==="products"?<><div className="studio-panel-heading"><div><h2>Products</h2><p>Create, edit and publish listings.</p></div><span className="count-pill">{products.length} listings</span></div>
 {canCreate&&<div className="studio-panel"><h3><Plus size={19}/> {studioAccess==="creator"?"Submit a listing":"Create a listing"}</h3><form className="form-stack" onSubmit={createProduct}><div className="form-columns"><label>Product name<input required minLength={3} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Give your creation a name"/></label><label>Price (USD)<input type="number" min={kind==="membership"?"1":"0"} max="500000" step=".01" required value={price} onChange={e=>setPrice(e.target.value)} placeholder="19.00"/></label></div>{kind!=="membership"&&<label>Inventory limit (optional) <input type="number" min="0" max="1000000" step="1" placeholder="Unlimited" value={stock} onChange={e=>setStock(e.target.value)}/><small>Leave empty for unlimited. Set to 0 to mark sold out.</small></label>}<label>Description<textarea maxLength={10000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe your product"/></label><div className="form-columns"><label>Product type<select value={kind} onChange={e=>setKind(e.target.value as "digital"|"membership"|"service")}><option value="digital">One-time digital download</option><option value="membership">Monthly creator membership</option><option value="service">Custom service / commission</option></select></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)} disabled={kind==="membership"}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div><div className="form-columns"><label className="file-field"><ImagePlus size={19}/> Cover image<small>PNG / JPG / WebP / GIF — 5 MB max</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setImage(e.target.files?.[0]||null)}/><span>{image?.name||"Choose cover"}</span></label><label className="file-field"><FileUp size={19}/>{kind==="membership"?"Optional member download":"Digital download"}<small>Private file — 50 MB max</small><input type="file" onChange={e=>setFile(e.target.files?.[0]||null)}/><span>{file?.name||"Choose file"}</span></label></div>{platformRole&&<label className="checkbox-row"><input type="checkbox" checked={moderationOverride} onChange={e=>setModerationOverride(e.target.checked)}/> Manual moderation override (owner/admin only, logged)</label>}
 <ListingExtras value={extras} onChange={setExtras} gallery={gallery} onGallery={setGallery}/>
 {canEdit?<label className="checkbox-row"><input type="checkbox" checked={publishNow} onChange={e=>setPublishNow(e.target.checked)}/> Publish immediately (uncheck for draft)</label>:<p className="muted-text">Creator submissions stay private until a reviewer or manager approves them.</p>}
 <button className="button button-primary" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>} {studioAccess==="creator"?"Submit for review":publishNow?"Publish product":"Save draft"}</button></form></div>}
 <div className="studio-panel"><h3>Your listings</h3>{products.length?<div className="dashboard-products">{products.map(p=><div className="dashboard-product" key={p.id}><div className="dashboard-thumb">{p.image_url?<img src={p.image_url} alt=""/>:"✳"}</div><div><strong>{p.title}</strong><small>{p.kind==="membership"?"Membership":p.category} · {p.published?"Published":p.review_status==="changes_requested"?"Changes requested":p.review_status==="pending"?"Pending review":"Draft"}</small></div><span>{p.price_cents===0?"Free":"$"+(p.price_cents/100).toFixed(2)}</span>{(canEdit||(studioAccess==="creator"&&p.submitted_by===userId))&&<ListingEditor product={p} canPublish={canEdit} onSaved={updated=>setProducts(old=>old.map(item=>item.id===updated.id?updated:item))} onDeleted={id=>setProducts(old=>old.filter(p=>p.id!==id))}/>}
 {canReview&&!p.published&&!p.removed_at&&(p.review_status==="pending"||p.review_status==="changes_requested")&&<div className="review-actions"><button type="button" disabled={busy} className="button button-small" onClick={()=>reviewProduct(p,"approve")}><ClipboardCheck size={16}/> Approve</button>
 <button type="button" disabled={busy} className="button button-outline" onClick={()=>reviewProduct(p,"request_changes")}>Request changes</button></div>}{p.published&&<Link href={"/products/"+p.id} aria-label={"Open "+p.title}><ArrowUpRight size={17}/></Link>}</div>)}</div>:<div className="studio-empty"><PackageOpen size={27}/><p>No products yet. Publish your first listing above.</p></div>}</div></>:
 tab==="sales"&&canEdit?<SellerSales orders={initialSales}/>:
 tab==="team"?<StudioTeam key={store.id} storeId={store.id}/>:
 tab==="settings"&&isOwner?<div className="studio-panel"><h2>Studio settings</h2><StudioRemoval storeId={store.id} name={store.name}/></div>:
 tab==="creatorPlus"&&plusStatus?<CreatorStatus status={plusStatus} baseBps={baseBps}/>:
 tab==="appearance"&&canEdit?<><div className="studio-panel-heading"><div><h2>Store appearance</h2><p>Change your store description, color and banner.</p></div></div><div className="studio-panel"><form className="form-stack" onSubmit={saveAppearance}><label>Shop name<input minLength={2} maxLength={70} required value={shopName} onChange={e=>setShopName(e.target.value)}/></label><label>Accent color<div className="color-control"><input type="color" value={accent} onChange={e=>setAccent(e.target.value)}/><span>{accent}</span></div></label><label>About your shop<textarea maxLength={1500} value={shopDesc} onChange={e=>setShopDesc(e.target.value)}/></label><label className="file-field"><ImagePlus size={19}/> Shop picture<small>Square image, up to 5 MB</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setAvatar(e.target.files?.[0]||null)}/><span>{avatar?.name||"Choose picture"}</span></label><label className="file-field"><ImagePlus size={19}/> Shop banner<small>Up to 5 MB</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setBanner(e.target.files?.[0]||null)}/><span>{banner?.name||"Choose banner"}</span></label><div className="theme-preview" style={{background:"linear-gradient(135deg,"+accent+",#12111f)"}}><span>YOUR STORE</span><strong>{store.name}</strong><small>Color preview</small></div><p className="muted-text">Customize the website-wide OLED theme, snow, stars, and animation preferences in <Link href="/appearance">Appearance Settings</Link>.</p>{platformRole&&<label className="checkbox-row"><input type="checkbox" checked={moderationOverride} onChange={e=>setModerationOverride(e.target.checked)}/> Owner/admin content override</label>}<button className="button button-primary" disabled={busy}>{busy?"Saving…":"Save appearance"} <Check size={17}/></button></form></div></>:
 <>{isOwner?<><div className="studio-panel-heading"><div><h2>Payments & payouts</h2><p>Connect your shop to Stripe's verified payment network.</p></div></div><div className="studio-panel stripe-panel"><div className="setup-icon"><Wallet size={26}/></div><h3>{stripeStatus==="active"?"Stripe account ready":stripeStatus==="pending"?"Verification in progress":stripeStatus==="not_configured"?"Stripe setup required":store.stripe_account_id?"Continue seller onboarding":"Set up Stripe payments"}</h3>
 <p role="status">{stripeStatus==="active"?"Your seller account is ready to receive transfers. Checkout also requires the platform webhook and server settings.":stripeStatus==="not_configured"?"The server still needs a Stripe key, webhook signing secret, and Supabase server key configured in Vercel.":stripeStatus==="pending"?"Stripe is reviewing your seller details. Checkout remains disabled until transfers are active.":stripeStatus==="checking"?"Checking your Stripe seller status…":stripeStatus==="error"?"Unable to check Stripe. Verify environment settings and retry.":"Stripe's identity and payout checks must be completed before buyers can purchase."}</p>
 <button className="button button-primary" disabled={busy||stripeStatus==="checking"||stripeStatus==="not_configured"} onClick={connect}>{busy?"Opening Stripe…":stripeStatus==="active"?"Review Stripe account":"Set up seller payments"} <ArrowUpRight size={17}/></button><p className="tiny-note">Stripe may require a legal guardian for sellers under 18. Seller payment eligibility is verified by Stripe.</p></div></>:<p>Access restricted.</p>}</>}
 </div></div>}
 </div>;
}
