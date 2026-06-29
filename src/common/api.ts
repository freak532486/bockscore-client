import type { App } from "./app"

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
    const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": app.csrfToken.value || ""
        },
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

interface LogoutResponse {
    newTempUserId: string
}

/**
 * Performs a logout. This will remove the auth token from the state.
 */
export async function logout(app: App): Promise<"ok" | "error">
{
    const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": app.csrfToken.value || ""
        }
    });

    if (!response.ok) {
        return "error";
    }

    const logout = await response.json() as LogoutResponse;
    app.authToken.value = null;
    app.userId.value = logout.newTempUserId;
    return "ok";
}

/**
 * Performs a sign in. This either generates a new access token from the refresh token cookie, or assigns a randomly
 * generated temporary user id without an access token.
 */
export async function signin(app: App): Promise<"ok" | "error">
{
    const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": app.csrfToken.value || ""
        }
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

export interface RankingResponse
{
    id: string,
    name: string,

}

export async function fetchAllRankings(app: App): Promise<Array<RankingResponse> | "error">
{
    const response = await fetch("/api/ranking", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        }
    });

    if (!response.ok) {
        return "error";
    }

    return await response.json() as Array<RankingResponse>
}

/**
 * Retrieves an CSRF cookie from the server.
 */
export async function updateXsrfToken(app: App): Promise<"ok" | "error">
{
    await fetch("/api/auth/xsrf-token", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    const csrfCookie = await window.cookieStore.get("bockscore.x-csrf-token");
    
    if (csrfCookie == null) {
        return "error";
    }

    const csrfToken = csrfCookie.value;
    if (csrfToken == undefined) {
        return "error";
    }

    app.csrfToken.value = csrfToken;
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
    const response = await fetch("/api/user", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        }
    });

    if (!response.ok) {
        return "error";
    }
    
    const user = await response.json() as UserInfo;
    app.username.value = user.name;
    return "ok";
}

export interface ScoreTableHeader
{
    "id": string,
    "name": string,
    "scoring": string
}

/**
 * Fetches the headers of all tables for a given ranking.
 */
export async function fetchTablesForRanking(app: App, rankingId: string): Promise<Array<ScoreTableHeader> | "error">
{
    const response = await fetch("/api/scoreTable?rankingId=" + rankingId, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        }
    });

    if (!response.ok) {
        return "error";
    }

    return await response.json() as Array<ScoreTableHeader>;
}

export interface MemberInfo
{
    "id": string,
    "name": string,
    "isGuest": boolean,
    "user": UserInfo
}

/**
 * Fetches all members of a ranking.
 */
export async function fetchMembersForRanking(app: App, rankingId: string): Promise<Array<MemberInfo> | "error">
{
    const response = await fetch("/api/member?rankingId=" + rankingId, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        }
    });

    if (!response.ok) {
        return "error";
    }

    return await response.json() as Array<MemberInfo>;
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
    const response = await fetch("/api/scoreTableEntry?scoreTableId=" + tableId, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        }
    });

    if (!response.ok) {
        return "error";
    }

    return await response.json() as Array<ScoreTableRow>;
}

export interface UserScore
{
    "id": string,
    "memberId": string,
    "entryId": string,
    "value": number | undefined
}

export async function fetchUserScores(app: App, userIds: Array<string>): Promise<Array<UserScore> | "error">
{
    const request = {
        "memberIds": userIds
    };

    const response = await fetch("/api/userscore/findMultiple", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        },
        "body": JSON.stringify(request)
    });

    if (!response.ok) {
        return "error";
    }

    return await response.json() as Array<UserScore>;
}

export async function createScore(app: App, memberId: string, rowId: string, value: number): Promise<string | "error">
{
    const response = await fetch("/api/userscore", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        },
        "body": JSON.stringify({
            "entryId": rowId,
            "memberId": memberId,
            "value": value
        })
    });

    if (!response.ok) {
        return "error";
    }


    return (await response.json()).id as string;
}

export async function setScore(app: App, valueId: string, value: number): Promise<"ok" | "error">
{
    const response = await fetch("/api/userscore/" + valueId, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        },
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
    const response = await fetch("/api/scoreTableEntry", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        },
        "body": JSON.stringify({ "scoreTableId": tableId, "name": name })
    });

    if (!response.ok) {
        return "error";
    }

    return (await response.json()).id as string;
}

export async function deleteRow(app: App, entryId: string): Promise<"ok" | "error">
{
    const response = await fetch("/api/scoreTableEntry/" + entryId, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        }
    });

    return response.ok ? "ok" : "error";
}

export async function renameRow(app: App, entryId: string, newName: string): Promise<"ok" | "error">
{
    const response = await fetch("/api/scoreTableEntry/" + entryId, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + app.authToken.value || "",
            "x-csrf-token": app.csrfToken.value || ""
        },
        "body": JSON.stringify({ "name": newName })
    });

    return response.ok ? "ok" : "error";
}