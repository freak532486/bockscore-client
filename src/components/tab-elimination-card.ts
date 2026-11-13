import type { ScoreTableRowWrapper } from "../common/table-wrapper";
import { htmlToElement } from "../common/utils";
import "./compact-row.css";
import type { Component } from "./component";
import type { ImageViewer } from "./image-viewer";
import "./tab-elimination-card.css";
import template from "./tab-elimination-card.html";
import { setupThumbnail } from "./thumbnail";

export class TabEliminationCardComponent implements Component {
    public readonly view: HTMLElement;

    constructor(
        row: ScoreTableRowWrapper,
        onEliminate: () => void,
        imageViewer: ImageViewer
    ) {
        this.view = htmlToElement(template);

        (this.view.querySelector(".game-name") as HTMLElement).textContent = row.name;

        const jokerText = this.view.querySelector(".joker-text") as HTMLElement;
        jokerText.classList.toggle("d-none", row.jokerOf === null);
        jokerText.textContent = row.jokerOf === null ? "" : `Joker: ${row.jokerOf.name}`;

        const rowIcon = this.view.querySelector(".row-icon") as HTMLElement;
        rowIcon.classList.add(...(row.jokerOf === null ? ["bi-trash3", "text-danger"] : ["bi-lock", "text-body-secondary"]));

        setupThumbnail(this.view.querySelector("img.thumb") as HTMLImageElement, row, imageViewer);

        this.view.onclick = () => {
            if (row.jokerOf === null) {
                onEliminate();
                return;
            }

            this.view.classList.remove("joker-shake");
            void this.view.offsetWidth;
            this.view.classList.add("joker-shake");
            this.view.addEventListener("animationend", () => this.view.classList.remove("joker-shake"), { once: true });
        };
    }
}
