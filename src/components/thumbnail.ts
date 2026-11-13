import type { ImageViewer } from "./image-viewer";

/**
 * Loads the entry image into the thumbnail and opens it in the image viewer on click. Pointer events on a loaded
 * thumbnail do not reach the row, so tapping it neither opens the row dialog nor eliminates the entry.
 */
export function setupThumbnail(
    img: HTMLImageElement,
    caption: string,
    loadImage: () => Promise<Blob | undefined>,
    viewer: ImageViewer
)
{
    loadImage().then(blob => {
        if (blob === undefined) {
            return;
        }

        const url = URL.createObjectURL(blob);
        img.onload = () => URL.revokeObjectURL(url);
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
        img.alt = caption;
        img.classList.add("has-image");

        img.addEventListener("pointerdown", ev => ev.stopPropagation());
        img.addEventListener("click", ev => {
            ev.stopPropagation();
            viewer.show(blob, caption);
        });
    });
}
