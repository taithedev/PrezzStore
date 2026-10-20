import {NextRequest,NextResponse} from "next/server";
import {admin,currentUser} from "@/lib/supabase";
export const runtime="nodejs";
export async function GET(_:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();
 if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid order"},{status:400});
 const db=admin();
 const {data:order,error}=await db.from("prezzstore_orders").select("id,status,product_id,product:prezzstore_products(kind)").eq("id",id).eq("buyer_id",user.id).maybeSingle();
 if(error)return NextResponse.json({error:"Unable to fetch order"},{status:503});
 if(!order||order.status!=="paid")return NextResponse.json({error:"No paid order available"},{status:404});
 const kind=(order.product as unknown as {kind?:string}|{kind?:string}[]|null); const productKind=Array.isArray(kind)?kind[0]?.kind:kind?.kind;
 if(productKind!=="digital")return NextResponse.json({error:"Not a digital software purchase"},{status:404});
 const {data:assigned,error:readError}=await db.from("prezzstore_license_keys").select("license_key").eq("order_id",id).eq("product_id",order.product_id).maybeSingle();
 if(readError)return NextResponse.json({error:"License delivery temporarily unavailable"},{status:503});
 return NextResponse.json({license_key:assigned?.license_key||null,status:assigned?"delivered":"not_available"},{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
