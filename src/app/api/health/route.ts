import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return Response.json({
        ok: true,
        database: "supabase",
        configured: false,
        setupRequired: "Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL to connect to your Supabase project.",
      });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("players").select("id", { head: true, count: "exact" }).limit(1);

    if (error) {
      return Response.json({ ok: false, database: "supabase", error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, database: "supabase", configured: true });
  } catch (error: any) {
    return Response.json({ ok: false, error: error.message || "Healthcheck failed" }, { status: 500 });
  }
}
