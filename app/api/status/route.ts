
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, step: "environment" },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { count, error } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { ok: false, step: "database" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      database: "connected",
      productsCount: count ?? 0,
    });
  } catch {
    return NextResponse.json(
      { ok: false, step: "connection" },
      { status: 503 }
    );
  }
}
