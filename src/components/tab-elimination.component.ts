import template from "./tab-elimination.html"
import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { TabEliminationCardComponent } from "./tab-elimination-card.component";
import { EliminationImportDialog, type EliminationImportSettings } from "./elimination-import-dialog.component";

export class EliminationTabComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly importDialog = new EliminationImportDialog();

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        document.body.appendChild(this.importDialog.view);

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
            const entries = new Map<string, number>();
            for (const row of table.rows) {
                entries.set(row.name, settings.weightedImport ? row.getAvgScore("MEAN") : 1);
            }

            const selection = weightedRandomSelection(entries, settings.entriesPerTable);
            console.log(settings.entriesPerTable + ", " + selection.length);
            result.push(...selection);
        }

        /* Sort by name */
        result.sort();

        /* Update view */
        const games = this.view.querySelector(".games") as HTMLElement;
        games.replaceChildren();

        for (const entry of result) {
            games.appendChild(new TabEliminationCardComponent(entry, () => {}).view);
        }
    }
}

function weightedRandomSelection(entries: Map<string, number>, n: number): Array<string>
{
    const pool = [...entries.entries()];
    const result: string[] = [];

    n = Math.min(n, pool.length);

    for (let i = 0; i < n; i++) {
        
        const totalWeight = pool.map(x => x[1]).reduce((a, b) => a + b, 0);

        let r = Math.random() * totalWeight;

        for (let j = 0; j < pool.length; j++) {
            const [key, weight] = pool[j]!;

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