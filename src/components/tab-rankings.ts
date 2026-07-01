import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./tab-rankings.html"
import { MobileScoreTableComponent } from "./score-table.mobile";
import { RowDetailsDialog } from "./row-details.mobile";

export class RankingsTabComponent implements Component
{
    public readonly view: HTMLElement;

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        const detailDialog = new RowDetailsDialog();
        document.body.appendChild(detailDialog.view);

        const nav = this.view.querySelector("nav") as HTMLElement;
        const ul = this.view.querySelector("ul") as HTMLElement;
        /* Update tables whenever ranking selection changes */
        const updateTables = async () => {
            app.inputBlocker.runWithBlockedInput(async () => {
                app.inputBlocker.setEnabled(true);
                ul.replaceChildren();

                if (app.selectedRankingId.value == null || !app.rankingCache.has(app.selectedRankingId.value)) {
                    nav.classList.toggle("d-none", true);
                    return;
                }

                const tables = [...app.rankingCache.get(app.selectedRankingId.value)!.values()];

                if (tables.length == 0) {
                    nav.classList.toggle("d-none", true);
                    return;
                }

                nav.classList.toggle("d-none", false);

                for (const table of tables) {
                    const li = document.createElement("li");
                    li.classList.add("nav-item");
                    const btn = document.createElement("button");
                    btn.classList.add("nav-link");
                    btn.textContent = table.header.name;
                    btn.onclick = () => app.selectedTableId.value = table.id;
                    li.appendChild(btn);
                    ul.appendChild(li);
                    app.selectedTableId.subscribe(() => {
                        btn.classList.toggle("active", app.selectedTableId.value == table.id);
                    });
                }



                this.app.selectedTableId.value = tables[0]!.id;
            });
        };

        app.selectedRankingId.subscribe(() => updateTables());
        updateTables();

        /* Also update tables every time the logged in user changes */
        app.userId.subscribe(() => updateTables());

        /* Create a table view whenever a table is selected */
        const updateTable = async () => {
            try {
                app.inputBlocker.setEnabled(true);
                const tableView = this.view.querySelector("#table-view") as HTMLElement;
                tableView.replaceChildren();

                if (app.selectedRankingId.value == null || app.selectedTableId.value == null) {
                    return;
                }

                const table = app.rankingCache.get(app.selectedRankingId.value)?.get(app.selectedTableId.value);

                if (table == undefined) {
                    app.errorDialog.showError("The selected table does not exist.");
                } else {
                    const tableComp = new MobileScoreTableComponent(app, table, detailDialog);
                    tableView.appendChild(tableComp.view);
                }
            } finally {
                app.inputBlocker.setEnabled(false);
            }
        };

        app.selectedTableId.subscribe(() => updateTable());
        updateTable();
    }
}