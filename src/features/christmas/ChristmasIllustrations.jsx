import React, { useEffect, useRef } from 'react'

const cream = '#f1dfb6'
const palette = {
    berry: '#a44752',
    plum: '#823945',
    honey: '#d6a75c',
    sage: '#839980',
}

function draw(ctx, shape, fill, stroke, width = 1.9) {
    const line = new Path2D(shape)
    if (fill) {
        ctx.fillStyle = fill
        ctx.fill(line)
    }
    if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = width
        ctx.stroke(line)
    }
}

function dot(ctx, x, y, radius = 1.7) {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = cream
    ctx.fill()
}

function star(ctx, x, y, radius) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(radius / 10, radius / 10)
    draw(ctx, 'M0 -10 Q1 -2 9 -1 Q2 1 1 10 Q-2 2 -9 0 Q-2 -1 0 -10 Z', cream)
    ctx.restore()
}

function snowflake(ctx, x, y, radius) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(radius / 10, radius / 10)
    for (let i = 0; i < 6; i++) {
        draw(ctx, 'M0 0 L0 -10 M-2.5 -6 L0 -8 L2.5 -6', null, cream, 1.35)
        ctx.rotate(Math.PI / 3)
    }
    ctx.restore()
}

const motifs = {
    tree(ctx, colour) {
        draw(ctx, 'M62 8 C70 9 71 19 78 27 L93 44 Q98 51 85 51 L104 70 Q112 82 94 80 L113 100 Q120 113 103 113 L73 111 Q72 120 67 121 L57 120 L56 110 L24 114 Q8 113 17 102 L36 83 Q19 84 24 75 L43 55 Q30 55 35 47 L52 27 Q58 18 62 8 Z', colour)
        draw(ctx, 'M44 49 Q55 56 66 43 Q75 53 86 47 M29 77 Q43 84 54 69 Q66 83 78 66 Q90 78 100 73 M21 101 Q36 108 49 94 Q60 108 73 92 Q85 103 107 99', null, cream, 2.05)
        for (const [x, y] of [[59, 34], [76, 54], [41, 66], [67, 66], [82, 82], [38, 91], [95, 91], [66, 103]]) dot(ctx, x, y)
        star(ctx, 64, 10, 7)
    },
    stocking(ctx, colour) {
        draw(ctx, 'M43 28 Q72 19 102 31 Q96 52 99 67 Q109 85 97 101 Q77 121 42 119 Q18 117 17 100 Q16 87 36 78 Q50 71 46 61 Z', colour)
        draw(ctx, 'M36 19 Q61 13 103 18 Q109 20 107 31 Q108 36 99 38 Q63 34 39 37 Q32 34 36 19 Z', cream)
        draw(ctx, 'M44 48 Q69 44 100 48 M45 53 Q67 49 99 53 M25 92 Q45 89 49 115 M89 87 Q94 80 104 79', null, cream, 2)
        snowflake(ctx, 73, 72, 11)
        for (const [x, y] of [[54, 62], [91, 61], [62, 91], [90, 99], [48, 83]]) dot(ctx, x, y, 1.25)
    },
    bauble(ctx, colour) {
        draw(ctx, 'M58 25 Q48 13 61 11 Q73 13 66 25 M51 26 Q62 22 74 26 L72 37 L53 39 Z', null, cream, 2.3)
        draw(ctx, 'M63 34 C92 33 105 48 107 73 C112 101 90 117 65 118 C39 119 19 106 20 81 C19 54 35 36 63 34 Z', colour)
        draw(ctx, 'M25 64 Q56 72 101 58 M21 87 Q63 97 105 79 M35 56 Q42 48 48 48', null, cream, 2.45)
        for (const [x, y] of [[39, 76], [58, 79], [77, 75], [92, 69], [45, 103], [81, 100]]) dot(ctx, x, y)
    },
    snowman(ctx, colour) {
        draw(ctx, 'M40 60 Q27 49 34 31 Q42 15 62 17 Q86 15 91 35 Q95 48 83 60 C102 68 105 86 103 99 Q98 117 70 120 Q41 121 26 107 Q14 92 24 74 Q29 66 40 60 Z', colour)
        draw(ctx, 'M34 34 Q47 16 84 27 L91 36 Q62 28 35 42 Z M38 58 Q57 66 85 56 L88 67 Q78 74 64 70 L59 93 L53 91 L54 70 Q42 71 34 66 Z', cream)
        draw(ctx, 'M26 77 L10 67 L5 59 M10 67 L16 60 M101 77 L115 64 L122 64 M115 64 L117 57', null, cream)
        draw(ctx, 'M60 48 l-9 3 l10 1 M65 55 q6 3 10 -1', null, cream, 1.5)
        for (const [x, y] of [[56, 43], [74, 44], [73, 83], [74, 95], [72, 106]]) dot(ctx, x, y)
    },
    candy(ctx, colour) {
        const candy = 'M79 110 C67 116 59 111 59 99 L62 47 C62 36 58 31 51 33 Q44 34 40 44 C34 58 16 49 22 34 Q30 12 51 12 C72 11 85 25 85 47 L82 100 Q83 106 79 110 Z'
        draw(ctx, candy, colour)
        ctx.save()
        ctx.clip(new Path2D(candy))
        draw(ctx, 'M22 29 L44 17 M31 53 L50 38 M51 31 L72 11 M55 55 L87 34 M57 75 L88 52 M55 95 L88 71 M59 113 L85 94', null, cream, 6)
        ctx.restore()
        draw(ctx, 'M68 68 C50 49 47 57 51 65 Q55 75 68 68 C91 52 97 66 81 72 Q74 74 68 68 Q64 81 53 90 M68 68 Q74 83 86 82', null, cream, 1.9)
    },
    sparkles(ctx) {
        star(ctx, 45, 48, 12)
        star(ctx, 83, 77, 7)
        dot(ctx, 36, 83, 2.3)
        dot(ctx, 92, 41, 1.8)
    },
}

