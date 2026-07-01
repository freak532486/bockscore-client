import template from "./tab-wheel.html";
import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { WheelComponent } from "./wheel";

export class WheelTabComponent implements Component
{
    public readonly view;

    constructor(app: App) {
        this.view = htmlToElement(template);
        const wheelContainer = this.view.querySelector("#wheel-container") as HTMLElement;
        wheelContainer.appendChild(new WheelComponent([ "Apples", "Berries", "CherryCherryCherryCherryCherry", "Dates" ]).view);
    }
}