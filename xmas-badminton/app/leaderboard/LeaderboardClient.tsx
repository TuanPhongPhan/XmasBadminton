"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTournament } from "@/app/context/TournamentContext";
import { sortLeaderboard } from "@/app/lib/tournament";

const IOS_FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
"Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`;

/* =========================
   Fullscreen helpers
========================= */

function canFullscreen() {
    if (typeof document === "undefined") return false;
    const doc = document as any;
    return Boolean(
        document.documentElement &&
        (document.fullscreenEnabled || doc.webkitFullscreenEnabled)
    );
}

async function enterFullscreen(el: HTMLElement) {
    const anyEl = el as any;
    if (el.requestFullscreen) return el.requestFullscreen();
    if (anyEl.webkitRequestFullscreen) return anyEl.webkitRequestFullscreen();
}

async function exitFullscreen() {
    const doc = document as any;
    if (document.exitFullscreen) return document.exitFullscreen();
    if (doc.webkitExitFullscreen) return doc.webkitExitFullscreen();
}

/* =========================
   Component
========================= */

export default function LeaderboardClient() {
    const { players, roundNumber, loadRemote } = useTournament();
    const searchParams = useSearchParams();
    const tournamentId = searchParams.get("t") ?? "default";

    const leaderboard = sortLeaderboard(players);

    /* ---------- Fullscreen state (hydration-safe) ---------- */

    const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Enable fullscreen ONLY after mount
    useEffect(() => {
        setFullscreenAvailable(canFullscreen());
    }, []);

    // Listen for fullscreen changes
    useEffect(() => {
        if (!fullscreenAvailable) return;

        const handler = () => {
            const doc = document as any;
            setIsFullscreen(
                Boolean(document.fullscreenElement || doc.webkitFullscreenElement)
            );
        };

        document.addEventListener("fullscreenchange", handler);
        document.addEventListener("webkitfullscreenchange", handler);
        handler();

        return () => {
            document.removeEventListener("fullscreenchange", handler);
            document.removeEventListener("webkitfullscreenchange", handler);
        };
    }, [fullscreenAvailable]);

    /* ---------- Visibility-aware polling ---------- */

    useEffect(() => {
        const POLL_MS = 15000;

        let timer: ReturnType<typeof setTimeout> | null = null;
        let inFlight = false;
        let stopped = false;
        let count = 0;

        const clear = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        const scheduleNext = () => {
            clear();
            if (stopped) return;
            timer = setTimeout(tick, POLL_MS);
        };

        const tick = async () => {
            if (stopped) return;

            // Only poll when visible (universal & battery-safe)
            if (document.visibilityState !== "visible") {
                clear();
                return;
            }

            // Prevent overlapping requests
            if (inFlight) {
                timer = setTimeout(tick, 500);
                return;
            }

            inFlight = true;
            count++;

            try {
                await loadRemote(tournamentId);
            } catch (e) {
                console.warn("[Leaderboard] poll failed", e);
            } finally {
                inFlight = false;
                scheduleNext();
            }
        };

        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                clear();
                tick(); // immediate refresh when returning
            } else {
                clear();
            }
        };

        // start immediately
        tick();

        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            stopped = true;
            clear();
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [tournamentId, loadRemote]);



    /* =========================
       Render
    ========================= */

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
            <header style={{ textAlign: "center", marginBottom: "1.2rem" }}>
                <h1
                    style={{
                        fontSize: "2.4rem",
                        fontWeight: 800,
                        color: "#e4ba10",
                        textShadow: "0 6px 25px rgba(250,204,21,0.55)",
                    }}
                >
                    👑 Christmas Leaderboard
                </h1>

                <p style={{ color: "#e5e7eb", fontSize: "0.95rem", opacity: 0.9 }}>
                    Sorted by wins, then point difference
                </p>

                <p style={{ marginTop: "0.4rem", fontSize: "0.85rem", color: "#9ca3af" }}>
                    Rounds played:{" "}
                    <strong style={{ color: "#facc15" }}>{roundNumber}</strong>
                </p>

                {fullscreenAvailable && (
                    <div style={{ marginTop: "0.8rem" }}>
                        <button
                            onClick={() =>
                                isFullscreen
                                    ? exitFullscreen()
                                    : enterFullscreen(document.documentElement)
                            }
                            style={{
                                padding: "0.45rem 1.1rem",
                                borderRadius: "999px",
                                border: "1px solid rgba(148,163,184,0.6)",
                                background: "rgba(15,23,42,0.65)",
                                color: "#e5e7eb",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                            }}
                        >
                            {isFullscreen ? "🧩 Exit Fullscreen" : "🖥️ Fullscreen"}
                        </button>
                    </div>
                )}
            </header>

            <section
                style={{
                    width: "100%",
                    maxWidth: "760px",
                    borderRadius: "1.5rem",
                    padding: "1.5rem 1.75rem",
                    background:
                        "linear-gradient(145deg, rgba(15,23,42,0.9), rgba(15,23,42,0.98))",
                    border: "1px solid rgba(148,163,184,0.5)",
                    boxShadow: "0 22px 50px rgba(15,23,42,0.9)",
                    color: "#e5e7eb",
                }}
            >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                    <tr style={{ borderBottom: "1px solid rgba(55,65,81,0.9)" }}>
                        <th style={{ padding: "0.5rem", width: "2.5rem" }}>#</th>
                        <th style={{ padding: "0.5rem" }}>Player</th>
                        <th style={{ padding: "0.5rem", textAlign: "right" }}>Wins</th>
                        <th style={{ padding: "0.5rem", textAlign: "right" }}>+/-</th>
                    </tr>
                    </thead>
                    <tbody>
                    {leaderboard.map((p, index) => (
                        <tr key={p.id}>
                            <td style={{ padding: "0.4rem", fontWeight: 700 }}>
                                {index + 1}
                            </td>
                            <td style={{ padding: "0.4rem" }}>
                                {index === 0 && "👑 "}
                                {index === 1 && "🥈 "}
                                {index === 2 && "🥉 "}
                                {p.name}
                            </td>
                            <td
                                style={{
                                    padding: "0.4rem",
                                    textAlign: "right",
                                    fontWeight: 700,
                                }}
                            >
                                {p.wins}
                            </td>
                            <td
                                style={{
                                    padding: "0.4rem",
                                    textAlign: "right",
                                    fontWeight: 700,
                                    color: p.pointDiff >= 0 ? "#4ade80" : "#f87171",
                                }}
                            >
                                {p.pointDiff >= 0 ? `+${p.pointDiff}` : p.pointDiff}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </section>
        </main>
    );
}
