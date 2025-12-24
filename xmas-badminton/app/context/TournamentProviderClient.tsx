"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TournamentProvider } from "./TournamentContext";

function Inner({ children }: { children: React.ReactNode }) {
    const sp = useSearchParams();
    const tournamentId = sp.get("t") ?? "default";
    return <TournamentProvider tournamentId={tournamentId}>{children}</TournamentProvider>;
}

export default function TournamentProviderClient({
                                                     children,
                                                 }: {
    children: React.ReactNode;
}) {
    return (
        <Suspense
            // IMPORTANT: do NOT render `children` here, or hooks will run without the provider
            fallback={<div style={{ minHeight: "100vh" }} />}
        >
            <Inner>{children}</Inner>
        </Suspense>
    );
}
