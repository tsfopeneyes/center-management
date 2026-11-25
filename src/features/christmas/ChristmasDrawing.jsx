import React, { useEffect, useRef, useState } from 'react'
import { Eraser, Pencil, RotateCcw } from 'lucide-react'
import { christmasApi, drawingId } from './christmasApi'
import { FACE_TEMPLATES, drawFaceTemplate } from './faceTemplates'

const SIZE = 480
const COLORS = [
    ['#212f27', '검정'], ['#a93446', '빨강'], ['#d48759', '주황'],
    ['#c39125', '노랑'], ['#367051', '초록'], ['#525493', '보라'],
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

function FaceTemplatePreview({ template, size, className }) {
    const ref = useRef(null)
    useEffect(() => {
        const context = ref.current.getContext('2d')
        context.clearRect(0, 0, size, size)
        drawFaceTemplate(context, template, size)
    }, [template, size])
    return <canvas ref={ref} width={size} height={size} className={className} aria-hidden="true" />
}

export default function ChristmasDrawing() {
    const canvasRef = useRef(null)
    const strokes = useRef([])
    const active = useRef(null)
    const submission = useRef(null)
    const sending = useRef(false)
    const templateControl = useRef(null)
    const [historyCount, setHistoryCount] = useState(0)
    const [color, setColor] = useState(COLORS[0][0])
    const [width, setWidth] = useState(8)
    const [eraser, setEraser] = useState(false)
    const [template, setTemplate] = useState(null)
    const [templatesOpen, setTemplatesOpen] = useState(false)
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
            setMessage('얼굴을 그린 후 보내주세요.')
            return
        }
        if (!submission.current) {
            const output = document.createElement('canvas')
            output.width = output.height = SIZE
            const context = output.getContext('2d')
            if (template) drawFaceTemplate(context, template, SIZE)
            context.drawImage(ink, 0, 0)
            const image = output.toDataURL('image/png')
            if (image.length > 400000) {
                setMessage('그림이 너무 커요. 선을 조금 줄이고 다시 보내주세요.')
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
                setMessage('지금은 작품을 받지 않아요. 그림은 남아 있어요.')
            } else {
                setMessage('전송하지 못했어요. 그림은 남아 있으니 다시 시도해 주세요.')
            }
            setState('ready')
        } finally {
            sending.current = false
        }
    }

    function selectTemplate(choice) {
        if (sending.current) return
        submission.current = null
        setTemplate(choice)
        setTemplatesOpen(false)
        templateControl.current?.focus({ preventScroll: true })
    }

    return (
        <main className="christmas-mobile">
            <section className="christmas-mobile-inner">
                <div className="christmas-mobile-brand">HAIFN CHRISTMAS</div>
                {state === 'sent' ? (
                    <div className="christmas-sent">
                        <img src={submission.current.image} alt="내가 그린 얼굴" />
                        <h1>그림을 보냈어요!</h1>
                        <p>{sentMode === 'review' ? '운영자가 확인한 뒤 화면에 걸려요.' : '앞에 있는 TV 화면을 봐주세요.'}</p>
                    </div>
                ) : (
                    <>
                        <h1>오늘의 내 얼굴을 그려요</h1>
                        <p>눈과 입만 그려도 좋아요.</p>
                        <div className="christmas-canvas-wrap">
                            {template && <FaceTemplatePreview template={template} size={SIZE} className="christmas-face-guide" />}
                            <canvas ref={canvasRef} width={SIZE} height={SIZE} aria-label="얼굴 그림판"
                                onPointerDown={start} onPointerMove={move} onPointerUp={finish}
                                onPointerCancel={finish} onLostPointerCapture={finish} />
                        </div>
                        <div className="christmas-tools" aria-label="펜 색상">
                            {COLORS.map(([value, label]) => (
                                <button key={value} type="button" className="christmas-color"
                                    style={{ '--ink': value }} aria-label={label} aria-pressed={!eraser && value === color}
                                    onClick={() => { setColor(value); setEraser(false) }} />
                            ))}
                        </div>
                        <div className="christmas-tools christmas-tool-labels">
                            <button type="button" aria-pressed={!eraser && width === 8} onClick={() => { setWidth(8); setEraser(false) }}><Pencil size={15} /> 가늘게</button>
                            <button type="button" aria-pressed={!eraser && width === 17} onClick={() => { setWidth(17); setEraser(false) }}><Pencil size={17} /> 굵게</button>
                            <button type="button" aria-pressed={eraser} onClick={() => setEraser(true)}><Eraser size={16} /> 지우개</button>
                            <button type="button" disabled={!historyCount || state === 'sending'} onClick={undo}><RotateCcw size={15} /> 되돌리기</button>
                            <button ref={templateControl} type="button" disabled={state === 'sending'}
                                aria-expanded={templatesOpen} aria-controls="christmas-face-templates"
                                aria-label={template ? `얼굴 틀 · ${template.label}` : '얼굴 틀'}
                                onClick={() => setTemplatesOpen(!templatesOpen)}>얼굴 틀</button>
                        </div>
                        {templatesOpen && <div id="christmas-face-templates" className="christmas-face-templates"
                            role="group" aria-label="얼굴 틀 고르기"
                            onKeyDown={event => {
                                if (event.key !== 'Escape') return
                                setTemplatesOpen(false)
                                templateControl.current?.focus({ preventScroll: true })
                            }}>
                            <button type="button" aria-pressed={!template} onClick={() => selectTemplate(null)}>
                                <span className="christmas-template-blank" aria-hidden="true" />
                                자유 그리기
                            </button>
                            {FACE_TEMPLATES.map(option => <button type="button" key={option.id}
                                aria-pressed={template?.id === option.id} onClick={() => selectTemplate(option)}>
                                <FaceTemplatePreview template={option} size={72} />
                                {option.label}
                            </button>)}
                        </div>}
                        <p className="christmas-disclosure">보낸 그림은 현장 TV에 공개됩니다.{mode === 'review' && ' 운영자 확인 후 게시돼요.'}</p>
                        <button className="christmas-send" type="button" onClick={send}
                            disabled={!historyCount || state === 'sending' || !mode || mode === 'closed'}>
                            {state === 'sending' ? '보내는 중…' : mode === 'closed' ? '접수 종료' : 'TV에 보내기'}
                        </button>
                        {(message || !mode) && <p role="status">{message || '접수 상태를 확인하고 있어요.'}</p>}
                    </>
                )}
            </section>
        </main>
    )
}
