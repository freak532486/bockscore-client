/**
 * Reads the HTML of a component and returns the element for this component.
 */
export function htmlToElement(html: string): HTMLElement
{
    const root = document.createElement("template");
    root.innerHTML = html.trim();

    if (root.content.childElementCount !== 1) {
        throw new Error("Component does not define a singular root element");
    }

    return root.content.firstElementChild as HTMLElement;
}

/**
 * Fetches the value of the cookie with the given name.
 */
export function getCookie(name: string): string | null {
    const prefix = encodeURIComponent(name) + "=";

    for (const cookie of document.cookie.split("; ")) {
        if (cookie.startsWith(prefix)) {
            return decodeURIComponent(cookie.slice(prefix.length));
        }
    }

    return null;
}