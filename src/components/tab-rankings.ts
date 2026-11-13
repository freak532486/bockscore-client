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

const REFRESH_AFTER_HIDDEN_MS = 60_000;

export class RankingsTabComponent implements Component {
    public readonly view: HTMLElement;
    private readonly confirmDialog = new ConfirmDialog();
    private readonly updateLock = new Mutex();
    private readonly addTableItem: HTMLElement;
    private renderedTable: ScoreTableWrapper | null = null;
    private tableComponent: MobileScoreTableComponent | null = null;
    private hiddenSince: number | null = null;

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        this.addTableItem = this.view.querySelector(".add-table-item") as HTMLElement;
        document.body.appendChild(this.confirmDialog.view);

        app.selectedRankingId.subscribe(() => this.updateTables());
        app.userId.subscribe(() => this.updateTables());
        app.rankingAccess.addEventListener(RankingAccess.EVENT_TABLES_CHANGED, (ev) => {
            if ((ev as CustomEvent).detail === this.app.selectedRankingId.value) {
                this.updateTables();
            }
        });
        this.updateTables();

        /* Setup add table dialog */
        const addTableDialog = new InputDialog("Add table");
        const inputTableName = addTableDialog.addTextInput("input-table-name", "Table name");
        addTableDialog.primaryButton.textContent = "Add";
        document.body.appendChild(addTableDialog.view);

        const btnAddTable = this.view.querySelector("#btn-add-table") as HTMLButtonElement;
        btnAddTable.onclick = () => {
            inputTableName.value = "";
            addTableDialog.modal.show();
        };

        addTableDialog.primaryButton.onclick = async () => {
            const name = inputTableName.value.trim();
            addTableDialog.modal.hide();
            await this.addTable(name);
        };

        /* Setup table settings dialog */
        const tableSettingsDialogView = htmlToElement(templateTableSettingsDialog);
        document.body.appendChild(tableSettingsDialogView);
        const tableSettingsDialog = new Modal(tableSettingsDialogView);
        const tableNameInput = tableSettingsDialogView.querySelector("#input-table-name") as HTMLInputElement;
        const tableScoringSelect = tableSettingsDialogView.querySelector("#input-scoring-method") as HTMLSelectElement;

        const btnTableSettings = this.view.querySelector("#btn-table-settings") as HTMLButtonElement;
        btnTableSettings.onclick = async () => {
            const table = await this.getActiveTable();
            if (table == undefined) {
                return;
            }

            tableNameInput.value = table.header.name;
            tableScoringSelect.value = table.header.scoreMode;
            tableSettingsDialog.show();
        };

        const submitButton = tableSettingsDialogView.querySelector("#btn-table-settings-update") as HTMLButtonElement;
        submitButton.onclick = async () => {
            const table = await this.getActiveTable();
            if (table == undefined) {
                return;
            }

            const name = tableNameInput.value.trim();
            const scoring = tableScoringSelect.value as api.ScoringType;
            const nameChanged = name != "" && name != table.header.name;
            const scoringChanged = scoring != table.header.scoreMode;
            if (!nameChanged && !scoringChanged) {
                return;
            }

            const success = await table.header.changeSettings({
                name: nameChanged ? name : undefined,
                scoring: scoringChanged ? scoring : undefined,
            });

            if (!success) {
                this.app.errorDialog.showError("An error occured while changing the table settings.");
                return;
            }

            this.renderedTable = null;
            this.updateTables();
        };

        /* The confirmation is shown once the settings dialog is hidden, since Bootstrap cannot show two modals at once */
        const btnDeleteTable = tableSettingsDialogView.querySelector("#btn-delete-table") as HTMLButtonElement;
        btnDeleteTable.onclick = () => {
            tableSettingsDialogView.addEventListener(
                "hidden.bs.modal",
                async () => {
                    const table = await this.getActiveTable();
                    if (table == undefined) {
                        return;
                    }

                    this.confirmDialog.show(
                        `Do you want to delete the table '${table.header.name}' with all its entries?`,
                        () => this.deleteTable(table.id),
                    );
                },
                { once: true },
            );

            tableSettingsDialog.hide();
        };

        /* Other users may have changed scores or entries while the page was in the background */
        document.addEventListener("visibilitychange", () => this.onVisibilityChange());

