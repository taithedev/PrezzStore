import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import {webcrypto} from "node:crypto";
import ts from "typescript";
const require=createRequire(import.meta.url);
const next={NextResponse:{json:(body,init)=>Response.json(body,init),redirect:(url,status=303)=>new Response(null,{status:typeof status==="number"?status:status.status,headers:{Location:String(url)}})}};
function moduleAt(path,mocks={}){
 const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 runInNewContext(output,{module,exports:module.exports,require:name=>name in mocks?mocks[name]:require(name),URL,Request,Response,FormData,process:{env:{STRIPE_WEBHOOK_SECRET:"test-only",SUPABASE_SERVICE_ROLE_KEY:"test-only"}},crypto:webcrypto,console:{error(){},warn(){}}});
 return module.exports;
}
const {apiRoute}=moduleAt("lib/api-route.ts",{"next/server":next});
test("redirects stay on PrezzStore, including backslash and whitespace attacks",()=>{
 const {safeNext}=moduleAt("lib/safe-next.ts");
 for(const value of ["https://evil.test","//evil.test","/\\\\evil.test","/\nevil.test","javascript:alert(1)",null,""])assert.equal(safeNext(value),"/account");
 assert.equal(safeNext("/products/abc?x=1#buy"),"/products/abc?x=1#buy");
});
test("unexpected database errors return a safe JSON response",async()=>{
 const route=apiRoute(async()=>{throw Error("private database connection detail");});
 const response=await route();assert.equal(response.status,503);
 const body=await response.json();assert.ok(body.reference);assert.doesNotMatch(JSON.stringify(body),/private database/);
});
test("upload ownership rejects traversal, foreign prefixes and invalid paths",()=>{
 const {ownedUploadPath}=moduleAt("lib/uploads.ts",{"@/lib/supabase":{admin(){throw Error("not called");}}});
 assert.equal(ownedUploadPath("owner/file.zip","owner"),true);
 for(const path of ["other/file.zip","owner/../file","owner/file?x","owner/","owner/../secret",null])assert.equal(ownedUploadPath(path,"owner"),false);
});
function checkoutFixture({user={id:"buyer",email:"buyer@example.test",email_confirmed_at:"yes"},owner=false,body={},kind="service",price=1000,storeOwner="seller",coupon=null,stock=2}={}){
 const calls=[];
 const product={id:"11111111-1111-4111-8111-111111111111",store_id:"22222222-2222-4222-8222-222222222222",title:"Test product",description:"",price_cents:price,kind,stock_quantity:stock};
 const store={owner_id:storeOwner,name:"Test store",stripe_account_id:"acct_fixture",is_profile_store:false};
 const db={
  from(table){
   const state={table,op:"select",payload:null};
   const chain={};
   for(const method of ["select","eq","is","limit","in","order"])chain[method]=()=>chain;
   chain.insert=payload=>{state.op="insert";state.payload=payload;calls.push({type:"insert",table,payload});return chain;};
   chain.update=payload=>{state.op="update";state.payload=payload;return chain;};
   const result=()=>{
    if(table==="prezzstore_products")return {data:product,error:null};
    if(table==="prezzstore_stores")return {data:store,error:null};
    if(table==="prezzstore_discounts")return {data:coupon,error:null};
    if(table==="prezzstore_orders"&&state.op==="insert")return {data:{id:"33333333-3333-4333-8333-333333333333"},error:null};
    if(table==="prezzstore_orders"&&state.op==="update")return {data:{id:"33333333-3333-4333-8333-333333333333"},error:null};
    return {data:null,error:null};
   };
   chain.single=chain.maybeSingle=async()=>result();
   chain.then=(resolve,reject)=>Promise.resolve(result()).then(resolve,reject);
   return chain;
  },
  async rpc(name,args){calls.push({type:"rpc",name,args});return {data:true,error:null};}
 };
 const stripe={checkout:{sessions:{async create(params){calls.push({type:"stripe",params});return {id:"cs_fixture",url:"https://checkout.stripe.com/fixture"};},async expire(){return {status:"expired"};}}}};
 const route=moduleAt("app/api/checkout/route.ts",{
  "next/server":next,"@/lib/api-route":{apiRoute},
  "@/lib/supabase":{admin:()=>db,currentUser:async()=>user},
  "@/lib/receipt-email":{sendOrderReceipt:async()=>"not_configured"},
  "@/lib/authority":{platformRole:async()=>owner?"owner":null},
  "@/lib/creator-plus":{creatorPlusStatus:async()=>({qualified:false}),creatorPlusFeeBps:(base)=>base},
  "@/lib/stripe":{marketplaceFeeBps:async()=>1000,recipientStatus:async()=>"active",siteUrl:()=>"https://prezzstore.test",stripe:()=>stripe,stripeConfigured:()=>true}
 }).POST;
 return {calls,run:()=>route(new Request("https://prezzstore.test/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:product.id,...body})}))};
}
test("checkout requires a signed-in buyer",async()=>{const f=checkoutFixture({user:null});assert.equal((await f.run()).status,401);assert.equal(f.calls.length,0);});
test("unverified accounts and unauthorized owner-free claims are rejected",async()=>{
 let f=checkoutFixture({user:{id:"buyer",email:"x@example.test"}});assert.equal((await f.run()).status,403);
 f=checkoutFixture({body:{ownerFree:true}});assert.equal((await f.run()).status,403);assert.equal(f.calls.length,0);
});
test("sold-out listings cannot create orders",async()=>{const f=checkoutFixture({stock:0});assert.equal((await f.run()).status,409);assert.equal(f.calls.length,0);});
test("owner free purchase settles without creating a Stripe charge",async()=>{
 const f=checkoutFixture({owner:true,storeOwner:"buyer",body:{ownerFree:true}});
 const response=await f.run();assert.equal(response.status,200);assert.match((await response.json()).url,/orders/);
 assert.equal(f.calls.some(x=>x.type==="stripe"),false);
 assert.ok(f.calls.some(x=>x.name==="prezzstore_settle_order"&&x.args.p_status==="paid"));
 assert.equal(f.calls.find(x=>x.type==="insert").payload.owner_comped,true);
});
test("paid checkout uses the database price and reserves before creating Stripe session",async()=>{
 const f=checkoutFixture({body:{price_cents:1}});
 const response=await f.run();assert.equal(response.status,200);
 const charge=f.calls.find(x=>x.type==="stripe");
 assert.equal(charge.params.line_items[0].price_data.unit_amount,1000);
 assert.equal(charge.params.payment_intent_data.application_fee_amount,100);
 assert.equal(charge.params.payment_intent_data.transfer_data.destination,"acct_fixture");
 assert.equal("payment_method_types" in charge.params,false);
 assert.ok(f.calls.findIndex(x=>x.name==="prezzstore_reserve_stock")<f.calls.indexOf(charge));
});
test("discounts are claimed for the order before starting paid Checkout",async()=>{
 const f=checkoutFixture({body:{discountCode:"SAVE"},coupon:{id:"coupon",code:"SAVE",active:true,percentage:10,used_count:0,max_uses:1}});
 assert.equal((await f.run()).status,200);
 assert.ok(f.calls.some(x=>x.name==="prezzstore_claim_order_discount"));
 assert.equal(f.calls.find(x=>x.type==="stripe").params.line_items[0].price_data.unit_amount,900);
});
test("owner cannot use free checkout for recurring memberships",async()=>{
 const f=checkoutFixture({owner:true,kind:"membership",body:{ownerFree:true}});
 assert.equal((await f.run()).status,400);assert.equal(f.calls.length,0);
});
