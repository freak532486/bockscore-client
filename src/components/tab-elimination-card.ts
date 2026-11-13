import type * as api from "../common/api";
import { htmlToElement } from "../common/utils";
import "./compact-row.css";
import type { Component } from "./component";
import type { ImageViewer } from "./image-viewer";
import "./tab-elimination-card.css";
import template from "./tab-elimination-card.html";
import { setupThumbnail } from "./thumbnail";

export class TabEliminationCardComponent implements Component {
    public readonly view: HTMLElement;
    private readonly nameElem: HTMLElement;
    private readonly subtextElem: HTMLElement;
    private readonly iconElem: HTMLElement;

    private _entry: api.EliminationEntry;
    private removed = false;

    constructor(
        entry: api.EliminationEntry,
        loadImage: () => Promise<Blob | undefined>,
        imageViewer: ImageViewer,
        onEliminate: () => void
    ) {
        this._entry = entry;
        this.view = htmlToElement(template);
        this.nameElem = this.view.querySelector(".game-name") as HTMLElement;
        this.subtextElem = this.view.querySelector(".row-subtext") as HTMLElement;
        this.iconElem = this.view.querySelector(".row-icon") as HTMLElement;

        setupThumbnail(this.view.querySelector("img.thumb") as HTMLImageElement, entry.name, loadImage, imageViewer);

        this.view.onclick = () => {
            if (this.removed) {
                return;
            }

            if (!this._entry.isJoker) {
                onEliminate();
                return;
            }

            this.view.classList.remove("joker-shake");
            void this.view.offsetWidth;
            this.view.classList.add("joker-shake");
            this.view.addEventListener("animationend", () => this.view.classList.remove("joker-shake"), { once: true });
        };
    }

    get entry() {
        return this._entry;
    }

    update(entry: api.EliminationEntry, removed: boolean, removedBy: string | null)
    {
        this._entry = entry;
        this.removed = removed;

        this.nameElem.textContent = entry.name;

        let subtext: string | null = null;
        if (removed) {
            subtext = removedBy === null ? null : `Removed by: ${removedBy}`;
        } else if (entry.isJoker) {
            subtext = `Joker: ${entry.jokerName ?? ""}`;
        }

        this.subtextElem.textContent = subtext ?? "";
        this.subtextElem.classList.toggle("d-none", subtext === null);

        this.view.classList.toggle("removed", removed);
        this.iconElem.classList.toggle("d-none", removed);
        this.iconElem.classList.toggle("bi-trash3", !entry.isJoker);
        this.iconElem.classList.toggle("text-danger", !entry.isJoker);
        this.iconElem.classList.toggle("bi-lock", entry.isJoker);
        this.iconElem.classList.toggle("text-body-secondary", entry.isJoker);
    }
}
