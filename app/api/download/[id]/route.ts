import {apiRoute} from "@/lib/api-route";
import {NextRequest,NextResponse} from "next/server";
import {admin,currentUser} from "@/lib/supabase";
async function handleGET(_:NextRequest,ctx:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in"},{status:401});
 const {id}=await ctx.params;
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:"Invalid order"},{status:400});
 const db=admin();
 const {data:order,error}=await db.from("prezzstore_orders")
  .select("product_id,seller_id,status,membership_status,product_kind,delivery_file_path,delivery_asset_owner_id")
  .eq("id",id).eq("buyer_id",user.id).maybeSingle();
 if(error)throw error;
 if(!order||order.status!=="paid")return NextResponse.json({error:"No paid order found"},{status:403});
 const {data:product}=await db.from("prezzstore_products").select("kind,file_path,asset_owner_id").eq("id",order.product_id).maybeSingle();
 const filePath=order.delivery_file_path||product?.file_path;
 const kind=order.product_kind||product?.kind;
 if(!filePath||(kind==="membership"&&order.membership_status!=="active"))return NextResponse.json({error:"No active download for this order"},{status:404});
 const assetOwner=order.delivery_asset_owner_id||(product?.asset_owner_id||order.seller_id);
 if(!filePath.startsWith(assetOwner+"/")||filePath.includes(".."))return NextResponse.json({error:"Invalid file ownership"},{status:403});
 const {data,error:downloadError}=await db.storage.from("prezzstore_deliveries").createSignedUrl(filePath,60,{download:true});
 if(downloadError||!data?.signedUrl)return NextResponse.json({error:"Download unavailable. Please try again."},{status:503});
 return NextResponse.redirect(data.signedUrl,{status:303,headers:{"Cache-Control":"private, no-store"}});
}

export const GET=apiRoute(handleGET);
