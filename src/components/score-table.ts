import type { App } from "../common/app";
import type { ScoreTableRowWrapper, ScoreTableWrapper } from "../common/table-wrapper";
import { htmlToElement } from "../common/utils";
import "./compact-row.css";
import type { Component } from "./component";
import { RowDetailsDialog, type EntryUpdateCallback } from "./row-details-dialog";
import "./score-table.entry.css";
import entry from "./score-table.entry.html";
import template from "./score-table.html";
import { setupThumbnail } from "./thumbnail";


export class MobileScoreTableComponent implements Component
{
    public readonly view: HTMLElement;

    constructor(
        private readonly app: App,
        private readonly wrapper: ScoreTableWrapper,
        private readonly detailDialog: RowDetailsDialog
    )
    {
        this.view = htmlToElement(template);
        this.refresh();

        /* Implement add row */
        const btnAddRow = this.view.querySelector("#btn-add-row") as HTMLButtonElement;
        btnAddRow.onclick = async () => {
            if (await wrapper.addRow("New Row")) {
                this.refresh();
            }
        }
    }

    public refresh() {
        const group = this.view.querySelector("#div-entries") as HTMLElement;
        group.replaceChildren();

        for (const row of this.wrapper.rows) {
            const entry = this.createEntry(
                row,
                async (newScore, newRowname, newImage, newJoker) => {
                    const scoreChanged = newScore == undefined ? false : await row.setScore(newScore);
                    const nameChanged = newRowname == undefined ? false : await row.setName(newRowname);
                    const imageChanged = newImage == undefined ? false : await row.setImage(newImage);
                    const jokerChanged = newJoker == undefined ? false : await this.wrapper.setJoker(newJoker, row.id);
                    if (scoreChanged || nameChanged || imageChanged || jokerChanged) {
                        this.refresh();
                    }
                },
                async () => {
                    const success = await this.wrapper.deleteRow(row.id);
                    if (success) {
                        this.refresh();
                    }
                }
            );
            group.appendChild(entry);
        }
    }

    private createEntry(
        row: ScoreTableRowWrapper,
        update: EntryUpdateCallback,
        deleteRow: () => void
    ): HTMLElement
    {
        const elem = htmlToElement(entry);
        elem.onclick = () => this.detailDialog.show(row, this.wrapper, update, deleteRow);

        (elem.querySelector(".name") as HTMLElement).textContent = row.name;

        const avgScore = row.getAvgScore(this.wrapper.header.scoreMode);
        (elem.querySelector(".fullscore") as HTMLElement).textContent = avgScore?.toFixed(2) ?? "–";

        const ownMemberId = this.app.userId.value == null ?
            undefined :
            this.wrapper.header.userToMemberId.get(this.app.userId.value);
        const ownScore = ownMemberId == undefined ? undefined : row.getScore(ownMemberId);
        (elem.querySelector(".own-score") as HTMLElement).classList.toggle("d-none", ownMemberId == undefined);
        (elem.querySelector(".own-score-value") as HTMLElement).textContent = ownScore == undefined ? "–" : String(ownScore);

        const jokerText = elem.querySelector(".joker-text") as HTMLElement;
        jokerText.classList.toggle("d-none", row.jokerOf === null);
        jokerText.textContent = row.jokerOf === null ? "" : `Joker: ${row.jokerOf.name}`;

        setupThumbnail(elem.querySelector("img.thumb") as HTMLImageElement, row, this.app.imageViewer);

        return elem;
    }
}