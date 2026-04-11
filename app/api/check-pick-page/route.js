import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Public: verify a pick_page_id exists before sending users to /picks/[id].
 * GET ?pick_page_id=123456 → { ok: true } | 404 { ok: false, error }
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = String(searchParams.get("pick_page_id") ?? "").trim();
    if (!/^\d{6}$/.test(raw)) {
      return Response.json(
        { ok: false, error: "Pick code must be exactly 6 digits." },
        { status: 400 }
      );
    }
    const pick_page_id = Number(raw);

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("participants")
      .select("id")
      .eq("pick_page_id", pick_page_id)
      .maybeSingle();

    if (error) {
      return Response.json(
        { ok: false, step: "participant_select", error: error.message },
        { status: 500 }
      );
    }
    if (!data?.id) {
      return Response.json(
        { ok: false, error: "Pick code not found." },
        { status: 404 }
      );
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
