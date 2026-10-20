import {apiRoute} from "@/lib/api-route";
import {NextRequest,NextResponse} from "next/server";
import {admin,currentUser} from "@/lib/supabase";
import {ensureOwnProfile} from "@/lib/profile";
import {creatorEnrolled} from "@/lib/authority";
import {moderationReason} from "@/lib/moderation";
export const runtime="nodejs";
async function handlePATCH(request:NextRequest){
 const user=await currentUser();
 if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid request"},{status:400});
 const name=String(body.display_name||"").trim(),bio=String(body.bio||"").trim();
 const username=String(body.username||"").trim().toLowerCase();
 const website=String(body.website_url||"").trim();
 if(name.length<2||name.length>50||bio.length>600)return NextResponse.json({error:"Name must be 2–50 characters, bio 600 or fewer"},{status:400});
 if(!/^[a-z][a-z0-9_]{2,29}$/.test(username))return NextResponse.json({error:"Username must be 3–30 letters, numbers or underscores and start with a letter"},{status:400});
 if(website){try{const url=new URL(website);if(!["https:","http:"].includes(url.protocol)||website.length>300)throw Error();}catch{return NextResponse.json({error:"Use a valid website URL starting with https:// or http://"},{status:400});}}
 const flagged=moderationReason(name,bio,username);
 if(flagged)return NextResponse.json({error:"Profile needs content review: "+flagged},{status:422});
 const enrolled=await creatorEnrolled(user);
 const {store}=await ensureOwnProfile(user,{createStore:enrolled});
 const db=admin();
 const assetUrl=(field:"avatar_path"|"banner_path")=>{
  if(!(field in body))return undefined;
  if(body[field]===null)return null;
  const path=body[field];
  if(typeof path!=="string"||!new RegExp("^"+user.id.replaceAll("-","\\-")+"/[a-zA-Z0-9._-]+$").test(path)||path.includes(".."))throw Error("Upload images to your own account first");
  return db.storage.from("prezzstore_assets").getPublicUrl(path).data.publicUrl;
 };
 let avatar_url:string|null|undefined,banner_url:string|null|undefined;
 try{avatar_url=assetUrl("avatar_path");banner_url=assetUrl("banner_path");}
 catch{return NextResponse.json({error:"Invalid profile image"},{status:400});}
 const {data,error}=await db.from("prezzstore_user_profiles")
  .update({display_name:name,username,bio,website_url:website||null,
   ...(avatar_url!==undefined?{avatar_url}:{}),...(banner_url!==undefined?{banner_url}:{}),
   updated_at:new Date().toISOString()})
  .eq("user_id",user.id).select("username,display_name,bio,avatar_url,banner_url,website_url").single();
 if(error){console.error("Profile update:",error.code,error.message);
  return NextResponse.json({error:error.code==="23505"?"That username is taken":"Unable to save profile. Please retry."},{status:error.code==="23505"?409:502});}
 // Personal catalog shop is an internal record; keep its public product byline in sync.
 if(store){const {error:storeError}=await db.from("prezzstore_stores")
  .update({name,avatar_url:data.avatar_url,banner_url:data.banner_url}).eq("id",store.id).eq("owner_id",user.id).eq("is_profile_store",true);
 if(storeError)console.error("Profile byline update:",storeError.message);}
 return NextResponse.json({profile:data});
}

export const PATCH=apiRoute(handlePATCH);
