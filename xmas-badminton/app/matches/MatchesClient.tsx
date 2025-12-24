"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTournament } from "@/app/context/TournamentContext";
import {
    generateRoundMatchesAvoidingPartners,
    applyResults,
    type MatchScore, Player, Side, Match,
} from "@/app/lib/tournament";

const NUM_COURTS = 5;
const IOS_FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
"Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`;

type Snapshot = {
    players: Player[];
    roundNumber: number;
    pastPartners: string[];
    nextId: number;
    currentMatches: Match[];
    currentWinners: Record<number, Side>;
    updatedAt: number;
};


export default function MatchesPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tournamentId = searchParams.get("t") ?? "default";

    const {
        players,
        setPlayers,
        roundNumber,
        setRoundNumber,
        pastPartners,
        addPartnerKeys,
        currentMatches,
        setCurrentMatches,
        setCurrentWinners,
        loadRemote,
        nextId,
    } = useTournament();

    const matches = currentMatches;
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    const [scoresByCourt, setScoresByCourt] = useState<
        Record<number, { side1: string; side2: string }>
    >({});

    const hasActiveRound = matches.length > 0;

    // Load shared state on open (and whenever tournamentId changes)
    useEffect(() => {
        loadRemote(tournamentId).catch((e) => {
            setInfoMessage(
                `Could not load shared tournament "${tournamentId}". (${e?.message ?? "error"})`
            );
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournamentId]);

    const pingOthers = () => {
        try {
            const msg = { tournamentId, at: Date.now() };

            if ("BroadcastChannel" in window) {
                const ch = new BroadcastChannel("tournament-updates");
                ch.postMessage(msg);
                ch.close();
            }

            localStorage.setItem("tournament-update", JSON.stringify(msg));
        } catch {}
    };

    const putSnapshot = async (snapshot: Snapshot) => {
        const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(snapshot),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to save tournament: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`
            );
        }
    };

    const setCourtScore = (courtNumber: number, side: "side1" | "side2", value: string) => {
        setScoresByCourt((prev) => ({
            ...prev,
            [courtNumber]: {
                side1: prev[courtNumber]?.side1 ?? "",
                side2: prev[courtNumber]?.side2 ?? "",
                [side]: value,
            },
        }));
    };

    const allScoresEntered = useMemo(() => {
        if (!hasActiveRound) return false;
        return matches.every((m) => {
            const raw = scoresByCourt[m.courtNumber];
            if (!raw) return false;
            if (raw.side1 === "" || raw.side2 === "") return false;
            const s1 = Number(raw.side1);
            const s2 = Number(raw.side2);
            if (!Number.isFinite(s1) || !Number.isFinite(s2)) return false;
            if (s1 < 0 || s2 < 0) return false;
            return s1 !== s2;
        });
    }, [hasActiveRound, matches, scoresByCourt]);

    const handleGenerateNextRound = async () => {
        if (hasActiveRound) {
            setInfoMessage("You still have an active round. Please save the results before rerolling courts.");
            return;
        }

        try {
            const result = generateRoundMatchesAvoidingPartners(
                players,
                NUM_COURTS,
                new Set(pastPartners)
            );

            // partner keys for this round
            const keys =
                result.usedPairs.length > 0
                    ? result.usedPairs.map((pair) => {
                        const id1 = pair.p1.id;
                        const id2 = pair.p2.id;
                        return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
                    })
                    : [];

            const nextPastPartners = keys.length
                ? Array.from(new Set([...pastPartners, ...keys]))
                : pastPartners;

            const nextRound = roundNumber + 1;

            // Update UI
            setRoundNumber(nextRound);
            setCurrentMatches(result.matches);
            setCurrentWinners({});
            setScoresByCourt({});
            if (keys.length) addPartnerKeys(keys);

            setInfoMessage(
                result.fallback ? "Note: could not fully avoid repeated partners for this round." : null
            );

            // Save EXACT snapshot (no stale state risk)
            await putSnapshot({
                players,
                roundNumber: nextRound,
                pastPartners: nextPastPartners,
                nextId,
                currentMatches: result.matches,
                currentWinners: {},
                updatedAt: Date.now(),
            });

            pingOthers();
        } catch (e: any) {
            setInfoMessage(e?.message || "Failed to save draw to server. Round not started.");
            setCurrentMatches([]);
            setCurrentWinners({});
            setScoresByCourt({});
        }
    };

    const handleSaveResults = async () => {
        if (!hasActiveRound) return;

        if (!allScoresEntered) {
            setInfoMessage("Enter both scores for every court (no ties) before saving.");
            return;
        }

        try {
            const numericScores: Record<number, MatchScore> = {};
            for (const m of matches) {
                const raw = scoresByCourt[m.courtNumber];
                const s1 = Number(raw.side1);
                const s2 = Number(raw.side2);

                if (!Number.isFinite(s1) || !Number.isFinite(s2)) {
                    throw new Error(`Invalid score on court ${m.courtNumber}`);
                }
                if (s1 < 0 || s2 < 0) {
                    throw new Error(`Negative score on court ${m.courtNumber}`);
                }
                if (s1 === s2) {
                    throw new Error(`Scores cannot be equal on court ${m.courtNumber}`);
                }

                numericScores[m.courtNumber] = { side1: s1, side2: s2 };
            }

            const updated = applyResults(players, matches, numericScores);

            // Update UI
            setPlayers(updated);
            setCurrentMatches([]);
            setCurrentWinners({});
            setScoresByCourt({});
            setInfoMessage("Round saved. You can now reroll courts for the next round.");

            // ✅ Save EXACT snapshot
            await putSnapshot({
                players: updated,
                roundNumber,
                pastPartners,
                nextId,
                currentMatches: [],
                currentWinners: {},
                updatedAt: Date.now(),
            });

            pingOthers();
        } catch (e: any) {
            setInfoMessage(e?.message || "Failed to save results");
        }
    };

    const handleShareLeaderboard = async () => {
        const url = `${window.location.origin}/leaderboard?t=${encodeURIComponent(tournamentId)}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: "Xmas Badminton Leaderboard",
                    text: "Live tournament standings",
                    url,
                });
                return;
            }

            await navigator.clipboard.writeText(url);
            setInfoMessage("📋 Leaderboard link copied!");
        } catch {
            prompt("Copy this leaderboard link:", url);
        }
    };

    const getWinnerLabel = (courtNumber: number) => {
        const raw = scoresByCourt[courtNumber];
        if (!raw || raw.side1 === "" || raw.side2 === "") return null;
        const s1 = Number(raw.side1);
        const s2 = Number(raw.side2);
        if (!Number.isFinite(s1) || !Number.isFinite(s2)) return null;
        if (s1 === s2) return "Tie (not allowed)";
        return s1 > s2 ? "Side 1 🏆" : "Side 2 🏆";
    };

    return (
        <main
            style={{
                minHeight: "100vh",
                padding: "3rem 1rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                fontFamily: IOS_FONT,
                background: "linear-gradient(180deg, #020617 0%, #0f172a 40%, #020617 100%)",
            }}
        >
            <header style={{ textAlign: "center", marginBottom: "1rem" }}>
                <h1
                    style={{
                        fontSize: "2.4rem",
                        fontWeight: 800,
                        color: "#f97373",
                        textShadow: "0 6px 25px rgba(248,113,113,0.45)",
                        letterSpacing: 0.4,
                        marginBottom: "0.3rem",
                    }}
                >
                    🎁 Court Draw
                </h1>
                <p style={{ color: "#e5e7eb", fontSize: "0.95rem", opacity: 0.9 }}>
                    Tournament: <strong>{tournamentId}</strong> · Round {roundNumber || "—"} · 5 courts · one set to 21
                </p>
            </header>

            {infoMessage && (
                <div
                    style={{
                        width: "100%",
                        maxWidth: "1040px",
                        background: "rgba(254,243,199,0.05)",
                        border: "1px solid rgba(250,204,21,0.6)",
                        color: "#facc15",
                        borderRadius: "0.9rem",
                        padding: "0.5rem 0.8rem",
                        fontSize: "0.8rem",
                        marginBottom: "0.75rem",
                    }}
                >
                    {infoMessage}
                </div>
            )}

            <section
                style={{
                    width: "100%",
                    maxWidth: "1040px",
                    borderRadius: "1.5rem",
                    padding: "1.75rem 2rem",
                    background: "linear-gradient(145deg, rgba(15,23,42,0.9), rgba(17,24,39,0.95))",
                    border: "1px solid rgba(148,163,184,0.5)",
                    boxShadow: "0 22px 50px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.7)",
                    backdropFilter: "blur(24px)",
                    marginBottom: "1.5rem",
                }}
            >
                {matches.length === 0 ? (
                    <p
                        style={{
                            textAlign: "center",
                            color: "#6b7280",
                            fontSize: "0.95rem",
                            padding: "1.4rem 0 0.6rem",
                        }}
                    >
                        No active round. Press <strong style={{ color: "#f97373" }}>Reroll Courts</strong> below to draw doubles for courts 1–5
                    </p>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                            gap: "1rem",
                        }}
                    >
                        {matches.map((match) => {
                            const winnerLabel = getWinnerLabel(match.courtNumber);

                            return (
                                <div
                                    key={match.courtNumber}
                                    style={{
                                        borderRadius: "1.1rem",
                                        border: "1px solid rgba(148,163,184,0.6)",
                                        padding: "0.9rem 0.95rem",
                                        background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.98))",
                                        boxShadow: "0 10px 28px rgba(15,23,42,0.9)",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: "0.6rem",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                            <span style={{ fontSize: "1rem", color: "#38bdf8" }}>🏸</span>
                                            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e5e7eb" }}>
                        Court {match.courtNumber}
                      </span>
                                        </div>

                                        {winnerLabel && (
                                            <span style={{ fontSize: "0.75rem", color: "#4ade80", fontWeight: 600 }}>
                        {winnerLabel}
                      </span>
                                        )}
                                    </div>

                                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "0.25rem" }}>
                                                Side 1 score
                                            </div>
                                            <input
                                                inputMode="numeric"
                                                type="number"
                                                min={0}
                                                value={scoresByCourt[match.courtNumber]?.side1 ?? ""}
                                                onChange={(e) => setCourtScore(match.courtNumber, "side1", e.target.value)}
                                                style={{
                                                    width: "100%",
                                                    borderRadius: "0.8rem",
                                                    border: "1px solid rgba(148,163,184,0.6)",
                                                    background: "rgba(15,23,42,0.6)",
                                                    color: "#e5e7eb",
                                                    padding: "0.35rem 0.55rem",
                                                    outline: "none",
                                                }}
                                            />
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "0.25rem" }}>
                                                Side 2 score
                                            </div>
                                            <input
                                                inputMode="numeric"
                                                type="number"
                                                min={0}
                                                value={scoresByCourt[match.courtNumber]?.side2 ?? ""}
                                                onChange={(e) => setCourtScore(match.courtNumber, "side2", e.target.value)}
                                                style={{
                                                    width: "100%",
                                                    borderRadius: "0.8rem",
                                                    border: "1px solid rgba(148,163,184,0.6)",
                                                    background: "rgba(15,23,42,0.6)",
                                                    color: "#e5e7eb",
                                                    padding: "0.35rem 0.55rem",
                                                    outline: "none",
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: "0.3rem", fontSize: "0.8rem", color: "#9ca3af" }}>
                                        Side 1
                                    </div>
                                    <div
                                        style={{
                                            borderRadius: "0.8rem",
                                            background: "rgba(15,118,110,0.2)",
                                            padding: "0.35rem 0.55rem",
                                            marginBottom: "0.6rem",
                                        }}
                                    >
                                        {match.side1.map((p, idx) => (
                                            <div
                                                key={p.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.35rem",
                                                    paddingTop: idx > 0 ? "0.22rem" : 0,
                                                    fontSize: "0.9rem",
                                                    color: "#e5e7eb",
                                                }}
                                            >
                                                <span style={{ fontSize: "0.9rem", color: "#7dd3fc" }}>🎄</span>
                                                <span>{p.name}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ marginBottom: "0.3rem", fontSize: "0.8rem", color: "#9ca3af" }}>
                                        Side 2
                                    </div>
                                    <div
                                        style={{
                                            borderRadius: "0.8rem",
                                            background: "rgba(30,64,175,0.35)",
                                            padding: "0.35rem 0.55rem",
                                        }}
                                    >
                                        {match.side2.map((p, idx) => (
                                            <div
                                                key={p.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.35rem",
                                                    paddingTop: idx > 0 ? "0.22rem" : 0,
                                                    fontSize: "0.9rem",
                                                    color: "#e5e7eb",
                                                }}
                                            >
                                                <span style={{ fontSize: "0.9rem", color: "#a5b4fc" }}>🎁</span>
                                                <span>{p.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                    type="button"
                    onClick={handleGenerateNextRound}
                    disabled={hasActiveRound}
                    style={{
                        minWidth: "150px",
                        padding: "0.6rem 1.4rem",
                        borderRadius: "999px",
                        border: "none",
                        background: hasActiveRound ? "rgba(30,64,175,0.4)" : "rgba(30,64,175,0.9)",
                        color: "#e0f2fe",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        cursor: hasActiveRound ? "not-allowed" : "pointer",
                    }}
                >
                    🔁 Reroll Courts
                </button>

                <button
                    type="button"
                    onClick={handleSaveResults}
                    disabled={!allScoresEntered || !hasActiveRound}
                    style={{
                        minWidth: "150px",
                        padding: "0.6rem 1.4rem",
                        borderRadius: "999px",
                        border: "none",
                        background:
                            allScoresEntered && hasActiveRound
                                ? "linear-gradient(135deg, #22c55e, #4ade80)"
                                : "rgba(34,197,94,0.25)",
                        color: allScoresEntered && hasActiveRound ? "#06230f" : "rgba(6,35,15,0.6)",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        cursor: allScoresEntered && hasActiveRound ? "pointer" : "not-allowed",
                    }}
                >
                    ✅ Save Results
                </button>

                <button
                    type="button"
                    onClick={() => router.push(`/players?t=${encodeURIComponent(tournamentId)}`)}
                    style={{
                        minWidth: "150px",
                        padding: "0.6rem 1.4rem",
                        borderRadius: "999px",
                        border: "none",
                        background: "rgba(248,250,252,0.95)",
                        color: "#111827",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        cursor: "pointer",
                    }}
                >
                    ✏️ Edit Players
                </button>

                <button
                    type="button"
                    onClick={handleShareLeaderboard}
                    style={{
                        minWidth: "180px",
                        padding: "0.6rem 1.4rem",
                        borderRadius: "999px",
                        border: "1px solid rgba(148,163,184,0.8)",
                        background: "rgba(30,41,59,0.9)",
                        color: "#e5e7eb",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        boxShadow: "0 8px 20px rgba(15,23,42,0.5)",
                    }}
                >
                    🔗 Share Leaderboard
                </button>

                <button
                    type="button"
                    onClick={() => {
                        const url = `/leaderboard?t=${encodeURIComponent(tournamentId)}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    style={{
                        minWidth: "150px",
                        padding: "0.6rem 1.4rem",
                        borderRadius: "999px",
                        border: "none",
                        background: "#FFDD00",
                        color: "#1f2937",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        cursor: "pointer",
                    }}
                >
                    👑 Open Leaderboard
                </button>
            </div>
        </main>
    );
}
