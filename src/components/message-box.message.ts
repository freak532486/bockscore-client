import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./message-box.message.html";

const SECONDS_TO_FADE = 20;
const SECONDS_TO_DELETE = 30;

export class MessageBoxMessage implements Component
{
    public readonly view: HTMLElement;
    private firstTs?: number;

    constructor(msg: string) {
        this.view = htmlToElement(template);
        this.view.textContent = msg;

        /* Hide immediately on click */
        this.view.onclick = _ => this.view.remove();

        /* Play animation to fade and eventually remove message */
        const anim = (ts: number) => {
            if (this.firstTs == undefined) {
                this.firstTs = ts;
                requestAnimationFrame(anim);
                return;
            }

            const elapsedSecs = (ts - this.firstTs) / 1000;
            if (elapsedSecs < SECONDS_TO_FADE) {
                requestAnimationFrame(anim);
                return;
            }

            if (elapsedSecs > SECONDS_TO_DELETE) {
                this.view.remove();
                return;
            }

            const k = (elapsedSecs - SECONDS_TO_FADE) / (SECONDS_TO_DELETE - SECONDS_TO_FADE);
            this.view.style.opacity = String(1 - k);
            requestAnimationFrame(anim);
        }

        requestAnimationFrame(anim);
    }
}