"use client";

import { useRouter } from "next/navigation";

const IOS_FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
"Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`;

function generateTournamentId() {
  // Prefer UUID when available ( the best uniqueness)
  const uuid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `xmas-${uuid}`; // readable prefix
}

export default function HomePage() {
  const router = useRouter();

  const handleStart = () => {
    const t = generateTournamentId();
    router.push(`/players?t=${encodeURIComponent(t)}`);
  };

  return (
      <main
          style={{
            minHeight: "100vh",
            padding: "3rem 1rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: IOS_FONT,
            textAlign: "center",
            background:
                "linear-gradient(180deg, #020617 0%, #0f172a 40%, #020617 100%)",
          }}
      >
        <div
            style={{
              width: "100%",
              maxWidth: "720px",
              borderRadius: "1.5rem",
              padding: "2rem 2rem",
              background:
                  "linear-gradient(145deg, rgba(15,23,42,0.9), rgba(17,24,39,0.95))",
              border: "1px solid rgba(148,163,184,0.5)",
              boxShadow:
                  "0 22px 50px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.7)",
              backdropFilter: "blur(24px)",
            }}
        >
          <h1
              style={{
                fontSize: "2.4rem",
                fontWeight: 800,
                color: "#f97373",
                textShadow: "0 6px 25px rgba(248,113,113,0.45)",
                letterSpacing: 0.4,
                marginBottom: "0.5rem",
              }}
          >
            🎄 Xmas Badminton Tournament
          </h1>

          <p style={{ color: "#e5e7eb", fontSize: "0.95rem", opacity: 0.9 }}>
            Create a new tournament link and start adding players.
          </p>

          <div style={{ marginTop: "1.6rem", display: "flex", justifyContent: "center" }}>
            <button
                type="button"
                onClick={handleStart}
                style={{
                  padding: "0.85rem 1.6rem",
                  borderRadius: "999px",
                  border: "none",
                  background: "linear-gradient(135deg, #22c55e, #4ade80)",
                  color: "#0f172a",
                  fontWeight: 800,
                  fontSize: "1rem",
                  cursor: "pointer",
                  boxShadow: "0 14px 32px rgba(34,197,94,0.55)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
            >
              <span>▶️</span>
              <span>Start Tournament</span>
            </button>
          </div>

          <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#9ca3af" }}>
            Tip: share the Leaderboard URL after you start so everyone follows the same tournament.
          </p>
        </div>
      </main>
  );
}
