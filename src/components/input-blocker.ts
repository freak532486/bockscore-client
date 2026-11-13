import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./input-blocker.html"
import "./input-blocker.css"

export class InputBlockerComponent implements Component
{
    public readonly view: HTMLElement;

    constructor()
    {
        this.view = htmlToElement(template);

        this.view.addEventListener("pointerdown", () => {
            this.view.classList.add("show-feedback");
        });
    }

    private blockCount = 0;

    private update()
    {
        this.view.classList.toggle("active", this.blockCount > 0);
        this.view.classList.remove("show-feedback");
    }

    async runAsyncWithBlockedInput<T>(runnable: () => Promise<T>): Promise<T> {
        this.blockCount++;
        this.update();

        try {
            return await runnable();
        } finally {
            this.blockCount--;
            this.update();
        }
    }
}