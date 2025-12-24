import { Suspense } from "react";
import PlayersClient from "./PlayersClient";

export default function Page() {
    return (
        <Suspense fallback={<div style={{ padding: 24 }}>Loading players…</div>}>
            <PlayersClient />
        </Suspense>
    );
}
