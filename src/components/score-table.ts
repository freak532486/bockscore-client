import type { App } from "../common/app";
import { isSupportedImageType } from "../common/image-utils";
import type { ScoreTableRowWrapper, ScoreTableWrapper } from "../common/table-wrapper";
import { htmlToElement } from "../common/utils";
import "./compact-row.css";
import type { Component } from "./component";
import type { ConfirmDialog } from "./confirm-dialog";
import "./score-table.entry.css";
import { ScoreTableEntryComponent } from "./score-table.entry";
import template from "./score-table.html";

export class MobileScoreTableComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly list: HTMLElement;
    private readonly entries = new Map<string, ScoreTableEntryComponent>();
    private expandedRowId: string | null = null;

    constructor(
        private readonly app: App,
        private readonly wrapper: ScoreTableWrapper,
        private readonly confirmDialog: ConfirmDialog
    )
    {
        this.view = htmlToElement(template);
        this.list = this.view.querySelector("#div-entries") as HTMLElement;
        this.refresh();

        const btnAddRow = this.view.querySelector("#btn-add-row") as HTMLButtonElement;
        btnAddRow.onclick = () => this.addRow();

        document.addEventListener("paste", this.onPaste);
    }

    /**
     * Pasted images are uploaded to the expanded entry. The listener removes itself once this table is no longer
     * shown, since tables are replaced instead of destroyed.
     */
    private readonly onPaste = (ev: ClipboardEvent) => {
        if (!this.view.isConnected) {
            document.removeEventListener("paste", this.onPaste);
            return;
        }

        const entry = this.expandedRowId === null ? undefined : this.entries.get(this.expandedRowId);
        const image = [...ev.clipboardData?.files ?? []].find(x => isSupportedImageType(x.type));
        if (entry === undefined || image === undefined) {
            return;
        }

        ev.preventDefault();
        entry.uploadImage(image);
    };

    /**
     * Updates the view in place. Entries are only created, removed or moved when necessary.
     */
    public refresh() {
        const rows = this.wrapper.rows;
        const ids = new Set(rows.map(x => x.id));

        if (this.expandedRowId !== null && !ids.has(this.expandedRowId)) {
            this.expandedRowId = null;
        }

        for (const [rowId, entry] of this.entries) {
            if (!ids.has(rowId)) {
                entry.view.remove();
                this.entries.delete(rowId);
            }
        }

        let previous: Element | null = null;
        for (const row of rows) {
            let entry = this.entries.get(row.id);
            if (entry === undefined) {
                entry = this.createEntry(row);
                this.entries.set(row.id, entry);
            }

            entry.update(row.id === this.expandedRowId);

            const expectedPosition: Element | null = previous === null ? this.list.firstElementChild : previous.nextElementSibling;
            if (expectedPosition !== entry.view) {
                this.list.insertBefore(entry.view, expectedPosition);
            }

            previous = entry.view;
        }
    }

    private createEntry(row: ScoreTableRowWrapper): ScoreTableEntryComponent
    {
        return new ScoreTableEntryComponent(this.app, this.wrapper, row, {
            toggle: () => this.toggle(row.id),
            changed: () => this.refresh(),
            remove: () => this.confirmDialog.show(`Do you want to delete '${row.name}'?`, () => this.deleteRow(row.id))
        });
    }

    private toggle(rowId: string)
    {
        this.expandedRowId = this.expandedRowId === rowId ? null : rowId;
        this.refresh();

        if (this.expandedRowId !== null) {
            this.entries.get(this.expandedRowId)?.view.scrollIntoView({ block: "nearest" });
        }
    }

    private async addRow()
    {
        const existing = new Set(this.wrapper.rows.map(x => x.id));
        const success = await this.app.inputBlocker.runAsyncWithBlockedInput(() => this.wrapper.addRow("New Row"));
        if (!success) {
            this.app.errorDialog.showError("An error occured while adding the entry.");
            return;
        }

        const added = this.wrapper.rows.find(x => !existing.has(x.id));
        this.expandedRowId = added?.id ?? null;
        this.refresh();

        if (added !== undefined) {
            const entry = this.entries.get(added.id);
            entry?.startNameEdit();
            entry?.view.scrollIntoView({ block: "nearest" });
        }
    }

    private async deleteRow(rowId: string)
    {
        const success = await this.app.inputBlocker.runAsyncWithBlockedInput(() => this.wrapper.deleteRow(rowId));
        if (!success) {
            this.app.errorDialog.showError("An error occured while deleting the entry.");
            return;
        }

        this.refresh();
    }
}
