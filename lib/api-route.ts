import {NextResponse} from "next/server";
export function apiRoute<T extends unknown[]>(handler:(...args:T)=>Promise<Response>){
 return async (...args:T):Promise<Response>=>{
  try{return await handler(...args);}
  catch(error){
   const incident=crypto.randomUUID();
   console.error("PrezzStore request failed",incident,error instanceof Error?error.message:error);
   return NextResponse.json({error:"This request could not finish. Please try again.",reference:incident},{status:503,headers:{"Cache-Control":"no-store"}});
  }
 };
}
