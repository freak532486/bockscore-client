import type { App } from "./app";
import { ScoreTableWrapper } from "./table-wrapper";
import * as api from "./api"

export class RankingAccess
{
    private tablesPerRanking: Map<string, Array<string>> = new Map();
    private tableIdToRankingId: Map<string, string> = new Map();
    private tableCache: Map<string, ScoreTableWrapper> = new Map();

    constructor(private readonly app: App) {
    }

    /**
     * Returns the list of all table ids in the given ranking. 
     */
    async getAllTablesForRanking(rankingId: string): Promise<Array<string> | "error"> {
        if (this.tablesPerRanking.has(rankingId)) {
            return this.tablesPerRanking.get(rankingId)!;
        }

        /* Load from API */
        const res = await api.fetchTablesForRanking(this.app, rankingId);
        if (res == "error") {
            return "error";
        }

        const ret = res.map(x => x.id);
        ret.forEach(x => this.tableIdToRankingId.set(x, rankingId));
        this.tablesPerRanking.set(rankingId, ret);
        return ret;
    }

    /**
     * Returns the table for the given table id.
     */
    async getTable(tableId: string): Promise<ScoreTableWrapper | "error">
    {
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
    }

    /**
     * Invalidates the given ranking. The tables will be fetched from API again on the next call.
     */
    async invalidateRanking(rankingId: string)
    {
        if (!this.tablesPerRanking.has(rankingId)) {
            return;
        }

        for (const tableId of this.tablesPerRanking.get(rankingId)!) {
            this.tableIdToRankingId.delete(tableId);
        }
        this.tablesPerRanking.delete(rankingId);
    }


}