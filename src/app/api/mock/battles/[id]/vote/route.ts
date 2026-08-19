import { NextRequest, NextResponse } from "next/server";
import { recordVote, VoteError } from "@/lib/mock/store";
import type { Vote } from "@/lib/api/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { overall } = body as { overall: Vote };
  if (!overall) return NextResponse.json({ error: "overall is required" }, { status: 400 });

  try {
    const result = recordVote(id, overall);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VoteError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
