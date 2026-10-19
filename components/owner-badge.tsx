import {Wrench,BadgeCheck} from "lucide-react";
import type {UserBadge} from "@/lib/profile";
export default function OwnerBadge({badge}:{badge:UserBadge}){
 if(badge==="owner")return <Wrench size={14} className="owner-symbol" aria-label="PrezzStore owner"/>;
 if(badge==="verified")return <BadgeCheck size={15} className="verified-symbol" aria-label="Verified creator"/>;
 return null;
}
