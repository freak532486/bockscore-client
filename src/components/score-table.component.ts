import template from "./score-table.html"
import "./score-table.css"
import type { Component } from "./component"
import { htmlToElement } from "../common/utils"
import type { App } from "../common/app";
import * as api from "../common/api"

export class ScoreTableComponent implements Component
{
    public readonly view;

    constructor(
        private readonly app: App,
        private readonly rankingId: string,
        private readonly tableId: string
    ) {
        this.view = htmlToElement(template);
        this.refresh();
    }

    /**
     * Refreshes the table content.
     */
    public async refresh()
    {
        /* Rebuild table from scratch */
        const table = this.view.querySelector("table") as HTMLTableElement;
        table.replaceChildren();

        /* Fetch all members */
        const members = await api.fetchMembersForRanking(this.app, this.rankingId);
        if (members == "error") {
            table.style.display = "none";
            return;
        }

        /* Fetch score data for members */
        const scoreDataResponse = await api.fetchUserScores(this.app, members.map(x => x.id));
        if (scoreDataResponse == "error") {
            table.style.display = "none";
            return;
        }

        const scoreData: Map<string, Map<string, number>> = new Map();
        for (const entry of scoreDataResponse) {
            if (!scoreData.has(entry.entryId)) {
                scoreData.set(entry.entryId, new Map());
            }

            scoreData.get(entry.entryId)!.set(entry.memberId, entry.value || 0);
        }

        /* Create header row */
        const headerRow = document.createElement("tr");
        headerRow.appendChild(td(""));
        headerRow.appendChild(columnHeader("Game"));
        for (const member of members) {
            headerRow.appendChild(columnHeader(member.name));
        }
        headerRow.appendChild(columnHeader("Score"));
        table.appendChild(headerRow);
        
        /* Fetch table data */
        const tableEntries = await api.fetchScoreTableRows(this.app, this.tableId);
        if (tableEntries == "error") {
            table.style.display = "none";
            return;
        }

        for (let i = 0; i < tableEntries.length; i++) {
            const entry = tableEntries[i]!;
            const row = document.createElement("tr");
            row.appendChild(rowHeader(String(i)));
            row.appendChild(td(entry.name));

            let avg = 0;
            for (const member of members) {
                const score = scoreData.get(entry.id)?.get(member.id) || 0;
                avg += score;
                row.appendChild(td(String(avg)));
            }
            avg /= members.length;

            row.appendChild(td(String(avg)));
            table.appendChild(row);
        }
    }
}

function columnHeader(content: string): HTMLTableCellElement
{
    const th = document.createElement("th");
    th.textContent = content;
    th.scope = "column";
    return th;
}

function rowHeader(content: string): HTMLTableCellElement
{
    const th = document.createElement("th");
    th.textContent = content;
    th.scope = "row";
    return th;
}

function td(content: string): HTMLTableCellElement
{
    const td = document.createElement("td");
    td.textContent = content;
    return td;
}