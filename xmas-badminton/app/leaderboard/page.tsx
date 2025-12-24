"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTournament } from "@/app/context/TournamentContext";
import { sortLeaderboard } from "@/app/lib/tournament";


const IOS_FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
"Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`;

export default function LeaderboardPage() {
    const { players, roundNumber, loadRemote } = useTournament();
    const searchParams = useSearchParams();
    const tournamentId = searchParams.get("t") ?? "default";

    const leaderboard = sortLeaderboard(players);

    useEffect(() => {
        // initial load
        loadRemote(tournamentId).catch(() => {});

        // poll every 3 seconds
        const interval = setInterval(() => {
            loadRemote(tournamentId).catch(() => {});
        }, 3000);

        return () => clearInterval(interval);
    }, [tournamentId, loadRemote]);

    return (
        <main
            style={{
                minHeight: "100vh",
                padding: "3rem 1rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                fontFamily: IOS_FONT,
                position: "relative",
                overflow: "hidden",

                // ❄️ Winter gradient
                background:
                    "linear-gradient(180deg, #020617 0%, #0f172a 40%, #020617 100%)",
            }}
        >
            <header style={{ textAlign: "center", marginBottom: "2rem" }}>
                <h1
                    style={{
                        fontSize: "2.4rem",
                        fontWeight: 800,
                        color: "#e4ba10",
                        textShadow: "0 6px 25px rgba(250,204,21,0.55)",
                        letterSpacing: 0.4,
                        marginBottom: "0.3rem",
                    }}
                >
                    👑 Christmas Leaderboard
                </h1>
                <p
                    style={{
                        color: "#e5e7eb",
                        fontSize: "0.95rem",
                        opacity: 0.9,
                    }}
                >
                    Each set won gives +1 point per player
                </p>
                <p
                    style={{
                        marginTop: "0.5rem",
                        fontSize: "0.85rem",
                        color: "#9ca3af",
                    }}
                >
                    Rounds played:{" "}
                    <strong style={{ color: "#facc15" }}>{roundNumber}</strong>
                </p>
            </header>

            <section
                style={{
                    width: "100%",
                    maxWidth: "720px",
                    borderRadius: "1.5rem",
                    padding: "1.5rem 1.75rem 1.75rem",
                    background:
                        "linear-gradient(145deg, rgba(15,23,42,0.9), rgba(15,23,42,0.98))",
                    border: "1px solid rgba(148,163,184,0.5)",
                    boxShadow:
                        "0 22px 50px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.7)",
                    backdropFilter: "blur(22px)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.75rem",
                    }}
                >
                    <h2
                        style={{
                            fontSize: "1.1rem",
                            fontWeight: 600,
                            color: "#e5e7eb",
                        }}
                    >
                        Standings
                    </h2>
                    <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
            Top 3 get prizes 🎁
          </span>
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "0.95rem",
                        }}
                    >
                        <thead>
                        <tr
                            style={{
                                textAlign: "left",
                                borderBottom: "1px solid rgba(55,65,81,0.9)",
                            }}
                        >
                            <th style={{ padding: "0.5rem 0.25rem", width: "2.5rem" }}>
                                #
                            </th>
                            <th style={{ padding: "0.5rem 0.25rem" }}>Player</th>
                            <th
                                style={{
                                    padding: "0.5rem 0.25rem",
                                    width: "4rem",
                                    textAlign: "right",
                                }}
                            >
                                Score
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {leaderboard.map((p, index) => {
                            const isFirst = index === 0;
                            const isSecond = index === 1;
                            const isThird = index === 2;

                            const rowBg = isFirst
                                ? "rgba(250,204,21,0.09)"
                                : isSecond
                                    ? "rgba(148,163,184,0.08)"
                                    : isThird
                                        ? "rgba(244,114,182,0.05)"
                                        : "transparent";

                            return (
                                <tr
                                    key={p.id}
                                    style={{
                                        borderBottom: "1px solid rgba(55,65,81,0.7)",
                                        background: rowBg,
                                    }}
                                >
                                    <td
                                        style={{
                                            padding: "0.4rem 0.25rem",
                                            width: "2.5rem",
                                            fontWeight: isFirst ? 700 : 500,
                                        }}
                                    >
                                        {index + 1}
                                    </td>
                                    <td style={{ padding: "0.4rem 0.25rem" }}>
                      <span
                          style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                          }}
                      >
                        {isFirst && <span>👑</span>}
                          {isSecond && <span>🥈</span>}
                          {isThird && <span>🥉</span>}
                          <span>{p.name}</span>
                      </span>
                                    </td>
                                    <td
                                        style={{
                                            padding: "0.4rem 0.25rem",
                                            textAlign: "right",
                                            fontWeight: isFirst ? 700 : 500,
                                        }}
                                    >
                                        {p.score}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}
