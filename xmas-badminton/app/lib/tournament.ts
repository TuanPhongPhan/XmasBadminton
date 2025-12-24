export type Side = "SIDE_1" | "SIDE_2";

export interface Player {
    id: number;
    name: string;
    score: number;
}

export interface Match {
    courtNumber: number;
    side1: Player[];
    side2: Player[];
}

export interface Pairing {
    p1: Player;
    p2: Player;
}

// Helper: stable key for a partner pair
function partnerKey(a: Player, b: Player): string {
    const id1 = a.id;
    const id2 = b.id;
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
}

/**
 * Backtracking to build pairs for one round.
 */
function buildPairs(
    shuffled: Player[],
    used: boolean[],
    current: Pairing[],
    pastPartners: Set<string>,
    allowRepeat: boolean
): boolean {
    const n = shuffled.length;

    // find first unused player
    let first = -1;
    for (let i = 0; i < n; i++) {
        if (!used[i]) {
            first = i;
            break;
        }
    }

    // base case: everyone is paired
    if (first === -1) return true;

    used[first] = true;
    const p1 = shuffled[first];

    for (let j = first + 1; j < n; j++) {
        if (used[j]) continue;

        const p2 = shuffled[j];
        const key = partnerKey(p1, p2);
        const alreadyPartners = pastPartners.has(key);

        if (!allowRepeat && alreadyPartners) continue;

        // try this pair
        used[j] = true;
        current.push({ p1, p2 });

        if (buildPairs(shuffled, used, current, pastPartners, allowRepeat)) {
            return true;
        }

        // backtrack
        current.pop();
        used[j] = false;
    }

    used[first] = false;
    return false;
}

export interface GenerateRoundResult {
    matches: Match[];
    usedPairs: Pairing[]; // for updating pastPartners
    fallback: boolean; // true if we had to relax constraints or go random
}

/**
 * Generate matches for a round while avoiding repeated partners when possible.
 * Assumes players.length === numCourts * 4 (e.g. 20 players, 5 courts).
 */
export function generateRoundMatchesAvoidingPartners(
    players: Player[],
    numCourts: number,
    pastPartners: Set<string>
): GenerateRoundResult {
    if (players.length < numCourts * 4) {
        throw new Error("Not enough players for all courts");
    }

    // shuffle players (Fisher–Yates)
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const roundPairs: Pairing[] = [];
    const used = new Array(shuffled.length).fill(false);

    // strict: no repeated partners
    let success = buildPairs(shuffled, used, roundPairs, pastPartners, false);
    let fallback = false;

    if (!success) {
        // relaxed: allow repeats if needed
        roundPairs.length = 0;
        used.fill(false);
        success = buildPairs(shuffled, used, roundPairs, pastPartners, true);
        fallback = true;
    }

    if (!success) {
        // total fallback: random 2v2 per court, no partner tracking
        const matches: Match[] = [];
        let court = 1;
        for (let i = 0; i + 3 < shuffled.length && court <= numCourts; i += 4) {
            const side1 = [shuffled[i], shuffled[i + 1]];
            const side2 = [shuffled[i + 2], shuffled[i + 3]];
            matches.push({ courtNumber: court, side1, side2 });
            court++;
        }
        return { matches, usedPairs: [], fallback: true };
    }

    // build matches from pairs: pair0 vs pair1 on court1, etc.
    const matches: Match[] = [];
    let court = 1;
    for (let i = 0; i + 1 < roundPairs.length && court <= numCourts; i += 2) {
        const t1 = roundPairs[i];
        const t2 = roundPairs[i + 1];
        matches.push({
            courtNumber: court,
            side1: [t1.p1, t1.p2],
            side2: [t2.p1, t2.p2],
        });
        court++;
    }

    return { matches, usedPairs: roundPairs, fallback };
}

/**
 * Apply winners for a round and return an updated player array.
 */
export function applyResults(
    players: Player[],
    matches: Match[],
    winners: Record<number, Side> // key = courtNumber
): Player[] {
    const updated = players.map((p) => ({ ...p }));

    const byId = new Map<number, Player>();
    for (const p of updated) {
        byId.set(p.id, p);
    }

    for (const match of matches) {
        const winnerSide = winners[match.courtNumber];
        if (!winnerSide) continue;

        const winnersPlayers = winnerSide === "SIDE_1" ? match.side1 : match.side2;

        for (const p of winnersPlayers) {
            const u = byId.get(p.id);
            if (u) u.score += 1;
        }
    }

    return updated;
}

/**
 * Sort players by score (desc), then name (asc).
 */
export function sortLeaderboard(players: Player[]): Player[] {
    return [...players].sort(
        (a, b) => b.score - a.score || a.name.localeCompare(b.name)
    );
}
