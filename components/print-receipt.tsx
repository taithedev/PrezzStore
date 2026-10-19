"use client";
import { Printer } from "lucide-react";
export default function PrintReceipt(){
 return <div className="receipt-print"><button type="button" className="button button-primary"
  onClick={()=>window.print()}><Printer size={16}/> Print or save as PDF</button></div>;
}
