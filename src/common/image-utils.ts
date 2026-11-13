import imageCompression from "browser-image-compression";

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const TARGET_IMAGE_SIZE = 200 * 1024;

export function isSupportedImageType(type: string): boolean {
    return type === "image/png" || type === "image/jpeg";
}

/**
 * Compresses the image towards the target size. Returns a plain blob, since compressed files cannot be uploaded
 * directly on iOS 16.
 */
export async function compressImage(file: File): Promise<Blob> {
    const compressed = await imageCompression(file, {
        maxSizeMB: TARGET_IMAGE_SIZE / (1024 * 1024),
        useWebWorker: true,
    });

    return new Blob([await compressed.arrayBuffer()], { type: compressed.type });
}

/**
 * Returns the first PNG or JPEG image in the clipboard.
 */
export async function readClipboardImage(): Promise<File | undefined> {
    for (const item of await navigator.clipboard.read()) {
        for (const type of item.types) {
            if (!isSupportedImageType(type)) {
                continue;
            }

            const blob = await item.getType(type);
            return new File([blob], "clipboard-image", { type: blob.type, lastModified: Date.now() });
        }
    }

    return undefined;
}
