import template from "./tab-elimination.html"
import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { TabEliminationCardComponent } from "./tab-elimination-card";
import { EliminationImportDialog, type EliminationImportSettings } from "./elimination-import-dialog";

export class EliminationTabComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly importDialog = new EliminationImportDialog();

    private originalNumEntries: number = 0;
    private _entries: Array<string>;

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        document.body.appendChild(this.importDialog.view);

        this._entries = [];

        /* Make import button work */
        const btnImport = this.view.querySelector("#btn-elimination-import") as HTMLButtonElement;
        btnImport.onclick = () => this.importDialog.show(settings => this.performImport(settings));
    }

    private performImport(settings: EliminationImportSettings)
    {
        /* Perform the random selection */
        const result: Array<string> = [];

        if (this.app.selectedRankingId.value == null) {
            return;
        }

        const tableMap = this.app.rankingCache.get(this.app.selectedRankingId.value);
        if (tableMap == undefined) {
            return;
        }

        for (const table of tableMap.values()) {
            const entries = [];
            for (const row of table.rows) {
                entries.push({
                    "name": row.name,
                    "score": settings.weightedImport ? row.getAvgScore("MEAN") : 1
                });
            }

            const selection = weightedRandomSelection(entries, settings.entriesPerTable);
            result.push(...selection);
        }

        /* Sort by name */
        result.sort();

        /* Update view */
        const games = this.view.querySelector(".games") as HTMLElement;
        games.replaceChildren();

        const spanRemaining = this.view.querySelector("#span-remaining") as HTMLElement;
        const spanCurrent = this.view.querySelector("#num-current") as HTMLElement;
        const spanTotal = this.view.querySelector("#num-total") as HTMLElement;

        for (const entry of result) {
            games.appendChild(new TabEliminationCardComponent(entry, () => {
                /* Update remaining view */
                const numCurrent = games.children.length;
                spanCurrent.textContent = String(numCurrent);
                spanRemaining.classList.toggle("text-danger", numCurrent > this.originalNumEntries / 2);
                spanRemaining.classList.toggle("text-success", numCurrent <= this.originalNumEntries / 2);

                /* Update state */
                this._entries.splice(this._entries.findIndex(x => x == entry), 1);
            }).view);
        }

        spanRemaining.classList.remove("invisible");
        spanRemaining.classList.toggle("text-danger", true);
        this._entries = result;
        this.originalNumEntries = result.length;
        spanCurrent.textContent = String(this.originalNumEntries);
        spanTotal.textContent = String(this.originalNumEntries);
    }

    get entries() {
        return this._entries;
    }
}

interface Entry
{
    name: string,
    score: number
}

function weightedRandomSelection(entries: Array<Entry>, n: number): Array<string>
{
    const pool = [...entries];
    const result: string[] = [];

    n = Math.min(n, pool.length);

    for (let i = 0; i < n; i++) {
        const totalWeight = pool.map(x => x.score).reduce((a, b) => a + b, 0);

        let r = Math.random() * totalWeight;

        for (let j = 0; j < pool.length; j++) {
            const key = pool[j]!.name;
            const weight = pool[j]!.score;

            if (r < weight) {
                result.push(key);
                pool.splice(j, 1); // Remove so it can't be selected again
                break;
            }

            r -= weight;
        }
    }

    return result;
}