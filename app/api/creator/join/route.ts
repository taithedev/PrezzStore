import {NextResponse} from "next/server";
import {admin,currentUser} from "@/lib/supabase";
export const runtime="nodejs";
export async function POST(){
 const user=await currentUser();
 if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 if(!user.email_confirmed_at)return NextResponse.json({error:"Confirm your account email before joining the Creator Program"},{status:403});
 const db=admin();
 const {error}=await db.from("prezzstore_user_profiles").upsert({
  user_id:user.id,creator_enrolled:true
 },{onConflict:"user_id"});
 if(error)return NextResponse.json({error:"Unable to activate creator access"},{status:503});
 return NextResponse.json({ok:true,message:"Creator Program activated. You can now publish profile listings and create studios."});
}
