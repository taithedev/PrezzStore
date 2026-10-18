import Link from "next/link";
import {ArrowLeft} from "lucide-react";
export default function NotFound(){return <div className="shell page-top narrow"><span className="section-tag">404 / NOT FOUND</span><h1>Not around here.</h1><p className="muted-text">This page could not be found.</p><Link className="button button-primary" href="/"><ArrowLeft size={16}/> Back home</Link></div>}