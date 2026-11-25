import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { isAdminOrStaff } from '../../utils/userUtils'
import { CHRISTMAS_PATH, christmasApi } from './christmasApi'
import { ChristmasImage } from './ChristmasScreen'

const modes = { live: '즉시 게시', review: '승인 후 게시', closed: '접수 종료' }
const statuses = { pending: '승인 대기', published: '게시 중', hidden: '숨김' }

function ManagementPanel() {
    const [mode, setMode] = useState(null)
    const [rows, setRows] = useState([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [filter, setFilter] = useState('all')
    const cache = useRef(new Map())
    const refresh = useCallback(async () => {
        const [next, drawings] = await Promise.all([christmasApi.mode(), christmasApi.list(true)])
        setMode(next)
        setRows(drawings)
    }, [])
    useEffect(() => {
        let running = true
        let timer
        async function poll() {
            try {
                await refresh()
                if (running) setError(current => current === '목록을 불러오지 못했습니다.' ? '' : current)
            } catch {
                if (running) setError('목록을 불러오지 못했습니다.')
            } finally {
                if (running) timer = window.setTimeout(poll, 2500)
            }
        }
        void poll()
        return () => {
            running = false
            window.clearTimeout(timer)
        }
    }, [refresh])

    async function change(action) {
        setBusy(true)
        setError('')
        try {
            await action()
            await refresh()
        } catch {
            setError('변경을 확인하지 못했습니다. 목록을 확인하고 다시 시도해 주세요.')
        } finally {
            setBusy(false)
        }
    }

    return <main className="christmas-manage">
        <header>
            <div className="christmas-mobile-brand">HAIFN CHRISTMAS</div>
            <h1>전시 운영</h1>
            <nav><a href={CHRISTMAS_PATH}>참여 화면</a><a href={`${CHRISTMAS_PATH}/tv`}>TV 화면</a></nav>
        </header>
        <section>
            <h2>접수 방식</h2>
            <div className="christmas-manage-controls">
                {Object.entries(modes).map(([value, label]) => <button key={value} disabled={busy || !mode}
                    type="button" aria-pressed={mode === value} onClick={() => change(() => christmasApi.setMode(value))}>{label}</button>)}
            </div>
        </section>
        {error && <p role="alert">{error}</p>}
        <section>
            <h2>작품 목록</h2>
            <div className="christmas-manage-controls">
                {Object.entries({ all: '전체', ...statuses }).map(([value, label]) => <button key={value} type="button"
                    aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
            </div>
            {rows.filter(row => filter === 'all' || row.status === filter).length === 0 && <p>표시할 그림이 없어요.</p>}
            <div className="christmas-manage-grid">
                {rows.filter(row => filter === 'all' || row.status === filter).map(row => <article key={row.id}>
                    <ChristmasImage id={row.id} cache={cache.current} manage />
                    <p>{statuses[row.status]}</p>
                    <div className="christmas-manage-controls">
                        {row.status !== 'published' && <button type="button" disabled={busy}
                            onClick={() => change(() => christmasApi.setStatus(row.id, 'published'))}>게시</button>}
                        {row.status !== 'hidden' && <button type="button" disabled={busy}
                            onClick={() => change(() => christmasApi.setStatus(row.id, 'hidden'))}>숨기기</button>}
                    </div>
                </article>)}
            </div>
        </section>
    </main>
}

function StaffManagement() {
    const auth = useAuth()
    if (auth.status === 'authenticated' && isAdminOrStaff(auth.profile)) return <ManagementPanel />
    return <main className="christmas-manage">
        <h1>HAIFN CHRISTMAS</h1>
        {['initializing', 'refreshing', 'restoring'].includes(auth.status) ? <p role="status">운영자 계정을 확인하고 있어요.</p>
            : <p>TSF 운영자 계정으로 로그인해 주세요. <a href="/">TSF 로그인</a></p>}
    </main>
}

export default function ChristmasManage() {
    return import.meta.env.DEV ? <ManagementPanel /> : <StaffManagement />
}
