import template from "./root.html"
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import type { App } from "../common/app";
import * as api from "../common/api"
import { LoginDialogComponent } from "./login-dialog.component";
import { RankingsTabComponent } from "./tab-rankings.component";

export class RootComponent implements Component
{
    public readonly view: HTMLElement;

    constructor(private readonly app: App)
    {
        this.view = htmlToElement(template);
        const tabRoot = this.view.querySelector("#tab-root") as HTMLElement;

        document.body.appendChild(app.errorDialog.view);

        /* Add each tab to page */
        const rankingsTab = new RankingsTabComponent(app);
        tabRoot.appendChild(rankingsTab.view);

        /* Make tabs switchable */
        const tabButtons = [...this.view.querySelectorAll(".tabs .nav-link")] as Array<HTMLButtonElement>;
        for (let i = 0; i < tabButtons.length; i++) {
            const button = tabButtons[i]!;
            button.onclick = () => {
                for (const otherButton of tabButtons) {
                    otherButton.classList.remove("active");
                }

                button.classList.add("active");

                rankingsTab.view.classList.toggle("d-none", i !== 0);
            }
        }

        /* Update active ranking on every login */
        const selectRankings = this.view.querySelector("#select-rankings") as HTMLSelectElement;
        selectRankings.onchange = () => app.selectedRankingId.value = 
            selectRankings.value == ""
                ? null
                : selectRankings.value;

        const updateRankings = async () => {
            const response = await api.fetchAllRankings(app);
            if (response == "error") {
                app.errorDialog.showError("An error occured while fetching available rankings.");
                return
            }

            selectRankings.replaceChildren();

            for (const ranking of response) {
                const option = document.createElement("option");
                option.value = ranking.id;
                option.textContent = ranking.name;
                selectRankings.appendChild(option);
            }

            selectRankings.dispatchEvent(new Event("change", { "bubbles": true }));
        }

        app.authToken.subscribe(() => updateRankings());
        updateRankings();

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
        logoutButton.onclick = () => api.logout(app);

        /* Make login usable */
        const loginDialog = new LoginDialogComponent(app);
        document.body.appendChild(loginDialog.view);
        const loginButton = loginDiv.querySelector("#btn-login") as HTMLButtonElement;
        loginButton.onclick = () => loginDialog.show();

        /* Auto-update username */
        const usernameSpan = logoutDiv.querySelector(".username") as HTMLSpanElement;
        const usernameUpdate = () => usernameSpan.textContent = app.username.value || "undefined";
        app.username.subscribe(() => usernameUpdate());
        usernameUpdate();
    }
}