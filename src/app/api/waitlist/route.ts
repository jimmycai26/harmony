import { NextRequest, NextResponse } from "next/server";
import { addEmail, getCount, WaitlistError } from "@/lib/waitlist/store";

export async function GET() {
  return NextResponse.json({ count: await getCount() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email : "";
  try {
    const result = await addEmail(email);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof WaitlistError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
