import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import "./image-viewer.css";
import template from "./image-viewer.html";

export class ImageViewer implements Component
{
    public readonly view: HTMLElement;
    private readonly img: HTMLImageElement;
    private readonly caption: HTMLElement;
    private url: string | null = null;

    constructor() {
        this.view = htmlToElement(template);
        this.img = this.view.querySelector("img") as HTMLImageElement;
        this.caption = this.view.querySelector("figcaption") as HTMLElement;

        this.view.onclick = () => this.hide();
        document.addEventListener("keydown", ev => {
            if (ev.key === "Escape") {
                this.hide();
            }
        });
    }

    show(image: Blob, caption: string)
    {
        this.hide();

        this.url = URL.createObjectURL(image);
        this.img.src = this.url;
        this.img.alt = caption;
        this.caption.textContent = caption;
        this.view.classList.remove("d-none");
    }

    hide()
    {
        this.view.classList.add("d-none");
        this.img.removeAttribute("src");

        if (this.url !== null) {
            URL.revokeObjectURL(this.url);
            this.url = null;
        }
    }
}
