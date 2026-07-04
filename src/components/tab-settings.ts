import type { App } from "../common/app";
import { Mutex } from "../common/mutex";
import { RankingAccess } from "../common/ranking-access";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { InputDialog } from "./input-dialog";
import template from "./tab-settings.html"
import rankingTemplate from "./tab-settings.ranking.html"

export class SettingsTab implements Component
{
    public readonly view: HTMLElement;

    private refreshLock: Mutex = new Mutex();

    constructor(private readonly app: App)
    {
        this.view = htmlToElement(template);

        /* Refresh ranking list on every user change */
        app.rankingAccess.addEventListener(RankingAccess.EVENT_RANKINGS_CHANGED, () => this.updateRankingsView());
        app.selectedRankingId.subscribe(() => this.updateRankingsView());
        this.updateRankingsView();

        /* Create and setup dialog for adding ranking */
        const addRankingDialog = new InputDialog("Add Ranking");
        const inputName = addRankingDialog.addTextInput("input-ranking-name", "Ranking name");
        addRankingDialog.primaryButton.textContent = "Add";

        const addRankingButton = this.view.querySelector("#btn-add-ranking") as HTMLButtonElement;
        addRankingButton.onclick = () => addRankingDialog.modal.show();
        this.view.appendChild(addRankingDialog.view);

        /* Make add ranking dialog work */
        addRankingDialog.primaryButton.onclick = async () => {
            const rankingName = inputName.value.trim();
            if (rankingName == "") {
                return;
            }

            const res = await app.rankingAccess.addRanking(rankingName);
            if (res == "error") {
                addRankingDialog.showError("An error occured.");
                return;
            }

            this.app.selectedRankingId.value = res;
            addRankingDialog.modal.hide();
        }
    }

    private async updateRankingsView()
    {
        await this.refreshLock.withLock(async () => {
            const div = this.view.querySelector("#div-rankings") as HTMLElement;
            div.replaceChildren();
            div.classList.add("d-none");

            for (const ranking of await this.app.rankingAccess.getAllRankings()) {
                const active = ranking.id == this.app.selectedRankingId.value;

                /* Fill text */
                const entry = htmlToElement(rankingTemplate);
                (entry.querySelector(".ranking-name") as HTMLElement).textContent = ranking.name + (active ? " (Active)" : "");

                let numTables = 0;
                let numEntries = 0;

                const tableHeaders = await this.app.rankingAccess.getAllTablesForRanking(ranking.id);
                numTables = tableHeaders.length;
                for (const tableHeader of tableHeaders) {
                    const table = await this.app.rankingAccess.getTable(tableHeader.id);
                    if (table == "error") {
                        continue;
                    }

                    numEntries += table.rows.length;
                }

                (entry.querySelector(".ranking-summary") as HTMLElement).textContent = `${numTables} tables, ${numEntries} entries.`;

                /* Set active button */
                const btnSetActive = entry.querySelector(".btn-make-ranking-active") as HTMLButtonElement;
                btnSetActive.disabled = active;
                btnSetActive.onclick = () => this.app.selectedRankingId.value = ranking.id;

                div.appendChild(entry);
            }

            div.classList.remove("d-none");
        });
    }
}