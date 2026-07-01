import html from "./login.html"
import "./login.css"
import type { Component } from "./component"
import { htmlToElement } from "../common/utils";
import type { App } from "../common/app";
import * as api from "../common/api"

export class LoginComponent implements Component {

    public readonly view: HTMLElement;

    constructor(private app: App) {
        this.view = htmlToElement(html);

        /* Show login form if not logged in */
        const loginForm = this.view.querySelector(".login-form") as HTMLElement;
        const logoutForm = this.view.querySelector(".logout-form") as HTMLElement;
        const onTokenChange = async (val: string | null) => {
            if (val == null) {
                loginForm.style.display = "block";
                logoutForm.style.display = "none";
            } else {
                loginForm.style.display = "none";
                logoutForm.style.display = "block";
            }
        }

        app.authToken.subscribe((val, _) => onTokenChange(val));
        onTokenChange(app.userId.value);

        /* Update username automatically */
        const usernameSpan = logoutForm.querySelector(".username") as HTMLElement;
        const onUsernameChange = (val: string | null) => {
            usernameSpan.textContent = val || "unknown";
        }
        app.username.subscribe((val, _) => onUsernameChange(val));
        onUsernameChange(app.username.value);

        /* Perform login on form submit */
        const usernameInput = loginForm.querySelector(".username") as HTMLInputElement;
        const passwordInput = loginForm.querySelector(".password") as HTMLInputElement;
        loginForm.onsubmit = async ev => {
            ev.preventDefault();
            const request = { name: usernameInput.value, password: passwordInput.value };
            const res = await api.login(app, request);
            if (res == "error") {
                alert("Login failed for an unknown reason.");
            } else if (res == "bad_credentials") {
                alert("Wrong username or password.");
            }
        }

        /* Perform logout on form submit */
        logoutForm.onsubmit = async ev => {
            ev.preventDefault();
            await api.logout(app);
        }
    }

}