        /* Create a table view whenever a table is selected */
        app.selectedTableId.subscribe(() => {
            this.highlightSelectedTable();
            this.renderTable();
        });
        this.renderTable();
    }

    private async onVisibilityChange() {
        if (document.visibilityState === "hidden") {
            this.hiddenSince = Date.now();
            return;
        }

        const hiddenFor = this.hiddenSince === null ? 0 : Date.now() - this.hiddenSince;
        this.hiddenSince = null;

        const rankingId = this.app.selectedRankingId.value;
        if (rankingId == null || hiddenFor < REFRESH_AFTER_HIDDEN_MS) {
            return;
        }

        await this.app.rankingAccess.invalidateRanking(rankingId);
        await this.updateTables();
    }

    private async deleteTable(tableId: string) {
        const rankingId = this.app.selectedRankingId.value;
        if (rankingId == null) {
            return;
        }

        const res = await this.app.inputBlocker.runAsyncWithBlockedInput(() => api.deleteTable(this.app, tableId));
        if (res == "error") {
            this.app.errorDialog.showError("An error occured while deleting the table.");
            return;
        }

        await this.app.rankingAccess.removeTable(rankingId, tableId);
        await this.updateTables();
    }

    private async addTable(name: string) {
        const rankingId = this.app.selectedRankingId.value;
        if (name == "" || rankingId == null) {
            return;
        }

        const res = await this.app.inputBlocker.runAsyncWithBlockedInput(() =>
            api.createTable(this.app, rankingId, name),
        );
        if (res == "error") {
            this.app.errorDialog.showError("An error occured while creating the table.");
            return;
        }

        await this.app.rankingAccess.addTable(rankingId, res);
        await this.updateTables(res.id);
    }

    /**
     * Rebuilds the table tabs. The new tabs replace the old ones at once, so the header never shows an empty state.
     */
    private updateTables(preferredTableId?: string): Promise<void> {
        return this.updateLock.withLock(() =>
            this.app.inputBlocker.runAsyncWithBlockedInput(async () => {
                const header = this.view.querySelector("#tab-rankings-header") as HTMLElement;
                const btnTableSettings = this.view.querySelector("#btn-table-settings") as HTMLElement;
                const ul = this.view.querySelector("ul") as HTMLElement;

                const rankingId = this.app.selectedRankingId.value;
                if (rankingId == null) {
                    ul.replaceChildren(this.addTableItem);
                    header.classList.toggle("d-none", true);
                    this.app.selectedTableId.value = null;
                    return;
                }

                const tableHeaders = await this.app.rankingAccess.getAllTablesForRanking(rankingId);
                const tables = await Promise.all(tableHeaders.map((x) => this.app.rankingAccess.getTable(x.id)));
                if (rankingId !== this.app.selectedRankingId.value) {
                    return;
                }

                const items: Array<HTMLElement> = [];
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
                    btn.onclick = () => (this.app.selectedTableId.value = table.id);
                    li.appendChild(btn);
                    items.push(li);
                }

                ul.replaceChildren(...items, this.addTableItem);
                header.classList.toggle("d-none", false);
                btnTableSettings.classList.toggle("d-none", tableHeaders.length == 0);

                if (tableHeaders.length == 0) {
                    this.app.selectedTableId.value = null;
                    return;
                }

                const tableIds = tableHeaders.map((x) => x.id);
                const current = this.app.selectedTableId.value;
                const target =
                    [preferredTableId, current].find((x) => x != undefined && tableIds.includes(x)) ?? tableIds[0]!;

                if (target === current) {
                    this.highlightSelectedTable();
                    await this.renderTable();
                } else {
                    this.app.selectedTableId.value = target;
                }
            }),
        );
    }

    private highlightSelectedTable() {
        for (const btn of this.view.querySelectorAll<HTMLButtonElement>("ul button[data-table-id]")) {
            btn.classList.toggle("active", btn.dataset.tableId === this.app.selectedTableId.value);
        }
    }

    /**
     * Shows the selected table. The view is only rebuilt if the table changed, which happens when another table is
     * selected or the cached ranking was reloaded.
     */
    private renderTable(): Promise<void> {
        return this.app.inputBlocker.runAsyncWithBlockedInput(async () => {
            const tableView = this.view.querySelector("#table-view") as HTMLElement;
            const tableId = this.app.selectedTableId.value;

            if (this.app.selectedRankingId.value == null || tableId == null) {
                tableView.replaceChildren();
                this.renderedTable = null;
                this.tableComponent = null;
                return;
            }

            const table = await this.getActiveTable();
            if (tableId !== this.app.selectedTableId.value || table === this.renderedTable) {
                return;
            }

            if (table == undefined) {
                tableView.replaceChildren();
                this.renderedTable = null;
                this.tableComponent = null;
                this.app.errorDialog.showError("The selected table does not exist.");
                return;
            }

            const expandedRowId =
                this.renderedTable?.id === table.id ? (this.tableComponent?.expandedRowId ?? null) : null;
            this.renderedTable = table;
            this.tableComponent = new MobileScoreTableComponent(this.app, table, this.confirmDialog, expandedRowId);
            tableView.replaceChildren(this.tableComponent.view);
        });
    }

    private async getActiveTable(): Promise<ScoreTableWrapper | undefined> {
        if (this.app.selectedTableId.value == null) {
            return undefined;
        }

        const table = await this.app.rankingAccess.getTable(this.app.selectedTableId.value);
        return table == "error" ? undefined : table;
    }
}
