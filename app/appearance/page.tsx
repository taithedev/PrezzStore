import {currentUser,server} from "@/lib/supabase";
import AppearancePanel from "@/components/appearance-panel";
import {defaults,type Preferences} from "@/components/appearance-manager";
export const dynamic="force-dynamic";
export default async function Appearance(){
 const user=await currentUser();let initial:Preferences=defaults;
 if(user){const db=await server();if(db){
 const {data}=await db.from("prezzstore_preferences").select("theme,effect,density,intensity,reduce_motion").eq("user_id",user.id).maybeSingle();
 if(data)initial={...defaults,...data} as Preferences;
 }}
 return <AppearancePanel initial={initial} authenticated={Boolean(user)}/>;
}
