import { NextRequest, NextResponse } from "next/server";
import { getTrackDuration } from "@/lib/mock/store";
import type { LayersResponse } from "@/lib/api/types";

const STEM_TYPES = [
  { type: "vocals", label: "Vocals" },
  { type: "melody", label: "Melody" },
  { type: "bass", label: "Bass" },
  { type: "drums", label: "Drums" },
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  const duration = getTrackDuration(trackId);
  const body: LayersResponse = {
    trackId,
    stems: STEM_TYPES.map((s) => ({
      type: s.type,
      label: s.label,
      url: `/api/mock/audio?id=${encodeURIComponent(trackId + ":" + s.type)}&duration=${duration}`,
    })),
  };
  return NextResponse.json(body);
}
