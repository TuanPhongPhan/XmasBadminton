import {
    generateRoundMatchesAvoidingPartners,
    applyResults,
    sortLeaderboard,
    type Player,
    type Match,
    type MatchScore,
} from "./tournament";

/* =========================
   Helpers
========================= */

/** Deterministic PRNG so tests are stable. */
function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makePlayers(n: number, opts?: Partial<Player>): Player[] {
    return Array.from({ length: n }, (_, i) => ({
        id: i + 1,
        name: `P${i + 1}`,
        wins: 0,
        pointDiff: 0,
        lossStreak: 0,
        ...opts,
    }));
}

function partnerKeyByIds(a: number, b: number) {
    const id1 = Math.min(a, b);
    const id2 = Math.max(a, b);
    return `${id1}-${id2}`;
}

function flattenMatchPlayerIds(matches: Match[]): number[] {
    return matches.flatMap((m) => [...m.side1, ...m.side2].map((p) => p.id));
}

/* =========================
   Tests
========================= */

describe("generateRoundMatchesAvoidingPartners", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("throws if not enough players for all courts", () => {
        const players = makePlayers(19); // need 20 for 5 courts
        expect(() =>
            generateRoundMatchesAvoidingPartners(players, 5, new Set())
        ).toThrow("Not enough players for all courts");
    });

    test("with 20 players and 5 courts: returns 5 matches and each player appears once", () => {
        // Make random deterministic
        const rng = mulberry32(12345);
        jest.spyOn(Math, "random").mockImplementation(rng);

        const players = makePlayers(20);
        const res = generateRoundMatchesAvoidingPartners(players, 5, new Set());

        expect(res.matches).toHaveLength(5);

        const ids = flattenMatchPlayerIds(res.matches);
        expect(ids).toHaveLength(20);
        expect(new Set(ids).size).toBe(20); // no duplicates

        // Each court should be 2v2
        for (const m of res.matches) {
            expect(m.side1).toHaveLength(2);
            expect(m.side2).toHaveLength(2);
        }
    });

    test("avoids repeated partners when possible (no fallback)", () => {
        const rng = mulberry32(1);
        jest.spyOn(Math, "random").mockImplementation(rng);

        // 1 court needs 4 players
        const players = makePlayers(4);

        // Disallow the obvious pairs (1-2) and (3-4), but other pairings exist
        const pastPartners = new Set<string>([
            partnerKeyByIds(1, 2),
            partnerKeyByIds(3, 4),
        ]);

        const res = generateRoundMatchesAvoidingPartners(players, 1, pastPartners);

        expect(res.fallback).toBe(false);

        // Ensure usedPairs does not contain forbidden partner keys
        const usedKeys = res.usedPairs.map((p) => partnerKeyByIds(p.p1.id, p.p2.id));
        expect(usedKeys).not.toContain(partnerKeyByIds(1, 2));
        expect(usedKeys).not.toContain(partnerKeyByIds(3, 4));

        // Still must produce exactly one match (one court)
        expect(res.matches).toHaveLength(1);
        expect(new Set(flattenMatchPlayerIds(res.matches)).size).toBe(4);
    });

    test("falls back (allow repeats) when strict avoidance is impossible", () => {
        const rng = mulberry32(2);
        jest.spyOn(Math, "random").mockImplementation(rng);

        const players = makePlayers(4);

        // Block ALL possible partner pairs among these 4 players.
        // (1-2,1-3,1-4,2-3,2-4,3-4) => strict has no solution.
        const pastPartners = new Set<string>([
            "1-2",
            "1-3",
            "1-4",
            "2-3",
            "2-4",
            "3-4",
        ]);

        const res = generateRoundMatchesAvoidingPartners(players, 1, pastPartners);

        // It should relax constraints and still generate a match
        expect(res.fallback).toBe(true);
        expect(res.matches).toHaveLength(1);
        expect(new Set(flattenMatchPlayerIds(res.matches)).size).toBe(4);
    });

    test("stress: 200 rounds with 20 players (5 courts) -> always valid, no duplicate players per round", () => {
        // deterministic randomness so the stress test is stable
        const rng = mulberry32(777);
        jest.spyOn(Math, "random").mockImplementation(rng);

        const players = makePlayers(20);
        let pastPartners = new Set<string>();

        for (let round = 1; round <= 200; round++) {
            const res = generateRoundMatchesAvoidingPartners(players, 5, pastPartners);

            // must always create 5 courts
            expect(res.matches).toHaveLength(5);

            // 20 unique players per round (each used exactly once)
            const ids = flattenMatchPlayerIds(res.matches);
            expect(ids).toHaveLength(20);
            expect(new Set(ids).size).toBe(20);

            // each match is 2v2
            for (const m of res.matches) {
                expect(m.side1).toHaveLength(2);
                expect(m.side2).toHaveLength(2);
            }

            // usedPairs should match exactly 2 partner pairs per court => 10 pairs per round
            // (unless your implementation chooses not to return all pairs; if it does, this is a great invariant)
            expect(res.usedPairs.length).toBe(10);

            // update pastPartners like your app does
            for (const pair of res.usedPairs) {
                pastPartners.add(partnerKeyByIds(pair.p1.id, pair.p2.id));
            }
        }
    });
});

