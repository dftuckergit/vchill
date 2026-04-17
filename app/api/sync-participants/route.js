import { fetchParticipantsFromSheet } from "@/lib/participants/sheet";
import { slugify } from "@/lib/slugify";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const maxDuration = 300;

function trimText(v) {
  const t = String(v ?? "").trim();
  return t.length ? t : null;
}

function normalizeParticipantRow(row) {
  const name = (row.name || row.Name || "").trim();
  if (!name) return null;

  const pickPageRaw = row.pick_page_id || row.pickPageId || row.pick_page || row.PickPageId;
  const pick_page_id = pickPageRaw ? Number(String(pickPageRaw).trim()) : null;

  const providedSlug = (row.slug || row.Slug || "").trim();
  const slug = providedSlug || slugify(name);

  const location = trimText(row.location || row.Location);
  const fav = trimText(row.fav || row.Fav);
  const linkedin = trimText(row.linkedin || row.LinkedIn || row.linked_in);

  return {
    name,
    slug,
    pick_page_id,
    location,
    fav,
    linkedin,
  };
}

export async function GET() {
  try {
    const rows = await fetchParticipantsFromSheet();
    const participants = rows.map(normalizeParticipantRow).filter(Boolean);

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("participants")
      .upsert(participants, { onConflict: "pick_page_id" })
      .select("id,name,slug,pick_page_id,location,fav,linkedin");

    if (error) {
      return Response.json(
        { ok: false, step: "upsert", error: error.message },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      count: participants.length,
      participants: data ?? [],
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

