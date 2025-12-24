"use client";

import {
    createContext,
    useContext,
    useState,
    useMemo,
    useEffect,
    useCallback,
    ReactNode,
    Dispatch,
    SetStateAction,
} from "react";
import type { Player, Match, Side } from "@/app/lib/tournament";

type TournamentContextType = {
    players: Player[];
    setPlayers: Dispatch<SetStateAction<Player[]>>;
    addPlayer: (name: string) => boolean;
    removePlayer: (id: number) => void;
    resetTournament: () => void;

    roundNumber: number;
    setRoundNumber: Dispatch<SetStateAction<number>>;

    nextId: number;

    pastPartners: string[];
    addPartnerKeys: (keys: string[]) => void;

    currentMatches: Match[];
    setCurrentMatches: Dispatch<SetStateAction<Match[]>>;

    currentWinners: Record<number, Side>;
    setCurrentWinners: Dispatch<SetStateAction<Record<number, Side>>>;

    loadRemote: (tournamentId: string) => Promise<void>;
    saveRemote: (tournamentId: string) => Promise<void>;
    resetRemote: (tournamentId: string) => Promise<void>;
};

const TournamentContext = createContext<TournamentContextType | null>(null);

type StoredState = {
    players: Player[];
    roundNumber: number;
    pastPartners: string[];
    nextId: number;
    currentMatches: Match[];
    currentWinners: Record<number, Side>;
};

type TournamentState = StoredState & { updatedAt: number };

export function TournamentProvider({
                                       children,
                                       tournamentId,
                                   }: {
    children: ReactNode;
    tournamentId: string;
}) {
    const STORAGE_KEY = `tournament-state-v1:${tournamentId}`;

    const [players, setPlayers] = useState<Player[]>([]);
    const [roundNumber, setRoundNumber] = useState(0);
    const [pastPartners, setPastPartners] = useState<string[]>([]);
    const [nextId, setNextId] = useState(1);
    const [currentMatches, setCurrentMatches] = useState<Match[]>([]);
    const [currentWinners, setCurrentWinners] = useState<Record<number, Side>>({});

    const hydrateFromState = useCallback((data: Partial<StoredState>) => {
        if (Array.isArray(data.players)) {
            setPlayers(data.players);
            const maxId = data.players.reduce((m, p) => (p.id > m ? p.id : m), 0) ?? 0;
            const safeNextId =
                typeof data.nextId === "number" && data.nextId > maxId ? data.nextId : maxId + 1;
            setNextId(safeNextId);
        } else if (typeof data.nextId === "number") {
            setNextId(data.nextId);
        }

        if (typeof data.roundNumber === "number") setRoundNumber(data.roundNumber);
        if (Array.isArray(data.pastPartners)) setPastPartners(data.pastPartners);
        if (Array.isArray(data.currentMatches)) setCurrentMatches(data.currentMatches);
        if (data.currentWinners && typeof data.currentWinners === "object") {
            setCurrentWinners(data.currentWinners as Record<number, Side>);
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        setPlayers([]);
        setRoundNumber(0);
        setPastPartners([]);
        setNextId(1);
        setCurrentMatches([]);
        setCurrentWinners({});

        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        try {
            hydrateFromState(JSON.parse(raw));
        } catch {}
    }, [STORAGE_KEY, hydrateFromState]);

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
    }, [players, roundNumber, pastPartners, nextId, currentMatches, currentWinners, STORAGE_KEY]);

    const addPlayer = (name: string): boolean => {
        const trimmed = name.trim();
        if (!trimmed) return false;

        const exists = players.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
        if (exists) return false;

        setPlayers((prev) => [
            ...prev,
            { id: nextId, name: trimmed, score: 0, wins: 0, pointDiff: 0, lossStreak: 0 },
        ]);
        setNextId((n) => n + 1);
        return true;
    };

    const removePlayer = (id: number) => setPlayers((prev) => prev.filter((p) => p.id !== id));

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
        if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    };

    const loadRemote = useCallback(
        async (tid: string) => {
            const res = await fetch(`/api/tournament/${encodeURIComponent(tid)}`, { cache: "no-store" });
            if (!res.ok) return;

            let data: TournamentState | null = null;
            try {
                data = (await res.json()) as TournamentState | null;
            } catch {
                return;
            }
            if (!data) return;
            hydrateFromState(data);
        },
        [hydrateFromState]
    );

    const saveRemote = useCallback(
        async (tid: string) => {
            const payload: TournamentState = {
                players,
                roundNumber,
                pastPartners,
                nextId,
                currentMatches,
                currentWinners,
                updatedAt: Date.now(),
            };

            const res = await fetch(`/api/tournament/${encodeURIComponent(tid)}`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Failed to save tournament to server");
        },
        [players, roundNumber, pastPartners, nextId, currentMatches, currentWinners]
    );

    const resetRemote = useCallback(async (tid: string) => {
        const payload: TournamentState = {
            players: [],
            roundNumber: 0,
            pastPartners: [],
            nextId: 1,
            currentMatches: [],
            currentWinners: {},
            updatedAt: Date.now(),
        };

        const res = await fetch(`/api/tournament/${encodeURIComponent(tid)}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Failed to reset tournament on server");
    }, []);

    const value = useMemo(
        () => ({
            players,
            setPlayers,
            addPlayer,
            removePlayer,
            resetTournament,
            roundNumber,
            setRoundNumber,
            nextId,
            pastPartners,
            addPartnerKeys,
            currentMatches,
            setCurrentMatches,
            currentWinners,
            setCurrentWinners,
            loadRemote,
            saveRemote,
            resetRemote,
        }),
        [players, roundNumber, nextId, pastPartners, currentMatches, currentWinners, loadRemote, saveRemote, resetRemote]
    );

    return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournament() {
    const ctx = useContext(TournamentContext);
    if (!ctx) throw new Error("useTournament must be used inside TournamentProvider");
    return ctx;
}
