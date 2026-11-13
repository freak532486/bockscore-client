import * as api from "./api";
import type { App } from "./app";
import { Mutex } from "./mutex";
import { ScoreTableWrapper, type ScoreMap } from "./table-wrapper";

export interface Ranking
{
    id: string,
    name: string
}

interface RankingData
{
    tables: Array<api.ScoreTableHeader>,
    members: Array<api.MemberInfo>,
    tablesById: Map<string, ScoreTableWrapper>
}

export class RankingAccess extends EventTarget
{
    public static readonly EVENT_RANKINGS_CHANGED = "rankings_changed";
    public static readonly EVENT_TABLES_CHANGED = "tables_changed";
    public static readonly EVENT_MEMBERS_CHANGED = "members_changed";

    private rankings: Array<Ranking> | null = null;
    private rankingData: Map<string, Promise<RankingData | "error">> = new Map();
    private tableIdToRankingId: Map<string, string> = new Map();
    private entryImages: Map<string, Promise<Blob | undefined>> = new Map();

    private rankingLock = new Mutex();

    constructor(private readonly app: App) {
        super();

        /* Cache must be invalidated after every user change */
        app.authToken.subscribe(() => this.invalidateCache());
    }

    /**
     * Returns the headers of all tables in the given ranking.
     */
    async getAllTablesForRanking(rankingId: string): Promise<Array<api.ScoreTableHeader>> {
        const data = await this.loadRanking(rankingId);
        if (data == "error") {
            this.app.errorDialog.showError("An error occured while fetching score tables");
            return [];
        }

        return data.tables;
    }

    /**
     * Returns the table for the given table id.
     */
    async getTable(tableId: string): Promise<ScoreTableWrapper | "error">
    {
        const rankingId = this.tableIdToRankingId.get(tableId);
        if (rankingId == undefined) {
            return "error";
        }

        const data = await this.loadRanking(rankingId);
        if (data == "error") {
            return "error";
        }

        return data.tablesById.get(tableId) ?? "error";
    }

    async preloadRanking(rankingId: string)
    {
        await this.loadRanking(rankingId);
    }

