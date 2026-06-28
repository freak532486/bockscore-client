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
    return "ok";
}

interface LogoutResponse {
    newTempUserId: string
}

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
    return "ok";
}

/**
 * Retrieves an XSRF cookie from the server.
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