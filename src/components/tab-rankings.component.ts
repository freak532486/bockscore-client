import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./tab-rankings.html"
import * as api from "../common/api"
import { ScoreTableComponent } from "./score-table.component";
import { ScoreTableWrapper } from "../common/table-wrapper";
import { MobileScoreTableComponent } from "./score-table.mobile.component";
import { RowDetailsDialog } from "../row-details.mobile.component";

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
            try {
                app.inputBlocker.setEnabled(true);
                ul.replaceChildren();

                if (app.selectedRankingId.value == null) {
                    nav.classList.toggle("d-none", true);
                    return;
                }

                const res = await api.fetchTablesForRanking(app, app.selectedRankingId.value);
                if (res == "error") {
                    nav.classList.toggle("d-none", true);
                    app.errorDialog.showError("An error occured while fetching score tables.");
                    return;
                }

                if (res.length == 0) {
                    nav.classList.toggle("d-none", true);
                    return;
                }

                nav.classList.toggle("d-none", false);

                for (const table of res) {
                    const li = document.createElement("li");
                    li.classList.add("nav-item");
                    const btn = document.createElement("button");
                    btn.classList.add("nav-link");
                    btn.textContent = table.name;
                    btn.onclick = () => app.selectedTableId.value = table.id;
                    li.appendChild(btn);
                    ul.appendChild(li);
                    app.selectedTableId.subscribe(() => {
                        btn.classList.toggle("active", app.selectedTableId.value == table.id);
                    });
                }



                this.app.selectedTableId.value = res[0]!.id;
            } finally {
                app.inputBlocker.setEnabled(false);
            }
        };

        app.selectedRankingId.subscribe(() => updateTables());
        updateTables();

        /* Create a table view whenever a table is selected */
        const showTable = async () => {
            try {
                app.inputBlocker.setEnabled(true);
                const tableView = this.view.querySelector("#table-view") as HTMLElement;
                tableView.replaceChildren();

                if (app.selectedRankingId.value == null || app.selectedTableId.value == null) {
                    return;
                }

                const table = await ScoreTableWrapper.loadTable(app, app.selectedRankingId.value, app.selectedTableId.value);
                if (table == "not_found") {
                    app.errorDialog.showError("The selected table does not exist (anymore).");
                } else if (table == "error") {
                    app.errorDialog.showError("An error occured while fetching the table.");
                } else {
                    const tableComp = new MobileScoreTableComponent(app, table, detailDialog);
                    tableView.appendChild(tableComp.view);
                }
            } finally {
                app.inputBlocker.setEnabled(false);
            }
        };

        app.selectedTableId.subscribe(() => showTable());
        showTable();
    }
}