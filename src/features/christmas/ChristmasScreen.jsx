import React, { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CHRISTMAS_PATH, christmasApi, participationUrl } from './christmasApi'
import { renderFaceBackground } from './faceBackground'

const PAGE = 18
const sampleFaces = [1, 2, 3, 4].map(sample => ({ id: `sample-${sample}`, sample }))
const decoration = [
    ['star', 10, 12, -12], ['tree', 3, 35, -10], ['berry', 6, 69, 9],
    ['star', 14, 89, -14], ['ball', 19, 13, -13], ['star', 38, 92, 15],
    ['berry', 64, 90, -11], ['star', 77, 10, 16], ['tree', 96, 43, 8],
    ['star', 92, 67, -14], ['ball', 89, 15, 12], ['berry', 82, 84, 10],
]

export function ChristmasImage({ id, cache, manage = false, onReady }) {
    const [src, setSrc] = useState(() => cache.get(id))
    useEffect(() => {
        let mounted = true
        let retry
        async function load() {
            try {
                const cached = cache.get(id)
                const original = cached ?? await christmasApi.image(id, manage)
                const next = cached || manage || !original ? original
                    : await renderFaceBackground(original).catch(() => original)
                if (!mounted || !next) return
                cache.set(id, next)
                setSrc(next)
            } catch {
                if (mounted) retry = window.setTimeout(load, 2000)
            }
        }
        void load()
        return () => {
            mounted = false
            window.clearTimeout(retry)
        }
    }, [id, cache, manage])
    return src ? <img src={src} alt="참여자가 그린 얼굴" onLoad={() => onReady?.(id)} /> : null
}

function SampleFace({ variant }) {
    return <span className={`christmas-sample christmas-sample-${variant}`} aria-hidden="true">
        <i /><b /><em />
    </span>
}

function Face({ item, cache, onReady }) {
    const key = item.sample ?? Number.parseInt(item.id.slice(-2), 16)
    return <div className="christmas-face christmas-face-live"
        style={{ '--tilt': `${(key % 9) - 4}deg` }}>
        {item.sample ? <SampleFace variant={item.sample} />
            : <ChristmasImage key={item.id} id={item.id} cache={cache} onReady={onReady} />}
    </div>
}

