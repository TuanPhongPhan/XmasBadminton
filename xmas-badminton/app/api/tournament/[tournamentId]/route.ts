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

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    // minimal schema guard
    const safe = {
        players: Array.isArray(body?.players) ? body.players : [],
        roundNumber: typeof body?.roundNumber === "number" ? body.roundNumber : 0,
        pastPartners: Array.isArray(body?.pastPartners) ? body.pastPartners : [],
        nextId: typeof body?.nextId === "number" ? body.nextId : 1,
        currentMatches: Array.isArray(body?.currentMatches) ? body.currentMatches : [],
        currentWinners: body?.currentWinners && typeof body.currentWinners === "object" ? body.currentWinners : {},
        updatedAt: typeof body?.updatedAt === "number" ? body.updatedAt : Date.now(),
    };

    await kv.set(key(tournamentId), safe);
    return NextResponse.json({ ok: true });
}


export async function DELETE(
    _req: NextRequest,
    context: { params: Promise<{ tournamentId: string }> }
) {
    const { tournamentId } = await context.params;
    await kv.del(key(tournamentId));
    return NextResponse.json({ ok: true });
}