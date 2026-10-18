import {NextRequest,NextResponse} from "next/server";
import {currentUser,server} from "@/lib/supabase";
export const runtime="nodejs";
const slugify=(s:string)=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,75);
export async function POST(request:NextRequest){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return NextResponse.json({error:"Invalid listing"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid listing"},{status:400});
 const title=String(body.title||"").trim(),kind=body.kind,price=body.price_cents;
 const description=String(body.description||"").trim(),category=String(body.category||"Other").trim();
 const storeId=String(body.store_id||""),imagePath=body.image_path===null?null:String(body.image_path||"");
 const filePath=body.file_path===null?null:String(body.file_path||"");
 const published=body.published===true;
 if(title.length<3||title.length>120||description.length>10000||category.length<1||category.length>64
 ||(typeof price!=="number"||!Number.isInteger(price))||Number(price)<100||Number(price)>50000000
 ||(kind!=="digital"&&kind!=="membership")
 ||(kind==="digital"&&!filePath)
 ||(imagePath&&!imagePath.startsWith(user.id+"/"))
 ||(filePath&&!filePath.startsWith(user.id+"/"))
 ||(imagePath&&imagePath.includes(".."))||(filePath&&filePath.includes("..")))
 return NextResponse.json({error:"Check listing fields and uploaded files"},{status:400});
 const db=await server();if(!db)return NextResponse.json({error:"Database unavailable"},{status:503});
 const {data:store,error:storeError}=await db.from("prezzstore_stores").select("id").eq("id",storeId).eq("owner_id",user.id).maybeSingle();
 if(storeError||!store)return NextResponse.json({error:"Store not found"},{status:403});
 const image_url=imagePath?db.storage.from("prezzstore_assets").getPublicUrl(imagePath).data.publicUrl:null;
 const {data,error}=await db.from("prezzstore_products").insert({
  store_id:store.id,title,slug:slugify(title)+"-"+crypto.randomUUID().slice(0,8),
  description,category:kind==="membership"?"Memberships":category,
  price_cents:price,kind,image_url,file_path:filePath,published
 }).select("*").single();
 if(error){console.error("Create listing",error.message);return NextResponse.json({error:"Could not publish listing"},{status:502});}
 return NextResponse.json({product:data},{status:201});
}
