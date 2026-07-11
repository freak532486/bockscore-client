import type { ScoreTableRowWrapper } from "../common/table-wrapper";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import "./tab-elimination-card.css";
import template from "./tab-elimination-card.html";

const TIME_UNTIL_DELETION_MS = 1000; // Keep in sync with CSS

export class TabEliminationCardComponent implements Component {
    public readonly view: HTMLElement;
    private deletionTimer?: number;

    constructor(
        private readonly row: ScoreTableRowWrapper,
        private readonly onDelete: () => void
    ) {
        this.view = htmlToElement(template);
        const card = this.view.querySelector(".game-card") as HTMLElement;

        /* Replace name */
        const gameNameSpan = this.view.querySelector(".game-name") as HTMLElement;
        gameNameSpan.textContent = row.name;

        const jokerTextSpan = this.view.querySelector(".joker-text") as HTMLElement;
        jokerTextSpan.classList.toggle("d-none", row.jokerOf === null);
        jokerTextSpan.textContent = row.jokerOf === null ? "" : (`Joker: ${row.jokerOf.name}`);

        card.classList.toggle("joker", row.jokerOf !== null);
        (this.view.querySelector(".joker-lock") as HTMLElement).classList.toggle("invisible", row.jokerOf === null);

        /* Replace image */
        const domImg = this.view.querySelector("img") as HTMLImageElement;

        /* Only load images after ranking has fully loaded, to prevent blocking the load */
        row.getImage().then(img => {
            if (img !== undefined) {
                const url = URL.createObjectURL(img);
                domImg.src = url;
            }
        });

        /* Delete after pressing down for five seconds */
        const progress = this.view.querySelector(".hold-progress") as HTMLElement;
        
        this.view.addEventListener("pointerdown", () => {
            if (row.jokerOf !== null) {
                card.classList.remove("joker-shake");
                card.classList.add("joker-shake");
                card.addEventListener("animationend", () => {
                    card.classList.remove("joker-shake");
                }, { once: true });
                return;
            }

            progress.classList.add("filling");

            this.deletionTimer = setTimeout(() => {
                this.view.remove();
                this.onDelete();
            }, TIME_UNTIL_DELETION_MS);
        });

        const cancelHold = () => {
            clearTimeout(this.deletionTimer);
            progress.classList.remove("filling");
        }

        this.view.addEventListener("pointerup", cancelHold);
        this.view.addEventListener("pointerleave", cancelHold);
        this.view.addEventListener("pointercancel", cancelHold);
    }
}