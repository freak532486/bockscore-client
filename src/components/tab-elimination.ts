import * as api from "../common/api";
import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { ConfirmDialog } from "./confirm-dialog";
import { EliminationImportDialog, type EliminationImportSettings } from "./elimination-import-dialog";
import { TabEliminationCardComponent } from "./tab-elimination-card";
import "./tab-elimination.css";
import template from "./tab-elimination.html";

const REMOVED_BY_STORAGE_PREFIX = "eliminationRemovedBy_";

export class EliminationTabComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly importDialog = new EliminationImportDialog();
    private readonly confirmDialog = new ConfirmDialog();
    private readonly games: HTMLElement;
    private readonly cards = new Map<string, TabEliminationCardComponent>();

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

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        this.games = this.view.querySelector(".games") as HTMLElement;
        document.body.appendChild(this.importDialog.view);
        document.body.appendChild(this.confirmDialog.view);

        app.selectedRankingId.subscribe(() => this.onRankingChanged());

        app.sseHandler.subscribe("elimination_started", () => {
            this.resetRound();
            this.syncWithServer();
        });

        app.sseHandler.subscribe("elimination_changed", (_, senderId) => {
            if (senderId !== undefined && senderId === this.app.userId.value && this.pendingOwnEvents > 0) {
                this.pendingOwnEvents--;
                return;
            }

            this.syncWithServer(senderId);
        });

        const btnImport = this.view.querySelector("#btn-elimination-import") as HTMLButtonElement;
        btnImport.onclick = () => this.importDialog.show(settings => this.performImport(settings));
    }

    /**
     * Names of all entries that have not been removed yet.
     */
    get remainingEntryNames(): Array<string> {
        return this.sortedEntries().filter(x => !x.removed).map(x => x.entry.name);
    }

    private onRankingChanged()
    {
        this.rankingId = this.app.selectedRankingId.value;
        this.serverEntries = [];
        this.ownRemovals.clear();
        this.pendingOwnEvents = 0;
        this.memberNames = new Map();
        this.removedBy = this.rankingId == null ? new Map() : loadRemovedBy(this.rankingId);
        this.render();

        if (this.rankingId != null) {
            this.loadMemberNames(this.rankingId);
            this.syncWithServer();
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
     * Fetches the elimination list and applies the differences to the view. A sender id attributes newly removed
     * entries to that user.
     */
    private async syncWithServer(senderId?: string)
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
        this.render();
    }

    private async eliminate(entry: api.EliminationEntry)
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

        this.render();
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
            this.render();
        }

        this.app.errorDialog.showError(`An error occured while removing '${entry.name}'.`);
    }

    private sortedEntries(): Array<{ entry: api.EliminationEntry, removed: boolean }>
    {
        return this.serverEntries
            .map(entry => ({ entry, removed: this.isRemoved(entry) }))
            .sort((a, b) => {
                if (a.entry.isJoker !== b.entry.isJoker) {
                    return a.entry.isJoker ? -1 : 1;
                }

                return a.entry.name.localeCompare(b.entry.name);
            });
    }

    /**
     * Updates the view in place. Rows are only created, removed or moved when necessary, so nothing flickers and
     * loaded images are kept.
     */
    private render()
    {
        const sorted = this.sortedEntries();

        const ids = new Set(sorted.map(x => x.entry.entryId));
        for (const [entryId, card] of this.cards) {
            if (!ids.has(entryId)) {
                card.view.remove();
                this.cards.delete(entryId);
            }
        }

        let previous: Element | null = null;
        for (const { entry, removed } of sorted) {
            let card = this.cards.get(entry.entryId);
            if (card === undefined) {
                card = this.createCard(entry);
                this.cards.set(entry.entryId, card);
            }

            card.update(entry, removed, this.removedBy.get(entry.entryId) ?? null);

            const expectedPosition: Element | null = previous === null ? this.games.firstElementChild : previous.nextElementSibling;
            if (expectedPosition !== card.view) {
                this.games.insertBefore(card.view, expectedPosition);
            }

            previous = card.view;
        }

        const remaining = sorted.filter(x => !x.removed).length;
        const spanRemaining = this.view.querySelector("#span-remaining") as HTMLElement;
        spanRemaining.classList.toggle("invisible", sorted.length == 0);
        spanRemaining.classList.toggle("text-danger", remaining > sorted.length / 2);
        spanRemaining.classList.toggle("text-success", remaining <= sorted.length / 2);
        (this.view.querySelector("#num-current") as HTMLElement).textContent = String(remaining);
        (this.view.querySelector("#num-total") as HTMLElement).textContent = String(sorted.length);
    }

    private createCard(entry: api.EliminationEntry): TabEliminationCardComponent
    {
        const loadImage = entry.hasImage ?
            () => this.app.rankingAccess.getEntryImage(entry.entryId) :
            () => Promise.resolve(undefined);

        const card: TabEliminationCardComponent = new TabEliminationCardComponent(entry, loadImage, this.app.imageViewer, () => {
            const current = card.entry;
            this.confirmDialog.show(`Do you want to eliminate '${current.name}'?`, () => this.eliminate(current));
        });

        return card;
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

    private async performImport(settings: EliminationImportSettings)
    {
        /* Perform the random selection */
        const result: Array<Entry> = [];

        if (this.app.selectedRankingId.value == null) {
            return;
        }

        const tableHeaders = await this.app.rankingAccess.getAllTablesForRanking(this.app.selectedRankingId.value);
        for (const tableHeader of tableHeaders) {
            const table = await this.app.rankingAccess.getTable(tableHeader.id);
            if (table == "error") {
                continue;
            }

            const jokers: Array<Entry> = [];
            const nonJokers: Array<Entry> = [];
            for (const row of table.rows) {
                const entry: Entry = {
                    "id": row.id,
                    "name": row.name,
                    "score": settings.weightedImport ? (row.getAvgScore(table.header.scoreMode) || 0) : 1,
                    "markedOff": false,
                    "isJoker": row.jokerOf !== null
                }

                if (row.jokerOf !== null) {
                    jokers.push(entry);
                } else {
                    nonJokers.push(entry);
                }
            }

            const selection = weightedRandomSelection(nonJokers, Math.max(0, settings.entriesPerTable - jokers.length));
            result.push(...jokers, ...selection);
        }

        /* Update using API */
        const apiResponse = await api.updateEliminationTable(this.app, this.app.selectedRankingId.value, result.map(x => x.id));
        if (apiResponse == "error") {
            this.app.errorDialog.showError("An error occured while updating the elimination list.");
            return;
        }

        this.resetRound();
        this.syncWithServer();
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

interface Entry
{
    id: string,
    name: string,
    score: number,
    markedOff: boolean,
    isJoker: boolean
}

function weightedRandomSelection(entries: Array<Entry>, n: number): Array<Entry>
{
    const pool = entries.filter(x => x.score > 0);
    const result: Array<Entry> = [];

    n = Math.min(n, pool.length);

    for (let i = 0; i < n; i++) {
        const totalWeight = pool.map(x => x.score).reduce((a, b) => a + b, 0);

        let r = Math.random() * totalWeight;
        let selected = pool.length - 1;
        for (let j = 0; j < pool.length; j++) {
            if (r < pool[j]!.score) {
                selected = j;
                break;
            }

            r -= pool[j]!.score;
        }

        result.push(...pool.splice(selected, 1));
    }

    return result;
}
