import * as api from "./api";
import type { App } from "./app";

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

        const allTables = await app.rankingAccess.getAllTablesForRanking(rankingId);
        const matchingTableHeaders = allTables.filter(x => x.id == tableId);
        if (matchingTableHeaders.length == 0) {
            return "not_found";
        }

        const tableHeader = matchingTableHeaders[0]!;

        const userIdToMemberId = new Map<string, string>();
        for (const member of membersRes) {
            if (member.user) {
                userIdToMemberId.set(member.user.id, member.id);
            }
        }

        const header = new ScoreTableHeaderWrapper(
            app,
            tableHeader?.name,
            membersRes,
            tableHeader.scoring,
            tableId
        );

        /* Fetch the scores */
        const scoresRes = await api.fetchUserScores(app, membersRes.map(x => x.id));
        if (scoresRes == "error") {
            return "error";
        }

        const scoreMap = new Map<string, Map<string, number>>(); // entryId -> memberId -> value
        for (const score of scoresRes) {
            if (score.value == undefined) {
                continue;
            }

            if (!scoreMap.has(score.entryId)) {
                scoreMap.set(score.entryId, new Map());
            }

            scoreMap.get(score.entryId)!.set(score.memberId, score.value);
        }

        /* Fetch all table rows and create wrappers */
        const rowsRes = await api.fetchScoreTableRows(app, tableId);
        if (rowsRes == "error") {
            return "error";
        }

        
        const rows = await Promise.all(rowsRes.map(async x => new ScoreTableRowWrapper(
                app,
                x.id,
                x.name,
                scoreMap.get(x.id) || new Map(),
                userIdToMemberId,
                x.joker == undefined ?
                    null :
                    header.members.find(y => y.id == x.joker!.id) || null
            )
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
            this._rows.push(new ScoreTableRowWrapper(this.app, res, name, new Map(), this.userIdToMemberId, null));
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

export class ScoreTableHeaderWrapper
{
    constructor(
        private readonly app: App,
        private _name: string,
        private readonly _members: Array<api.MemberInfo>,
        private _scoreMode: api.ScoringType,
        private tableId: string
    ) {}

    get members() {
        return this._members;
    }

    get name() {
        return this._name;
    }

    get scoreMode() {
        return this._scoreMode;
    }

    async changeSettings(settings: api.TableSettings): Promise<boolean>
    {
        if ((settings.name == undefined || settings.name == this._name) && (settings.scoring == undefined || settings.scoring == this._scoreMode)) {
            return false;
        }

        const res = await api.updateTableSettings(this.app, this.tableId, settings);
        if (res == "ok") {
            this._name = settings.name || this._name;
            this._scoreMode = settings.scoring || this._scoreMode;
            return true;
        }

        return false;
    }
}

export class ScoreTableRowWrapper
{
    private imageCache: Promise<Blob | undefined> | null = null;

    constructor(
        private readonly app: App,
        public readonly id: string,
        private _name: string,
        private readonly _data: Map<string, number>,
        private readonly userToMemberId: Map<string, string>,
        public readonly jokerOf: api.MemberInfo | null //
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
    getScore(memberId: string): number | undefined
    {
        if (memberId == undefined) {
            return undefined;
        }

        return this._data.get(memberId);
    }

    getAvgScore(type: api.ScoringType): number | undefined
    {
        const scores = [...this._data.values()];
        if (scores.length == 0) {
            return undefined;
        }

        switch (type) {
            case "Average": return avg(scores);
            case "Magic": return magicMean(scores);
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
        if (oldValue == undefined) {
            const res = await api.createScore(this.app, this.id, memberId, value);
            if (res == "error") {
                return false;
            }

            this._data.set(memberId, value);
            return true;
        }
        
        const res = await api.setScore(this.app, this.id, memberId, value);

        if (res == "ok") {
            this._data.set(memberId, value);
            return true;
        }

        return false;
    }

    async getImage(): Promise<Blob | undefined>
    {
        if (this.imageCache !== null) {
            return this.imageCache;
        }

        this.imageCache = api.getEntryImage(this.app, this.id).then(x => {
            if (x == "error" || x == "not_found") {
                return undefined;
            }

            return x;
        });
        return this.imageCache;
    }

    async setImage(image: Blob): Promise<boolean> {
        if (image.type !== "image/png" && image.type !== "image/jpeg") {
            return false;
        }

        const res = await api.setEntryImage(this.app, this.id, image);
        if (res == "ok") {
            this.imageCache = Promise.resolve(image);
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
        sum += s == 0 ? 1 : s ** e;
    }
    sum /= arr.length;

    return sum ** (1 / e);
}