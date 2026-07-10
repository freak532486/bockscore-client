import template from "./tab-elimination.html"
import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { TabEliminationCardComponent } from "./tab-elimination-card";
import { EliminationImportDialog, type EliminationImportSettings } from "./elimination-import-dialog";
import * as api from "../common/api"

export class EliminationTabComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly importDialog = new EliminationImportDialog();

    private _entries: Array<api.EliminationEntry>;

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        document.body.appendChild(this.importDialog.view);

        /* Fetch state from API */
        this._entries = [];
        const syncWithServer = async () => {
            this._entries = [];

            if (this.app.selectedRankingId.value == null) {
                this.updateView();
                return;
            }

            const res = await api.getEliminationTable(app, this.app.selectedRankingId.value);
            if (res == "error") {
                app.errorDialog.showError("There was an error fetching elimination list from server.");
                this.updateView();
                return;
            }

            this._entries = res;
            this.updateView();
        }

        app.selectedRankingId.subscribe(() => syncWithServer());
        app.sseHandler.subscribe("elimination_changed", data => {
            const rankingId = (data?.rankingId || null) as string | null;
            if (rankingId !== app.selectedRankingId.value) {
                return;
            }

            syncWithServer();
        });

        /* Make import button work */
        const btnImport = this.view.querySelector("#btn-elimination-import") as HTMLButtonElement;
        btnImport.onclick = () => this.importDialog.show(settings => this.performImport(settings));
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

            const entries = [];
            for (const row of table.rows) {
                entries.push({
                    "id": row.id,
                    "name": row.name,
                    "score": settings.weightedImport ? (row.getAvgScore(table.header.scoreMode) || 0) : 1,
                    "markedOff": false
                });
            }

            const selection = weightedRandomSelection(entries, settings.entriesPerTable);
            result.push(...selection);
        }

        /* Sort by name */
        result.sort((a, b) => a.name.localeCompare(b.name));

        /* Update using API */
        const apiResponse = await api.updateEliminationTable(this.app, this.app.selectedRankingId.value, result.map(x => x.id));
        if (apiResponse == "error") {
            this.app.errorDialog.showError("An error occured while updating the elimination list.");
            return;
        }
    }

    private async updateView()
    {
        const games = this.view.querySelector(".games") as HTMLElement;
        games.replaceChildren();

        const spanRemaining = this.view.querySelector("#span-remaining") as HTMLElement;
        const spanCurrent = this.view.querySelector("#num-current") as HTMLElement;
        const spanTotal = this.view.querySelector("#num-total") as HTMLElement;

        if (this.app.selectedRankingId.value == null) {
            spanRemaining.classList.add("invisible");
            return;
        }

        let current = 0;
        let total = 0;
        spanRemaining.classList.toggle("invisible", this._entries.length == 0);
        for (const entry of this._entries) {
            total += 1;
            if (entry.markedOff) {
                continue;
            }

            current += 1;
            const row = await this.app.rankingAccess.getEntry(this.app.selectedRankingId.value, entry.entryId);
            if (row == null) {
                continue;
            }

            games.appendChild(new TabEliminationCardComponent(row.name, async () => {
                if (this.app.selectedRankingId.value === null) {
                    this.app.errorDialog.showError("No ranking is active.");
                    return;
                }

                /* Mark off using API */
                const res = await api.markOffEliminationEntry(this.app, this.app.selectedRankingId.value, entry.entryId);
                if (res == "error") {
                    this.app.errorDialog.showError("An error occured while syncing elimination list state to server.");
                    return;
                }
            }).view);
        }

        spanRemaining.classList.toggle("text-danger", current > total / 2);
        spanRemaining.classList.toggle("text-success", current <= total / 2);
        spanCurrent.textContent = String(current);
        spanTotal.textContent = String(total);
    }

    get entries() {
        return this._entries;
    }
}

interface Entry
{
    id: string,
    name: string,
    score: number,
    markedOff: boolean
}

function weightedRandomSelection(entries: Array<Entry>, n: number): Array<Entry>
{
    const pool = [...entries];
    const result: Array<Entry> = [];

    n = Math.min(n, pool.length);

    for (let i = 0; i < n; i++) {
        const totalWeight = pool.map(x => x.score).reduce((a, b) => a + b, 0);

        let r = Math.random() * totalWeight;

        for (let j = 0; j < pool.length; j++) {
            const key = pool[j]!.name;
            const weight = pool[j]!.score;

            if (r < weight) {
                result.push(pool[j]!);
                pool.splice(j, 1); // Remove so it can't be selected again
                break;
            }

            r -= weight;
        }
    }

    return result;
}