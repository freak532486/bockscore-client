import template from "./login-dialog.html"
import "./login-dialog.css"
import type { Component } from "./component"
import { htmlToElement } from "../common/utils";
import type { App } from "../common/app";
import * as bootstrap from "bootstrap"
import * as api from "../common/api"

export class LoginDialogComponent implements Component
{
    public readonly view: HTMLElement;
    public readonly modal: bootstrap.Modal;

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        this.modal = new bootstrap.Modal(this.view);

        /* Make login button work */
        const inputUsername = this.view.querySelector("#username") as HTMLInputElement;
        const inputPassword = this.view.querySelector("#password") as HTMLInputElement;
        const loginForm = this.view.querySelector("form") as HTMLFormElement;
        const errorDiv = this.view.querySelector(".alert") as HTMLDivElement;

        loginForm.onsubmit = async ev => {
            ev.preventDefault();

            const res = await api.login(app, { "name": inputUsername.value, "password": inputPassword.value });
            if (res == "bad_credentials") {
                errorDiv.classList.remove("d-none");
                errorDiv.textContent = "Invalid username or password";
                return;
            }

            if (res == "error") {
                errorDiv.classList.remove("d-none");
                errorDiv.textContent = "An error occured during login.";
                return;
            }

            errorDiv.classList.add("d-none");
            this.modal.hide();
        };
    }
}