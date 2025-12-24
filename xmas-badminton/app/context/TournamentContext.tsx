"use client";

import {
    createContext,
    useContext,
    useState,
    useMemo,
    useEffect,
    ReactNode,
    Dispatch,
    SetStateAction,
} from "react";
import type { Player, Match, Side } from "@/app/lib/tournament";

const STORAGE_KEY = "tournament-state-v1";

/* =========================
   Context Types
========================= */

type TournamentContextType = {
    players: Player[];
    setPlayers: Dispatch<SetStateAction<Player[]>>;
    addPlayer: (name: string) => boolean;
    removePlayer: (id: number) => void;
    resetTournament: () => void;

    roundNumber: number;
    setRoundNumber: Dispatch<SetStateAction<number>>;

    pastPartners: string[];
    addPartnerKeys: (keys: string[]) => void;

    currentMatches: Match[];
    setCurrentMatches: Dispatch<SetStateAction<Match[]>>;

    currentWinners: Record<number, Side>;
    setCurrentWinners: Dispatch<SetStateAction<Record<number, Side>>>;

    loadRemote: (tournamentId: string) => Promise<void>;
    saveRemote: (tournamentId: string) => Promise<void>;
};

const TournamentContext = createContext<TournamentContextType | null>(null);

/* =========================
   Stored / Remote Types
========================= */

type StoredState = {
    players: Player[];
    roundNumber: number;
    pastPartners: string[];
    nextId: number;
    currentMatches: Match[];
    currentWinners: Record<number, Side>;
};

type TournamentState = StoredState & {
    updatedAt: number;
};

/* =========================
   Provider
========================= */

export function TournamentProvider({ children }: { children: ReactNode }) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [roundNumber, setRoundNumber] = useState(0);
    const [pastPartners, setPastPartners] = useState<string[]>([]);
    const [nextId, setNextId] = useState(1);
    const [currentMatches, setCurrentMatches] = useState<Match[]>([]);
    const [currentWinners, setCurrentWinners] = useState<Record<number, Side>>({});

    /* =========================
       LocalStorage helpers
    ========================= */

    const hydrateFromState = (data: Partial<StoredState>) => {
        if (Array.isArray(data.players)) {
            setPlayers(data.players);
            const maxId =
                data.players.reduce((m, p) => (p.id > m ? p.id : m), 0) ?? 0;
            setNextId(
                typeof data.nextId === "number" && data.nextId > maxId
                    ? data.nextId
                    : maxId + 1
            );
        }
        if (typeof data.roundNumber === "number") setRoundNumber(data.roundNumber);
        if (Array.isArray(data.pastPartners)) setPastPartners(data.pastPartners);
        if (Array.isArray(data.currentMatches))
            setCurrentMatches(data.currentMatches);
        if (data.currentWinners && typeof data.currentWinners === "object")
            setCurrentWinners(data.currentWinners);
    };

    useEffect(() => {
        if (typeof window === "undefined") return;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            hydrateFromState(JSON.parse(raw));
        } catch {
            /* ignore corrupted state */
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const toStore: StoredState = {
            players,
            roundNumber,
            pastPartners,
            nextId,
            currentMatches,
            currentWinners,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    }, [
        players,
        roundNumber,
        pastPartners,
        nextId,
        currentMatches,
        currentWinners,
    ]);

    /* =========================
       Player helpers
    ========================= */

    const addPlayer = (name: string): boolean => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        const exists = players.some(
            (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) return false;

        setPlayers((prev) => [...prev, { id: nextId, name: trimmed, score: 0 }]);
        setNextId((n) => n + 1);
        return true;
    };

    const removePlayer = (id: number) => {
        setPlayers((prev) => prev.filter((p) => p.id !== id));
    };

    const addPartnerKeys = (keys: string[]) => {
        setPastPartners((prev) => {
            const set = new Set(prev);
            keys.forEach((k) => set.add(k));
            return Array.from(set);
        });
    };

    const resetTournament = () => {
        setPlayers([]);
        setRoundNumber(0);
        setPastPartners([]);
        setNextId(1);
        setCurrentMatches([]);
        setCurrentWinners({});
        if (typeof window !== "undefined") {
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    /* =========================
       Remote (Vercel KV)
    ========================= */

    const loadRemote = async (tournamentId: string) => {
        const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`, {
            cache: "no-store",
        });
        const data = (await res.json()) as TournamentState | null;
        if (!data) return;

        hydrateFromState(data);
    };

    const saveRemote = async (tournamentId: string) => {
        const payload: TournamentState = {
            players,
            roundNumber,
            pastPartners,
            nextId,
            currentMatches,
            currentWinners,
            updatedAt: Date.now(),
        };

        const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`, {
            method: "PUT",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error("Failed to save tournament to server");
        }
    };


    /**
     * Context Value
     */

    const value = useMemo(
        () => ({
            players,
            setPlayers,
            addPlayer,
            removePlayer,
            resetTournament,
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
        }),
        [players, roundNumber, pastPartners, currentMatches, currentWinners]
    );

    return (
        <TournamentContext.Provider value={value}>
            {children}
        </TournamentContext.Provider>
    );
}

/* =========================
   Hook
========================= */

export function useTournament() {
    const ctx = useContext(TournamentContext);
    if (!ctx) {
        throw new Error("useTournament must be used inside TournamentProvider");
    }
    return ctx;
}
