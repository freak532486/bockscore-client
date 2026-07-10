import type { App } from "./app"
import { getCookie } from "./utils";

export interface LoginRequest
{
    name: string,
    password: string
}

export interface LoginResponse
{
    userId: string,
    accessToken?: string
}

/**
 * Performs a login. Writes the access token into the state.
 */
export async function login(app: App, request: LoginRequest): Promise<"ok" | "bad_credentials" | "error">
{
    const response = await basicFetch(app, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(request)
    });

    if (response.status == 401) {
        return "bad_credentials";
    }

    if (!response.ok) {
        return "error";
    }

    const login = await response.json() as LoginResponse;
    if (login.accessToken == undefined) {
        return "error";
    }

    app.userId.value = login.userId;
    app.authToken.value = login.accessToken;
    await updateUserInfo(app);
    return "ok";
}

export interface RegisterRequest
{
    name: string,
    email: string
    password: string
}

export async function register(app: App, request: RegisterRequest): Promise<"ok" | "user_exists" | "error">
{
    const response = await basicFetch(app, "/api/auth/register", {
        method: "POST",
        body: JSON.stringify(request)
    });

    if (response.status == 409) {
        return "user_exists";
    }

    if (!response.ok) {
        return "error";
    }

    return "ok";
}

interface LogoutResponse {
    newTempUserId: string
}

/**
 * Performs a logout. This will remove the auth token from the state.
 */
export async function logout(app: App): Promise<"ok" | "error">
{
    const response = await basicFetch(app, "/api/auth/logout", {
        method: "POST"
    });

    if (!response.ok) {
        return "error";
    }

    const logout = await response.json() as LogoutResponse;
    app.authToken.value = null;
    app.userId.value = logout.newTempUserId;
    app.username.value = null;
    app.selectedTableId.value = null;
    app.selectedRankingId.value = null;
    return "ok";
}

/**
 * Performs a sign in. This either generates a new access token from the refresh token cookie, or assigns a randomly
 * generated temporary user id without an access token.
 */
export async function signin(app: App): Promise<"ok" | "error">
{
    const response = await basicFetch(app, "/api/auth/signin", {
        method: "POST"
    });

    if (!response.ok) {
        return "error";
    }

    const login = await response.json() as LoginResponse;
    if (login.accessToken == undefined) {
        return "error";
    }

    app.userId.value = login.userId;
    app.authToken.value = login.accessToken;
    await updateUserInfo(app);
    return "ok";
}

export async function deleteUser(app: App, password: string): Promise<"ok" | "bad_password" | "error">
{
    const response = await authFetch(app, "/api/user/delete", {
        method: "POST",
        body: JSON.stringify({
            "password": password
        })
    });

    if (response.status == 401) {
        return "bad_password";
    }

    return response.ok ? "ok" : "error";
}

export interface RankingResponse
{
    id: string,
    name: string,

}

export async function fetchAllRankings(app: App): Promise<Array<RankingResponse> | "error">
{
    const response = await authFetch(app, "/api/ranking", {
        method: "GET"
    });

    if (!response.ok) {
        return "error";
    }

    return await response.json() as Array<RankingResponse>
}

/**
 * Creates a new ranking. Returns the ranking id, or error.
 */
export async function addRanking(app: App, name: string): Promise<string | "error">
{
    const response = await authFetch(app, "/api/ranking", {
        method: "POST",
        body: JSON.stringify({ "name": name })
    });

    if (!response.ok) {
        return "error";
    }

    return (await response.json()).id;
}

/**
 * Deletes the given ranking.
 */
export async function deleteRanking(app: App, rankingId: string): Promise<"ok" | "error">
{
    const response = await authFetch(app,
        "/api/ranking/" + rankingId, {
        method: "DELETE"
    });

    return response.ok ? "ok" : "error";
}

/**
 * Renames the given ranking.
 */
export async function renameRanking(app: App, rankingId: string, name: string): Promise<"ok" | "error">
{
    const response = await authFetch(app,
        "/api/ranking/" + rankingId, {
        method: "PUT",
        body: JSON.stringify({ "name": name })
    });

    return response.ok ? "ok" : "error";
}

/**
 * Retrieves an CSRF cookie from the server.
 */
export async function updateXsrfToken(app: App): Promise<"ok" | "error">
{
    await basicFetch(app, "/api/auth/xsrf-token", {
        method: "GET"
    });

    const csrfCookie = getCookie("bockscore.x-csrf-token");
    if (csrfCookie == null) {
        return "error";
    }

    app.csrfToken.value = csrfCookie;
    return "ok";
}

