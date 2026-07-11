import type { ScoreTableRowWrapper } from "../common/table-wrapper";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import "./tab-elimination-card.css";
import template from "./tab-elimination-card.html";

const TIME_UNTIL_DELETION_MS = 1000; // Keep in sync with CSS

export class TabEliminationCardComponent implements Component
{
    public readonly view: HTMLElement;
    private deletionTimer?: number;

    constructor(
        private readonly row: ScoreTableRowWrapper,
        private readonly onDelete: () => void
    ) {
        this.view = htmlToElement(template);

        /* Replace name */
        const gameNameSpan = this.view.querySelector(".game-name") as HTMLElement;
        gameNameSpan.textContent = row.name;

        /* Replace image */
        const domImg = this.view.querySelector("img") as HTMLImageElement;
        const img = row.image;
        if (img !== undefined) {
            const url = URL.createObjectURL(img);
            domImg.src = url;
        }

        /* Delete after pressing down for five seconds */
        const progress = this.view.querySelector(".hold-progress") as HTMLElement;
        this.view.addEventListener("pointerdown", () => {
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