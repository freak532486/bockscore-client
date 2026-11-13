import { Modal } from "bootstrap";
import type { EliminationImportSettings } from "../common/elimination-state";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./elimination-import-dialog.html"

export class EliminationImportDialog implements Component
{
    public readonly view;
    private modal: Modal;

    constructor() {
        this.view = htmlToElement(template);
        this.modal = new Modal(this.view);
    }

    show(onSubmit: (importSettings: EliminationImportSettings) => void) {
        const inputNum = this.view.querySelector("#input-entries-per-table") as HTMLInputElement;
        const inputWeighted = this.view.querySelector("#input-weighted-import") as HTMLInputElement;
        const submitBtn = this.view.querySelector("#btn-elimination-dialog-submit") as HTMLButtonElement;

        inputNum.classList.remove("is-invalid");
        this.modal.show();

        submitBtn.onclick = () => {
            const num = Number(inputNum.value);
            const valid = inputNum.value.trim() != "" && Number.isInteger(num) && num >= 1;
            inputNum.classList.toggle("is-invalid", !valid);
            if (!valid) {
                return;
            }

            this.modal.hide();
            onSubmit({ entriesPerTable: num, weightedImport: inputWeighted.checked });
        }
    }
}