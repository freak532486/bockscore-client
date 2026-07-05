import { Modal } from "bootstrap";
import { htmlToElement } from "../common/utils";
import type { Component } from "./component";
import template from "./tab-settings.edit-ranking-dialog.html"
import templateMemberEntry from "./tab-settings.edit-ranking-dialog.member.html"
import type { App } from "../common/app";
import { RankingAccess } from "../common/ranking-access";

export class EditRankingDialog implements Component
{
    public readonly view: HTMLElement;
    private readonly modal: Modal;
    public readonly primaryButton: HTMLButtonElement;

    private activeRankingId: string | undefined;

    constructor(private readonly app: App)
    {
        this.view = htmlToElement(template);
        this.modal = new Modal(this.view);
        this.primaryButton = this.view.querySelector(".dialog-primary-button") as HTMLButtonElement;

        /* Refresh member list on change */
        app.rankingAccess.addEventListener(RankingAccess.EVENT_MEMBERS_CHANGED, ev => {
            const detail = (ev as CustomEvent).detail;
            if (detail !== this.activeRankingId) {
                return;
            }

            this.refresh();
        });
    }

    async show(rankingId: string)
    {
        this.activeRankingId = rankingId;
        await this.refresh();
        this.modal.show();

        /* Make invite button work */
        const btnInvite = this.view.querySelector("#btn-invite-member") as HTMLButtonElement;
        const inputInvite = this.view.querySelector("#input-invite-member") as HTMLInputElement;
        const alert = this.view.querySelector("div.alert") as HTMLElement;

        btnInvite.onclick = async () => {
            const res = await this.app.rankingAccess.inviteMember(rankingId, inputInvite.value);
            
            const isError = res == "error" || res == "user_not_found";
            alert.classList.toggle("d-none", !isError);
            alert.classList.toggle("alert-danger", isError)
            if (res == "error") {
                alert.textContent = "An error occured during invite."
            } else if (res == "user_not_found") {
                alert.textContent = `User with name '${inputInvite.value}' not found.`
            }
        }
    }

    hide() {
        this.modal.hide();
    }

    async refresh()
    {
        if (this.activeRankingId == undefined) {
            return;
        }

        const ul = this.view.querySelector("ul.members-list") as HTMLElement;
        ul.replaceChildren();

        const members = await this.app.rankingAccess.getMembersForRanking(this.activeRankingId);
        for (const member of members) {
            const li = htmlToElement(templateMemberEntry);
            (li.querySelector(".name") as HTMLElement).textContent = member.name;
            (li.querySelector(".role") as HTMLElement).textContent = member.isGuest ? "Guest" : "Member";
            ul.appendChild(li);
        }
    }
}