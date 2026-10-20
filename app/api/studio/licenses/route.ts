import {NextRequest,NextResponse} from "next/server";
import {admin,currentUser} from "@/lib/supabase";
import {studioRole} from "@/lib/authority";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function allowed(productId:string,user:NonNullable<Awaited<ReturnType<typeof currentUser>>>){
 const db=admin();
 const {data:product}=await db.from("prezzstore_products").select("id,store_id,kind").eq("id",productId).maybeSingle();
 if(!product||product.kind!=="digital")return false;
 const role=await studioRole(user,product.store_id);
 return role==="owner"||role==="manager";
}
export async function GET(request:NextRequest){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const productId=new URL(request.url).searchParams.get("product_id")||"";
 if(!uuid.test(productId)||!await allowed(productId,user))return NextResponse.json({error:"Not permitted"},{status:403});
 const {data,error}=await admin().from("prezzstore_license_keys").select("id,order_id").eq("product_id",productId);
 if(error)return NextResponse.json({error:"Unable to check license inventory"},{status:503});
 return NextResponse.json({available:(data||[]).filter(k=>!k.order_id).length,assigned:(data||[]).filter(k=>!!k.order_id).length},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:NextRequest){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 let body:{product_id?:unknown;keys?:unknown};try{body=await request.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
 const productId=typeof body.product_id==="string"?body.product_id:"";
 if(!uuid.test(productId)||!await allowed(productId,user))return NextResponse.json({error:"Not permitted"},{status:403});
 if(!Array.isArray(body.keys)||body.keys.length<1||body.keys.length>200||body.keys.some(k=>typeof k!=="string"||k.length<3||k.length>500))return NextResponse.json({error:"Enter 1–200 license keys, each 3–500 characters"},{status:400});
 const keys=[...new Set((body.keys as string[]).map(k=>k.trim()))].filter(k=>k.length>=3);
 if(keys.length===0)return NextResponse.json({error:"No valid keys"},{status:400});
 const db=admin();
 const {data,error}=await db.from("prezzstore_license_keys").upsert(keys.map(license_key=>({product_id:productId,license_key})),{onConflict:"product_id,license_key",ignoreDuplicates:true}).select("id");
 if(error)return NextResponse.json({error:"Could not save keys"},{status:503});
 const {count}=await db.from("prezzstore_license_keys").select("id",{count:"exact",head:true}).eq("product_id",productId).is("order_id",null);
 return NextResponse.json({added:data?.length||0,available:count||0},{headers:{"Cache-Control":"no-store"}});
}
