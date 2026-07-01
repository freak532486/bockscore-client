import type { App } from "./app";
import * as api from "./api"

const DEFAULT_SCORE = 5;

/**
 * A wrapper around a score table. Can be modified. Every modification will automatically be sent to the API. If that
 * call fails, the table is also not modified internally.
 */
export class ScoreTableWrapper
{

    private constructor(
        private readonly app: App,
        public readonly id: string,
        public readonly header: ScoreTableHeaderWrapper,
        private _rows: Array<ScoreTableRowWrapper>,
        private readonly userIdToMemberId: Map<string, string>
    )
    {}

    static async loadTable(app: App, rankingId: string, tableId: string): Promise<ScoreTableWrapper | "not_found" | "error"> {
        /* First, we fetch the header */
        const membersRes = await api.fetchMembersForRanking(app, rankingId);
        if (membersRes == "error") {
            return "error";
        }

        const allTables = await api.fetchTablesForRanking(app, rankingId);
        if (allTables == "error") {
            return "error";
        }

        const matchingTableHeaders = allTables.filter(x => x.id == tableId);
        if (matchingTableHeaders.length == 0) {
            return "not_found";
        }

        const tableHeader = matchingTableHeaders[0]!;

        const userIdToMemberId = new Map<string, string>();
        for (const member of membersRes) {
            userIdToMemberId.set(member.user.id, member.id);
        }

        const header = new ScoreTableHeaderWrapper(
            app,
            tableHeader?.name,
            membersRes.map(x => ({ "id": x.user.id, "name": x.name })),
            "average"
        );

        /* Fetch the scores */
        const scoresRes = await api.fetchUserScores(app, membersRes.map(x => x.id));
        if (scoresRes == "error") {
            return "error";
        }

        const scoreMap = new Map<string, Map<string, ScoreEntry>>(); // entryId -> memberId -> value
        for (const score of scoresRes) {
            if (score.value == undefined) {
                continue;
            }

            if (!scoreMap.has(score.entryId)) {
                scoreMap.set(score.entryId, new Map());
            }

            scoreMap.get(score.entryId)!.set(score.memberId, { id: score.id, value: score.value });
        }

        /* Fetch all table rows and create wrappers */
        const rowsRes = await api.fetchScoreTableRows(app, tableId);
        if (rowsRes == "error") {
            return "error";
        }

        const rows = rowsRes.map(x => new ScoreTableRowWrapper(
            app,
            x.id,
            x.name,
            scoreMap.get(x.id) || new Map(),
            userIdToMemberId
        ));

        /* Done */
        return new ScoreTableWrapper(app, tableId, header, rows, userIdToMemberId);
    }

    get rows() {
        return  [...this._rows].sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Adds a row to the table.
     */
    async addRow(name: string): Promise<boolean>
    {
        const res = await api.addRow(this.app, this.id, name);
        if (res !== "error") {
            this._rows.push(new ScoreTableRowWrapper(this.app, res, name, new Map(), this.userIdToMemberId));
            return true;
        }

        return false;
    }

    /**
     * Deletes this row from the table.
     */
    async deleteRow(rowId: string): Promise<boolean>
    {
        const rowWrapper = this._rows.filter(x => x.id == rowId);
        if (rowWrapper.length == 0) {
            return false;
        }

        const res = await api.deleteRow(this.app, rowId);
        if (res == "error") {
            return false;
        }

        this._rows = this._rows.filter(x => x.id !== rowId);
        return true;
    }

}

export interface User
{
    id: string,
    name: string
}

export class ScoreTableHeaderWrapper
{
    constructor(
        private readonly app: App,
        public readonly name: string,
        private readonly _members: Array<User>,
        public readonly scoreMode: "average" | "magic"
    ) {}

    get members() {
        return this._members;
    }
}

interface ScoreEntry
{
    id: string | undefined,
    value: number
}

export class ScoreTableRowWrapper
{
    constructor(
        private readonly app: App,
        public readonly id: string,
        private _name: string,
        private readonly _data: Map<string, ScoreEntry>,
        private readonly userToMemberId: Map<string, string>
    ) {}

    get name() {
        return this._name;
    }

    /**
     * Changes the name of this row.
     */
    async setName(newName: string) {
        const res = await api.renameRow(this.app, this.id, newName);
        if (res == "ok") {
            this._name = newName;
        }
    }

    /**
     * Returns the score given by the given user for this row.
     */
    getScore(userId: string)
    {
        const memberId = this.userToMemberId.get(userId);
        if (memberId == undefined) {
            return DEFAULT_SCORE;
        }

        return this._data.get(memberId)?.value || DEFAULT_SCORE;
    }

    getAvgScore(type: "MEAN" | "MAGIC")
    {
        const scores = [...this._data.values()].map(x => x.value);
        if (scores.length == 0) {
            return DEFAULT_SCORE;
        }

        switch (type) {
            case "MEAN": return avg(scores);
            case "MAGIC": return magicMean(scores);
        }
    }

    /**
     * Sets the score for the currently active user.
     */
    async setScore(value: number): Promise<boolean>
    {
        if (this.app.userId.value == null) {
            return false;
        }

        
        const memberId = this.userToMemberId.get(this.app.userId.value);
        if (memberId == undefined) {
            return false;
        }
        const oldValue = this._data.get(memberId);

        if (oldValue == undefined || oldValue.id == undefined) {
            const res = await api.createScore(this.app, memberId, this.id, value);
            if (res == "error") {
                return false;
            }

            this._data.set(memberId, { "id": res, "value": value });
            return true;
        }
        
        const res = await api.setScore(this.app, oldValue.id, value);

        if (res == "ok") {
            this._data.set(memberId, { "id": oldValue.id, "value": value });
            return true;
        }

        return false;
    }
}

function avg(arr: Array<number>)
{
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function magicMean(arr: Array<number>) {
    const e = -1.2;

    let sum = 0;
    for (const s of arr) {
        sum += s ** e;
    }

    return sum ** (1 / e);
}