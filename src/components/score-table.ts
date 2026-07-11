import type { App } from "../common/app";
import type { ScoreTableRowWrapper, ScoreTableWrapper } from "../common/table-wrapper";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { RowDetailsDialog, type EntryUpdateCallback } from "./row-details-dialog";
import "./score-table.entry.css";
import entry from "./score-table.entry.html";
import template from "./score-table.html";


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

        this.app.inputBlocker.setEnabled(false);
    }

    private createEntry(
        row: ScoreTableRowWrapper,
        update: EntryUpdateCallback,
        deleteRow: () => void
    ): HTMLElement
    {
        /* Fetch scores for each user */
        const scores = new Map<string, number | undefined>();
        for (const member of this.wrapper.header.members) {
            scores.set(member.name, row.getScore(member.id));
        }

        const avgScore = row.getAvgScore(this.wrapper.header.scoreMode);
        const elem = htmlToElement(entry);
        const card = elem.querySelector(".card") as HTMLElement;
        const jokerText = elem.querySelector(".joker-text") as HTMLElement;
        (elem.querySelector(".name") as HTMLElement).textContent = row.name;
        (elem.querySelector(".fullscore") as HTMLElement).textContent = String(avgScore?.toFixed(2) || "?");
        elem.onclick = () => this.detailDialog.show(row, this.wrapper, update, deleteRow);
        card.classList.toggle("joker", row.jokerOf !== null);
        jokerText.classList.toggle("invisible", row.jokerOf == null);
        jokerText.textContent = "Joker: " + (row.jokerOf == null ? "" : row.jokerOf.name);

        /* Create image link for entry image */
        const domImg = elem.querySelector("img") as HTMLImageElement;
        row.getImage().then(x => {
            if (x !== undefined) {
                const url = URL.createObjectURL(x);
                domImg.src = url;
            }
        });

        return elem;
    }
}