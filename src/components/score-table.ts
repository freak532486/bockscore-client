import template from "./score-table.html"
import entry from "./score-table.entry.html"
import type { App } from "../common/app";
import type { ScoreTableRowWrapper, ScoreTableWrapper } from "../common/table-wrapper";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { RowDetailsDialog } from "./row-details-dialog";
import "./score-table.entry.css"


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

    public async refresh() {
        this.app.inputBlocker.setEnabled(true);
        const group = this.view.querySelector("#div-entries") as HTMLElement;
        group.replaceChildren();

        for (const row of this.wrapper.rows) {
            const entry = this.createEntry(
                row,
                async (newScore, newRowname, newImage) => {
                    const scoreChanged = newScore == undefined ? false : await row.setScore(newScore);
                    const nameChanged = newRowname == undefined ? false : await row.setName(newRowname);
                    const imageChanged = newImage == undefined ? false : await row.setImage(newImage);
                    if (scoreChanged || nameChanged || imageChanged) {
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

        this.app.inputBlocker.setEnabled(false);
    }

    private createEntry(
        row: ScoreTableRowWrapper,
        update: (score?: number, name?: string, image?: Blob) => void,
        deleteRow: () => void
    ): HTMLElement
    {
        /* Fetch scores for each user */
        const scores = new Map<string, number>();
        for (const member of this.wrapper.header.members) {
            scores.set(member.name, row.getScore(member.id));
        }

        const elem = htmlToElement(entry);
        (elem.querySelector(".name") as HTMLElement).textContent = row.name;
        (elem.querySelector(".fullscore") as HTMLElement).textContent = String(row.getAvgScore(this.wrapper.header.scoreMode));
        elem.onclick = () => this.detailDialog.show(row.name, scores, update, deleteRow);

        /* Create image link for entry image */
        const domImg = elem.querySelector("img") as HTMLImageElement;
        const img = row.image;
        if (img !== undefined) {
            const url = URL.createObjectURL(img);
            domImg.src = url;
        }

        return elem;
    }
}