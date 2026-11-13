import { Collapse } from "bootstrap";
import * as api from "../common/api";
import type { App } from "../common/app";
import { RankingAccess } from "../common/ranking-access";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { InputDialog } from "./input-dialog";
import { LoginDialogComponent } from "./login-dialog";
import "./root.css";
import template from "./root.html";
import { RankingsTabComponent } from "./tab-rankings";
import { SettingsTab } from "./tab-settings";
import { WheelTabComponent } from "./tab-wheel";

const TAB_TABLES = 0;
const TAB_SETTINGS = 3;
const TAB_PATHS = ["/tables", "/elimination", "/wheel", "/settings"];

export class RootComponent implements Component
{
    public readonly view: HTMLElement;
    private readonly loginDialog: LoginDialogComponent;
    private readonly registerDialog: InputDialog;
    private readonly tabs: Array<Component>;
    private readonly tabButtons: Array<HTMLButtonElement>;
    private tabBeforeRedirect: number | null = null;

    constructor(private readonly app: App)
    {
        this.view = htmlToElement(template);
        const tabRoot = this.view.querySelector("#tab-root") as HTMLElement;

        /* Preload every selected ranking */
        app.selectedRankingId.subscribe((val, _) => {
            if (val == null) {
                return;
            }

            app.rankingAccess.preloadRanking(val);
        });

        /* Setup commonly used components */
        document.body.appendChild(app.errorDialog.view);
        document.body.appendChild(app.inputBlocker.view);
        document.body.appendChild(app.imageViewer.view);

        /* Apply theme from local storage */
        const storedTheme = window.localStorage.getItem("theme");
        if (storedTheme == "light" || storedTheme == "dark") {
            this.setTheme(storedTheme);
        }

        /* Add each tab to page */
        this.tabs = [
            new RankingsTabComponent(app),
            app.tabElimination,
            new WheelTabComponent(app),
            new SettingsTab(app)
        ];

        this.tabs.forEach(x => {
            tabRoot.appendChild(x.view);
            x.view.classList.add("d-none");
        });

        /* Close the burger menu after any button inside it was used */
        const navbarContent = this.view.querySelector("#navbarContent") as HTMLElement;
        const navbarCollapse = new Collapse(navbarContent, { toggle: false });
        const navbarToggler = this.view.querySelector(".navbar-toggler") as HTMLButtonElement;
        navbarContent.addEventListener("click", ev => {
            const button = (ev.target as Element).closest("button");
            if (button === null) {
                return;
            }

            navbarCollapse.hide();
            button.blur();
            navbarToggler.blur();
        });

        /* Make tabs switchable */
        this.tabButtons = [...this.view.querySelectorAll(".tabs .nav-link")] as Array<HTMLButtonElement>;
        this.tabButtons.forEach((button, i) => button.onclick = () => {
            this.tabBeforeRedirect = null;
            this.navigate(i, "push");
        });
        window.addEventListener("popstate", () => this.navigate(this.tabFromLocation(), "replace"));

        /* Restore the selected ranking, which also decides the initial tab */
        this.syncRankingFromLocalStorage();

        /* Tabs other than settings are only selectable while the selected ranking exists */
        const makeTabsSelectable = async () => {
            const selected = this.app.selectedRankingId.value;
            const allRankings = selected == null ? [] : await this.app.rankingAccess.getAllRankings();
            if (selected !== this.app.selectedRankingId.value || allRankings == "error") {
                return;
            }

            const activeRankingExists = allRankings.some(x => x.id == selected);
            this.setRankingTabsVisible(activeRankingExists);
            if (!activeRankingExists) {
                this.navigate(TAB_SETTINGS, "replace");
            }
        }

        this.app.selectedRankingId.subscribe(() => makeTabsSelectable());
        this.app.rankingAccess.addEventListener(RankingAccess.EVENT_RANKINGS_CHANGED, () => makeTabsSelectable());
        makeTabsSelectable();

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
            if (await api.logout(app) == "error") {
                this.app.errorDialog.showError("An error occured while logging out.");
                return;
            }

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

    /**
     * Shows the given tab and updates the URL. Navigation by the user adds a history entry, while redirects replace the
     * current one, so the back button never leads to a page that immediately redirects again.
     */
    private navigate(index: number, mode: "push" | "replace")
    {
        const path = TAB_PATHS[index]!;
        if (window.location.pathname !== path) {
            if (mode === "push") {
                window.history.pushState(null, "", path);
            } else {
                window.history.replaceState(null, "", path);
            }
        }

        this.showTab(index);
    }

    /**
     * The tab requested by the URL. Unknown paths lead to the tables, and tabs other than settings need a selected
     * ranking.
     */
    private tabFromLocation(): number
    {
        const index = TAB_PATHS.indexOf(window.location.pathname.replace(/\/+$/, ""));
        const requested = index === -1 ? TAB_TABLES : index;
        if (requested !== TAB_SETTINGS && this.app.selectedRankingId.value == null) {
            this.tabBeforeRedirect = requested;
            return TAB_SETTINGS;
        }

        return requested;
    }

    private showTab(index: number)
    {
        this.tabButtons.forEach((button, i) => button.classList.toggle("active", i === index));
        this.tabs.forEach((tab, i) => tab.view.classList.toggle("d-none", i !== index));
    }

    private setRankingTabsVisible(visible: boolean)
    {
        this.tabButtons.forEach((button, i) => button.classList.toggle("d-none", i !== TAB_SETTINGS && !visible));
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
                return;
            }

            const req: api.RegisterRequest = {
                "name": inputUser.value.trim(),
                "email": inputEmail.value.trim(),
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

    /**
     * The selected ranking is stored by user id, because the user id is known right after sign in, while the username
     * needs another request.
     */
    private syncRankingFromLocalStorage()
    {
        const storageKey = (userId: string) => "selectedRanking_" + userId;

        this.app.selectedRankingId.subscribe(val => {
            if (this.app.userId.value == null) {
                return;
            }

            const key = storageKey(this.app.userId.value);
            if (val == null) {
                window.localStorage.removeItem(key);
            } else {
                window.localStorage.setItem(key, val);
            }
        });

        const selectRanking = (rankingId: string | null) => {
            this.app.selectedRankingId.value = rankingId;
            this.setRankingTabsVisible(rankingId != null);
            if (rankingId != null && this.tabBeforeRedirect !== null) {
                this.navigate(this.tabBeforeRedirect, "replace");
                this.tabBeforeRedirect = null;
            } else {
                this.navigate(this.tabFromLocation(), "replace");
            }
        };

        const loadFromStorage = () => {
            const userId = this.app.userId.value;
            selectRanking(userId == null ? null : window.localStorage.getItem(storageKey(userId)));
        };

        const migrateFromUsernameKey = () => {
            if (this.app.username.value == null) {
                return;
            }

            const legacyKey = "rankingId_" + this.app.username.value;
            const legacyRankingId = window.localStorage.getItem(legacyKey);
            if (legacyRankingId == null) {
                return;
            }

            window.localStorage.removeItem(legacyKey);
            if (this.app.selectedRankingId.value == null) {
                selectRanking(legacyRankingId);
            }
        };

        this.app.userId.subscribe(() => loadFromStorage());
        this.app.username.subscribe(() => migrateFromUsernameKey());
        loadFromStorage();
        migrateFromUsernameKey();
    }
}

function validateRegistrationRequest(req: api.RegisterRequest): string | null
{
    if (req.name.length == 0) {
        return "Username is required.";
    }

    if (req.name.length > 64) {
        return "Username is too long.";
    }

    if (req.email.length == 0) {
        return "E-Mail address is required.";
    }

    if (req.password.length < 8) {
        return "Password is too short.";
    }

    if (req.password.length > 48) {
        return "Password is too long.";
    }

    return null;
}