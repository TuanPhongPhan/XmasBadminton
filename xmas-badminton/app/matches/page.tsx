"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTournament } from "@/app/context/TournamentContext";
import { Side, generateRoundMatchesAvoidingPartners, applyResults } from "@/app/lib/tournament";

const NUM_COURTS = 5;
const IOS_FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
"Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`;

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
        currentWinners,
        setCurrentWinners,
        loadRemote,
        saveRemote,
    } = useTournament();

    const matches = currentMatches;
    const winners = currentWinners;

    const [infoMessage, setInfoMessage] = useState<string | null>(null);

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

    const handleGenerateNextRound = async () => {
        if (hasActiveRound) {
            setInfoMessage(
                "You still have an active round. Please save the results before rerolling courts."
            );
            return;
        }

        try {
            const result = generateRoundMatchesAvoidingPartners(
                players,
                NUM_COURTS,
                new Set(pastPartners)
            );

            setRoundNumber((n) => n + 1);
            setCurrentMatches(result.matches);
            setCurrentWinners({});

            if (result.usedPairs.length > 0) {
                const keys = result.usedPairs.map((pair) => {
                    const id1 = pair.p1.id;
                    const id2 = pair.p2.id;
                    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
                });
                addPartnerKeys(keys);
            }

            setInfoMessage(
                result.fallback
                    ? "Note: could not fully avoid repeated partners for this round."
                    : null
            );

            // Save to KV so other devices see the draw
            await saveRemote(tournamentId);
        } catch (e: any) {
            setInfoMessage(e?.message || "Error generating round");
            setCurrentMatches([]);
            setCurrentWinners({});
        }
    };

    const handleSetWinner = (courtNumber: number, side: Side) => {
        setCurrentWinners((prev) => ({ ...prev, [courtNumber]: side }));
    };

    const allWinnersSelected =
        matches.length > 0 && matches.every((m) => Boolean(winners[m.courtNumber]));

    const handleSaveResults = async () => {
        if (!hasActiveRound) return;

        if (!allWinnersSelected) {
            setInfoMessage("Select a winner for every court before saving.");
            return;
        }

        try {
            const updated = applyResults(players, matches, winners);
            setPlayers(updated);
            setCurrentMatches([]);
            setCurrentWinners({});
            setInfoMessage("Round saved. You can now reroll courts for the next round. 🎄");

            // Persist updated scores to KV
            await saveRemote(tournamentId);
        } catch (e: any) {
            setInfoMessage(e?.message || "Failed to save results");
        }
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

            {/* Main card (courts) */}
            <section
                style={{
                    width: "100%",
                    maxWidth: "1040px",
                    borderRadius: "1.5rem",
                    padding: "1.75rem 2rem",
                    background:
                        "linear-gradient(145deg, rgba(15,23,42,0.9), rgba(17,24,39,0.95))",
                    border: "1px solid rgba(148,163,184,0.5)",
                    boxShadow:
                        "0 22px 50px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.7)",
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
                        No active round. Press{" "}
                        <strong style={{ color: "#f97373" }}>Reroll Courts</strong> below to draw doubles for courts 1–5. 🎅
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
                            const winner = winners[match.courtNumber];

                            return (
                                <div
                                    key={match.courtNumber}
                                    style={{
                                        borderRadius: "1.1rem",
                                        border: "1px solid rgba(148,163,184,0.6)",
                                        padding: "0.9rem 0.95rem",
                                        background:
                                            "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.98))",
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

                                        {winner && (
                                            <span style={{ fontSize: "0.75rem", color: "#4ade80", fontWeight: 600 }}>
                        {winner === "SIDE_1" ? "Side 1" : "Side 2"} 🎉
                      </span>
                                        )}
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
                                            marginBottom: "0.75rem",
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

                                    <div style={{ display: "flex", gap: "0.45rem" }}>
                                        <button
                                            type="button"
                                            onClick={() => handleSetWinner(match.courtNumber, "SIDE_1")}
                                            style={{
                                                flex: 1,
                                                padding: "0.3rem 0.4rem",
                                                borderRadius: "999px",
                                                border:
                                                    winner === "SIDE_1"
                                                        ? "1px solid rgba(74,222,128,0.9)"
                                                        : "1px solid rgba(148,163,184,0.9)",
                                                background:
                                                    winner === "SIDE_1" ? "rgba(34,197,94,0.18)" : "transparent",
                                                fontSize: "0.8rem",
                                                color: "#e5e7eb",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Side 1 won
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleSetWinner(match.courtNumber, "SIDE_2")}
                                            style={{
                                                flex: 1,
                                                padding: "0.3rem 0.4rem",
                                                borderRadius: "999px",
                                                border:
                                                    winner === "SIDE_2"
                                                        ? "1px solid rgba(74,222,128,0.9)"
                                                        : "1px solid rgba(148,163,184,0.9)",
                                                background:
                                                    winner === "SIDE_2" ? "rgba(34,197,94,0.18)" : "transparent",
                                                fontSize: "0.8rem",
                                                color: "#e5e7eb",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Side 2 won
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Bottom controls */}
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
                    disabled={!allWinnersSelected || !hasActiveRound}
                    style={{
                        minWidth: "150px",
                        padding: "0.6rem 1.4rem",
                        borderRadius: "999px",
                        border: "none",
                        background:
                            allWinnersSelected && hasActiveRound
                                ? "linear-gradient(135deg, #22c55e, #4ade80)"
                                : "rgba(21,128,61,0.4)",
                        color: "#022c22",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        cursor: allWinnersSelected && hasActiveRound ? "pointer" : "not-allowed",
                    }}
                >
                    ✅ Save Results
                </button>

                <button
                    type="button"
                    onClick={() => router.push("/players")}
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
            </div>
        </main>
    );
}
