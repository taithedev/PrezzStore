import {NextRequest,NextResponse} from "next/server";
import {currentUser,server} from "@/lib/supabase";
export const runtime="nodejs";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid product ID"},{status:400});
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request"},{status:400});}
 const db=await server();if(!db)return NextResponse.json({error:"Database unavailable"},{status:503});
 const {data:product}=await db.from("prezzstore_products").select("id,store_id,kind,file_path").eq("id",id).maybeSingle();
 if(!product)return NextResponse.json({error:"Listing not found"},{status:404});
 const {data:store}=await db.from("prezzstore_stores").select("id").eq("id",product.store_id).eq("owner_id",user.id).maybeSingle();
 if(!store)return NextResponse.json({error:"You do not manage this listing"},{status:403});
 const updates:Record<string,unknown>={};
 if("title" in body){if(typeof body.title!=="string"||body.title.trim().length<3||body.title.trim().length>120)return NextResponse.json({error:"Title must be 3–120 characters"},{status:400});updates.title=body.title.trim();}
 if("description" in body){if(typeof body.description!=="string"||body.description.length>10000)return NextResponse.json({error:"Description is too long"},{status:400});updates.description=body.description.trim();}
 if("category" in body){if(typeof body.category!=="string"||body.category.length>64||!body.category.trim())return NextResponse.json({error:"Invalid category"},{status:400});updates.category=body.category.trim();}
 if("price_cents" in body){if(!Number.isInteger(body.price_cents)||Number(body.price_cents)<100||Number(body.price_cents)>50000000)return NextResponse.json({error:"Invalid price"},{status:400});updates.price_cents=body.price_cents;}
 if("published" in body){if(typeof body.published!=="boolean")return NextResponse.json({error:"Invalid listing status"},{status:400});
 if(body.published&&product.kind==="digital"&&!product.file_path)return NextResponse.json({error:"Upload a delivery file before publishing"},{status:409});
 updates.published=body.published;}
 if(!Object.keys(updates).length)return NextResponse.json({error:"No editable fields supplied"},{status:400});
 const {data,error}=await db.from("prezzstore_products").update(updates).eq("id",id).eq("store_id",store.id).select("*").single();
 if(error){console.error("Update listing",error.message);return NextResponse.json({error:"Could not save listing"},{status:502});}
 return NextResponse.json({product:data});
}
