import { Modal } from "bootstrap";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component"
import template from "./input-dialog.html"
import templateText from "./input-dialog.text.html"

export class InputDialog implements Component
{

    public readonly view: HTMLElement;
    public readonly modal: Modal;

    public readonly primaryButton: HTMLButtonElement;

    constructor(title: string) {
        this.view = htmlToElement(template);
        this.modal = new Modal(this.view);
        this.primaryButton = this.view.querySelector(".btn-primary") as HTMLButtonElement;

        /* Apply title */
        const titleSpan = this.view.querySelector(".modal-title") as HTMLElement;
        titleSpan.textContent = title;
    }

    /**
     * Adds a text input field to the dialog.
     */
    addTextInput(id: string, label: string): HTMLInputElement
    {
        const body = this.view.querySelector(".modal-body") as HTMLElement;
        const elem = htmlToElement(templateText);
        body.appendChild(elem);

        const domLabel = elem.querySelector("label") as HTMLLabelElement;
        const domInput = elem.querySelector("input") as HTMLInputElement;

        domInput.id = id;
        domLabel.htmlFor = id;
        domLabel.textContent = label;

        return domInput;
    }

    showInfo(msg: string) {
        this.showNotification("Info", msg);
    }

    showError(msg: string) {
        this.showNotification("Error", msg);
    }

    showSuccess(msg: string) {
        this.showNotification("Success", msg);
    }  

    showNotification(type: "Info" | "Error" | "Success", msg: string)
    {
        const div = this.view.querySelector(".alert") as HTMLElement;
        div.textContent = msg;

        div.classList.remove("d-none");
        div.classList.toggle("alert-primary", type == "Info");
        div.classList.toggle("alert-danger", type == "Error");
        div.classList.toggle("alert-success", type == "Success");
    }

    hideNotification()
    {
        const div = this.view.querySelector(".alert") as HTMLElement;
        div.classList.add("d-none");
    }

}