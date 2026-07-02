import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./tab-rankings.html"
import templateTableSettingsDialog from "./tab-rankings.table-settings-dialog.html"
import { MobileScoreTableComponent } from "./score-table.mobile";
import { RowDetailsDialog } from "./row-details.mobile";
import { Modal } from "bootstrap";
import { InputDialog } from "./input-dialog";
import * as api from "../common/api"
import { ScoreTableWrapper } from "../common/table-wrapper";

export class RankingsTabComponent implements Component
{
    public readonly view: HTMLElement;

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        const detailDialog = new RowDetailsDialog();
        document.body.appendChild(detailDialog.view);

        /* Update tables whenever ranking selection changes */
        app.selectedRankingId.subscribe(() => this.updateTables());
        this.updateTables();

        /* Also update tables every time the logged in user changes */
        app.userId.subscribe(() => this.updateTables());

        /* Setup add table dialog */
        const addTableDialog = new InputDialog("Add table");
        const inputTableName = addTableDialog.addTextInput("input-table-name", "Table name");
        addTableDialog.primaryButton.textContent = "Add";
        this.view.appendChild(addTableDialog.view);

        const btnAddTable = this.view.querySelector("#btn-add-table") as HTMLButtonElement;
        btnAddTable.onclick = () => addTableDialog.modal.show();

        addTableDialog.primaryButton.onclick = async () => {
            const name = inputTableName.value.trim();
            this.addTable(name);
        }

        /* Setup table settings dialog */
        const tableSettingsDialogView = htmlToElement(templateTableSettingsDialog);
        const tableSettingsDialog = new Modal(tableSettingsDialogView);
        const tableNameInput = tableSettingsDialogView.querySelector("#input-table-name") as HTMLInputElement;
        const tableScoringSelect = tableSettingsDialogView.querySelector("#input-scoring-method") as HTMLSelectElement;

        const btnTableSettings = this.view.querySelector("#btn-table-settings") as HTMLButtonElement;
        btnTableSettings.onclick = () => {
            if (app.selectedRankingId.value == null || app.selectedTableId.value == null) {
                return;
            }

            const curTableName = app.rankingCache.get(app.selectedRankingId.value)?.get(app.selectedTableId.value)?.header.name;
            tableNameInput.placeholder = curTableName || "";
            tableSettingsDialog.show();
        }

        const submitButton = tableSettingsDialogView.querySelector("#btn-table-settings-update") as HTMLButtonElement;
        submitButton.onclick = async () => {
            if (app.selectedRankingId.value == null || app.selectedTableId.value == null) {
                return;
            }

            const table = app.rankingCache.get(app.selectedRankingId.value)?.get(app.selectedTableId.value);
            if (table == undefined) {
                return;
            }

            const name = tableNameInput.value.trim();
            const scoring = tableScoringSelect.value;

            const changed = await table.header.changeSettings({
                "name": name == "" ? undefined : name,
                "scoring": scoring == "" ? undefined : scoring as api.ScoringType
            });

            if (changed) {
                this.updateTables();
            }
        }

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

    private async addTable(name: string)
    {
        if (name == "" || this.app.selectedRankingId.value == null) {
            return;
        }

        const res = await api.createTable(this.app, this.app.selectedRankingId.value, name);
        if (res == "error") {
            this.app.errorDialog.showError("An error occured while creating the table.");
            return;
        }

        const table = await ScoreTableWrapper.loadTable(this.app, this.app.selectedRankingId.value, res);
        if (table == "error" || table == "not_found") {
            this.app.errorDialog.showError("An error occured while creating the table.");
            return;
        }

        this.app.rankingCache.get(this.app.selectedRankingId.value)!.set(res, table);
        await this.updateTables();
        
        this.app.selectedTableId.value = res;
    }

    private async updateTables()
    {
        const header = this.view.querySelector("#tab-rankings-header") as HTMLElement;
        const ul = this.view.querySelector("ul") as HTMLElement;

        this.app.inputBlocker.runWithBlockedInput(async () => {
        ul.replaceChildren();

        if (this.app.selectedRankingId.value == null || !this.app.rankingCache.has(this.app.selectedRankingId.value)) {
            header.classList.toggle("d-none", true);
            return;
        }

        const tables = [...this.app.rankingCache.get(this.app.selectedRankingId.value)!.values()];

        if (tables.length == 0) {
            header.classList.toggle("d-none", true);
            return;
        }

        header.classList.toggle("d-none", false);

        for (const table of tables) {
            const li = document.createElement("li");
            li.classList.add("nav-item");
            const btn = document.createElement("button");
            btn.classList.add("nav-link");
            btn.textContent = table.header.name;
            btn.onclick = () => this.app.selectedTableId.value = table.id;
            li.appendChild(btn);
            ul.appendChild(li);
            this.app.selectedTableId.subscribe(() => {
                btn.classList.toggle("active", this.app.selectedTableId.value == table.id);
            });
        }

        this.app.selectedTableId.value = tables[0]!.id;
    });
    }
}