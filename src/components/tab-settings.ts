import type { App } from "../common/app";
import { Mutex } from "../common/mutex";
import { RankingAccess } from "../common/ranking-access";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import { ConfirmDialog } from "./confirm-dialog";
import { InputDialog } from "./input-dialog";
import template from "./tab-settings.html"
import rankingTemplate from "./tab-settings.ranking.html"
import * as api from "../common/api"
import { EditRankingDialog } from "./tab-settings.edit-ranking-dialog";

interface RankingSummary
{
    rankingId: string,
    view: HTMLElement,
    active: boolean
}

export class SettingsTab implements Component
{
    public readonly view: HTMLElement;

    private editRankingDialog: EditRankingDialog;
    private confirmDialog = new ConfirmDialog();
    private userDeleteConfirmDialog = new InputDialog("Confirm deletion");

    private refreshLock: Mutex = new Mutex();
    private shown = false;
    private pendingSummaries: Array<RankingSummary> = [];

    constructor(private readonly app: App)
    {
        this.view = htmlToElement(template);
        this.editRankingDialog = new EditRankingDialog(app);
        document.body.appendChild(this.editRankingDialog.view);
        document.body.appendChild(this.confirmDialog.view);

        const inputPassword = this.userDeleteConfirmDialog.addTextInput("input-pw", "Confirm password");
        inputPassword.type = "password";
        inputPassword.autocomplete = "current-password";
        this.userDeleteConfirmDialog.primaryButton.textContent = "Delete User";
        this.userDeleteConfirmDialog.primaryButton.classList.remove("btn-primary");
        this.userDeleteConfirmDialog.primaryButton.classList.add("btn-danger");
        this.userDeleteConfirmDialog.primaryButton.onclick = async () => {
            const res = await api.deleteUser(app, inputPassword.value);
            if (res == "bad_password") {
                this.userDeleteConfirmDialog.showError("Wrong password.");
                return;
            }

            if (res == "error") {
                this.userDeleteConfirmDialog.showError("An error occured.");
                return;
            }

            window.location.href = "/";
        }
        document.body.appendChild(this.userDeleteConfirmDialog.view);

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
        document.body.appendChild(addRankingDialog.view);

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

            this.activateRanking(res);
            addRankingDialog.modal.hide();
        }

        /* Make delete user button work */
        const btnDeleteUser = this.view.querySelector("#btn-delete-user") as HTMLElement;
        btnDeleteUser.onclick = () => this.userDeleteConfirmDialog.modal.show();

        /* Update username span */
        const usernameDisplay = this.view.querySelector("strong.username") as HTMLElement;
        app.username.subscribe((val, _) => usernameDisplay.textContent = val)
        usernameDisplay.textContent = app.username.value;
    }

    onShow()
    {
        this.shown = true;
        this.fillPendingSummaries();
    }

    /**
     * Reloads the app with the given ranking active, so it is loaded behind the loading screen.
     */
    private activateRanking(rankingId: string)
    {
        this.app.selectedRankingId.value = rankingId;
        window.location.assign("/");
    }

    private async updateRankingsView()
    {
        const spinner = this.view.querySelector("div.spinner-border") as HTMLElement;
        const summaries: Array<RankingSummary> = [];
        await this.refreshLock.withLock(async () => {
            try {
                spinner.classList.remove("d-none");
                const div = this.view.querySelector("#div-rankings") as HTMLElement;
                div.replaceChildren();
                div.classList.add("d-none");

                const rankings = await this.app.rankingAccess.getAllRankings();
                if (rankings == "error") {
                    this.app.errorDialog.showError("An error occured while loading your rankings.");
                    return;
                }

                for (const ranking of rankings) {
                    const active = ranking.id == this.app.selectedRankingId.value;

                    /* Fill text */
                    const entry = htmlToElement(rankingTemplate);
                    (entry.querySelector(".ranking-name") as HTMLElement).textContent = ranking.name + (active ? " (Active)" : "");

                    const summary = entry.querySelector(".ranking-summary") as HTMLElement;
                    summary.textContent = "Loading…";
                    summaries.push({ rankingId: ranking.id, view: summary, active });

                    /* Set active button */
                    const btnSetActive = entry.querySelector(".btn-make-ranking-active") as HTMLButtonElement;
                    btnSetActive.disabled = active;
                    btnSetActive.onclick = () => this.activateRanking(ranking.id);

                    /* Delete button */
                    const btnDelete = entry.querySelector(".btn-delete-ranking") as HTMLButtonElement;
                    btnDelete.onclick = () => {
                        this.confirmDialog.show("Do you want to delete ranking '" + ranking.name + "'?", async () => {
                            const res = await this.app.rankingAccess.deleteRanking(ranking.id);
                            if (res == "error") {
                                this.app.errorDialog.showError("An error occured while deleting the ranking.");
                                return;
                            }

                            if (this.app.selectedRankingId.value == ranking.id) {
                                this.app.selectedRankingId.value = null;
                            }
                        });
                    }

                    /* Rename button */
                    const btnRename = entry.querySelector(".btn-edit-ranking") as HTMLButtonElement;
                    const inputRankingName = this.editRankingDialog.view.querySelector("#input-ranking-name") as HTMLInputElement;
                    btnRename.onclick = async () => {
                        inputRankingName.value = "";
                        this.editRankingDialog.show(ranking.id);
                        this.editRankingDialog.primaryButton.onclick = async () => {
                            this.editRankingDialog.hide();
                            if (inputRankingName.value.trim() == "") {
                                return;
                            }

                            const res = await this.app.rankingAccess.renameRanking(ranking.id, inputRankingName.value);
                            if (res == "error") {
                                this.app.errorDialog.showError("An error occured while renaming the ranking.");
                            }
                        }
                    }

                    div.appendChild(entry);
                }

                div.classList.remove("d-none");
            } finally {
                spinner.classList.add("d-none");
            }
        });

        /* The active ranking is loaded anyway. Other rankings are only loaded once this tab is actually viewed. */
        this.pendingSummaries = summaries.filter(x => !x.active);
        await Promise.all(summaries.filter(x => x.active).map(x => this.fillSummary(x)));
        this.fillPendingSummaries();
    }

    private fillPendingSummaries()
    {
        if (!this.shown) {
            return;
        }

        const summaries = this.pendingSummaries;
        this.pendingSummaries = [];
        summaries.forEach(x => this.fillSummary(x));
    }

    private async fillSummary(summary: RankingSummary)
    {
        const tableHeaders = await this.app.rankingAccess.getAllTablesForRanking(summary.rankingId);

        let numEntries = 0;
        for (const tableHeader of tableHeaders) {
            const table = await this.app.rankingAccess.getTable(tableHeader.id);
            if (table !== "error") {
                numEntries += table.rows.length;
            }
        }

        summary.view.textContent = `${tableHeaders.length} tables, ${numEntries} entries.`;
    }
}