import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./row-details-dialog.html"
import * as bootstrap from "bootstrap"
import "./row-details-dialog.css"

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export class RowDetailsDialog implements Component {
    public readonly view: HTMLElement;
    private readonly modal: bootstrap.Modal;
    private imageData: Blob | undefined;

    constructor() {
        this.view = htmlToElement(template);
        this.modal = new bootstrap.Modal(this.view);

        /* Make paste area work */
        const inputFileUpload = this.view.querySelector("#input-image-upload") as HTMLInputElement;
        const btnPasteImage = this.view.querySelector("#btn-image-paste") as HTMLButtonElement;
        const imagePreview = this.view.querySelector("#image-preview") as HTMLImageElement;
        const imagePreviewDiv = this.view.querySelector("#image-preview-div") as HTMLElement;
        const errMsg = this.view.querySelector("#image-err-msg") as HTMLElement;

        /* Pasting is not supported on some devies */
        btnPasteImage.classList.toggle("d-none", navigator.clipboard == undefined);

        /* Common update function for listeners */
        const updateFromFiles = async (files: Array<File>) => {
            for (const file of files) {
                if (file.size > MAX_IMAGE_SIZE) {
                    errMsg.classList.remove("d-none");
                    errMsg.textContent = "Image is too large!";
                    continue;
                }

                if (!file.type.startsWith("image/")) {
                    continue;
                }

                errMsg.classList.add("d-none");
                this.imageData = new Blob([await file.bytes()], { "type": file.type });
                const url = URL.createObjectURL(this.imageData);
                imagePreview.src = url;
                imagePreviewDiv.classList.remove("d-none");
            }
        }

        /* Listeners */
        inputFileUpload.onchange = () => {
            if (inputFileUpload.files == null) {
                return;
            }

            updateFromFiles([...inputFileUpload.files]);
        };

        btnPasteImage.onclick = async () => {
            updateFromFiles(await readClipboardFiles());
        }

        /* Make remove button work */
        const btnRemoveImage = this.view.querySelector("#btn-remove-image") as HTMLButtonElement;
        btnRemoveImage.onclick = () => {
            if (this.imageData == undefined) {
                return;
            }

            this.imageData = undefined;
            imagePreviewDiv.classList.add("d-none");
        }
    }

    show(
        rowname: string,
        scores: Map<string, number | undefined>,
        update: (score?: number, newRowname?: string, newImage?: Blob) => void,
        deleteRow: () => void
    ) {
        this.reset();

        /* Write rowname into header */
        (this.view.querySelector("#row-details-title") as HTMLElement).textContent = rowname;

        /* Add scores to table */
        const tbody = this.view.querySelector("tbody") as HTMLElement;
        tbody.replaceChildren();

        const sortedScores = [...scores.entries()]
            .map(x => ({ "name": x[0], "score": x[1] }))
            .sort((a, b) => a.name.localeCompare(b.name));

        for (const score of sortedScores) {
            const tr = document.createElement("tr");
            const td1 = document.createElement("td");
            const td2 = document.createElement("td");
            td1.textContent = score.name;
            td2.textContent = String(score.score == undefined ? "---" : score.score);
            tr.appendChild(td1);
            tr.appendChild(td2);
            tbody.appendChild(tr);
        }

        const inputRowname = this.view.querySelector("#row-name-input") as HTMLInputElement;
        const inputScore = this.view.querySelector("#row-score-input") as HTMLInputElement;

        /* Score change */
        const btnSubmit = this.view.querySelector("#row-details-submit") as HTMLButtonElement;
        btnSubmit.onclick = async () => {
            /* Change score if applies */
            let newScore: number | undefined = undefined;
            const num = Number(inputScore.value);
            if (!Number.isNaN(num)) {
                newScore = num;
            }

            /* Change row name if applies */
            let newRowname: string | undefined = undefined;
            const inValue = inputRowname.value.trim();
            if (inValue.length > 0) {
                newRowname = inValue;
            }

            update(newScore, newRowname, this.imageData);
            this.modal.hide();
        }

        /* Delete row */
        const btnDelete = this.view.querySelector("#btn-delete-row") as HTMLButtonElement;
        btnDelete.onclick = () => {
            deleteRow();
            this.modal.hide();
        }

        this.modal.show();
    }

    private reset()
    {
        const inputRowname = this.view.querySelector("#row-name-input") as HTMLInputElement;
        const inputScore = this.view.querySelector("#row-score-input") as HTMLInputElement;
        const imagePreview = this.view.querySelector("#image-preview") as HTMLImageElement;
        const errMsg = this.view.querySelector("#image-err-msg") as HTMLElement;

        inputRowname.value = "";
        inputScore.value = "";
        errMsg.textContent = "";
        imagePreview.src = "";
        
        errMsg.classList.add("d-none");
    }
}

async function readClipboardFiles() {
    const items = await navigator.clipboard.read();
    const files = [];

    let i = 0;
    for (const item of items) {
        for (const type of item.types) {
            const blob = await item.getType(type);
            if (blob.type !== "image/png" && blob.type !== "image/jpeg") {
                continue;
            }

            const filename = "clip-" + i;

            files.push(
                new File([blob], filename, {
                    type: blob.type,
                    lastModified: Date.now(),
                })
            );
        }
    }

    return files;
}