import {admin} from "@/lib/supabase";
export function ownedUploadPath(value:unknown,userId:string):value is string{
 return typeof value==="string"&&value.startsWith(userId+"/")&&value.length<512&&!value.includes("..")
  &&/^[a-zA-Z0-9._/-]+$/.test(value)&&!value.endsWith("/");
}
export async function verifyUpload(bucket:"prezzstore_assets"|"prezzstore_deliveries",path:unknown,userId:string){
 if(!ownedUploadPath(path,userId))throw new Error("Upload this file to your own account first.");
 const {data,error}=await admin().storage.from(bucket).info(path);
 if(error||!data)throw new Error("The uploaded file was not found. Please upload it again.");
 return path;
}
