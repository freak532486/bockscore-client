import type * as api from "../common/api";
import type { App } from "../common/app";
import { EliminationState } from "../common/elimination-state";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { ConfirmDialog } from "./confirm-dialog";
import { EliminationImportDialog } from "./elimination-import-dialog";
import { TabEliminationCardComponent } from "./tab-elimination-card";
import "./tab-elimination.css";
import template from "./tab-elimination.html";

export class EliminationTabComponent implements Component {
    public readonly view: HTMLElement;
    private readonly importDialog = new EliminationImportDialog();
    private readonly confirmDialog = new ConfirmDialog();
    private readonly games: HTMLElement;
    private readonly cards = new Map<string, TabEliminationCardComponent>();

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        this.games = this.view.querySelector(".games") as HTMLElement;
        document.body.appendChild(this.importDialog.view);
        document.body.appendChild(this.confirmDialog.view);

        app.elimination.addEventListener(EliminationState.EVENT_CHANGED, () => this.render());
        this.render();

        const btnImport = this.view.querySelector("#btn-elimination-import") as HTMLButtonElement;
        btnImport.onclick = () => this.importDialog.show((settings) => app.elimination.importFromRanking(settings));
    }

    /**
     * Updates the view in place. Rows are only created, removed or moved when necessary, so nothing flickers and
     * loaded images are kept.
     */
    private render() {
        const items = this.app.elimination.items;

        const ids = new Set(items.map((x) => x.entry.entryId));
        for (const [entryId, card] of this.cards) {
            if (!ids.has(entryId)) {
                card.view.remove();
                this.cards.delete(entryId);
            }
        }

        let previous: Element | null = null;
        for (const { entry, removed, removedBy } of items) {
            let card = this.cards.get(entry.entryId);
            if (card === undefined) {
                card = this.createCard(entry);
                this.cards.set(entry.entryId, card);
            }

            card.update(entry, removed, removedBy);

            const expectedPosition: Element | null =
                previous === null ? this.games.firstElementChild : previous.nextElementSibling;
            if (expectedPosition !== card.view) {
                this.games.insertBefore(card.view, expectedPosition);
            }

            previous = card.view;
        }

        const remaining = items.filter((x) => !x.removed).length;
        const spanRemaining = this.view.querySelector("#span-remaining") as HTMLElement;
        spanRemaining.classList.toggle("invisible", items.length == 0);
        spanRemaining.classList.toggle("text-danger", remaining > items.length / 2);
        spanRemaining.classList.toggle("text-success", remaining <= items.length / 2);
        (this.view.querySelector("#num-current") as HTMLElement).textContent = String(remaining);
        (this.view.querySelector("#num-total") as HTMLElement).textContent = String(items.length);
    }

    private createCard(entry: api.EliminationEntry): TabEliminationCardComponent {
        const loadImage = entry.hasImage
            ? () => this.app.rankingAccess.getEntryImage(entry.entryId)
            : () => Promise.resolve(undefined);

        const card: TabEliminationCardComponent = new TabEliminationCardComponent(
            entry,
            loadImage,
            this.app.imageViewer,
            () => {
                const current = card.entry;
                this.confirmDialog.show(`Do you want to eliminate '${current.name}'?`, () =>
                    this.app.elimination.eliminate(current),
                );
            },
        );

        return card;
    }
}