interface UserInfo
{
    id: string,
    name: string,
    email: string,
    password: string,
    role: string,
    expiresAt: string,
    createdAt: string
}

async function updateUserInfo(app: App): Promise<"ok" | "error">
{
    const response = await authFetch(app, "/api/user", {
        method: "GET"
    });

    if (!response.ok) {
        return "error";
    }
    
    const user = await response.json() as UserInfo;
    app.username.value = user.name;
    return "ok";
}

export type ScoringType = "Average" | "Magic";

export interface ScoreTableHeader
{
    "id": string,
    "name": string,
    "scoring": ScoringType
}

/**
 * Fetches the headers of all tables for a given ranking.
 */
export async function fetchTablesForRanking(app: App, rankingId: string): Promise<Array<ScoreTableHeader> | "error">
{
    const response = await authFetch(app, "/api/scoreTable?rankingId=" + rankingId, {
        method: "GET"
    });

    if (!response.ok) {
        return "error";
    }

    return await response.json() as Array<ScoreTableHeader>;
}

/**
 * Creates a table for a ranking and returns its id. Returns error on error. 
 */
export async function createTable(app: App, rankingId: string, name: string): Promise<string | "error">
{
    const defaultScoringType: ScoringType = "Magic";

    const response = await authFetch(app, "/api/scoreTable", {
        method: "POST",
        body: JSON.stringify({
            "name": name,
            "rankingId": rankingId,
            "scoring": defaultScoringType
        })
    });

    if (!response.ok) {
        return "error";
    }

    return (await response.json()).id;
}

export interface TableSettings
{
    name: string | undefined,
    scoring: ScoringType | undefined
}

/**
 * Changes basic table settings.
 */
export async function updateTableSettings(app: App, tableId: string, settings: TableSettings): Promise<"ok" | "error">
{
    const response = await authFetch(app, "/api/scoreTable/" + tableId, {
        method: "PUT",
        body: JSON.stringify({
            "name": settings.name,
            "scoring": settings.scoring
        })
    });

    return response.ok ? "ok" : "error";
}

export interface MemberInfo
{
    "id": string,
    "name": string,
    "isGuest": boolean,
    "user"?: UserInfo
}

/**
 * Fetches all members of a ranking.
 */
export async function fetchMembersForRanking(app: App, rankingId: string): Promise<Array<MemberInfo> | "error">
{
    const response = await authFetch(app, "/api/member?rankingId=" + rankingId, {
        method: "GET",
    });

    if (!response.ok) {
        return "error";
    }

    return await response.json() as Array<MemberInfo>;
}

export async function inviteMember(app: App, rankingId: string, name: string): Promise<MemberInfo | "user_not_found" | "error">
{
    const response = await authFetch(app, "/api/member/" + rankingId + "/invite", {
        method: "POST",
        body: JSON.stringify({ "name": name })
    });

    if (response.status == 404) {
        return "user_not_found"
    }

    if (!response.ok) {
        return "error";
    }

    return await response.json() as MemberInfo;
}

export interface ScoreTableRow
{
    "id": string,
    "name": string,
    "joker": {
        "id": string,
        "name": string
    }
}

export async function fetchScoreTableRows(app: App, tableId: string): Promise<Array<ScoreTableRow> | "error">
{
    const response = await authFetch(app, "/api/scoreTableEntry?scoreTableId=" + tableId, {
        method: "GET",
    });

    if (!response.ok) {
        return "error";
    }

    return await response.json() as Array<ScoreTableRow>;
}

export interface UserScore
{
    "memberId": string,
    "entryId": string,
    "value": number | undefined
}

export async function fetchUserScores(app: App, userIds: Array<string>): Promise<Array<UserScore> | "error">
{
    const request = {
        "memberIds": userIds
    };

    const response = await authFetch(app, "/api/userscore/findMultiple", {
        method: "POST",
        "body": JSON.stringify(request)
    });

    if (!response.ok) {
        return "error";
    }

    return await response.json() as Array<UserScore>;
}

export async function createScore(app: App, entryId: string, memberId: string, value: number): Promise<string | "error">
{
    const response = await authFetch(app, 
        `/api/userscore/?entryId=${entryId}&memberId=${memberId}`, {
        method: "POST",
        "body": JSON.stringify({
            "value": value
        })
    });

    if (!response.ok) {
        return "error";
    }


    return (await response.json()).id as string;
}