export default function ChristmasScreen() {
    const cache = useRef(new Map())
    const previous = useRef(null)
    const wallRef = useRef(null)
    const stageRef = useRef(null)
    const currentRows = useRef([])
    const [rows, setRows] = useState([])
    const [queue, setQueue] = useState([])
    const [active, setActive] = useState([])
    const [ready, setReady] = useState([])
    const [page, setPage] = useState(0)
    const [qr, setQr] = useState('')

    useEffect(() => {
        participationUrl().then(setQr).catch(() => setQr(new URL(CHRISTMAS_PATH, location.origin).href))
        let running = true
        let timer
        async function poll() {
            try {
                const next = await christmasApi.list()
                if (!running) return
                const ids = new Set(next.map(item => item.id))
                if (previous.current) {
                    const arrivals = next.filter(item => !previous.current.has(item.id)).reverse()
                    if (arrivals.length) setQueue(list => [...list, ...arrivals])
                }
                previous.current = ids
                const ordered = next.reverse()
                currentRows.current = ordered
                setRows(ordered)
            } catch {
                // Leave the last successful exhibition view on screen.
            } finally {
                if (running) timer = window.setTimeout(poll, 1200)
            }
        }
        void poll()
        return () => {
            running = false
            window.clearTimeout(timer)
        }
    }, [])

    useEffect(() => {
        if (active.length || !queue.length) return
        const arrivals = queue.filter(item => rows.some(row => row.id === item.id))
        const batch = arrivals.slice(0, arrivals.length > 3 ? 3 : 1)
        setQueue(arrivals.slice(batch.length))
        if (batch.length) {
            setReady([])
            setActive(batch)
        }
    }, [rows, queue, active])

    const newest = active[active.length - 1]
    useEffect(() => {
        if (!newest) return
        const timeout = window.setTimeout(() => setActive([]), 8000)
        return () => window.clearTimeout(timeout)
    }, [newest])

    useEffect(() => {
        if (!newest || !active.every(item => ready.includes(item.id))) return
        const index = currentRows.current.findIndex(item => item.id === newest.id)
        if (index >= 0) setPage(Math.floor(index / PAGE))
        let finish
        const animations = []
        const timer = window.setTimeout(() => {
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                for (const item of active) {
                    const source = stageRef.current?.querySelector(`[data-drawing="${item.id}"]`)
                    const destination = wallRef.current?.querySelector(`[data-drawing="${item.id}"] .christmas-face`)
                    if (!source?.animate || !destination) continue
                    const from = source.getBoundingClientRect()
                    const to = destination.getBoundingClientRect()
                    const x = to.left + to.width / 2 - from.left - from.width / 2
                    const y = to.top + to.height / 2 - from.top - from.height / 2
                    animations.push(source.animate([
                        { transform: 'translate(0, 0) scale(1)' },
                        { transform: `translate(${x}px, ${y}px) scale(${to.width / from.width})` },
                    ], { duration: 480, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }))
                }
            }
            if (animations.length) finish = window.setTimeout(() => setActive([]), 480)
            else setActive([])
        }, 1900)
        return () => {
            window.clearTimeout(timer)
            window.clearTimeout(finish)
            animations.forEach(animation => animation.cancel())
        }
    }, [newest, active, ready])

    const pages = Math.max(1, Math.ceil(rows.length / PAGE))
    useEffect(() => {
        if (active.length || queue.length || pages < 2) return undefined
        const timer = window.setInterval(() => setPage(index => (index + 1) % pages), 12000)
        return () => window.clearInterval(timer)
    }, [active.length, queue.length, pages])

    const incoming = new Set([...queue, ...active].map(item => item.id))
    const currentPage = page % pages
    const items = rows.slice(currentPage * PAGE, (currentPage + 1) * PAGE)
    if (pages === 1 && rows.length < sampleFaces.length) items.push(...sampleFaces.slice(rows.length))
    const spotlight = active.filter(item => rows.some(row => row.id === item.id))

    return (
        <main className="christmas-screen">
            <div className="christmas-border" aria-hidden="true" />
            <div className="christmas-decorations" aria-hidden="true">
                {decoration.map(([shape, x, y, tilt], index) =>
                    <i key={x} className={`christmas-decoration christmas-decoration-${shape}`}
                        style={{
                            left: `${x}%`, top: `${y}%`, '--tilt': `${tilt}deg`,
                            '--drift-x': `${index % 2 ? -8 : 8}px`,
                            '--drift-y': `${10 + index % 4 * 3}px`,
                            '--drift-time': `${8 + index % 5 * 1.4}s`,
                            '--drift-delay': `-${index * 1.3}s`,
                        }} />)}
            </div>
            <header className="christmas-screen-header">
                <div className="christmas-title-ornament" aria-hidden="true">✦</div>
                <h1>HAIFN CHRISTMAS</h1>
            </header>
            <div ref={wallRef} className={`christmas-wall${items.length <= 6 ? ' christmas-wall-small' : ''}`}
                data-count={items.length} aria-label="얼굴 모아보기">
                {items.map(item => <div className="christmas-wall-cell" key={item.id} data-drawing={item.id}>
                    {incoming.has(item.id) ? <div className="christmas-face" aria-hidden="true" />
                        : <Face item={item} cache={cache.current} />}
                </div>)}
            </div>
            {spotlight.length > 0 && <div ref={stageRef} className="christmas-spotlight" data-count={spotlight.length}>
                {spotlight.map(item => <div className="christmas-spotlight-item" data-drawing={item.id} key={item.id}>
                    <Face item={item} cache={cache.current} onReady={id =>
                        setReady(current => current.includes(id) ? current : [...current, id])} />
                </div>)}
            </div>}
            {qr && <div className="christmas-qr">
                <QRCodeSVG value={qr} title="참여 페이지 QR 코드" size={160} marginSize={4} level="M" />
            </div>}
        </main>
    )
}
