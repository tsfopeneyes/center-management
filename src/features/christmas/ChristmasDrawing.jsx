import React, { useEffect, useRef, useState } from 'react'
import { Eraser, Pencil, RotateCcw } from 'lucide-react'
import { christmasApi, drawingId } from './christmasApi'

const SIZE = 480
const COLORS = [
    ['#212f27', '����'], ['#a93446', '����'], ['#d48759', '��Ȳ'],
    ['#c39125', '���'], ['#367051', '�ʷ�'], ['#525493', '����'],
]

function drawSegment(context, stroke, from, to = from) {
    context.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over'
    context.strokeStyle = context.fillStyle = stroke.color
    context.lineWidth = stroke.width
    context.lineJoin = context.lineCap = 'round'
    context.beginPath()
    if (from === to) {
        context.arc(from.x, from.y, stroke.width / 2, 0, Math.PI * 2)
        context.fill()
    } else {
        context.moveTo(from.x, from.y)
        context.lineTo(to.x, to.y)
        context.stroke()
    }
    context.globalCompositeOperation = 'source-over'
}

function guideFace(context) {
    context.strokeStyle = '#87634d'
    context.lineWidth = 5
    context.beginPath()
    context.ellipse(240, 252, 128, 148, 0, 0, Math.PI * 2)
    context.stroke()
}

