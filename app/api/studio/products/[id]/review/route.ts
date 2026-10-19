import { NextRequest,NextResponse } from "next/server";
import { admin,currentUser } from "@/lib/supabase";
import { canApproveProduct,platformRole } from "@/lib/authority";
import { moderationReason } from "@/lib/moderation";
export const runtime="nodejs";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 const {id}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(id))return NextResponse.json({error:"Invalid listing"},{status:400});
 let body:{decision?:string;override?:boolean};
 try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request"},{status:400});}
 if(!["approve","request_changes"].includes(body.decision||""))return NextResponse.json({error:"Invalid decision"},{status:400});
 const db=admin();
 const {data:product,error:pe}=await db.from("prezzstore_products")
  .select("id,store_id,title,description,kind,file_path,removed_at").eq("id",id).maybeSingle();
 if(pe||!product)return NextResponse.json({error:"Listing not found"},{status:404});
 if(!await canApproveProduct(user,product.store_id))return NextResponse.json({error:"No review permission"},{status:403});
 if(product.removed_at)return NextResponse.json({error:"Listing removed by moderation"},{status:403});
 const {data:parent}=await db.from("prezzstore_stores").select("deleted_at,suspended_at,is_profile_store").eq("id",product.store_id).maybeSingle();
 if(!parent||parent.deleted_at||parent.suspended_at||parent.is_profile_store)return NextResponse.json({error:"Studio unavailable for review"},{status:403});
 const approving=body.decision==="approve";
 if(approving&&product.kind==="digital"&&!product.file_path)return NextResponse.json({error:"Digital downloads require a delivery file"},{status:409});
 const flagged=moderationReason(product.title,product.description);
 if(approving&&flagged&&!(body.override===true&&await platformRole(user)))return NextResponse.json({error:"Content needs further moderation: "+flagged},{status:422});
 const {data,error}=await db.from("prezzstore_products").update({
  review_status:approving?"approved":"changes_requested",published:approving
 }).eq("id",id).eq("store_id",product.store_id).select("*").single();
 if(error)return NextResponse.json({error:"Unable to update review"},{status:503});
 return NextResponse.json({product:data});
}
