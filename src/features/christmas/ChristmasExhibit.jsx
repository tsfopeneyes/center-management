import React, { lazy, Suspense } from 'react'
import { AuthProvider } from '../../auth/AuthProvider'
import './christmas.css'

const Drawing = lazy(() => import('./ChristmasDrawing'))
const Screen = lazy(() => import('./ChristmasScreen'))
const Manage = lazy(() => import('./ChristmasManage'))

export default function ChristmasExhibit({ view }) {
    const content = view === 'tv' ? <Screen />
        : view === 'manage' && import.meta.env.DEV ? <Manage />
            : view === 'manage' ? <AuthProvider><Manage /></AuthProvider> : <Drawing />
    return <Suspense fallback={<main className="christmas-loading" aria-busy="true" />}>{content}</Suspense>
}
