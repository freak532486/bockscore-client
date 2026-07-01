import template from "./tab-wheel.html";
import dialogTemplate from "./tab-wheel.dialog.html"
import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { WheelComponent } from "./wheel";
import { Modal } from "bootstrap";

const INITIAL_ENTRIES = [
    "Apple",
    "Banana",
    "Cherry",
    "Dates",
    "Elderberries"
];

export class WheelTabComponent implements Component
{
    public readonly view;
    private modal: Modal;

    constructor(app: App) {
        this.view = htmlToElement(template);

        /* Create dialog */
        const dialogView = htmlToElement(dialogTemplate);
        document.body.appendChild(dialogView);
        this.modal = new Modal(dialogView);

        /* Write entries into textarea */
        const textarea = this.view.querySelector("#wheel-textarea") as HTMLTextAreaElement;
        textarea.value = INITIAL_ENTRIES.join("\n");

        /* Build wheel */
        const wheelContainer = this.view.querySelector("#wheel-container") as HTMLElement;
        const wheel = new WheelComponent(INITIAL_ENTRIES);
        wheelContainer.appendChild(wheel.view);

        /* Idle after dialog close */
        const onClose = () => wheel.idle();

        (dialogView.querySelector("#btn-wheel-close") as HTMLButtonElement).onclick = onClose;
        (dialogView.querySelector("#btn-wheel-ok") as HTMLButtonElement).onclick = onClose;

        /* Spin and remove entry on button click */
        const onWin = (entry: string) => {
            const winnerSpan = dialogView.querySelector("#wheel-dialog-winner") as HTMLSpanElement;
            winnerSpan.textContent = entry;

            this.modal.show();

            (dialogView.querySelector("#btn-wheel-remove") as HTMLButtonElement).onclick = () => {
                onClose();

                wheel.removeEntry(entry);
                textarea.value = wheel.entries.join("\n");
            }
        }

        wheel.view.onclick = () => wheel.spin(onWin);

        /* Update entries on text area change */
        textarea.oninput = () => {
            const entries = textarea.value.split("\n").map(x => x.trim()).filter(x => x != "");
            wheel.entries = entries;
        }
    }
}