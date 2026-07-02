import template from "./root.html"
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import type { App } from "../common/app";
import * as api from "../common/api"
import { LoginDialogComponent } from "./login-dialog";
import { RankingsTabComponent } from "./tab-rankings";
import { ScoreTableWrapper } from "../common/table-wrapper";
import { EliminationTabComponent } from "./tab-elimination";
import { WheelTabComponent } from "./tab-wheel";
import { Modal } from "bootstrap";
import { InputDialog } from "./input-dialog";

export class RootComponent implements Component
{
    public readonly view: HTMLElement;

    constructor(private readonly app: App)
    {
        this.view = htmlToElement(template);
        const tabRoot = this.view.querySelector("#tab-root") as HTMLElement;

        /* Create and setup dialog for adding ranking */
        const addRankingDialog = new InputDialog("Add Ranking");
        addRankingDialog.addTextInput("input-ranking-name", "Ranking name");
        addRankingDialog.primaryButton.textContent = "Add";

        const addRankingButton = this.view.querySelector("#btn-add-ranking") as HTMLButtonElement;
        addRankingButton.onclick = () => addRankingDialog.modal.show();
        this.view.appendChild(addRankingDialog.view);

        /* Setup other dialogs */
        document.body.appendChild(app.errorDialog.view);
        this.view.appendChild(app.inputBlocker.view);

        /* Add each tab to page */
        const tabs: Array<Component> = [
            new RankingsTabComponent(app),
            app.tabElimination,
            new WheelTabComponent(app)
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

        /* Update active ranking on every login */
        const selectRankings = this.view.querySelector("#select-rankings") as HTMLSelectElement;
        selectRankings.onchange = () => app.selectedRankingId.value = 
            selectRankings.value == ""
                ? null
                : selectRankings.value;

        const updateRankings = async () => {
            app.inputBlocker.runWithBlockedInput(async () => {
                const response = await api.fetchAllRankings(app);
                if (response == "error") {
                    app.errorDialog.showError("An error occured while fetching available rankings.");
                    return;
                }

                /* Update rankings selector and read tables into cache */
                selectRankings.replaceChildren();
                selectRankings.classList.toggle("d-none", response.length == 0);
                for (const ranking of response) {
                    /* Create selector entry */
                    const option = document.createElement("option");
                    option.value = ranking.id;
                    option.textContent = ranking.name;
                    selectRankings.appendChild(option);

                    /* Write tables into cache if they dont exist. */
                    if (!app.rankingCache.has(ranking.id)) {
                        app.rankingCache.set(ranking.id, new Map());
                    }

                    const allTables = await api.fetchTablesForRanking(app, ranking.id);
                    if (allTables == "error") {
                        continue;
                    }

                    const rankingCache = app.rankingCache.get(ranking.id)!;
                    for (const table of allTables) {
                        if (rankingCache.has(table.id)) {
                            continue;
                        }

                        const wrapper = await ScoreTableWrapper.loadTable(app, ranking.id, table.id);
                        if (wrapper == "error" || wrapper == "not_found") {
                            continue;
                        }
                        rankingCache.set(table.id, wrapper);
                    }

                    /* Remove tables from cache that don't exist */
                    for (const tableId of rankingCache.keys()) {
                        if (allTables.filter(x => x.id == tableId).length == 0) {
                           rankingCache.delete(tableId);
                        }
                    }
                }

                selectRankings.dispatchEvent(new Event("change", { "bubbles": true }));
            });
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