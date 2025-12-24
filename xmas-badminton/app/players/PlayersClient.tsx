"use client";

import { useRouter } from "next/navigation";
import { useState, KeyboardEventHandler, useEffect, useRef } from "react";
import { useTournament } from "@/app/context/TournamentContext";
import { useSearchParams } from "next/navigation";


const IOS_FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
"Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`;

export default function PlayersPage() {
    const router = useRouter();
    const { players, addPlayer, removePlayer, resetTournament, resetRemote, saveRemote } = useTournament();
    const [input, setInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const tournamentId = searchParams.get("t") ?? "default";
    const [confirmReset, setConfirmReset] = useState(false);
    const firstRun = useRef(true);


    const handleAdd = () => {
        if (!input.trim()) return;

        const ok = addPlayer(input);
        if (!ok) {
            setInfo(null);
            setError("This name is already in the player pool.");
            return;
        }

        setInput("");
        setInfo(null);
        setError(null);
    };


    const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    };

    useEffect(() => {
        // skip first mount
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }

        const t = setTimeout(() => {
            saveRemote(tournamentId).catch(() => {
                // optional: show a warning banner
            });
        }, 400);

        return () => clearTimeout(t);
    }, [players, tournamentId, saveRemote]);

    return (
        <main
            style={{
                minHeight: "100vh",
                padding: "3rem 1rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                fontFamily: IOS_FONT,
                background:
                    "linear-gradient(180deg, #020617 0%, #0f172a 40%, #020617 100%)",
            }}
        >
            {/* iOS + Christmas header */}
            <header style={{ textAlign: "center", marginBottom: "2rem" }}>
                <h1
                    style={{
                        fontSize: "2.4rem",
                        fontWeight: 800,
                        color: "#f97373", // warm Christmas red
                        textShadow: "0 6px 25px rgba(248,113,113,0.45)",
                        letterSpacing: 0.4,
                        marginBottom: "0.3rem",
                    }}
                >
                    🎄 Xmas Badminton Tournament
                </h1>
                <p
                    style={{
                        color: "#e5e7eb",
                        fontSize: "0.95rem",
                        opacity: 0.9,
                    }}
                >
                    Set up your player pool below.
                </p>
            </header>

            {/* Frosted-glass card */}
            <section
                style={{
                    width: "100%",
                    maxWidth: "720px",
                    borderRadius: "1.5rem",
                    padding: "1.75rem 2rem",
                    background:
                        "linear-gradient(145deg, rgba(15,23,42,0.82), rgba(15,23,42,0.92))",
                    border: "1px solid rgba(148,163,184,0.35)",
                    boxShadow:
                        "0 18px 45px rgba(15,23,42,0.85), 0 0 0 1px rgba(148,163,184,0.25)",
                    backdropFilter: "blur(24px)",
                }}
            >
                {/* Header row */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: "1.1rem",
                    }}
                >
                    <div>
                        <h2
                            style={{
                                fontSize: "1.05rem",
                                fontWeight: 600,
                                color: "#e5e7eb",
                                marginBottom: "0.2rem",
                            }}
                        >
                            Player Pool
                        </h2>
                        <p
                            style={{
                                fontSize: "0.85rem",
                                color: "#9ca3af",
                            }}
                        >
                            Add player names. Your pool is saved on this device.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={async () => {
                            if (!confirmReset) {
                                setConfirmReset(true);
                                setTimeout(() => setConfirmReset(false), 4000);
                                return;
                            }

                            setConfirmReset(false);

                            // local reset first (fast UI)
                            resetTournament();

                            try {
                                await resetRemote(tournamentId);
                                setInfo("✅ New game started (synced to all devices).");
                                setError(null);
                            } catch (e: any) {
                                setError("⚠️ New game reset locally, but failed to sync to server. Check Wi-Fi and try again.");
                            }
                        }}
                        style={{
                            border: "none",
                            background: confirmReset ? "#dc2626" : "rgba(31,41,55,0.7)",
                            color: "#fff",
                            padding: "0.25rem 0.7rem",
                            borderRadius: "999px",
                            fontSize: "0.8rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            cursor: "pointer",
                        }}
                    >
                        {confirmReset ? "⚠️ Click again to confirm" : "🧹 New Game"}
                    </button>

                </div>

                {/* Input */}
                <div
                    style={{
                        display: "flex",
                        gap: "0.6rem",
                        marginBottom: "0.9rem",
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            borderRadius: "0.9rem",
                            padding: "0.45rem 0.75rem",
                            background: "rgba(15,23,42,0.85)",
                            border: "1px solid rgba(148,163,184,0.6)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                        }}
                    >
                        <span style={{ fontSize: "1rem", color: "#9ca3af" }}>👥</span>
                        <input
                            type="text"
                            placeholder="Enter player name"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            style={{
                                flex: 1,
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: "#e5e7eb",
                                fontSize: "0.95rem",
                            }}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleAdd}
                        style={{
                            padding: "0.55rem 1rem",
                            borderRadius: "0.9rem",
                            border: "none",
                            background:
                                "linear-gradient(135deg, #22c55e, #4ade80)", // Christmas green
                            color: "#0f172a",
                            fontWeight: 700,
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            boxShadow: "0 10px 24px rgba(34,197,94,0.65)",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Add
                    </button>
                </div>

                {error && (
                    <p
                        style={{
                            marginTop: "-0.4rem",
                            marginBottom: "0.6rem",
                            fontSize: "0.8rem",
                            color: "#fca5a5",
                        }}
                    >
                        {error}
                    </p>
                )}


                {info && !error && (
                    <p
                        style={{
                            marginTop: "-0.4rem",
                            marginBottom: "0.6rem",
                            fontSize: "0.8rem",
                            color: "#86efac",
                        }}
                    >
                        {info}
                    </p>
                )}



                {/* Current players */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "0.4rem",
                    }}
                >
          <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
            Current Players ({players.length})
          </span>
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            Tip: aim for 20 players for 5 full courts.
          </span>
                </div>

                <div
                    style={{
                        minHeight: "2.5rem",
                        padding: players.length ? "0.5rem 0" : "0.9rem 0",
                    }}
                >
                    {players.length === 0 ? (
                        <p
                            style={{
                                textAlign: "center",
                                fontSize: "0.9rem",
                                color: "#6b7280",
                            }}
                        >
                            The court is empty. Add some players to start the Christmas
                            showdown!
                        </p>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "0.5rem",
                            }}
                        >
                            {players.map((p) => (
                                <span
                                    key={p.id}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.3rem",
                                        padding: "0.2rem 0.6rem",
                                        borderRadius: "999px",
                                        background: "rgba(15,118,110,0.15)",
                                        border: "1px solid rgba(45,212,191,0.8)",
                                        color: "#a5f3fc",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    {p.name}
                                    <button
                                        type="button"
                                        onClick={() => removePlayer(p.id)}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            color: "#fca5a5",
                                            cursor: "pointer",
                                            fontSize: "0.9rem",
                                            lineHeight: 1,
                                        }}
                                    >
                    ×
                  </button>
                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bottom buttons */}
                <div
                    style={{
                        marginTop: "1.5rem",
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <button
                        type="button"
                        onClick={async () => {
                            try { await saveRemote(tournamentId); } catch {}
                            router.push(`/matches?t=${encodeURIComponent(tournamentId)}`);
                        }}
                        disabled={players.length < 4}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.45rem",
                            padding: "0.7rem 1.9rem",
                            borderRadius: "999px",
                            border: "none",
                            background:
                                players.length >= 4
                                    ? "linear-gradient(135deg, #38bdf8, #a855f7)"
                                    : "rgba(30,64,175,0.5)",
                            color: "#f9fafb",
                            fontWeight: 700,
                            fontSize: "0.9rem",
                            cursor: players.length >= 4 ? "pointer" : "not-allowed",
                            boxShadow:
                                players.length >= 4
                                    ? "0 14px 32px rgba(56,189,248,0.7)"
                                    : "none",
                        }}
                    >
                        <span>❄️</span>
                        <span>Randomize Courts</span>
                    </button>
                </div>
            </section>
        </main>
    );
}
