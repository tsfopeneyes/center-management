import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { isAdminOrStaff } from '../../utils/userUtils'
import { CHRISTMAS_PATH, christmasApi } from './christmasApi'
import { ChristmasImage } from './ChristmasScreen'

const modes = { live: '��� �Խ�', review: '���� �� �Խ�', closed: '���� ����' }
const statuses = { pending: '���� ���', published: '�Խ� ��', hidden: '����' }

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
                if (running) setError(current => current === '����� �ҷ����� ���߽��ϴ�.' ? '' : current)
            } catch {
                if (running) setError('����� �ҷ����� ���߽��ϴ�.')
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
            setError('������ Ȯ������ ���߽��ϴ�. ����� Ȯ���ϰ� �ٽ� �õ��� �ּ���.')
        } finally {
            setBusy(false)
        }
    }

    return <main className="christmas-manage">
        <header>
            <div className="christmas-mobile-brand">HAIFN CHRISTMAS</div>
            <h1>���� �</h1>
            <nav><a href={CHRISTMAS_PATH}>���� ȭ��</a><a href={`${CHRISTMAS_PATH}/tv`}>TV ȭ��</a></nav>
        </header>
        <section>
            <h2>���� ���</h2>
            <div className="christmas-manage-controls">
                {Object.entries(modes).map(([value, label]) => <button key={value} disabled={busy || !mode}
                    type="button" aria-pressed={mode === value} onClick={() => change(() => christmasApi.setMode(value))}>{label}</button>)}
            </div>
        </section>
        {error && <p role="alert">{error}</p>}
        <section>
            <h2>��ǰ ���</h2>
            <div className="christmas-manage-controls">
                {Object.entries({ all: '��ü', ...statuses }).map(([value, label]) => <button key={value} type="button"
                    aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
            </div>
            {rows.filter(row => filter === 'all' || row.status === filter).length === 0 && <p>ǥ���� �׸��� �����.</p>}
            <div className="christmas-manage-grid">
                {rows.filter(row => filter === 'all' || row.status === filter).map(row => <article key={row.id}>
                    <ChristmasImage id={row.id} cache={cache.current} manage />
                    <p>{statuses[row.status]}</p>
                    <div className="christmas-manage-controls">
                        {row.status !== 'published' && <button type="button" disabled={busy}
                            onClick={() => change(() => christmasApi.setStatus(row.id, 'published'))}>�Խ�</button>}
                        {row.status !== 'hidden' && <button type="button" disabled={busy}
                            onClick={() => change(() => christmasApi.setStatus(row.id, 'hidden'))}>�����</button>}
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
        {['initializing', 'refreshing', 'restoring'].includes(auth.status) ? <p role="status">��� ������ Ȯ���ϰ� �־��.</p>
            : <p>TSF ��� �������� �α����� �ּ���. <a href="/">TSF �α���</a></p>}
    </main>
}

export default function ChristmasManage() {
    return import.meta.env.DEV ? <ManagementPanel /> : <StaffManagement />
}
