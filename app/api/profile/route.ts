import {NextRequest,NextResponse} from "next/server";
import {admin,currentUser} from "@/lib/supabase";
import {ensureOwnProfile} from "@/lib/profile";
import {moderationReason} from "@/lib/moderation";
export const runtime="nodejs";
export async function PATCH(request:NextRequest){
 const user=await currentUser();
 if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid request"},{status:400});
 const name=String(body.display_name||"").trim(),bio=String(body.bio||"").trim();
 if(name.length<2||name.length>50||bio.length>600)return NextResponse.json({error:"Name must be 2–50 characters, bio 600 or fewer"},{status:400});
 const flagged=moderationReason(name,bio);
 if(flagged)return NextResponse.json({error:"Profile needs content review: "+flagged},{status:422});
 const {store}=await ensureOwnProfile(user);
 const db=admin();
 const {data,error}=await db.from("prezzstore_user_profiles")
  .update({display_name:name,bio,updated_at:new Date().toISOString()})
  .eq("user_id",user.id).select("display_name,bio").single();
 if(error)return NextResponse.json({error:"Unable to save profile"},{status:502});
 // Personal catalog shop is an internal record; keep its public product byline in sync.
 const {error:storeError}=await db.from("prezzstore_stores")
  .update({name}).eq("id",store.id).eq("owner_id",user.id).eq("is_profile_store",true);
 if(storeError)console.error("Profile byline update:",storeError.message);
 return NextResponse.json({profile:data});
}
