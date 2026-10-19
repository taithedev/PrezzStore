import MarketGrid from "@/components/market-grid";
import {allProducts} from "@/lib/catalog";
import {allStores} from "@/lib/catalog";
import ShopDirectory from "@/components/shop-directory";
export const dynamic="force-dynamic";
export default async function Explore({searchParams}:{searchParams:Promise<{category?:string}>}){const [{items,preview},stores,params]=await Promise.all([allProducts(),allStores(),searchParams]);return <div className="shell page-top"><div className="inner-hero"><span className="section-tag">THE CREATOR MARKETPLACE</span><h1>Discover your<br/><span className="headline-gradient">next favorite.</span></h1><p>A space for products, memberships, and the people behind them.</p></div><ShopDirectory stores={stores}/><MarketGrid items={items} preview={preview} title="All products" initialCategory={params.category||"All"}/></div>}
