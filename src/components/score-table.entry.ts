import type { App } from "../common/app";
import { compressImage, isSupportedImageType, MAX_IMAGE_SIZE, readClipboardImage } from "../common/image-utils";
import type { ScoreTableRowWrapper, ScoreTableWrapper } from "../common/table-wrapper";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import detailsTemplate from "./score-table.details.html";
import rowTemplate from "./score-table.entry.html";
import { setupThumbnail } from "./thumbnail";

export interface ScoreTableEntryActions
{
    toggle: () => void,
    changed: () => void,
    remove: () => void
}

/**
 * A row of the score table, which can be expanded to show the details and settings of the entry below it.
 */
export class ScoreTableEntryComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly rowElem: HTMLElement;
    private details: HTMLElement | null = null;

    private expanded = false;
    private editingName = false;
    private nameDraft: string | null = null;
    private imageError: string | null = null;

    constructor(
        private readonly app: App,
        private readonly table: ScoreTableWrapper,
        private readonly row: ScoreTableRowWrapper,
        private readonly actions: ScoreTableEntryActions
    ) {
        this.view = document.createElement("div");
        this.view.classList.add("score-entry");

        this.rowElem = htmlToElement(rowTemplate);
        this.rowElem.onclick = () => this.actions.toggle();
        this.view.appendChild(this.rowElem);

        this.loadThumbnail();
    }

    update(expanded: boolean)
    {
        if (!expanded) {
            this.editingName = false;
            this.nameDraft = null;
            this.imageError = null;
        }

        this.expanded = expanded;
        this.renderRow();

        if (!expanded) {
            this.details?.remove();
            this.details = null;
            return;
        }

        const details = this.renderDetails();
        if (this.details === null) {
            this.view.appendChild(details);
        } else {
            this.details.replaceWith(details);
        }

        this.details = details;
    }

    startNameEdit()
    {
        this.editingName = true;
        this.update(true);

        const input = this.details?.querySelector(".details-name-edit input") as HTMLInputElement | null;
        input?.focus();
        input?.select();
    }

    private get ownMemberId(): string | undefined
    {
        const userId = this.app.userId.value;
        return userId == null ? undefined : this.table.header.userToMemberId.get(userId);
    }

    private renderRow()
    {
        const row = this.row;
        (this.rowElem.querySelector(".name") as HTMLElement).textContent = row.name;

        const avgScore = row.getAvgScore(this.table.header.scoreMode);
        (this.rowElem.querySelector(".fullscore") as HTMLElement).textContent = avgScore?.toFixed(2) ?? "–";

        const ownMemberId = this.ownMemberId;
        const ownScore = ownMemberId == undefined ? undefined : row.getScore(ownMemberId);
        (this.rowElem.querySelector(".own-score") as HTMLElement).classList.toggle("d-none", ownMemberId == undefined);
        (this.rowElem.querySelector(".own-score-value") as HTMLElement).textContent = ownScore == undefined ? "–" : String(ownScore);

        const jokerText = this.rowElem.querySelector(".joker-text") as HTMLElement;
        jokerText.classList.toggle("d-none", row.jokerOf === null);
        jokerText.textContent = row.jokerOf === null ? "" : `Joker: ${row.jokerOf.name}`;

        const chevron = this.rowElem.querySelector(".row-chevron") as HTMLElement;
        chevron.classList.toggle("bi-chevron-right", !this.expanded);
        chevron.classList.toggle("bi-chevron-down", this.expanded);

        this.view.classList.toggle("expanded", this.expanded);
        this.rowElem.setAttribute("aria-expanded", String(this.expanded));
    }

    private renderDetails(): HTMLElement
    {
        const details = htmlToElement(detailsTemplate);
        this.renderName(details);
        this.renderScores(details);

        const ownMemberId = this.ownMemberId;
        (details.querySelector(".details-own-score") as HTMLElement).classList.toggle("d-none", ownMemberId == undefined);
        (details.querySelector(".details-joker") as HTMLElement).classList.toggle("d-none", ownMemberId == undefined);
        if (ownMemberId != undefined) {
            this.renderOwnScore(details, ownMemberId);
            this.renderJoker(details, ownMemberId);
        }

        this.renderImage(details);

        (details.querySelector(".btn-delete-entry") as HTMLButtonElement).onclick = () => this.actions.remove();
        return details;
    }

    private renderName(details: HTMLElement)
    {
        const display = details.querySelector(".details-name") as HTMLElement;
        const form = details.querySelector(".details-name-edit") as HTMLFormElement;
        const input = form.querySelector("input") as HTMLInputElement;

        (display.querySelector(".details-title") as HTMLElement).textContent = this.row.name;
        display.classList.toggle("d-none", this.editingName);
        form.classList.toggle("d-none", !this.editingName);
        input.value = this.nameDraft ?? this.row.name;
        input.oninput = () => this.nameDraft = input.value;

        const cancel = () => {
            this.editingName = false;
            this.nameDraft = null;
            this.update(true);
        };

        (display.querySelector(".btn-edit-name") as HTMLButtonElement).onclick = () => this.startNameEdit();
        (form.querySelector(".btn-cancel-name") as HTMLButtonElement).onclick = cancel;
        input.onkeydown = ev => {
            if (ev.key === "Escape") {
                cancel();
            }
        };

        form.onsubmit = async ev => {
            ev.preventDefault();

            const name = input.value.trim();
            if (name == "" || name == this.row.name) {
                cancel();
                return;
            }

            const success = await this.app.inputBlocker.runAsyncWithBlockedInput(() => this.row.setName(name));
            if (!success) {
                this.app.errorDialog.showError("An error occured while renaming the entry.");
                return;
            }

            this.editingName = false;
            this.nameDraft = null;
            this.actions.changed();
        };
    }

    private renderScores(details: HTMLElement)
    {
        const tbody = details.querySelector(".details-scores tbody") as HTMLElement;
        const members = [...this.table.header.members].sort((a, b) => a.name.localeCompare(b.name));

        for (const member of members) {
            const tr = document.createElement("tr");
            const tdName = document.createElement("td");
            const tdScore = document.createElement("td");

            tdName.textContent = member.name;
            if (member.id === this.ownMemberId) {
                tdName.classList.add("fw-semibold");
            }

            if (this.row.jokerOf?.id === member.id) {
                const jokerHint = document.createElement("span");
                jokerHint.classList.add("text-body-secondary", "ms-1");
                jokerHint.textContent = "(Joker)";
                tdName.appendChild(jokerHint);
            }

            const score = this.row.getScore(member.id);
            tdScore.textContent = score == undefined ? "–" : String(score);
            tdScore.classList.add("text-end");

            tr.append(tdName, tdScore);
            tbody.appendChild(tr);
        }
    }

    private renderOwnScore(details: HTMLElement, ownMemberId: string)
    {
        const ownScore = this.row.getScore(ownMemberId);
        (details.querySelector(".own-score-current") as HTMLElement).textContent = ownScore == undefined ? "–" : String(ownScore);

        const buttons = details.querySelector(".score-buttons") as HTMLElement;
        for (let score = 1; score <= 10; score++) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.classList.add("btn", "btn-sm", score === ownScore ? "btn-primary" : "btn-outline-secondary");
            btn.textContent = String(score);
            btn.setAttribute("aria-pressed", String(score === ownScore));

            btn.onclick = async () => {
                if (score === ownScore) {
                    return;
                }

                const success = await this.app.inputBlocker.runAsyncWithBlockedInput(() => this.row.setScore(score));
                if (!success) {
                    this.app.errorDialog.showError("An error occured while saving your score.");
                    return;
                }

                this.actions.changed();
            };

            buttons.appendChild(btn);
        }
    }

    private renderJoker(details: HTMLElement, ownMemberId: string)
    {
        const btn = details.querySelector(".btn-joker") as HTMLButtonElement;
        const icon = btn.querySelector("i") as HTMLElement;
        const label = btn.querySelector("span") as HTMLElement;
        const jokerOf = this.row.jokerOf;

        if (jokerOf?.id === ownMemberId) {
            btn.disabled = true;
            btn.classList.replace("btn-outline-warning", "btn-warning");
            icon.classList.replace("bi-star", "bi-star-fill");
            label.textContent = "Your joker";
            return;
        }

        if (jokerOf !== null) {
            btn.disabled = true;
            btn.classList.replace("btn-outline-warning", "btn-outline-secondary");
            label.textContent = `Joker of ${jokerOf.name}`;
            return;
        }

        btn.onclick = async () => {
            const success = await this.app.inputBlocker.runAsyncWithBlockedInput(() => this.table.setJoker(ownMemberId, this.row.id));
            if (!success) {
                this.app.errorDialog.showError("An error occured while setting your joker.");
                return;
            }

            this.actions.changed();
        };
    }

    private renderImage(details: HTMLElement)
    {
        const preview = details.querySelector(".details-image-preview") as HTMLImageElement;
        const input = details.querySelector(".input-image") as HTMLInputElement;
        const btnPaste = details.querySelector(".btn-paste-image") as HTMLButtonElement;
        const btnRemove = details.querySelector(".btn-remove-image") as HTMLButtonElement;
        const error = details.querySelector(".image-error") as HTMLElement;

        preview.classList.toggle("d-none", !this.row.hasImage);
        btnRemove.classList.toggle("d-none", !this.row.hasImage);
        if (this.row.hasImage) {
            setupThumbnail(preview, this.row.name, () => this.row.getImage(), this.app.imageViewer);
        }

        error.classList.toggle("d-none", this.imageError === null);
        error.textContent = this.imageError ?? "";

        input.onchange = () => this.uploadImage(input.files?.[0]);

        btnPaste.classList.toggle("d-none", navigator.clipboard == undefined);
        btnPaste.onclick = async () => {
            try {
                const image = await readClipboardImage();
                if (image === undefined) {
                    this.showImageError("The clipboard does not contain a PNG or JPEG image.");
                    return;
                }

                await this.uploadImage(image);
            } catch {
                this.showImageError("Could not read the clipboard. You can also paste the image with Ctrl+V.");
            }
        };

        btnRemove.onclick = async () => {
            const success = await this.app.inputBlocker.runAsyncWithBlockedInput(() => this.row.removeImage());
            if (!success) {
                this.app.errorDialog.showError("An error occured while removing the image.");
                return;
            }

            this.imageError = null;
            this.loadThumbnail();
            this.actions.changed();
        };
    }

    async uploadImage(file: File | undefined)
    {
        if (file === undefined) {
            return;
        }

        if (!isSupportedImageType(file.type)) {
            this.showImageError("Only PNG and JPEG images are supported.");
            return;
        }

        const result = await this.app.inputBlocker.runAsyncWithBlockedInput(async () => {
            const image = await compressImage(file);
            if (image.size > MAX_IMAGE_SIZE) {
                return `The image is too large (${Math.round(image.size / 1024)} KB).`;
            }

            return await this.row.setImage(image) ? null : "An error occured while uploading the image.";
        });

        if (result !== null) {
            this.showImageError(result);
            return;
        }

        this.imageError = null;
        this.loadThumbnail();
        this.actions.changed();
    }

    private showImageError(message: string)
    {
        this.imageError = message;
        this.update(this.expanded);
    }

    private loadThumbnail()
    {
        const img = document.createElement("img");
        img.classList.add("thumb");
        img.alt = "";

        (this.rowElem.querySelector("img.thumb") as HTMLImageElement).replaceWith(img);
        setupThumbnail(img, this.row.name, () => this.row.getImage(), this.app.imageViewer);
    }
}
