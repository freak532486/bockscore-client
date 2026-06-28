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