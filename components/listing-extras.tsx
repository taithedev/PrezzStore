"use client";
import {ImagePlus,SlidersHorizontal} from "lucide-react";
export type ListingExtraValues={subtitle:string;tags:string;highlights:string;fulfillment_note:string};
export const emptyExtras:ListingExtraValues={subtitle:"",tags:"",highlights:"",fulfillment_note:""};
export function extrasPayload(x:ListingExtraValues){
 return {subtitle:x.subtitle.trim(),tags:x.tags.split(",").map(s=>s.trim()).filter(Boolean),
  highlights:x.highlights.split("\n").map(s=>s.trim()).filter(Boolean),
  fulfillment_note:x.fulfillment_note.trim()};
}
export default function ListingExtras({value,onChange,gallery,onGallery}:{value:ListingExtraValues;onChange:(x:ListingExtraValues)=>void;gallery?:File[];onGallery?:(files:File[])=>void}){
 const set=(key:keyof ListingExtraValues)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>onChange({...value,[key]:e.target.value});
 return <details className="listing-extras"><summary><SlidersHorizontal size={16}/> More listing options <small>optional</small></summary>
  <div className="form-stack">
   <label>Short subtitle<input maxLength={160} value={value.subtitle} onChange={set("subtitle")} placeholder="One sentence about the item"/></label>
   <label>Tags (up to 8, separated by commas)<input value={value.tags} onChange={set("tags")} placeholder="UI kit, icons, dark mode"/></label>
   <label>Highlights (up to 6, one per line)<textarea value={value.highlights} onChange={set("highlights")} placeholder={"Instant access\nLifetime updates"}/></label>
   <label>Delivery or service details<textarea maxLength={1200} value={value.fulfillment_note} onChange={set("fulfillment_note")} placeholder="What the buyer receives and when"/></label>
   {onGallery&&<label className="file-field"><ImagePlus size={17}/> Gallery images <small>Up to 5 images, 5 MB each</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={e=>onGallery(Array.from(e.target.files||[]))}/><span>{gallery?.length?gallery.length+" selected":"Choose optional images"}</span></label>}
  </div>
 </details>;
}
