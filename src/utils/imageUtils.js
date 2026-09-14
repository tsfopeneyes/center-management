export const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        if (url && (url.startsWith('http') || url.startsWith('https'))) {
            image.setAttribute('crossOrigin', 'anonymous')
        }
        image.src = url
    })

export function getRadianAngle(degreeValue) {
    return (degreeValue * Math.PI) / 180
}

/**
 * Returns the new bounding area of a rotated rectangle.
 */
export function rotateSize(width, height, rotation) {
    const rotRad = getRadianAngle(rotation)

    return {
        width:
            Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
        height:
            Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    }
}

/**
 * This function was adapted from the one in the ReadMe of https://github.com/DominicTobias/react-image-crop
 */
export default async function getCroppedImg(
    imageSrc,
    pixelCrop,
    rotation = 0,
    flip = { horizontal: false, vertical: false }
) {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return null
    }

    const rotRad = getRadianAngle(rotation)

    // calculate bounding box of the rotated image
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
        image.width,
        image.height,
        rotation
    )

    // Bound the intermediate surface so high-resolution phone photos cannot
    // exhaust mobile browser memory while rotating and cropping.
    const workScale = Math.min(1, 1600 / Math.max(bBoxWidth, bBoxHeight))
    canvas.width = Math.max(1, Math.round(bBoxWidth * workScale))
    canvas.height = Math.max(1, Math.round(bBoxHeight * workScale))

    // translate canvas context to a central location to allow rotating and flipping around the center
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(rotRad)
    ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
    ctx.drawImage(image, -image.width * workScale / 2, -image.height * workScale / 2,
        image.width * workScale, image.height * workScale)

    // Crop directly into a small output canvas. getImageData previously made
    // another large pixel copy and caused mobile tabs to be terminated.
    const output = document.createElement('canvas')
    const outputScale = Math.min(1, 1024 / Math.max(pixelCrop.width, pixelCrop.height))
    output.width = Math.max(1, Math.round(pixelCrop.width * outputScale))
    output.height = Math.max(1, Math.round(pixelCrop.height * outputScale))
    const outputContext = output.getContext('2d')
    if (!outputContext) return null
    outputContext.drawImage(canvas,
        pixelCrop.x * workScale, pixelCrop.y * workScale,
        pixelCrop.width * workScale, pixelCrop.height * workScale,
        0, 0, output.width, output.height)

    // As Blob
    return new Promise((resolve, reject) => {
        output.toBlob((file) => {
            if (file) {
                file.name = 'cropped.jpeg'; // Default name
                resolve(file)
            } else {
                reject(new Error('Canvas is empty'));
            }
        }, 'image/jpeg')
    })
}

/**
 * Optimizes an image by resizing (max 1280px) and compressing (80% quality).
 */
export async function compressImage(file, maxWidth = 1200, quality = 0.8) {
    if (!file || !file.type.startsWith('image/')) return file;

    const imageSrc = URL.createObjectURL(file);
    let image;
    try {
        image = await createImage(imageSrc);
    } finally {
        URL.revokeObjectURL(imageSrc);
    }

    let { width, height } = image;

    const resizeScale = Math.min(1, maxWidth / Math.max(width, height));
    if (resizeScale < 1) {
        width = Math.round(width * resizeScale);
        height = Math.round(height * resizeScale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('이미지를 변환하지 못했습니다.'));
                return;
            }
            const optimizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
            });
            resolve(optimizedFile);
        }, 'image/jpeg', quality);
    });
}
