import type { ScoreTableRowWrapper } from "../common/table-wrapper";
import type { ImageViewer } from "./image-viewer";

/**
 * Loads the entry image into the thumbnail and opens it in the image viewer on click. Pointer events on a loaded
 * thumbnail do not reach the row, so tapping it neither opens the row dialog nor starts a hold.
 */
export function setupThumbnail(img: HTMLImageElement, row: ScoreTableRowWrapper, viewer: ImageViewer)
{
    row.getImage().then(blob => {
        if (blob === undefined) {
            return;
        }

        const url = URL.createObjectURL(blob);
        img.onload = () => URL.revokeObjectURL(url);
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
        img.alt = row.name;
        img.classList.add("has-image");

        img.addEventListener("pointerdown", ev => ev.stopPropagation());
        img.addEventListener("click", ev => {
            ev.stopPropagation();
            viewer.show(blob, row.name);
        });
    });
}
