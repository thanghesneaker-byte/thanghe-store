
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
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      // Server-only diagnostic for Preview; never expose database errors to visitors.
      if (process.env.VERCEL_ENV !== "production") {
        console.error("[THS_PRODUCTS_DB_ERROR]", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      }
      return NextResponse.json(
        { ok: false, step: "database" },
        { status: 500 }
      );
    }

    // Optional gallery field: if the migration has not run yet, keep
    // the public catalog working with its existing cover images.
    let products = data ?? [];
    if (products.length > 0) {
      const ids = products.map((product) => product.id);
      const { data: galleries, error: galleryError } = await supabase
        .from("products")
        .select("id, image_urls")
        .in("id", ids)
        .eq("is_active", true)
        .is("deleted_at", null);
      if (!galleryError && galleries) {
        const galleryMap = new Map(galleries.map((row) => [row.id, row.image_urls]));
        products = products.map((row) => ({
          ...row,
          image_urls: galleryMap.get(row.id) ?? [],
        }));
      }
    }

    return NextResponse.json(
      {
        ok: true,
        count: products.length,
        products
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
