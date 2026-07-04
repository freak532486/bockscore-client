import template from "./root.html"
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import type { App } from "../common/app";
import * as api from "../common/api"
import { LoginDialogComponent } from "./login-dialog";
import { RankingsTabComponent } from "./tab-rankings";
import { WheelTabComponent } from "./tab-wheel";
import { InputDialog } from "./input-dialog";
import { SettingsTab } from "./tab-settings";
import { RankingAccess } from "../common/ranking-access";

export class RootComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly loginDialog: LoginDialogComponent;
    private readonly registerDialog: InputDialog;

    constructor(private readonly app: App)
    {
        this.view = htmlToElement(template);
        const tabRoot = this.view.querySelector("#tab-root") as HTMLElement;

        /* Setup commonly used components */
        document.body.appendChild(app.errorDialog.view);
        document.body.appendChild(app.inputBlocker.view);

        /* Apply theme from local storage */
        const storedTheme = window.localStorage.getItem("theme");
        if (storedTheme == "light" || storedTheme == "dark") {
            this.setTheme(storedTheme);
        }

        /* Write selected ranking into localstorage */
        this.syncRankingFromLocalStorage();

        /* Add each tab to page */
        const tabs: Array<Component> = [
            new RankingsTabComponent(app),
            app.tabElimination,
            new WheelTabComponent(app),
            new SettingsTab(app)
        ];

        tabs.forEach(x => {
            tabRoot.appendChild(x.view);
            x.view.classList.add("d-none");
        });

        tabs[0]!.view.classList.remove("d-none"); // Initial tab is rankings tab.


        /* Make tabs switchable */
        const tabButtons = [...this.view.querySelectorAll(".tabs .nav-link")] as Array<HTMLButtonElement>;
        for (let i = 0; i < tabButtons.length; i++) {
            const button = tabButtons[i]!;
            button.onclick = () => {
                for (const otherButton of tabButtons) {
                    otherButton.classList.remove("active");
                }

                button.classList.add("active");

                for (let j = 0; j < tabButtons.length; j++) {
                    tabs[j]!.view.classList.toggle("d-none", i !== j);
                }
            }
        }

        /* Switch between login/logout view depending on app state */
        const loginDiv = this.view.querySelector("div.login") as HTMLDivElement;
        const logoutDiv = this.view.querySelector("div.logout") as HTMLDivElement;
        const loginButtonUpdate = () => {
            const loggedIn = app.authToken.value != null;

            loginDiv.classList.toggle("d-none", loggedIn);
            logoutDiv.classList.toggle("d-none", !loggedIn);
        }
        app.authToken.subscribe(() => loginButtonUpdate());
        loginButtonUpdate();

        /* Make logout usable */
        const logoutButton = logoutDiv.querySelector("#btn-logout") as HTMLButtonElement;
        logoutButton.onclick = async () => {
            await api.logout(app);
            this.loginDialog.modal.show();
        }

        /* Make login usable */
        this.loginDialog = new LoginDialogComponent(app);
        document.body.appendChild(this.loginDialog.view);
        const loginButton = loginDiv.querySelector("#btn-login") as HTMLButtonElement;
        loginButton.onclick = () => this.loginDialog.modal.show();

        /* Create register dialog */
        this.registerDialog = this.createRegisterDialog();
        this.view.appendChild(this.registerDialog.view);

        /* Auto-update username */
        const usernameSpan = logoutDiv.querySelector(".username") as HTMLSpanElement;
        const usernameUpdate = () => usernameSpan.textContent = app.username.value || "undefined";
        app.username.subscribe(() => usernameUpdate());
        usernameUpdate();

        /* Dark mode toggle */
        const btnDesktop = this.view.querySelector("#btn-theme-desktop") as HTMLButtonElement;
        const btnMobile = this.view.querySelector("#btn-theme-mobile") as HTMLButtonElement;

        btnDesktop.onclick = () => this.toggleDarkMode();
        btnMobile.onclick = () => this.toggleDarkMode();

        /* Show the login dialog by default if not logged in */
        if (app.authToken.value == null) {
            this.loginDialog.modal.show();
        }
    }

    private toggleDarkMode()
    {
        const curMode = document.documentElement.getAttribute("data-bs-theme");
        const newMode = curMode == "light" ? "dark" : "light";

        this.setTheme(newMode);
    }

    private setTheme(theme: "light" | "dark")
    {
        const btnDesktop = this.view.querySelector("#btn-theme-desktop") as HTMLButtonElement;
        const btnMobile = this.view.querySelector("#btn-theme-mobile") as HTMLButtonElement;

        document.documentElement.setAttribute("data-bs-theme", theme);

        for (const btn of [btnDesktop, btnMobile]) {
            const icon = btn.querySelector("i") as HTMLElement;
            icon.classList.toggle("bi-sun-fill", theme == "light");
            icon.classList.toggle("bi-moon-fill", theme == "dark");
        }

        /* Store in browser storage */
        window.localStorage.setItem("theme", theme);
    }

    private createRegisterDialog(): InputDialog
    {
        /* Setup dialog */
        const registerDialog = new InputDialog("Register new user");
        const inputUser = registerDialog.addTextInput("input-username", "Username");
        const inputEmail = registerDialog.addTextInput("input-email", "E-Mail Address");
        const inputPw = registerDialog.addTextInput("input-password", "Password");
        const inputPwConfirm = registerDialog.addTextInput("input-password-confirm", "Confirm Password");

        inputUser.autocomplete = "username";
        inputUser.placeholder = "Username";
        inputEmail.type = "email";
        inputEmail.autocomplete = "email";
        inputEmail.placeholder = "E-Mail";
        inputPw.type = "password";
        inputPw.autocomplete = "new-password";
        inputPw.placeholder = "Password";
        inputPwConfirm.type = "password";
        inputPwConfirm.autocomplete = "new-password";
        inputPwConfirm.placeholder = "Confirm Password";

        registerDialog.primaryButton.textContent = "Register";

        /* Open when register dialog link is clicked */
        const registerLink = this.loginDialog.view.querySelector("#link-register") as HTMLLinkElement;
        registerLink.onclick = () => {
            this.loginDialog.modal.hide();
            this.registerDialog.modal.show();
        }

        /* Send registration request on submit */
        registerDialog.primaryButton.onclick = async () => {
            if (inputPw.value !== inputPwConfirm.value) {
                registerDialog.showError("Passwords do not match.");
            }

            const req: api.RegisterRequest = {
                "name": inputUser.value,
                "email": inputEmail.value,
                "password": inputPw.value
            }

            const validationError = validateRegistrationRequest(req);
            if (validationError !== null) {
                registerDialog.showError(validationError);
                return;
            }

            const res = await api.register(this.app, req);
            if (res == "user_exists") {
                registerDialog.showError("User already exists.");
                return;
            }

            if (res == "error") {
                registerDialog.showError("An error occured.");
                return;
            }

            // Reload page, user will be logged in automatically thanks to refresh token cookie.
            window.location.href = "/";
        }

        return registerDialog;
    }

    private syncRankingFromLocalStorage()
    {
        this.app.selectedRankingId.subscribe((val, old) => {
            if (this.app.username.value == null) {
                return;
            }
            
            const key = "rankingId_" + this.app.username.value;
            if (val == null) {
                window.localStorage.removeItem(key);
            } else {
                window.localStorage.setItem(key, val);
            }
        });

        const loadFromStorage = () => {
            if (this.app.username.value == null) {
                return;
            }

            const key = "rankingId_" + this.app.username.value;
            this.app.selectedRankingId.value = window.localStorage.getItem(key);
        }

        this.app.username.subscribe(() => loadFromStorage());
        loadFromStorage();
    }
}

function validateRegistrationRequest(req: api.RegisterRequest): string | null
{
    if (req.name.length >= 64) {
        return "Username is too long.";
    }

    if (req.password.length < 8) {
        return "Password is too short";
    }

    return null;
}