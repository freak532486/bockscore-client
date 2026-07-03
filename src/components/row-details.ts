import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./row-details.html"
import * as bootstrap from "bootstrap"

export class RowDetailsDialog implements Component
{
    public readonly view: HTMLElement;
    private readonly modal: bootstrap.Modal;

    constructor()
    {
        this.view = htmlToElement(template);
        this.modal = new bootstrap.Modal(this.view);
    }

    show(
        rowname: string,
        scores: Map<string, number>,
        update: (score?: number, newRowname?: string, newImage?: Blob) => void,
        deleteRow: () => void
    ) {
        /* Write rowname into header */
        (this.view.querySelector("#row-details-title") as HTMLElement).textContent = rowname;

        /* Add scores to table */
        const tbody = this.view.querySelector("tbody") as HTMLElement;
        tbody.replaceChildren();

        const sortedScores = [...scores.entries()]
            .map(x => ({ "name": x[0], "score": x[1] }))
            .sort((a, b) => a.name.localeCompare(b.name));

        for (const score of sortedScores) {
            const tr = document.createElement("tr");
            const td1 = document.createElement("td");
            const td2 = document.createElement("td");
            td1.textContent = score.name;
            td2.textContent = String(score.score);
            tr.appendChild(td1);
            tr.appendChild(td2);
            tbody.appendChild(tr);
        }

        /* Score change */
        const btnSubmit = this.view.querySelector("#row-details-submit") as HTMLButtonElement;
        const input = this.view.querySelector("#row-score-input") as HTMLInputElement;
        const inputRowname = this.view.querySelector("#row-name-input") as HTMLInputElement;
        const inputEntryImage = this.view.querySelector("#input-entry-image") as HTMLInputElement;
        btnSubmit.onclick = async () => {
            /* Change score if applies */
            let newScore: number | undefined = undefined;
            const num = Number(input.value);
            if (!Number.isNaN(num)) {
                newScore = num;
            }

            /* Change row name if applies */
            let newRowname: string | undefined = undefined;
            const inValue = inputRowname.value.trim();
            if (inValue.length > 0) {
                newRowname = inValue;
            }

            /* Change image if applies */
            const file = inputEntryImage.files?.[0];
            const image = file == undefined ? undefined : new Blob([await file.bytes()], { "type": file.type });

            update(newScore, newRowname, image);
            this.modal.hide();
        }

        /* Delete row */
        const btnDelete = this.view.querySelector("#btn-delete-row") as HTMLButtonElement;
        btnDelete.onclick = () => {
            deleteRow();
            this.modal.hide();
        }

        this.modal.show();
    }
}