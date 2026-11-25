const FACE_COLOR = [251, 239, 215, 255]
const INK_ALPHA = 80
const GAP_RADIUS = 3

export function findFaceInterior({ data, width, height }) {
    const area = width * height
    const region = new Uint8Array(area)
    let left = width, top = height, right = -1, bottom = -1
    let inkPixels = 0

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] < INK_ALPHA) continue
            inkPixels++
            left = Math.min(left, x)
            right = Math.max(right, x)
            top = Math.min(top, y)
            bottom = Math.max(bottom, y)
            // Widen the flood-fill barrier so small gaps in a contour don't leak.
            for (let row = Math.max(0, y - GAP_RADIUS); row <= Math.min(height - 1, y + GAP_RADIUS); row++) {
                region.fill(1, row * width + Math.max(0, x - GAP_RADIUS), row * width + Math.min(width, x + GAP_RADIUS + 1))
            }
        }
    }
    if (right < left) return null

    const queue = new Uint32Array(area)
    let head = 0
    let tail = 0
    function visit(pixel) {
        if (region[pixel] !== 0) return
        region[pixel] = 2
        queue[tail++] = pixel
    }
    for (let x = 0; x < width; x++) {
        visit(x)
        visit((height - 1) * width + x)
    }
    for (let y = 0; y < height; y++) {
        visit(y * width)
        visit(y * width + width - 1)
    }
    while (head < tail) {
        const pixel = queue[head++]
        const x = pixel % width
        if (x > 0) visit(pixel - 1)
        if (x + 1 < width) visit(pixel + 1)
        if (pixel >= width) visit(pixel - width)
        if (pixel + width < area) visit(pixel + width)
    }

    let enclosed = 0
    for (let pixel = 0; pixel < area; pixel++) {
        if (region[pixel] === 0) enclosed++
    }
    const bounds = { left, top, right, bottom }
    const inkBoundsArea = (right - left + 1) * (bottom - top + 1)
    if (enclosed >= inkBoundsArea * 0.1) return { bounds, mask: region }
    return inkPixels < inkBoundsArea * 0.25 ? { bounds, mask: null } : null
}

function cropToDrawing(canvas, context) {
    const { width, height } = canvas
    const { data } = context.getImageData(0, 0, width, height)
    let left = width, top = height, right = -1, bottom = -1
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] < 32) continue
            left = Math.min(left, x)
            right = Math.max(right, x)
            top = Math.min(top, y)
            bottom = Math.max(bottom, y)
        }
    }
    if (right < left) return canvas
    const longest = Math.max(right - left + 1, bottom - top + 1)
    const size = Math.ceil(Math.max(longest * 1.15, Math.min(width, height) * .35))
    const output = document.createElement('canvas')
    output.width = output.height = size
    output.getContext('2d').drawImage(canvas, Math.round((size - left - right - 1) / 2),
        Math.round((size - top - bottom - 1) / 2))
    return output
}

export async function renderFaceBackground(source) {
    const image = new Image()
    await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
        image.src = source
    })

    const canvas = document.createElement('canvas')
    const width = canvas.width = image.naturalWidth
    const height = canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const interior = findFaceInterior(context.getImageData(0, 0, width, height))
    if (!interior) return cropToDrawing(canvas, context).toDataURL('image/png')
    context.clearRect(0, 0, width, height)

    if (interior.mask) {
        const fill = context.createImageData(width, height)
        const mask = interior.mask
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixel = y * width + x
                if (mask[pixel] === 2) continue
                // Extend the fill under the inner edge of the pen stroke.
                let inside = mask[pixel] === 0
                for (let row = Math.max(0, y - GAP_RADIUS); !inside && row <= Math.min(height - 1, y + GAP_RADIUS); row++) {
                    for (let column = Math.max(0, x - GAP_RADIUS); column <= Math.min(width - 1, x + GAP_RADIUS); column++) {
                        if (mask[row * width + column] === 0) {
                            inside = true
                            break
                        }
                    }
                }
                if (inside) fill.data.set(FACE_COLOR, pixel * 4)
            }
        }
        context.putImageData(fill, 0, 0)
    } else {
        const { left, top, right, bottom } = interior.bounds
        const centerX = (left + right) / 2
        const centerY = (top + bottom) / 2
        const radiusX = Math.min(width * 0.48, Math.max(width * 0.23, (right - left) * 0.62))
        const radiusY = Math.min(height * 0.48, Math.max(height * 0.28, (bottom - top) * 0.65))
        context.fillStyle = '#fbefd7'
        context.beginPath()
        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
        context.fill()
    }
    context.drawImage(image, 0, 0)
    return cropToDrawing(canvas, context).toDataURL('image/png')
}
