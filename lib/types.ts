export type ProductKind = "digital" | "membership" | "service";
export type Store = {
  id: string; owner_id: string; name: string; slug: string;
  description: string | null; accent: string; banner_url: string | null;
  avatar_url: string | null; stripe_account_id: string | null; verified?: boolean; suspended_at?: string | null; deleted_at?:string|null; is_profile_store?:boolean; created_at: string;
};
export type Product = {
  id: string; store_id: string; title: string; slug: string; description: string | null;
  category: string; image_url: string | null; price_cents: number; kind: ProductKind;
  file_path: string | null; published: boolean; stock_quantity?: number | null; removed_at?:string|null; asset_owner_id?:string|null; submitted_by?:string|null; review_status?:"pending"|"approved"|"changes_requested"; created_at: string;
  store?: Store; seller_badge?:"owner"|"verified"|null; demo?: boolean;
};
export type Order = {
  id: string; buyer_id: string; product_id: string; seller_id: string;
  amount_cents: number; status: "pending" | "paid" | "failed" | "refunded";
  stripe_session_id: string | null; stripe_subscription_id: string | null; membership_status: "active" | "inactive";
  created_at: string; product?: Product;
};