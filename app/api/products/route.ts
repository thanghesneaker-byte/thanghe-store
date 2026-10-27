
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, step: "environment" },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        slug,
        name,
        brand,
        category,
        description,
        price_vnd,
        compare_at_price_vnd,
        image_url,
        product_variants (
          id,
          sku,
          size,
          color,
          stock_quantity
        )
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, step: "database" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        count: data?.length ?? 0,
        products: data ?? []
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false, step: "connection" },
      { status: 500 }
    );
  }
}
