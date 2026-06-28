import template from "./ranking-selector.html"
import "./ranking-selector.css"
import type { Component } from "./component";
import { htmlToElement } from "../common/utils";
import type { App } from "../common/app";
import * as api from "../common/api"

export class RankingSelector implements Component
{

    public readonly view: HTMLElement;

    constructor(private readonly app: App) {
        this.view = htmlToElement(template);
        app.authToken.subscribe(() => this.reloadRankings());
        this.reloadRankings();

        app.selectedRankingId.subscribe(() => this.reloadScoreTables());
        this.reloadScoreTables();
    }

    private async reloadRankings()
    {
        /* First, update rankings */
        const rankingSelector = this.view.querySelector("select.ranking") as HTMLSelectElement;
        rankingSelector.replaceChildren();

        const rankings = await api.fetchAllRankings(this.app);
        if (rankings == "error" || rankings.length == 0) {
            this.view.style.display = "none";
            this.app.selectedRankingId.value = null;
            this.app.selectedTableId.value = null;
            return;
        }

        rankingSelector.onchange = ev => {
            this.app.selectedRankingId.value = rankingSelector.value;
        }

        this.view.style.display = "block";
        for (const ranking of rankings) {
            const option = document.createElement("option");
            option.value = ranking.id;
            option.textContent = ranking.name;
            rankingSelector.appendChild(option);
        }

        rankingSelector.dispatchEvent(new Event("change", { "bubbles": true }));
    }

    private async reloadScoreTables() {
        const scoreTableSelector = this.view.querySelector("select.table") as HTMLSelectElement;
        scoreTableSelector.replaceChildren();

        if (this.app.selectedRankingId.value == null) {
            this.app.selectedTableId.value = null;
            return;
        }

        const tables = await api.fetchTablesForRanking(this.app, this.app.selectedRankingId.value);
        if (tables == "error" || tables.length == 0) {
            return;
        }

        scoreTableSelector.onchange = ev => {
            this.app.selectedTableId.value = scoreTableSelector.value;
        }

        for (const table of tables) {
            const option = document.createElement("option");
            option.value = table.id;
            option.textContent = table.name;
            scoreTableSelector.appendChild(option);
        }

        scoreTableSelector.dispatchEvent(new Event("change", { "bubbles": true }));
    }

}