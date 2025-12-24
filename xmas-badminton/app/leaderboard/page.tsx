import { Suspense } from "react";
import LeaderboardClient from "./LeaderboardClient";

export default function Page() {
    return (
        <Suspense fallback={<div style={{ padding: 24 }}>Loading leaderboard…</div>}>
            <LeaderboardClient />
        </Suspense>
    );
}
