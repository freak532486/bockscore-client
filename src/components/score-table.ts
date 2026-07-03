import template from "./score-table.html"
import entry from "./score-table.entry.html"
import type { App } from "../common/app";
import type { ScoreTableWrapper } from "../common/table-wrapper";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { RowDetailsDialog } from "./row-details";
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

        const members = this.wrapper.header.members;

        for (const row of this.wrapper.rows) {
            const scores = new Map<string, number>();
            for (const member of members) {
                scores.set(member.name, row.getScore(member.id));
            }

            const entry = this.createEntry(
                row.name,
                scores,
                async (newScore, newRowname) => {
                    const scoreChanged = newScore == undefined ? false : await row.setScore(newScore);
                    const nameChanged = newRowname == undefined ? false : await row.setName(newRowname);
                    if (scoreChanged || nameChanged) {
                        this.refresh();
                    }
                },
                async image => {
                    const success = await row.setImage(image);
                    if (success) {
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
        name: string,
        scores: Map<string, number>,
        changeScore: (score: number | undefined, name: string | undefined) => void,
        setEntryImage: (image: Blob) => void,
        deleteRow: () => void
    ): HTMLElement
    {
        const avgScore = [...scores.values()].reduce((a, b) => a + b, 0) / scores.size;

        const elem = htmlToElement(entry);
        (elem.querySelector(".name") as HTMLElement).textContent = name;
        (elem.querySelector(".fullscore") as HTMLElement).textContent = String(avgScore);
        elem.onclick = () => this.detailDialog.show(name, scores, changeScore, setEntryImage, deleteRow);
        return elem;
    }
}