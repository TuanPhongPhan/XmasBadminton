import { Suspense } from "react";
import MatchesClient from "./MatchesClient";

export default function Page() {
    return (
        <Suspense fallback={<div style={{ padding: 24 }}>Loading matches…</div>}>
            <MatchesClient />
        </Suspense>
    );
}
