import { Modal } from "bootstrap";
import * as api from "../common/api";
import type { App } from "../common/app";
import { Mutex } from "../common/mutex";
import { RankingAccess } from "../common/ranking-access";
import type { ScoreTableWrapper } from "../common/table-wrapper";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { ConfirmDialog } from "./confirm-dialog";
import { InputDialog } from "./input-dialog";
import { MobileScoreTableComponent } from "./score-table";
import template from "./tab-rankings.html";
import templateTableSettingsDialog from "./tab-rankings.table-settings-dialog.html";

export class RankingsTabComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly confirmDialog = new ConfirmDialog();
    private readonly updateLock = new Mutex();
    private readonly addTableItem: HTMLElement;

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        this.addTableItem = this.view.querySelector(".add-table-item") as HTMLElement;
        document.body.appendChild(this.confirmDialog.view);

        app.selectedRankingId.subscribe(() => this.updateTables());
        app.userId.subscribe(() => this.updateTables());
        app.rankingAccess.addEventListener(RankingAccess.EVENT_TABLES_CHANGED, ev => {
            if ((ev as CustomEvent).detail === this.app.selectedRankingId.value) {
                this.updateTables();
            }
        });
        this.updateTables();

        /* Setup add table dialog */
        const addTableDialog = new InputDialog("Add table");
        const inputTableName = addTableDialog.addTextInput("input-table-name", "Table name");
        addTableDialog.primaryButton.textContent = "Add";
        this.view.appendChild(addTableDialog.view);

        const btnAddTable = this.view.querySelector("#btn-add-table") as HTMLButtonElement;
        btnAddTable.onclick = () => {
            inputTableName.value = "";
            addTableDialog.modal.show();
        };

        addTableDialog.primaryButton.onclick = async () => {
            const name = inputTableName.value.trim();
            addTableDialog.modal.hide();
            await this.addTable(name);
        }

        /* Setup table settings dialog */
        const tableSettingsDialogView = htmlToElement(templateTableSettingsDialog);
        const tableSettingsDialog = new Modal(tableSettingsDialogView);
        const tableNameInput = tableSettingsDialogView.querySelector("#input-table-name") as HTMLInputElement;
        const tableScoringSelect = tableSettingsDialogView.querySelector("#input-scoring-method") as HTMLSelectElement;

        const btnTableSettings = this.view.querySelector("#btn-table-settings") as HTMLButtonElement;
        btnTableSettings.onclick = async () => {
            const table = await this.getActiveTable();
            if (table == undefined) {
                return;
            }

            tableNameInput.placeholder = table.header.name || "";
            tableSettingsDialog.show();
        }

        const submitButton = tableSettingsDialogView.querySelector("#btn-table-settings-update") as HTMLButtonElement;
        submitButton.onclick = async () => {
            const table = await this.getActiveTable();
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
        app.selectedTableId.subscribe(() => {
            this.highlightSelectedTable();
            this.renderTable();
        });
        this.renderTable();
    }

    private async addTable(name: string)
    {
        const rankingId = this.app.selectedRankingId.value;
        if (name == "" || rankingId == null) {
            return;
        }

        const res = await api.createTable(this.app, rankingId, name);
        if (res == "error") {
            this.app.errorDialog.showError("An error occured while creating the table.");
            return;
        }

        await this.app.rankingAccess.invalidateRanking(rankingId);
        await this.updateTables(res);
    }

    private updateTables(preferredTableId?: string): Promise<void>
    {
        return this.updateLock.withLock(() => this.app.inputBlocker.runAsyncWithBlockedInput(async () => {
            const header = this.view.querySelector("#tab-rankings-header") as HTMLElement;
            const btnTableSettings = this.view.querySelector("#btn-table-settings") as HTMLElement;
            const ul = this.view.querySelector("ul") as HTMLElement;
            ul.replaceChildren(this.addTableItem);

            const rankingId = this.app.selectedRankingId.value;
            if (rankingId == null) {
                header.classList.toggle("d-none", true);
                this.app.selectedTableId.value = null;
                return;
            }

            header.classList.toggle("d-none", false);

            const tableHeaders = await this.app.rankingAccess.getAllTablesForRanking(rankingId);
            btnTableSettings.classList.toggle("d-none", tableHeaders.length == 0);
            if (tableHeaders.length == 0) {
                this.app.selectedTableId.value = null;
                return;
            }

            const tables = await Promise.all(tableHeaders.map(x => this.app.rankingAccess.getTable(x.id)));
            for (const table of tables) {
                if (table == "error") {
                    continue;
                }

                const li = document.createElement("li");
                li.classList.add("nav-item");
                const btn = document.createElement("button");
                btn.classList.add("nav-link");
                btn.dataset.tableId = table.id;
                btn.textContent = table.header.name;
                btn.onclick = () => this.app.selectedTableId.value = table.id;
                li.appendChild(btn);
                ul.insertBefore(li, this.addTableItem);
            }

            const tableIds = tableHeaders.map(x => x.id);
            const current = this.app.selectedTableId.value;
            const target = [preferredTableId, current].find(x => x != undefined && tableIds.includes(x)) ?? tableIds[0]!;

            /* Cached tables may have been replaced, so the view must be rebuilt even if the selection stays */
            if (target === current) {
                this.highlightSelectedTable();
                await this.renderTable();
            } else {
                this.app.selectedTableId.value = target;
            }
        }));
    }

    private highlightSelectedTable()
    {
        for (const btn of this.view.querySelectorAll<HTMLButtonElement>("ul button[data-table-id]")) {
            btn.classList.toggle("active", btn.dataset.tableId === this.app.selectedTableId.value);
        }
    }

    private renderTable(): Promise<void>
    {
        return this.app.inputBlocker.runAsyncWithBlockedInput(async () => {
            const tableView = this.view.querySelector("#table-view") as HTMLElement;

            if (this.app.selectedRankingId.value == null || this.app.selectedTableId.value == null) {
                tableView.replaceChildren();
                return;
            }

            const table = await this.getActiveTable();
            if (table == undefined) {
                tableView.replaceChildren();
                this.app.errorDialog.showError("The selected table does not exist.");
                return;
            }

            tableView.replaceChildren(new MobileScoreTableComponent(this.app, table, this.confirmDialog).view);
        });
    }

    private async getActiveTable(): Promise<ScoreTableWrapper | undefined>
    {
        if (this.app.selectedTableId.value == null) {
            return undefined;
        }

        const table = await this.app.rankingAccess.getTable(this.app.selectedTableId.value);
        return table == "error" ? undefined : table;
    }
}
