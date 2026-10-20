"use client";
import Link from "next/link";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <div className="shell page-top narrow"><h1>This page could not load.</h1>
 <p className="muted-text">Please try again. Your saved account and purchases remain available.</p>
 <button className="button button-primary" onClick={reset}>Try again</button> <Link href="/" className="button button-outline">Back to marketplace</Link></div>;
}
