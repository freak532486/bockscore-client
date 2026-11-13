import type { ImageViewer } from "./image-viewer";
import "./thumbnail.css";

const PLACEHOLDER_IMAGE = "/images/placeholder.png";
const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Shows a loading placeholder in the thumbnail until the entry image (or the placeholder for entries without an image)
 * is available, and opens the image in the image viewer on click. Pointer events on a loaded thumbnail do not reach
 * the row, so tapping it does not trigger the row action.
 */
export function setupThumbnail(
    img: HTMLImageElement,
    caption: string,
    loadImage: () => Promise<Blob | undefined>,
    viewer: ImageViewer,
) {
    img.src = EMPTY_IMAGE;
    img.classList.add("image-loading");

    loadImage().then((blob) => {
        if (blob === undefined) {
            img.classList.remove("image-loading");
            img.src = PLACEHOLDER_IMAGE;
            return;
        }

        const url = URL.createObjectURL(blob);
        const loaded = () => {
            URL.revokeObjectURL(url);
            img.classList.remove("image-loading");
        };

        img.onload = loaded;
        img.onerror = loaded;
        img.src = url;
        img.alt = caption;
        img.classList.add("has-image");

        img.addEventListener("pointerdown", (ev) => ev.stopPropagation());
        img.addEventListener("click", (ev) => {
            ev.stopPropagation();
            viewer.show(blob, caption);
        });
    });
}
