import { NextRequest, NextResponse } from "next/server";
import { getReveal, VoteError } from "@/lib/mock/store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(getReveal(id));
  } catch (err) {
    if (err instanceof VoteError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
