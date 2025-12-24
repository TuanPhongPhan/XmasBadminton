import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const key = (tournamentId: string) => `tournament:${tournamentId}`;

export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ tournamentId: string }> }
) {
    const { tournamentId } = await context.params;
    const data = await kv.get(key(tournamentId));
    return NextResponse.json(data ?? null);
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ tournamentId: string }> }
) {
    const { tournamentId } = await context.params;
    const body = await req.json();
    await kv.set(key(tournamentId), body);
    return NextResponse.json({ ok: true });
}
