import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./message-box.html";
import { MessageBoxMessage } from "./message-box.message";

export class MessageBox implements Component
{
    public readonly view: HTMLElement;
    private readonly messages: HTMLElement;

    constructor() {
        this.view = htmlToElement(template);
        this.messages = this.view.querySelector(".messages") as HTMLElement;
    }

    showMessage(msg: string) {
        const msgComp = new MessageBoxMessage(msg);
        this.messages.appendChild(msgComp.view);
    }
}