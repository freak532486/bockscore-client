import template from "./score-table.html"
import "./score-table.css"
import type { Component } from "./component"
import { htmlToElement } from "../common/utils"
import type { App } from "../common/app";
import * as api from "../common/api"
import type { ScoreTableRowWrapper, ScoreTableWrapper } from "../common/table-wrapper";

const ROW_HEIGHT = "20px";

export class ScoreTableComponent implements Component
{
    public readonly view;

    constructor(
        private readonly app: App,
        private readonly wrapper: ScoreTableWrapper
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

        /* Create header row */
        const thead = document.createElement("thead") as HTMLElement;
        const headerRow = document.createElement("tr");
        headerRow.appendChild(th("Game"));
        for (const member of this.wrapper.header.members) {
            console.log("member: " + member.id + "(" + member.name + ")");
            headerRow.appendChild(th(member.name));
        }
        console.log("active user: " + this.app.userId.value);
        
        headerRow.appendChild(th("Score"));
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        /* Fetch table data */
        const tbody = document.createElement("tbody");
        for (const entry of this.wrapper.rows) {
            const row = document.createElement("tr");
            row.style.height = ROW_HEIGHT;
            row.appendChild(td(entry.name));

            let avg = 0;
            for (const member of this.wrapper.header.members) {
                const score = entry.getScore(member.id);
                avg += score;
                const cell = td(String(score))
                row.appendChild(cell);

                if (member.id == this.app.userId.value) {
                    this.makeEditable(cell, async str => {
                        const newScore = getScoreOrNull(str);
                        if (newScore !== null && newScore !== score) {
                            await entry.setScore(newScore);
                            await this.refresh();
                            return;
                        }

                        cell.replaceChildren(document.createTextNode(String(score)));
                    });
                }
            }
            avg /= this.wrapper.header.members.length;

            row.appendChild(td(String(avg)));
            tbody.appendChild(row);
        }

        /* Add final row for adding rows */
        const addRowRow = document.createElement("tr");
        const addRowCell = document.createElement("td");
        const addRowButton = document.createElement("button");
        addRowButton.textContent = "Add column";
        addRowButton.classList = "btn btn-sm w-100 py-2 btn-primary";
        addRowCell.colSpan = this.wrapper.header.members.length + 2;
        addRowCell.classList = "text-center p-0";
        addRowButton.onclick = async () => {
            const success = await this.wrapper.addRow("New Row");
            if (success) {
                await this.refresh();
            }
        }

        addRowCell.appendChild(addRowButton);
        addRowRow.appendChild(addRowCell);
        tbody.appendChild(addRowRow);
        table.appendChild(tbody);
    }

    private makeEditable(
        td: HTMLTableCellElement,
        onSubmit: (str: string) => void
    )
    {
        td.classList.add("editable");

        td.onclick = () => {
            if (td.classList.contains("editing")) {
                return;
            }

            td.classList.add("editing");
            const input = document.createElement("input");
            input.classList = "cell-input";
            input.style.width = "100%";
            input.style.height = "100%";
            input.type = "text";
            td.replaceChildren(input);
            input.focus();
            const submitInput = async () => {
                td.classList.remove("editing");
                onSubmit(input.value);
            }
            input.onkeyup = ev => {
                if (ev.key == "Enter") {
                    submitInput();
                }
            }

            input.onblur = () => submitInput();
        }
    }
}

function th(content: string): HTMLTableCellElement
{
    const th = document.createElement("th");
    th.textContent = content;
    th.scope = "column";
    return th;
}

function td(content: string): HTMLTableCellElement
{
    const td = document.createElement("td");
    td.textContent = content;
    return td;
}

/**
 * Returns the score as a number _if_ given string is a valid score.
 */
function getScoreOrNull(str: string) : number | null {
    const num = Number(str);
    if (!Number.isInteger(num)) {
        return null;
    }

    return num >= 0 && num <= 10 ? num : null;
}