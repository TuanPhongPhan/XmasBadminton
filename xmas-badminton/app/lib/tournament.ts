export type Side = "SIDE_1" | "SIDE_2";

export interface Player {
    id: number;
    name: string;
    wins: number;
    pointDiff: number;
    lossStreak: number;
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

export type MatchScore = {
    side1: number;
    side2: number;
};

// ===============================
// Matchmaking tuning configuration
// ===============================

export const MATCHMAKING_CONFIG = {
    // --- Anti-streak behavior ---
    STREAK_THRESHOLD: 3,        // lossStreak >= this activates anti-streak logic

    // Prefer stronger partner (soft, ordering only)
    PARTNER_BIAS: 1.0,          // 0 = off, 1 = mild, 2 = strong (DO NOT exceed 2)

    // Court balance protection for streaking players
    LOW_BALANCE_PENALTY: 3.0,   // penalty when imbalance >= 3 and streaker present

    // Randomness (breaks deterministic traps)
    BASE_NOISE: 0.15,           // always applied
    STREAK_NOISE: 0.15,         // extra noise when streaker is present

    // --- Safety limits ---
    MAX_NOISE: 0.35,            // hard cap, prevents chaos
};


function partnerKey(a: Player, b: Player): string {
    const id1 = a.id;
    const id2 = b.id;
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
}

/**
 * Build partner pairs using backtracking.
 * Hard constraint: avoid repeated partners when allowRepeat=false.
 *
 * Soft anti-streak:
 * - If p1 has lossStreak >= 3, we *try* higher-win partners first (not forced).
 */
function buildPairs(
    shuffled: Player[],
    used: boolean[],
    current: Pairing[],
    pastPartners: Set<string>,
    allowRepeat: boolean
): boolean {
    const n = shuffled.length;

    // Find first unused
    let first = -1;
    for (let i = 0; i < n; i++) {
        if (!used[i]) {
            first = i;
            break;
        }
    }

    // Done
    if (first === -1) return true;

    const p1 = shuffled[first];
    used[first] = true;

    // Candidate partner indices
    const candidates: number[] = [];
    for (let j = first + 1; j < n; j++) {
        if (!used[j]) candidates.push(j);
    }

    // Soft preference: if p1 streaking, try higher-win partners earlier
    const streaking = (p1.lossStreak ?? 0) >= MATCHMAKING_CONFIG.STREAK_THRESHOLD;
    candidates.sort((ia, ib) => {
        if (!streaking) {
            // small shuffle so we don't always pick the same-looking pairing
            return Math.random() - 0.5;
        }
        const a = shuffled[ia];
        const b = shuffled[ib];

        // Prefer higher wins; add tiny randomness so it doesn't become robotic
        const bias = MATCHMAKING_CONFIG.PARTNER_BIAS;
        const noise = (Math.random() * 0.2 - 0.1);

        return (b.wins - a.wins) * bias + noise;
    });

    for (const j of candidates) {
        const p2 = shuffled[j];
        const key = partnerKey(p1, p2);
        const alreadyPartners = pastPartners.has(key);

        if (!allowRepeat && alreadyPartners) continue;

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

/** Win sum for a doubles team */
function teamWins(p: Pairing): number {
    return (p.p1.wins ?? 0) + (p.p2.wins ?? 0);
}

/** Whether a team includes a streaking player */
function hasStreaker(p: Pairing): boolean {
    return (p.p1.lossStreak ?? 0) >= 3 || (p.p2.lossStreak ?? 0) >= 3;
}

/**
 * Court cost: lower is better.
 * - Soft: balance by wins (minimize imbalance)
 * - Soft anti-streak: avoid low-balance courts for streakers (imbalance >= 3)
 * - Tiny noise: increases when streakers present to break deterministic traps
 */
function courtCost(a: Pairing, b: Pairing): number {
    const imbalance = Math.abs(teamWins(a) - teamWins(b));
    const streakersPresent = hasStreaker(a) || hasStreaker(b);

    // Penalize low-balance courts for streakers
    // High balance: 0–1, Mid: 2, Low: >= 3
    const lowBalancePenalty =
        streakersPresent && imbalance >= 3 ? (imbalance - 2) * MATCHMAKING_CONFIG.LOW_BALANCE_PENALTY : 0;

    // Noise (with cap)
    const rawNoise =
        MATCHMAKING_CONFIG.BASE_NOISE +
        (streakersPresent ? MATCHMAKING_CONFIG.STREAK_NOISE : 0);

    const noiseMagnitude = Math.min(
        rawNoise,
        MATCHMAKING_CONFIG.MAX_NOISE
    );

    const noise = (Math.random() * 2 - 1) * noiseMagnitude;

    // Weight: wins balance is the main objective
    return imbalance * 1.0 + lowBalancePenalty + noise;
}

/**
 * Optimize which partner pairs play against which on courts.
 * For 10 teams (5 courts), there are only 945 matchings; fast.
 *
 * Returns an array: [t1,t2,t1,t2,...] length = 2*numCourts.
 */
function optimizeCourts(pairs: Pairing[], numCourts: number): Pairing[] | null {
    const remaining = pairs.slice();
    const chosen: Pairing[] = [];
    let best: Pairing[] | null = null;
    let bestCost = Number.POSITIVE_INFINITY;

    function dfs(costSoFar: number) {
        if (chosen.length === numCourts * 2) {
            if (costSoFar < bestCost) {
                bestCost = costSoFar;
                best = chosen.slice();
            }
            return;
        }

        const first = remaining[0];

        for (let i = 1; i < remaining.length; i++) {
            const second = remaining[i];
            const c = courtCost(first, second);

            // branch-and-bound
            if (costSoFar + c >= bestCost) continue;

            // choose
            remaining.splice(i, 1);
            remaining.splice(0, 1);
            chosen.push(first, second);

            dfs(costSoFar + c);

            // undo
            chosen.pop();
            chosen.pop();
            remaining.unshift(first);
            remaining.splice(i, 0, second);
        }
    }

    dfs(0);
    return best;
}

export interface GenerateRoundResult {
    matches: Match[];
    usedPairs: Pairing[]; // for updating pastPartners
    fallback: boolean; // true if we had to relax constraints or go random
}

/**
 * Generate matches for a round while avoiding repeated partners when possible.
 * Assumes players.length >= numCourts * 4 (e.g. 20 players, 5 courts).
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

    // Soft: balance courts by wins + anti-streak penalties + noise
    const orderedPairs = optimizeCourts(roundPairs, numCourts) ?? roundPairs;

    const matches: Match[] = [];
    let court = 1;
    for (let i = 0; i + 1 < orderedPairs.length && court <= numCourts; i += 2) {
        const t1 = orderedPairs[i];
        const t2 = orderedPairs[i + 1];
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
 * Apply results for a round using scores.
 *
 * Example: side1 wins 21-10 => diff = +11
 * - side1 players: wins += 1, pointDiff += 11, lossStreak = 0
 * - side2 players: wins += 0, pointDiff -= 11, lossStreak += 1
 */
export function applyResults(
    players: Player[],
    matches: Match[],
    scoresByCourt: Record<number, MatchScore> // key = courtNumber
): Player[] {
    // clone
    const updated = players.map((p) => ({
        ...p,
        lossStreak: typeof p.lossStreak === "number" ? p.lossStreak : 0,
    }));

    const byId = new Map<number, Player>();
    for (const p of updated) byId.set(p.id, p);

    for (const match of matches) {
        const score = scoresByCourt[match.courtNumber];
        if (!score) {
            throw new Error(`Missing score for court ${match.courtNumber}`);
        }

        const s1 = score.side1;
        const s2 = score.side2;

        if (!Number.isFinite(s1) || !Number.isFinite(s2)) {
            throw new Error(`Invalid score on court ${match.courtNumber}`);
        }
        if (s1 < 0 || s2 < 0) {
            throw new Error(`Negative score on court ${match.courtNumber}`);
        }
        if (s1 === s2) {
            throw new Error(`Scores cannot be equal on court ${match.courtNumber}`);
        }

        const diff = s1 - s2; // positive if side1 wins, negative if side2 wins
        const winnerSide: Side = diff > 0 ? "SIDE_1" : "SIDE_2";

        // Side 1
        for (const p of match.side1) {
            const u = byId.get(p.id);
            if (!u) continue;

            u.pointDiff += diff; // if side1 loses, diff is negative -> decreases

            if (winnerSide === "SIDE_1") {
                u.wins += 1;
                u.lossStreak = 0;
            } else {
                u.lossStreak = (u.lossStreak ?? 0) + 1;
            }
        }

        // Side 2
        for (const p of match.side2) {
            const u = byId.get(p.id);
            if (!u) continue;

            u.pointDiff -= diff; // opposite of side1

            if (winnerSide === "SIDE_2") {
                u.wins += 1;
                u.lossStreak = 0;
            } else {
                u.lossStreak = (u.lossStreak ?? 0) + 1;
            }
        }
    }
    return updated;
}

/**
 * Sort by wins (desc), then pointDiff (desc), then name (asc).
 */
export function sortLeaderboard(players: Player[]): Player[] {
    return [...players].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
        return a.name.localeCompare(b.name);
    });
}