export async function setScore(app: App, entryId: string, memberId: string, value: number): Promise<"ok" | "error">
{
    const response = await authFetch(app,
        `/api/userscore/?entryId=${entryId}&memberId=${memberId}`, {
        method: "PUT",
        "body": JSON.stringify({
            "value": value
        })
    });

    return response.ok ? "ok" : "error";
}

/**
 * Either returns the UUID of the created row, or an error.
 */
export async function addRow(app: App, tableId: string, name: string): Promise<string | "error">
{
    const response = await authFetch(app, "/api/scoreTableEntry", {
        method: "POST",
        "body": JSON.stringify({ "scoreTableId": tableId, "name": name })
    });

    if (!response.ok) {
        return "error";
    }

    return (await response.json()).id as string;
}

export async function deleteRow(app: App, entryId: string): Promise<"ok" | "error">
{
    const response = await authFetch(app, "/api/scoreTableEntry/" + entryId, {
        method: "DELETE",
    });

    return response.ok ? "ok" : "error";
}

export async function renameRow(app: App, entryId: string, newName: string): Promise<"ok" | "error">
{
    const response = await authFetch(app, "/api/scoreTableEntry/" + entryId, {
        method: "PUT",
        "body": JSON.stringify({ "name": newName })
    });

    return response.ok ? "ok" : "error";
}

/**
 * Returns the saved image for the given entry.
 */
export async function getEntryImage(app: App, entryId: string): Promise<Blob | "not_found" | "error">
{
    const response = await authFetch(app, "/api/scoreTableEntry/" + entryId + "/image", {
        method: "GET"
    });

    if (response.status == 404) {
        return "not_found";
    }

    const contentType = response.headers.get("Content-Type");
    if (!response.ok || contentType == null) {
        return "error";
    }

    const bytes = await response.bytes();
    return new Blob([bytes], { "type": contentType });
}

/**
 * Updates the entry image for the given entry.
 */
export async function setEntryImage(
    app: App,
    entryId: string,
    image: Blob
): Promise<"ok" | "error">
{
    const response = await authFetch(app, "/api/scoreTableEntry/" + entryId + "/image", {
        method: "PUT",
        headers: {
            "Content-Type": image.type
        },
        body: image
    });

    return response.ok ? "ok" : "error";
}

export interface EliminationEntry
{
    entryId: string,
    markedOff: boolean
}

export async function getEliminationTable
(
    app: App,
    rankingId: string
): Promise<Array<EliminationEntry> | "error">
{
    const res = await authFetch(
        app,
        "/api/ranking/" + rankingId + "/elimination",
        {
            method: "GET"
        }
    );

    if (!res.ok) {
        return "error";
    }

    return (await res.json()).entries as Array<EliminationEntry>
}

export async function updateEliminationTable(
    app: App,
    rankingId: string,
    entryIds: Array<string>
): Promise<"ok" | "error">
{
    const res = await authFetch(
        app,
        "/api/ranking/" + rankingId + "/elimination",
        {
            method: "PUT",
            body: JSON.stringify({
                ids: entryIds
            })
        }
    );

    return res.ok ? "ok" : "error";
}

export async function markOffEliminationEntry(
    app: App,
    rankingId: string,
    entryId: string
): Promise<"ok" | "error">
{
    const res = await authFetch(
        app,
        "/api/ranking/" + rankingId + "/elimination/" + entryId,
        {
            method: "POST"
        }
    );

    return res.ok ? "ok" : "error";
}

async function authFetch(app: App, resource: string, options: RequestInit): Promise<Response>
{
    /* Add auth token header */
    const headers = new Headers(options.headers);

    if (app.authToken.value) {
        headers.set("Authorization", `Bearer ${app.authToken.value}`);
    }

    /* First attempt */
    const res1 = await basicFetch(app, resource, {
        ...options,
        headers
    });

    if (res1.status !== 401) {
        return res1;
    }

    /* Token refresh, then try again */
    const signinRes = await signin(app);
    if (signinRes == "error") {
        return res1;
    }

    /* Second attempt */
    return basicFetch(app, resource, {
        ...options,
        headers
    });
}

async function basicFetch(app: App, resource: string, options: RequestInit)
{
    /* Add basic headers */
    const headers = new Headers(options.headers);

    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    headers.set("x-csrf-token", app.csrfToken.value || "");

    /* Do the fetch */
    return fetch(resource, {
        ...options,
        headers
    });
}