import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./error-dialog.html"
import * as bootstrap from "bootstrap"

export class ErrorDialogComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly modal: bootstrap.Modal;

    constructor() {
        this.view = htmlToElement(template);
        this.modal = new bootstrap.Modal(this.view);
    }

    showError(errMsg: string) {
        const errMsgDiv = this.view.querySelector("#error-message") as HTMLElement;
        errMsgDiv.textContent = errMsg;
        this.modal.show();
    }
}