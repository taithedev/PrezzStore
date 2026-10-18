import { NextRequest, NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
export async function GET(_:NextRequest,ctx:{params:Promise<{id:string}>}) {
  const user=await currentUser();
  if(!user) return NextResponse.json({error:"Sign in"},{status:401});
  const {id}=await ctx.params;
  const db=admin();
  const {data:order}=await db.from("prezzstore_orders").select("product_id,seller_id,status,membership_status").eq("id",id).eq("buyer_id",user.id).maybeSingle();
  if(!order || order.status!=="paid") return NextResponse.json({error:"No paid order found"},{status:403});
  const {data:product}=await db.from("prezzstore_products").select("kind,file_path").eq("id",order.product_id).maybeSingle();
  if(!product?.file_path || (product.kind==="membership" && order.membership_status!=="active")) return NextResponse.json({error:"No active download for this order"},{status:404});
  // Never sign a different seller's private object, even if a malicious listing points at it.
  if(!product.file_path.startsWith(order.seller_id+"/") || product.file_path.includes(".."))
    return NextResponse.json({error:"Invalid file ownership"},{status:403});
  const {data,error}=await db.storage.from("prezzstore_deliveries").createSignedUrl(product.file_path,60);
  if(error || !data?.signedUrl) return NextResponse.json({error:"Download unavailable"},{status:500});
  return NextResponse.redirect(data.signedUrl);
}