import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./tab-rankings.html"
import * as api from "../common/api"
import { ScoreTableComponent } from "./score-table.component";
import { ScoreTableWrapper } from "../common/table-wrapper";

export class RankingsTabComponent implements Component
{
    public readonly view: HTMLElement;

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);

        /* Update tables whenever ranking selection changes */
        const updateTables = async () => {
            const nav = this.view.querySelector("nav") as HTMLElement;
            const ul = this.view.querySelector("ul") as HTMLElement;
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
        };

        app.selectedRankingId.subscribe(() => updateTables());
        updateTables();

        /* Create a table view whenever a table is selected */
        const showTable = async () => {
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
                const tableComp = new ScoreTableComponent(app, table);
                tableView.appendChild(tableComp.view);
            }
        };

        app.selectedTableId.subscribe(() => showTable());
        showTable();
    }
}