import { Modal } from "bootstrap";
import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import dialogTemplate from "./tab-wheel.dialog.html";
import template from "./tab-wheel.html";
import { WheelComponent } from "./wheel";

const INITIAL_ENTRIES = [
    "Apple",
    "Banana",
    "Cherry",
    "Dates",
    "Elderberries"
];

export class WheelTabComponent implements Component {
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
            const sndApplause = this.view.querySelector("#snd-applause") as HTMLAudioElement;
            const winnerSpan = dialogView.querySelector("#wheel-dialog-winner") as HTMLSpanElement;
            winnerSpan.textContent = entry;

            this.modal.show();
            sndApplause.play();

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

        /* Make import button work */
        const btnImport = this.view.querySelector("#btn-wheel-import") as HTMLButtonElement;
        btnImport.onclick = async () => {
            if (app.selectedRankingId.value == null) {
                app.errorDialog.showError("No ranking is active");
                return;
            }

            const names: Array<string> = [];
            for (const entry of app.tabElimination.entries) {
                const row = await app.rankingAccess.getEntry(app.selectedRankingId.value, entry.entryId);
                if (row == null) {
                    continue;
                }

                names.push(row?.name);
            }

            wheel.entries = names;
            textarea.value = wheel.entries.join("\n");
        }

        /* Make shuffle button work */
        const btnShuffle = this.view.querySelector("#btn-shuffle") as HTMLButtonElement;
        btnShuffle.onclick = () => {
            const entries = [...wheel.entries];
            shuffle(entries);
            wheel.entries = entries;
            textarea.value = entries.join("\n");
        }
    }
}

function shuffle<T>(array: Array<T>): void {
    let currentIndex = array.length;
    while (currentIndex != 0) {
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex]!, array[currentIndex]!];
    }
}