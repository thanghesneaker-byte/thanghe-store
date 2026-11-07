 
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const fail = (step: string) =>
    NextResponse.json(
      { ok: false, step },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );

  if (!url || !key) {
    console.error("[THS_PRODUCTS_ENV_MISSING]", {
      hasUrl: Boolean(url),
      hasKey: Boolean(key),
    });
    return fail("environment");
  }

  try {
    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

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
      console.error("[THS_PRODUCTS_DB_ERROR]", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return fail("database");
    }

    let products = (data ?? []).map((product) => ({
      ...product,
      image_urls: product.image_url
        ? [product.image_url]
        : [],
    }));

    if (products.length > 0) {
      const ids = products.map((p) => p.id);

      const { data: galleries, error: galleryError } =
        await supabase
          .from("products")
          .select("id, image_urls")
          .in("id", ids)
          .eq("is_active", true)
          .is("deleted_at", null);

      if (galleryError) {
        console.error("[THS_PRODUCTS_GALLERY_ERROR]", {
          code: galleryError.code,
          message: galleryError.message,
        });
      } else if (galleries) {
        const galleryMap = new Map(
          galleries.map((row) => [row.id, row.image_urls])
        );

        products = products.map((product) => {
          const images = galleryMap.get(product.id);

          return {
            ...product,
            image_urls:
              Array.isArray(images) && images.length > 0
                ? images
                : product.image_urls,
          };
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        count: products.length,
        products,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[THS_PRODUCTS_CONNECTION_ERROR]", {
      message:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });

    return fail("connection");
  }
}
