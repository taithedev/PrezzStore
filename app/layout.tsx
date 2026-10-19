import type {Metadata} from "next";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
import AppearanceManager from "@/components/appearance-manager";
import AnnouncementBanner from "@/components/announcement-banner";
import {admin} from "@/lib/supabase";
export const metadata:Metadata={title:{default:"PrezzStore — Create. Sell. Grow.",template:"%s · PrezzStore"},description:"Digital products, creator shops and memberships."};
export default async function Layout({children}:{children:React.ReactNode}){
 let items:{id:string;title:string;body:string;category:string}[]=[];
 try{
  if(process.env.SUPABASE_SERVICE_ROLE_KEY){
   const {data}=await admin().from("prezzstore_announcements")
    .select("id,title,body,category").eq("published",true).order("created_at",{ascending:false}).limit(10);
   items=data||[];
  }
 }catch{}
 return <html lang="en"><body><AppearanceManager/><Header/><AnnouncementBanner items={items}/><main>{children}</main><Footer/></body></html>;
}