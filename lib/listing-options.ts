export function optionalDetails(body:Record<string,unknown>){
 const details:Record<string,string|string[]|null>={};
 for(const [field,max] of [["subtitle",160],["fulfillment_note",1200]] as const){
  if(field in body){
   if(body[field]!==null&&typeof body[field]!=="string")throw Error("Invalid "+field);
   const value=typeof body[field]==="string"?body[field].trim():"";
   if(value.length>max)throw Error(field+" is too long");
   details[field]=value||null;
  }
 }
 for(const [field,maxItems,maxLength] of [["tags",8,30],["highlights",6,140]] as const){
  if(field in body){
   const value=body[field];
   if(!Array.isArray(value)||value.length>maxItems||value.some(v=>typeof v!=="string"||!v.trim()||v.trim().length>maxLength))
    throw Error("Check your "+field);
   details[field]=[...new Set(value.map((s:string)=>s.trim()))];
  }
 }
 return details;
}