export default function ChristmasDrawing() {
    const canvasRef = useRef(null)
    const strokes = useRef([])
    const active = useRef(null)
    const submission = useRef(null)
    const sending = useRef(false)
    const [historyCount, setHistoryCount] = useState(0)
    const [color, setColor] = useState(COLORS[0][0])
    const [width, setWidth] = useState(8)
    const [eraser, setEraser] = useState(false)
    const [guide, setGuide] = useState(false)
    const [mode, setMode] = useState(null)
    const [sentMode, setSentMode] = useState(null)
    const [state, setState] = useState('ready')
    const [message, setMessage] = useState('')

    useEffect(() => {
        let mounted = true
        let timer
        async function load() {
            try {
                const next = await christmasApi.mode()
                if (mounted) setMode(next)
            } catch {
                // Keep the drawing editable while the connection recovers.
            } finally {
                if (mounted) timer = window.setTimeout(load, 3000)
            }
        }
        void load()
        return () => {
            mounted = false
            window.clearTimeout(timer)
        }
    }, [])

    const getPoint = event => {
        const bounds = canvasRef.current.getBoundingClientRect()
        return {
            x: (event.clientX - bounds.left) * SIZE / bounds.width,
            y: (event.clientY - bounds.top) * SIZE / bounds.height,
        }
    }

    function start(event) {
        if (active.current || sending.current || event.button !== 0) return
        const point = getPoint(event)
        const stroke = { color, width: eraser ? width * 3 : width, eraser, points: [point] }
        event.currentTarget.setPointerCapture(event.pointerId)
        active.current = { pointer: event.pointerId, stroke }
        strokes.current.push(stroke)
        drawSegment(canvasRef.current.getContext('2d'), stroke, point)
        setHistoryCount(strokes.current.length)
        submission.current = null
    }

    function move(event) {
        if (active.current?.pointer !== event.pointerId) return
        const { stroke } = active.current
        const point = getPoint(event)
        const previous = stroke.points[stroke.points.length - 1]
        drawSegment(canvasRef.current.getContext('2d'), stroke, previous, point)
        stroke.points.push(point)
    }

    function finish(event) {
        if (active.current?.pointer === event.pointerId) active.current = null
    }

    function undo() {
        if (active.current || sending.current) return
        strokes.current.pop()
        const context = canvasRef.current.getContext('2d')
        context.clearRect(0, 0, SIZE, SIZE)
        for (const stroke of strokes.current) {
            drawSegment(context, stroke, stroke.points[0])
            for (let i = 1; i < stroke.points.length; i++) {
                drawSegment(context, stroke, stroke.points[i - 1], stroke.points[i])
            }
        }
        setHistoryCount(strokes.current.length)
        submission.current = null
    }

    async function send() {
        if (active.current || sending.current || !mode || mode === 'closed') return
        const ink = canvasRef.current
        const pixels = ink.getContext('2d').getImageData(0, 0, SIZE, SIZE).data
        if (!pixels.some((value, index) => index % 4 === 3 && value > 0)) {
            setMessage('���� �׸� �� �����ּ���.')
            return
        }
        if (!submission.current) {
            const output = document.createElement('canvas')
            output.width = output.height = SIZE
            const context = output.getContext('2d')
            if (guide) guideFace(context)
            context.drawImage(ink, 0, 0)
            const image = output.toDataURL('image/png')
            if (image.length > 400000) {
                setMessage('�׸��� �ʹ� Ŀ��. ���� ���� ���̰� �ٽ� �����ּ���.')
                return
            }
            submission.current = { id: drawingId(), image }
        }
        sending.current = true
        setState('sending')
        setMessage('')
        try {
            await christmasApi.submit(submission.current.id, submission.current.image)
            setSentMode(mode)
            setState('sent')
        } catch (error) {
            if (error.message === 'christmas_submissions_closed') {
                setMode('closed')
                setMessage('������ ��ǰ�� ���� �ʾƿ�. �׸��� ���� �־��.')
            } else {
                setMessage('�������� ���߾��. �׸��� ���� ������ �ٽ� �õ��� �ּ���.')
            }
            setState('ready')
        } finally {
            sending.current = false
        }
    }

    return (
        <main className="christmas-mobile">
            <section className="christmas-mobile-inner">
                <div className="christmas-mobile-brand">HAIFN CHRISTMAS</div>
                {state === 'sent' ? (
                    <div className="christmas-sent">
                        <img src={submission.current.image} alt="���� �׸� ��" />
                        <h1>�׸��� ���¾��!</h1>
                        <p>{sentMode === 'review' ? '��ڰ� Ȯ���� �� ȭ�鿡 �ɷ���.' : '�տ� �ִ� TV ȭ���� ���ּ���.'}</p>
                    </div>
                ) : (
                    <>
                        <h1>������ �� ���� �׷���</h1>
                        <p>���� �Ը� �׷��� ���ƿ�.</p>
                        <div className="christmas-canvas-wrap">
                            {guide && <span className="christmas-face-guide" aria-hidden="true" />}
                            <canvas ref={canvasRef} width={SIZE} height={SIZE} aria-label="�� �׸���"
                                onPointerDown={start} onPointerMove={move} onPointerUp={finish}
                                onPointerCancel={finish} onLostPointerCapture={finish} />
                        </div>
                        <div className="christmas-tools" aria-label="�� ����">
                            {COLORS.map(([value, label]) => (
                                <button key={value} type="button" className="christmas-color"
                                    style={{ '--ink': value }} aria-label={label} aria-pressed={!eraser && value === color}
                                    onClick={() => { setColor(value); setEraser(false) }} />
                            ))}
                        </div>
                        <div className="christmas-tools christmas-tool-labels">
                            <button type="button" aria-pressed={!eraser && width === 8} onClick={() => { setWidth(8); setEraser(false) }}><Pencil size={15} /> ���ð�</button>
                            <button type="button" aria-pressed={!eraser && width === 17} onClick={() => { setWidth(17); setEraser(false) }}><Pencil size={17} /> ����</button>
                            <button type="button" aria-pressed={eraser} onClick={() => setEraser(true)}><Eraser size={16} /> ���찳</button>
                            <button type="button" disabled={!historyCount || state === 'sending'} onClick={undo}><RotateCcw size={15} /> �ǵ�����</button>
                            <button type="button" disabled={state === 'sending'} aria-pressed={guide} onClick={() => {
                                submission.current = null
                                setGuide(!guide)
                            }}>�� Ʋ</button>
                        </div>
                        <p className="christmas-disclosure">���� �׸��� ���� TV�� �����˴ϴ�.{mode === 'review' && ' ��� Ȯ�� �� �Խõſ�.'}</p>
                        <button className="christmas-send" type="button" onClick={send}
                            disabled={!historyCount || state === 'sending' || !mode || mode === 'closed'}>
                            {state === 'sending' ? '������ �ߡ�' : mode === 'closed' ? '���� ����' : 'TV�� ������'}
                        </button>
                        {(message || !mode) && <p role="status">{message || '���� ���¸� Ȯ���ϰ� �־��.'}</p>}
                    </>
                )}
            </section>
        </main>
    )
}
