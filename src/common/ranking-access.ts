import type { App } from "./app";
import { ScoreTableWrapper } from "./table-wrapper";
import * as api from "./api"
import { Mutex } from "./mutex";

export interface Ranking
{
    id: string,
    name: string
}

export class RankingAccess extends EventTarget
{
    public static readonly EVENT_RANKINGS_CHANGED = "rankings_changed";
    public static readonly EVENT_TABLES_CHANGED = "tables_changed";

    private rankings: Array<Ranking> = [];
    private tablesPerRanking: Map<string, Array<api.ScoreTableHeader>> = new Map();
    private tableIdToRankingId: Map<string, string> = new Map();
    private tableCache: Map<string, ScoreTableWrapper> = new Map();

    private rankingLock = new Mutex();
    private tableCacheLock = new Mutex();

    constructor(private readonly app: App) {
        super();

        /* Cache must be invalidated after every user change */
        app.authToken.subscribe(() => this.invalidateCache());
    }

    /**
     * Returns the list of all table ids in the given ranking. 
     */
    async getAllTablesForRanking(rankingId: string): Promise<Array<api.ScoreTableHeader>> {
        return this.rankingLock.withLock(async () => {
            if (this.tablesPerRanking.has(rankingId)) {
                return this.tablesPerRanking.get(rankingId)!;
            }

            /* Load from API */
            const res = await api.fetchTablesForRanking(this.app, rankingId);
            if (res == "error") {
                this.app.errorDialog.showError("An error occured while fetching score tables");
                return [];
            }

            const tableIds = res.map(x => x.id);
            tableIds.forEach(x => this.tableIdToRankingId.set(x, rankingId));
            this.tablesPerRanking.set(rankingId, res);
            return res;
        });
    }

    async addTable(rankingId: string, name: string): Promise<string | "error">
    {
        return this.rankingLock.withLock(async () => {
            const res = await api.createTable(this.app, rankingId, name);
            if (res == "error") {
                return "error";
            }

            /* Preload caches */
            const table = await this.getTable(res);
            if (table == "error") {
                return "error";
            }

            this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_TABLES_CHANGED, { "detail": rankingId }));
            return res;
        });
    }

    /**
     * Returns the table for the given table id.
     */
    async getTable(tableId: string): Promise<ScoreTableWrapper | "error">
    {
        return this.tableCacheLock.withLock(async () => {
            if (this.tableCache.has(tableId)) {
                return this.tableCache.get(tableId)!;
            }

            const rankingId = this.tableIdToRankingId.get(tableId);
            if (rankingId == undefined) {
                return "error";
            }

            const table = await ScoreTableWrapper.loadTable(this.app, rankingId, tableId);
            if (table == "error" || table == "not_found") {
                return "error";
            }

            this.tableCache.set(tableId, table);
            return table;
        });
    }

    getAllRankings(): Promise<Array<Ranking>>
    {
        return this.rankingLock.withLock(async () => this.rankings);
    }

    /**
     * Adds a ranking
     */
    async addRanking(name: string): Promise<string | "error">
    {
        return this.rankingLock.withLock(async () => {
            const res = await api.addRanking(this.app, name);
            if (res == "error") {
                return "error";
            }

            this.rankings.push({ "id": res, "name": name });
            this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_RANKINGS_CHANGED));
            return res;
        });
    }

    async deleteRanking(rankingId: string): Promise<"ok" | "error">
    {
        return this.rankingLock.withLock(async () => {
            const res = await api.deleteRanking(this.app, rankingId);
            if (res == "error") {
                return "error";
            }

            for (const table of this.tablesPerRanking.get(rankingId) || []) {
                this.tableIdToRankingId.delete(table.id);
            }
            this.tablesPerRanking.delete(rankingId);
            this.rankings.splice(this.rankings.findIndex(x => x.id == rankingId), 1);

            this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_RANKINGS_CHANGED));
            return "ok";
        });
    }

    async renameRanking(rankingId: string, name: string): Promise<"ok" | "error">
    {
        const actualName = name.trim();
        if (actualName == "") {
            return "error";
        }

        return this.rankingLock.withLock(async () => {
            const res = await api.renameRanking(this.app, rankingId, actualName);
            if (res == "error") {
                return "error";
            }

            this.rankings.splice(this.rankings.findIndex(x => x.id == rankingId), 1);
            this.rankings.push({ "id": rankingId, "name": actualName });

            this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_RANKINGS_CHANGED));
            return "ok";
        });
    }

    /**
     * Invalidates the given ranking. The tables will be fetched from API again on the next call.
     */
    async invalidateRanking(rankingId: string)
    {
        return this.rankingLock.withLock(async () => {
            if (!this.tablesPerRanking.has(rankingId)) {
                return;
            }

            for (const table of this.tablesPerRanking.get(rankingId)!) {
                this.tableIdToRankingId.delete(table.id);
            }
            this.tablesPerRanking.delete(rankingId);
            this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_TABLES_CHANGED, { "detail": rankingId }));
        });
    }

    private async invalidateCache()
    {
        return this.tableCacheLock.withLock(async () => {
            return this.rankingLock.withLock(async () => {
                try {
                    /* Reset state */
                    this.rankings = [];
                    this.tableCache.clear();
                    this.tableIdToRankingId.clear();
                    this.tablesPerRanking.clear();

                    /* Fetch rankings for current user */
                    if (this.app.authToken.value == null) {
                        return;
                    }

                    const res = await api.fetchAllRankings(this.app);
                    if (res == "error") {
                        return;
                    }

                    this.rankings = res.map(x => ({ "id": x.id, "name": x.name }));
                } finally {
                    this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_RANKINGS_CHANGED));
                }
            });
        });
    }


}