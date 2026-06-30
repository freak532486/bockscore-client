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

    setEnabled(enabled: boolean)
    {
        this.view.classList.toggle("active", enabled);
        this.view.classList.remove("show-feedback");
    }

    runWithBlockedInput(runnable: () => void) {
        try {
            this.setEnabled(true);
            runnable();
        } finally {
            this.setEnabled(false);
        }
    }
}