    getAllRankings(): Promise<Array<Ranking> | "error">
    {
        return this.rankingLock.withLock(async () => {
            if (this.rankings !== null) {
                return this.rankings;
            }

            if (this.app.authToken.value == null) {
                return [];
            }

            const res = await api.fetchAllRankings(this.app);
            if (res == "error") {
                return "error";
            }

            this.rankings = res.map(x => ({ "id": x.id, "name": x.name }));
            this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_RANKINGS_CHANGED));
            return this.rankings;
        });
    }

    /**
     * Adds a ranking
     */
    async addRanking(name: string): Promise<string | "error">
    {
        if (this.rankings == null) {
            return "error";
        }

        return this.rankingLock.withLock(async () => {
            const res = await api.addRanking(this.app, name);
            if (res == "error") {
                return "error";
            }

            this.rankings!.push({ "id": res, "name": name });
            this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_RANKINGS_CHANGED));
            return res;
        });
    }

    async deleteRanking(rankingId: string): Promise<"ok" | "error">
    {
        if (this.rankings == null) {
            return "error";
        }

        return this.rankingLock.withLock(async () => {
            const res = await api.deleteRanking(this.app, rankingId);
            if (res == "error") {
                return "error";
            }

            this.rankingData.delete(rankingId);
            this.rankings = this.rankings!.filter(x => x.id !== rankingId);

            this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_RANKINGS_CHANGED));
            return "ok";
        });
    }

    async renameRanking(rankingId: string, name: string): Promise<"ok" | "error">
    {
        if (this.rankings == null) {
            return "error";
        }

        const actualName = name.trim();
        if (actualName == "") {
            return "error";
        }

        return this.rankingLock.withLock(async () => {
            const res = await api.renameRanking(this.app, rankingId, actualName);
            if (res == "error") {
                return "error";
            }

            const ranking = this.rankings!.find(x => x.id == rankingId);
            if (ranking !== undefined) {
                ranking.name = actualName;
            }

            this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_RANKINGS_CHANGED));
            return "ok";
        });
    }

    /**
     * Invalidates the given ranking. Tables and members will be fetched from API again on the next call.
     */
    async invalidateRanking(rankingId: string)
    {
        this.rankingData.delete(rankingId);
    }

    /**
     * Adds a newly created, empty table to the cached ranking. Reloads the ranking if it is not cached.
     */
    async addTable(rankingId: string, header: api.ScoreTableHeader)
    {
        const data = await this.rankingData.get(rankingId);
        if (data === undefined || data == "error") {
            this.invalidateRanking(rankingId);
            return;
        }

        data.tables = [...data.tables, header];
        data.tablesById.set(header.id, new ScoreTableWrapper(this.app, header, data.members, new Map(), []));
        this.tableIdToRankingId.set(header.id, rankingId);
    }

    /**
     * Removes a deleted table from the cached ranking.
     */
    async removeTable(rankingId: string, tableId: string)
    {
        const data = await this.rankingData.get(rankingId);
        if (data === undefined || data == "error") {
            this.invalidateRanking(rankingId);
            return;
        }

        data.tables = data.tables.filter(x => x.id !== tableId);
        data.tablesById.delete(tableId);
        this.tableIdToRankingId.delete(tableId);
    }

    async getMembersForRanking(rankingId: string): Promise<Array<api.MemberInfo>>
    {
        const data = await this.loadRanking(rankingId);
        if (data == "error") {
            this.app.errorDialog.showError("An error occured trying to fetch members for ranking.");
            return [];
        }

        return data.members;
    }

    async inviteMember(rankingId: string, name: string): Promise<api.MemberInfo | "user_not_found" | "error">
    {
        const res = await api.inviteMember(this.app, rankingId, name);
        if (res == "user_not_found") {
            return "user_not_found";
        }

        if (res == "error") {
            return "error";
        }

        await this.invalidateRanking(rankingId);
        this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_MEMBERS_CHANGED, { detail: rankingId }));
        this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_TABLES_CHANGED, { detail: rankingId }));
        return res;
    }

    getEntryImage(entryId: string): Promise<Blob | undefined>
    {
        const cached = this.entryImages.get(entryId);
        if (cached !== undefined) {
            return cached;
        }

        const promise = api.getEntryImage(this.app, entryId).then(x => x == "error" || x == "not_found" ? undefined : x);
        this.entryImages.set(entryId, promise);
        return promise;
    }

    setEntryImage(entryId: string, image: Blob | undefined)
    {
        this.entryImages.set(entryId, Promise.resolve(image));
    }

    /**
     * Concurrent callers share one in-flight load per ranking. Failed loads are not cached.
     */
    private loadRanking(rankingId: string): Promise<RankingData | "error">
    {
        const cached = this.rankingData.get(rankingId);
        if (cached !== undefined) {
            return cached;
        }

        const promise = this.fetchRanking(rankingId);
        this.rankingData.set(rankingId, promise);
        promise.then(res => {
            if (res == "error" && this.rankingData.get(rankingId) === promise) {
                this.rankingData.delete(rankingId);
            }
        });

        return promise;
    }

    private async fetchRanking(rankingId: string): Promise<RankingData | "error">
    {
        const [tables, members] = await Promise.all([
            api.fetchTablesForRanking(this.app, rankingId),
            api.fetchMembersForRanking(this.app, rankingId)
        ]);

        if (tables == "error" || members == "error") {
            return "error";
        }

        const [scores, rows] = await Promise.all([
            members.length == 0 ? [] : api.fetchUserScores(this.app, members.map(x => x.id)),
            tables.length == 0 ? [] : api.fetchScoreTableRowsForTables(this.app, tables.map(x => x.id))
        ]);

        if (scores == "error" || rows == "error") {
            return "error";
        }

        const scoreMap: ScoreMap = new Map();
        for (const score of scores) {
            if (score.value == undefined) {
                continue;
            }

            if (!scoreMap.has(score.entryId)) {
                scoreMap.set(score.entryId, new Map());
            }

            scoreMap.get(score.entryId)!.set(score.memberId, score.value);
        }

        const tablesById = new Map<string, ScoreTableWrapper>();
        for (const header of tables) {
            const tableRows = rows.filter(x => x.scoreTable?.id == header.id);
            tablesById.set(header.id, new ScoreTableWrapper(this.app, header, members, scoreMap, tableRows));
            this.tableIdToRankingId.set(header.id, rankingId);
        }

        return { tables, members, tablesById };
    }

    private async invalidateCache()
    {
        return this.rankingLock.withLock(async () => {
            try {
                this.rankings = null;
                this.rankingData.clear();
                this.tableIdToRankingId.clear();
                this.entryImages.clear();
            } finally {
                this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_RANKINGS_CHANGED));
            }
        });
    }
}