// The small off-axis pieces connect the illustration to the artwork in the middle.
const desktop = [
    ['stocking', 'plum', 9, 15, 115, -15], ['bauble', 'honey', 20, 10, 63, 14],
    ['snowman', 'sage', 8, 48, 108, -9], ['tree', 'berry', 18, 36, 74, 13],
    ['candy', 'plum', 13, 70, 87, -9], ['tree', 'sage', 9, 88, 120, -13],
    ['bauble', 'honey', 22, 89, 83, 9], ['sparkles', 'honey', 29, 79, 65, 0],
    ['tree', 'sage', 90, 14, 118, 13], ['bauble', 'berry', 80, 12, 76, 8],
    ['stocking', 'honey', 92, 43, 115, 13], ['candy', 'plum', 83, 36, 72, 18],
    ['snowman', 'plum', 88, 67, 109, 10], ['bauble', 'sage', 77, 90, 72, -13],
    ['sparkles', 'honey', 72, 74, 70, 0], ['sparkles', 'honey', 35, 16, 60, 0],
    ['sparkles', 'honey', 67, 18, 57, 0],
]

const portrait = [
    [11, 11], [26, 7], [11, 40], [20, 25], [10, 64], [12, 82], [24, 93], [34, 87],
    [89, 11], [75, 8], [89, 36], [82, 27], [88, 63], [74, 91], [79, 75], [22, 52], [78, 52],
]

function Illustration({ piece, index }) {
    const canvas = useRef(null)
    const [shape, tone, x, y, size, angle] = piece
    useEffect(() => {
        const ctx = canvas.current.getContext('2d')
        ctx.setTransform(2, 0, 0, 2, 0, 0)
        ctx.clearRect(0, 0, 128, 128)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        motifs[shape](ctx, palette[tone])
    }, [shape, tone])
    return <canvas ref={canvas} width="256" height="256" className="christmas-illustration"
        style={{
            '--x': `${x}%`, '--y': `${y}%`, '--portrait-x': `${portrait[index][0]}%`,
            '--portrait-y': `${portrait[index][1]}%`, '--piece-size': size,
            '--angle': `${angle}deg`, '--delay': `-${index * 1.37}s`,
        }} />
}

export default function ChristmasIllustrations() {
    return (
        <div className="christmas-illustrations" aria-hidden="true">
            {desktop.map((piece, index) => <Illustration key={index} piece={piece} index={index} />)}
        </div>
    )
}