describe("applyResults", () => {
    test("applies wins, pointDiff and lossStreak correctly (side1 wins)", () => {
        const players = makePlayers(4);

        const match: Match = {
            courtNumber: 1,
            side1: [players[0], players[1]], // 1,2
            side2: [players[2], players[3]], // 3,4
        };

        const scores: Record<number, MatchScore> = {
            1: { side1: 21, side2: 10 }, // diff +11
        };

        const updated = applyResults(players, [match], scores);

        const p1 = updated.find((p) => p.id === 1)!;
        const p2 = updated.find((p) => p.id === 2)!;
        const p3 = updated.find((p) => p.id === 3)!;
        const p4 = updated.find((p) => p.id === 4)!;

        // Winners
        expect(p1.wins).toBe(1);
        expect(p2.wins).toBe(1);
        expect(p1.pointDiff).toBe(11);
        expect(p2.pointDiff).toBe(11);
        expect(p1.lossStreak).toBe(0);
        expect(p2.lossStreak).toBe(0);

        // Losers
        expect(p3.wins).toBe(0);
        expect(p4.wins).toBe(0);
        expect(p3.pointDiff).toBe(-11);
        expect(p4.pointDiff).toBe(-11);
        expect(p3.lossStreak).toBe(1);
        expect(p4.lossStreak).toBe(1);
    });

    test("applies wins, pointDiff and lossStreak correctly (side2 wins)", () => {
        const players = makePlayers(4, { lossStreak: 2 }); // start with streak

        const match: Match = {
            courtNumber: 1,
            side1: [players[0], players[1]],
            side2: [players[2], players[3]],
        };

        const scores: Record<number, MatchScore> = {
            1: { side1: 15, side2: 21 }, // diff -6 => side2 wins
        };

        const updated = applyResults(players, [match], scores);

        const s1a = updated.find((p) => p.id === 1)!;
        const s1b = updated.find((p) => p.id === 2)!;
        const s2a = updated.find((p) => p.id === 3)!;
        const s2b = updated.find((p) => p.id === 4)!;

        // side1 loses: pointDiff decreases by 6, streak increments
        expect(s1a.wins).toBe(0);
        expect(s1b.wins).toBe(0);
        expect(s1a.pointDiff).toBe(-6);
        expect(s1b.pointDiff).toBe(-6);
        expect(s1a.lossStreak).toBe(3);
        expect(s1b.lossStreak).toBe(3);

        // side2 wins: pointDiff increases by 6, streak resets, wins++
        expect(s2a.wins).toBe(1);
        expect(s2b.wins).toBe(1);
        expect(s2a.pointDiff).toBe(6);
        expect(s2b.pointDiff).toBe(6);
        expect(s2a.lossStreak).toBe(0);
        expect(s2b.lossStreak).toBe(0);
    });

    test("throws if missing score for a court", () => {
        const players = makePlayers(4);
        const match: Match = {
            courtNumber: 1,
            side1: [players[0], players[1]],
            side2: [players[2], players[3]],
        };

        expect(() => applyResults(players, [match], {})).toThrow(
            "Missing score for court 1"
        );
    });

    test("throws on tie scores", () => {
        const players = makePlayers(4);
        const match: Match = {
            courtNumber: 1,
            side1: [players[0], players[1]],
            side2: [players[2], players[3]],
        };

        expect(() =>
            applyResults(players, [match], { 1: { side1: 10, side2: 10 } })
        ).toThrow("Scores cannot be equal on court 1");
    });

    test("throws on negative scores", () => {
        const players = makePlayers(4);
        const match: Match = {
            courtNumber: 1,
            side1: [players[0], players[1]],
            side2: [players[2], players[3]],
        };

        expect(() =>
            applyResults(players, [match], { 1: { side1: -1, side2: 10 } })
        ).toThrow("Negative score on court 1");
    });
});

describe("sortLeaderboard", () => {
    test("sorts by wins desc, then pointDiff desc, then name asc", () => {
        const players: Player[] = [
            { id: 1, name: "Bob", wins: 2, pointDiff: 5, lossStreak: 0 },
            { id: 2, name: "Alice", wins: 2, pointDiff: 5, lossStreak: 0 },
            { id: 3, name: "Zed", wins: 3, pointDiff: -10, lossStreak: 0 },
            { id: 4, name: "Cara", wins: 2, pointDiff: 10, lossStreak: 0 },
        ];

        const sorted = sortLeaderboard(players);

        // wins 3 first
        expect(sorted[0].name).toBe("Zed");

        // then wins 2, higher pointDiff first
        expect(sorted[1].name).toBe("Cara");

        // then same wins+diff: name asc (Alice before Bob)
        expect(sorted[2].name).toBe("Alice");
        expect(sorted[3].name).toBe("Bob");
    });
});


