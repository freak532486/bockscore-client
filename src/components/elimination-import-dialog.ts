import { Modal } from "bootstrap";
import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./elimination-import-dialog.html"

export interface EliminationImportSettings
{
    entriesPerTable: number,
    weightedImport: boolean
}

export class EliminationImportDialog implements Component
{
    public readonly view;
    private modal: Modal;

    constructor() {
        this.view = htmlToElement(template);
        this.modal = new Modal(this.view);
    }

    show(onSubmit: (importSettings: EliminationImportSettings) => void) {
        this.modal.show();

        const inputNum = this.view.querySelector("#input-entries-per-table") as HTMLInputElement;
        const inputWeighted = this.view.querySelector("#input-weighted-import") as HTMLInputElement;
        const submitBtn = this.view.querySelector("#btn-elimination-dialog-submit") as HTMLButtonElement;

        submitBtn.onclick = () => {
            this.modal.hide();

            const num = Number(inputNum.value);
            if (Number.isNaN(num)) {
                return;
            }

            onSubmit({ entriesPerTable: num, weightedImport: inputWeighted.checked });
        }
    }
}