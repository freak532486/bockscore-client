import * as api from "./api";
import type { App } from "./app";
import { EVENT_RECONNECTED } from "./sse-handler";

const REMOVED_BY_STORAGE_PREFIX = "eliminationRemovedBy_";

export interface EliminationImportSettings
{
    entriesPerTable: number,
    weightedImport: boolean
}

export interface EliminationItem
{
    entry: api.EliminationEntry,
    removed: boolean,
    removedBy: string | null
}

/**
 * The elimination list of the selected ranking, kept in sync with the server and other clients. Dispatches
 * EVENT_CHANGED whenever the list changes.
 */
export class EliminationState extends EventTarget
{
    public static readonly EVENT_CHANGED = "changed";

    private rankingId: string | null = null;
    private serverEntries: Array<api.EliminationEntry> = [];

    /**
     * Removals cannot be undone until the next elimination starts, so own removals are applied on top of any server
     * state, including responses to requests that were sent before the removal was saved.
     */
    private readonly ownRemovals = new Set<string>();
    private pendingOwnEvents = 0;

    private removedBy = new Map<string, string>();
    private memberNames = new Map<string, string>();
    private syncGeneration = 0;

    constructor(private readonly app: App)
    {
        super();

        app.selectedRankingId.subscribe(() => this.onRankingChanged());

        app.sseHandler.subscribe("elimination_started", () => {
            this.resetRound();
            this.sync();
        });

        app.sseHandler.subscribe("elimination_changed", (_, senderId) => {
            if (senderId !== undefined && senderId === this.app.userId.value && this.pendingOwnEvents > 0) {
                this.pendingOwnEvents--;
                return;
            }

            this.sync(senderId);
        });

        app.sseHandler.subscribe(EVENT_RECONNECTED, () => this.sync());
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                this.sync();
            }
        });
    }

    /**
     * All entries, jokers first and then by name.
     */
    get items(): Array<EliminationItem>
    {
        return this.serverEntries
            .map(entry => ({
                entry,
                removed: this.isRemoved(entry),
                removedBy: this.removedBy.get(entry.entryId) ?? null
            }))
            .sort((a, b) => {
                if (a.entry.isJoker !== b.entry.isJoker) {
                    return a.entry.isJoker ? -1 : 1;
                }

                return a.entry.name.localeCompare(b.entry.name);
            });
    }

    get remainingEntryNames(): Array<string>
    {
        return this.items.filter(x => !x.removed).map(x => x.entry.name);
    }

    /**
     * Removes the entry. The change is applied immediately and reverted if the server rejects it.
     */
    async eliminate(entry: api.EliminationEntry)
    {
        const rankingId = this.rankingId;
        if (rankingId == null || this.isRemoved(entry)) {
            return;
        }

        this.ownRemovals.add(entry.entryId);
        this.pendingOwnEvents++;

        const userId = this.app.userId.value;
        const ownName = (userId == null ? undefined : this.memberNames.get(userId)) ?? this.app.username.value;
        if (ownName != null) {
            this.removedBy.set(entry.entryId, ownName);
            this.saveRemovedBy();
        }

        this.notifyChanged();
        this.app.messageBox.showMessage(`'${entry.name}' was removed.`);

        const res = await api.markOffEliminationEntry(this.app, rankingId, entry.entryId);
        if (res == "ok") {
            return;
        }

        if (rankingId === this.rankingId) {
            this.ownRemovals.delete(entry.entryId);
            this.pendingOwnEvents = Math.max(0, this.pendingOwnEvents - 1);
            this.removedBy.delete(entry.entryId);
            this.saveRemovedBy();
            this.notifyChanged();
        }

        this.app.errorDialog.showError(`An error occured while removing '${entry.name}'.`);
    }

    /**
     * Starts a new elimination with a random selection of entries from every table of the selected ranking. Jokers are
     * always included.
     */
    async importFromRanking(settings: EliminationImportSettings)
    {
        const rankingId = this.rankingId;
        if (rankingId == null) {
            return;
        }

        const selection: Array<string> = [];
        for (const tableHeader of await this.app.rankingAccess.getAllTablesForRanking(rankingId)) {
            const table = await this.app.rankingAccess.getTable(tableHeader.id);
            if (table == "error") {
                continue;
            }

            const jokers = table.rows.filter(x => x.jokerOf !== null);
            const candidates = table.rows
                .filter(x => x.jokerOf === null)
                .map(x => ({
                    id: x.id,
                    weight: settings.weightedImport ? (x.getAvgScore(table.header.scoreMode) ?? 0) : 1
                }));

            const count = Math.max(0, settings.entriesPerTable - jokers.length);
            selection.push(...jokers.map(x => x.id), ...weightedRandomSelection(candidates, count));
        }

        const res = await api.updateEliminationTable(this.app, rankingId, selection);
        if (res == "error") {
            this.app.errorDialog.showError("An error occured while updating the elimination list.");
            return;
        }

        this.resetRound();
        this.sync();
    }

    private onRankingChanged()
    {
        this.rankingId = this.app.selectedRankingId.value;
        this.serverEntries = [];
        this.ownRemovals.clear();
        this.pendingOwnEvents = 0;
        this.memberNames = new Map();
        this.removedBy = this.rankingId == null ? new Map() : loadRemovedBy(this.rankingId);
        this.notifyChanged();

        if (this.rankingId != null) {
            this.loadMemberNames(this.rankingId);
            this.sync();
        }
    }

    private async loadMemberNames(rankingId: string)
    {
        const members = await this.app.rankingAccess.getMembersForRanking(rankingId);
        if (rankingId !== this.rankingId) {
            return;
        }

        for (const member of members) {
            if (member.user) {
                this.memberNames.set(member.user.id, member.name);
            }
        }
    }

    private resetRound()
    {
        this.ownRemovals.clear();
        this.pendingOwnEvents = 0;
        this.removedBy.clear();
        this.saveRemovedBy();
    }

    private isRemoved(entry: api.EliminationEntry): boolean
    {
        return entry.markedOff || this.ownRemovals.has(entry.entryId);
    }

    /**
     * Fetches the elimination list and applies the differences. A sender id attributes newly removed entries to that
     * user.
     */
    private async sync(senderId?: string)
    {
        const rankingId = this.rankingId;
        if (rankingId == null) {
            return;
        }

        const generation = ++this.syncGeneration;
        const res = await api.getEliminationTable(this.app, rankingId);
        if (generation !== this.syncGeneration || rankingId !== this.rankingId) {
            return;
        }

        if (res == "error") {
            this.app.errorDialog.showError("There was an error fetching elimination list from server.");
            return;
        }

        const previousIds = new Set(this.serverEntries.map(x => x.entryId));
        const sameRound = previousIds.size == res.length && res.every(x => previousIds.has(x.entryId));

        if (sameRound) {
            const previous = new Map(this.serverEntries.map(x => [x.entryId, x]));
            for (const entry of res) {
                if (!entry.markedOff || this.isRemoved(previous.get(entry.entryId)!)) {
                    continue;
                }

                const remover = senderId === undefined ? undefined : this.memberNames.get(senderId);
                if (remover !== undefined) {
                    this.removedBy.set(entry.entryId, remover);
                }

                this.app.messageBox.showMessage(`'${entry.name}' was removed` + (remover === undefined ? "." : ` by ${remover}.`));
            }
        } else if (this.serverEntries.length > 0) {
            this.resetRound();
        }

        const ids = new Set(res.map(x => x.entryId));
        for (const entryId of [...this.removedBy.keys()]) {
            if (!ids.has(entryId)) {
                this.removedBy.delete(entryId);
            }
        }

        this.serverEntries = res;
        this.saveRemovedBy();
        this.notifyChanged();
    }

    private notifyChanged()
    {
        this.dispatchEvent(new CustomEvent(EliminationState.EVENT_CHANGED));
    }

    private saveRemovedBy()
    {
        if (this.rankingId == null) {
            return;
        }

        try {
            window.localStorage.setItem(
                REMOVED_BY_STORAGE_PREFIX + this.rankingId,
                JSON.stringify(Object.fromEntries(this.removedBy))
            );
        } catch {
        }
    }
}

function loadRemovedBy(rankingId: string): Map<string, string>
{
    try {
        const stored = window.localStorage.getItem(REMOVED_BY_STORAGE_PREFIX + rankingId);
        return new Map(Object.entries(stored == null ? {} : JSON.parse(stored) as Record<string, string>));
    } catch {
        return new Map();
    }
}

/**
 * Selects up to n distinct ids, each with a probability proportional to its weight. Entries with a weight of 0 are
 * never selected.
 */
function weightedRandomSelection(candidates: Array<{ id: string, weight: number }>, n: number): Array<string>
{
    const pool = candidates.filter(x => x.weight > 0);
    const result: Array<string> = [];

    n = Math.min(n, pool.length);

    for (let i = 0; i < n; i++) {
        const totalWeight = pool.reduce((sum, x) => sum + x.weight, 0);

        let r = Math.random() * totalWeight;
        let selected = pool.length - 1;
        for (let j = 0; j < pool.length; j++) {
            if (r < pool[j]!.weight) {
                selected = j;
                break;
            }

            r -= pool[j]!.weight;
        }

        result.push(pool.splice(selected, 1)[0]!.id);
    }

    return result;
}
