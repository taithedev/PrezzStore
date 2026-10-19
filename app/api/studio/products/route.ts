import { NextRequest, NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { canCreateProduct, studioRole, platformRole } from "@/lib/authority";
import { moderationReason } from "@/lib/moderation";
export const runtime="nodejs";
const slugify=(s:string)=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,75);
export async function POST(request:NextRequest){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return NextResponse.json({error:"Invalid listing"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid listing"},{status:400});
 const title=String(body.title||"").trim(),kind=body.kind,price=body.price_cents;
 const description=String(body.description||"").trim(),category=String(body.category||"Other").trim();
 const storeId=String(body.store_id||"");
 const imagePath=body.image_path===null?null:String(body.image_path||"");
 const filePath=body.file_path===null?null:String(body.file_path||"");
 const published=body.published===true;
 const stock=body.stock_quantity===null||body.stock_quantity===undefined||body.stock_quantity===""?null:body.stock_quantity;
 if(title.length<3||title.length>120||description.length>10000||category.length<1||category.length>64
  ||!Number.isInteger(price)||Number(price)<0||Number(price)>50000000
  ||!["digital","membership","service"].includes(String(kind))
  ||(kind==="membership"&&Number(price)===0)
  ||(kind==="digital"&&!filePath)
  ||(stock!==null&&(!Number.isInteger(stock)||Number(stock)<0||Number(stock)>1000000))
  ||(imagePath&&!imagePath.startsWith(user.id+"/"))
  ||(filePath&&!filePath.startsWith(user.id+"/"))
  ||(imagePath&&imagePath.includes(".."))||(filePath&&filePath.includes("..")))
 return NextResponse.json({error:"Check the listing, stock and uploads"},{status:400});
 if(!await canCreateProduct(user,storeId))return NextResponse.json({error:"You cannot manage this store"},{status:403});
 const role=await studioRole(user,storeId);
 const creatorOnly=role==="creator";
 const reason=moderationReason(title,description);
 const override=body.moderationOverride===true&&Boolean(await platformRole(user));
 if(reason&&!override)return NextResponse.json({error:"Listing needs review: "+reason},{status:422});
 const db=admin();
 const {data:store}=await db.from("prezzstore_stores").select("id,suspended_at,deleted_at,is_profile_store").eq("id",storeId).maybeSingle();
 if(!store||store.suspended_at||store.deleted_at)return NextResponse.json({error:"Store is not available"},{status:403});
 if(store.is_profile_store&&kind==="membership")return NextResponse.json({error:"Subscriptions require a studio"},{status:400});
 const {data:product,error}=await db.from("prezzstore_products").insert({
  store_id:store.id,title,slug:slugify(title)+"-"+crypto.randomUUID().slice(0,8),
  description,category:kind==="membership"?"Memberships":category,
  price_cents:price,kind,image_url:imagePath?(db.storage.from("prezzstore_assets").getPublicUrl(imagePath).data.publicUrl):null,
  file_path:filePath,asset_owner_id:user.id,submitted_by:user.id,review_status:creatorOnly?"pending":"approved",stock_quantity:kind==="membership"?null:stock,published:creatorOnly?false:published
 }).select("*").single();
 if(error)return NextResponse.json({error:"Could not save listing"},{status:502});
 if(reason&&override)await db.from("prezzstore_moderation_log").insert({moderator_id:user.id,target_type:"content",target_id:product.id,action:"approved_false_positive",note:reason});
 return NextResponse.json({product},{status:201});
}
