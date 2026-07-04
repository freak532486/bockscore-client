import { Modal } from "bootstrap";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./confirm-dialog.html"

export class ConfirmDialog implements Component
{
    public readonly view: HTMLElement;
    public readonly modal: Modal;

    constructor() {
        this.view = htmlToElement(template);
        this.modal = new Modal(this.view);
    }

    show(msg: string, onYes: () => void)
    {
        const confirmMsg = this.view.querySelector("#confirm-msg") as HTMLElement;
        const btnYes = this.view.querySelector("#btn-yes") as HTMLElement;

        confirmMsg.textContent = msg;
        btnYes.onclick = () => onYes();
        this.modal.show();
    }
}