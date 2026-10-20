import assert from "node:assert/strict";
const base=process.env.PREZZSTORE_SMOKE_URL||"https://prezz-store.vercel.app";
const paths=["/","/explore","/shop/zuzify","/login","/creator-plus","/updates","/api/health"];
for(const path of paths){
 const response=await fetch(new URL(path,base),{redirect:"follow",signal:AbortSignal.timeout(30000)});
 const body=await response.text();
 assert.equal(response.status,200,path+" returned "+response.status);
 assert.doesNotMatch(body,/Application error: a server-side exception/i);
 if(path==="/api/health")assert.equal(JSON.parse(body).release,"2026.10.20");
 console.log("PASS",path,response.status);
}
for(const path of ["/api/checkout","/api/studio/products","/api/studio/stores"]){
 const response=await fetch(new URL(path,base),{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,401,path+" must reject signed-out requests");
 console.log("PASS",path,"signed-out request rejected");
}
const webhook=await fetch(new URL("/api/stripe/webhook",base),{method:"POST",body:"{}",signal:AbortSignal.timeout(30000)});
assert.equal(webhook.status,400);
console.log("PASS unsigned webhook rejected");
