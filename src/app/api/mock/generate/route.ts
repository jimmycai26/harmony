import { NextRequest, NextResponse } from "next/server";
import { createGeneration } from "@/lib/mock/store";
import type { Genre, Scope } from "@/lib/api/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prompt, scope, genre } = body as { prompt: string; scope: Scope; genre: Genre };
  if (!prompt || !scope || !genre) {
    return NextResponse.json({ error: "prompt, scope, and genre are required" }, { status: 400 });
  }
  const result = createGeneration(prompt, scope, genre);
  return NextResponse.json(result, { status: 201 });
}
