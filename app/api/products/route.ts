import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const fail = (step: string) =>
    NextResponse.json({ ok: false, step }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });

  if (!url || !key) {
    console.error("[THS_PRODUCTS_ENV_MISSING]", { hasUrl: !!url, hasKey: !!key });
    return fail("environment");
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch products independently of the PostgREST relationship cache.
    const { data, error } = await supabase
      .from("products")
      .select("id,slug,name,brand,category,description,price_vnd,compare_at_price_vnd,image_url")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[THS_PRODUCTS_DB_ERROR]", {
        code: error.code, message: error.message,
        details: error.details, hint: error.hint,
      });
      return fail("database");
    }

    const products = (data ?? []).map((p) => ({
      ...p,
      product_variants: [] as Array<{
        id: string; sku: string | null; size: string | null;
        color: string | null; stock_quantity: number;
      }>,
      image_urls: p.image_url ? [p.image_url] : [],
    }));

    if (products.length) {
      const ids = products.map((p) => p.id);
      const [{ data: variants, error: variantsError }, { data: galleries, error: galleryError }] =
        await Promise.all([
          supabase.from("product_variants")
            .select("id,product_id,sku,size,color,stock_quantity")
            .in("product_id", ids),
          supabase.from("products")
            .select("id,image_urls")
            .in("id", ids)
            .eq("is_active", true)
            .is("deleted_at", null),
        ]);

      if (variantsError) {
        console.error("[THS_PRODUCTS_VARIANTS_ERROR]", {
          code: variantsError.code, message: variantsError.message,
        });
        // Do not silently show products as out of stock when inventory fails.
        return fail("variants");
      }

      const byProduct = new Map<string, typeof products[number]["product_variants"]>();
      for (const v of variants ?? []) {
        const list = byProduct.get(v.product_id) ?? [];
        list.push({ id: v.id, sku: v.sku, size: v.size,
          color: v.color, stock_quantity: v.stock_quantity });
        byProduct.set(v.product_id, list);
      }
      const galleryMap = new Map(
        (galleries ?? []).map((g) => [g.id, g.image_urls])
      );
      if (galleryError) {
        console.error("[THS_PRODUCTS_GALLERY_ERROR]", {
          code: galleryError.code, message: galleryError.message,
        });
      }
      for (const p of products) {
        p.product_variants = byProduct.get(p.id) ?? [];
        const images = galleryMap.get(p.id);
        if (Array.isArray(images) && images.length) p.image_urls = images;
      }
    }

    return NextResponse.json(
      { ok: true, count: products.length, products },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[THS_PRODUCTS_CONNECTION_ERROR]", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return fail("connection");
  }
}
