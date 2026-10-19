import { NextRequest,NextResponse } from "next/server";
import { admin,currentUser } from "@/lib/supabase";
import { canManageStore,platformRole } from "@/lib/authority";
import { moderationReason } from "@/lib/moderation";
export const runtime="nodejs";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid product ID"},{status:400});
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid request"},{status:400});
 const db=admin();
 const {data:product}=await db.from("prezzstore_products").select("id,store_id,kind,file_path,removed_at,title,description")
 .eq("id",id).maybeSingle();
 if(!product)return NextResponse.json({error:"Listing not found"},{status:404});
 if(!await canManageStore(user,product.store_id))return NextResponse.json({error:"You do not manage this listing"},{status:403});
 if(product.removed_at)return NextResponse.json({error:"Removed listings must be reviewed by moderation"},{status:403});
 const updates:Record<string,unknown>={};
 if("title" in body){if(typeof body.title!=="string"||body.title.trim().length<3||body.title.trim().length>120)return NextResponse.json({error:"Invalid title"},{status:400});updates.title=body.title.trim();}
 if("description" in body){if(typeof body.description!=="string"||body.description.length>10000)return NextResponse.json({error:"Description is too long"},{status:400});updates.description=body.description.trim();}
 if("category" in body){if(typeof body.category!=="string"||body.category.length>64||!body.category.trim())return NextResponse.json({error:"Invalid category"},{status:400});updates.category=body.category.trim();}
 if("price_cents" in body){if(!Number.isInteger(body.price_cents)||Number(body.price_cents)<0||Number(body.price_cents)>50000000||(product.kind==="membership"&&Number(body.price_cents)===0))return NextResponse.json({error:"Invalid price"},{status:400});updates.price_cents=body.price_cents;}
 if("stock_quantity" in body){const stock=body.stock_quantity;if(stock!==null&&(!Number.isInteger(stock)||Number(stock)<0||Number(stock)>1000000))return NextResponse.json({error:"Invalid stock"},{status:400});updates.stock_quantity=product.kind==="membership"?null:stock;}
 if("published" in body){if(typeof body.published!=="boolean")return NextResponse.json({error:"Invalid listing status"},{status:400});if(body.published&&product.kind==="digital"&&!product.file_path)return NextResponse.json({error:"Upload a delivery file first"},{status:409});updates.published=body.published;}
 const reason=moderationReason(updates.title??product.title,updates.description??product.description);
 const override=body.moderationOverride===true&&Boolean(await platformRole(user));
 if(reason&&!override)return NextResponse.json({error:"Listing needs review: "+reason},{status:422});
 if(!Object.keys(updates).length)return NextResponse.json({error:"No editable fields"},{status:400});
 const {data,error}=await db.from("prezzstore_products").update(updates).eq("id",id).eq("store_id",product.store_id).select("*").single();
 if(error)return NextResponse.json({error:"Could not save listing"},{status:502});
 if(reason&&override)await db.from("prezzstore_moderation_log").insert({moderator_id:user.id,target_type:"content",target_id:id,action:"approved_false_positive",note:reason});
 return NextResponse.json({product:data});
}
