import * as api from "./api";
import type { App } from "./app";
import { Mutex } from "./mutex";
import { ScoreTableRowWrapper, ScoreTableWrapper } from "./table-wrapper";

export interface Ranking
{
    id: string,
    name: string
}

export class RankingAccess extends EventTarget
{
    public static readonly EVENT_RANKINGS_CHANGED = "rankings_changed";
    public static readonly EVENT_TABLES_CHANGED = "tables_changed";
    public static readonly EVENT_MEMBERS_CHANGED = "members_changed";

    private rankings: Array<Ranking> | null = [];
    private tablesPerRanking: Map<string, Array<api.ScoreTableHeader>> = new Map();
    private tableIdToRankingId: Map<string, string> = new Map();
    private tableCache: Map<string, ScoreTableWrapper> = new Map();
    private membersPerRanking: Map<string, Array<api.MemberInfo>> = new Map();
    private tableEntryCache: Map<string, ScoreTableRowWrapper> = new Map();

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
            for (const row of table.rows) {
                this.tableEntryCache.set(row.id, row);
            }

            return table;
        });
    }

    async preloadRanking(rankingId: string)
    {
        const allTables = await this.getAllTablesForRanking(rankingId);
        for (const table of allTables) {
            await this.getTable(table.id);
        }
    }

    getAllRankings(): Promise<Array<Ranking>>
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
                return [];
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

            for (const table of this.tablesPerRanking.get(rankingId) || []) {
                this.tableIdToRankingId.delete(table.id);
            }
            this.tablesPerRanking.delete(rankingId);
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
        return this.tableCacheLock.withLock(async () => {
            return this.rankingLock.withLock(async () => {
                for (const table of this.tablesPerRanking.get(rankingId) || []) {
                    this.tableIdToRankingId.delete(table.id);
                    this.tableCache.delete(table.id);
                }
                this.tablesPerRanking.delete(rankingId);
                this.membersPerRanking.delete(rankingId);
            });
        });
    }

    async getMembersForRanking(rankingId: string): Promise<Array<api.MemberInfo>>
    {
        if (this.membersPerRanking.has(rankingId)) {
            return this.membersPerRanking.get(rankingId)!;
        }

        const members = await api.fetchMembersForRanking(this.app, rankingId);
        if (members == "error") {
            this.app.errorDialog.showError("An error occured trying to fetch members for ranking.");
            return [];
        }

        this.membersPerRanking.set(rankingId, members);
        return members;
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

    async getEntry(rankingId: string, entryId: string): Promise<ScoreTableRowWrapper | null>
    {
        /* Load all tables of the ranking */
        const tables = await this.getAllTablesForRanking(rankingId);
        for (const table of tables) {
            await this.getTable(table.id);
        }

        /* Now the entry cache is filled */
        return this.tableEntryCache.get(entryId) || null;
    }

    private async invalidateCache()
    {
        return this.tableCacheLock.withLock(async () => {
            return this.rankingLock.withLock(async () => {
                try {
                    this.rankings = null;
                    this.tableCache.clear();
                    this.tableIdToRankingId.clear();
                    this.tablesPerRanking.clear();
                    this.membersPerRanking.clear();
                    this.tableEntryCache.clear();
                } finally {
                    this.dispatchEvent(new CustomEvent(RankingAccess.EVENT_RANKINGS_CHANGED));
                }
            });
        });
    }


}