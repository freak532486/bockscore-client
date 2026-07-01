import template from "./tab-wheel.html";
import type { App } from "../common/app";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";

export class WheelTabComponent implements Component
{
    public readonly view;

    constructor(app: App) {
        this.view = htmlToElement(template);
    }
}