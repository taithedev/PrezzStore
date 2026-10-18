import type {Metadata} from "next";
import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";
export const metadata:Metadata={title:{default:"PrezzStore — Create. Sell. Grow.",template:"%s · PrezzStore"},description:"Digital products, creator shops and memberships."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><Header/><main>{children}</main><Footer/></body></html>}