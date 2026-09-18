import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './auth/AuthProvider'
import { getHomeEntry } from './auth/homeEntry'
import { isAdminOrStaff } from './utils/userUtils'
import { serverIntegrationsEnabled } from './utils/serverIntegration'
import { trackUserWebActivity } from './utils/userActivityUtils'
import AppAlertDialog from './components/common/AppAlertDialog'

// Keep the initial module graph small. Previously every admin, analytics,
// kiosk, student and signage dependency was transformed before the landing
// page could render, which made a cold local start appear frozen.
const Layout = lazy(() => import('./components/Layout'))
const Landing = lazy(() => import('./pages/Landing'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const Kiosk = lazy(() => import('./pages/Kiosk'))
const PublicProgramDetail = lazy(() => import('./pages/PublicProgramDetail'))
const PublicSurveyPage = lazy(() => import('./pages/PublicSurveyPage'))
const GuestMobileWelcome = lazy(() => import('./pages/GuestMobileWelcome'))
const StandaloneLiveChat = lazy(() => import('./pages/StandaloneLiveChat'))
const RandomLiveChatBoard = lazy(() => import('./pages/RandomLiveChatBoard'))
const ElectronicLiveChatBoard = lazy(() => import('./pages/ElectronicLiveChatBoard'))
const TvSignageViewer = lazy(() => import('./pages/TvSignageViewer'))
const ScreenViewer = lazy(() => import('./pages/ScreenViewer'))
const CommunityChannelPage = lazy(() => import('./pages/CommunityChannelPage'))

function HomeEntry() {
    const auth = useAuth()
    const location = useLocation()
    const params = new URLSearchParams(location.search)
    const specialReturn = ['programLogin', 'communityInvite', 'surveyLogin', 'register'].some(key => params.has(key))
        || Boolean(location.state?.fromProgram || location.state?.communityId)
    const destination = getHomeEntry(auth, specialReturn, isAdminOrStaff)

    if (destination === 'admin' || destination === 'student') {
        return <Navigate to={`/${destination}${location.search}`} replace />
    }
    if (destination === 'waiting') {
        return <div className="min-h-screen bg-[#F8F9FA]" aria-label="로그인 상태 확인 중" />
    }
    if (destination === 'retry') {
        return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8F9FA] px-6 text-center">
            <p className="font-bold text-gray-700">연결을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.</p>
            <button type="button" onClick={() => void auth.refresh()} className="rounded-xl bg-[#CF3A27] px-5 py-3 font-bold text-white">다시 시도</button>
        </main>
    }
    return <Landing />
}

function App() {
    const auth = useAuth()
    useEffect(() => {
        if (window.location.pathname.toLowerCase() === '/screen') return;
        const loadGlobalSettings = async () => {
            ['line_channel_access_token', 'line_group_id'].forEach(key => localStorage.removeItem(key));
            // Once server integrations are enabled, external-service credentials
            // must remain on the server and must not be copied into this browser.
            if (serverIntegrationsEnabled()) return;
            try {
                const { data, error } = await supabase
                    .from('global_settings')
                    .select('*');
                if (!error && data) {
                    data.forEach(item => {
                        try {
                            if (['line_channel_access_token', 'line_group_id'].includes(item.key)) return;
                            localStorage.setItem(item.key, item.value);
                        } catch (err) {}
                    });
                }
            } catch (e) {
                console.error('Failed to load global settings:', e);
            }
        };

        loadGlobalSettings();
    }, []);

    useEffect(() => {
        if (auth.status !== 'authenticated' || !auth.profile?.id) return;
        // This write is optional for startup. Use the verified profile rather
        // than an old local copy, and let routing complete before recording it.
        const timer = window.setTimeout(() => {
            void trackUserWebActivity(auth.profile, { force: true }).catch(error => {
                console.error('Failed to track web session:', error);
            });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [auth.status, auth.profile?.id]);

    return (
        <>
            {window.location.pathname.toLowerCase() !== '/screen' && <AppAlertDialog />}
            <BrowserRouter>
                <Suspense fallback={<div className="min-h-screen bg-[#F8F9FA]" aria-hidden="true" />}>
                    <Routes>
                        <Route path="/" element={<HomeEntry />} />
                        <Route path="/checkin" element={<GuestMobileWelcome />} />
                        <Route path="/guest" element={<GuestMobileWelcome />} />
                        <Route path="/welcome" element={<GuestMobileWelcome />} />
                        <Route path="/p/:id" element={<PublicProgramDetail />} />
                        <Route path="/survey/:token" element={<PublicSurveyPage />} />
                        <Route path="/community/:id" element={<CommunityChannelPage />} />
                        <Route path="student" element={<StudentDashboard />} />
                        <Route element={<Layout />}>
                            {/* Legacy or unused routes can be kept or removed */}
                            <Route path="dashboard" element={<Dashboard />} />
                        </Route>
                        <Route path="admin" element={<AdminDashboard />} />
                        <Route path="kiosk" element={<Kiosk />} />
                        <Route path="screen" element={<ScreenViewer />} />
                        <Route path="/live-chat" element={<StandaloneLiveChat />} />
                        <Route path="/live-chat/:center" element={<StandaloneLiveChat />} />
                        <Route path="/chat" element={<StandaloneLiveChat />} />
                        <Route path="/chat/:center" element={<StandaloneLiveChat />} />
                        <Route path="/chat2" element={<RandomLiveChatBoard />} />
                        <Route path="/chat2/:center" element={<RandomLiveChatBoard />} />
                        <Route path="/chat3" element={<ElectronicLiveChatBoard />} />
                        <Route path="/chat3/:center" element={<ElectronicLiveChatBoard />} />
                        <Route path="/tv" element={<StandaloneLiveChat />} />
                        <Route path="/tv/:center" element={<StandaloneLiveChat />} />
                        <Route path="/signage" element={<StandaloneLiveChat />} />
                        <Route path="/signage/:center" element={<StandaloneLiveChat />} />
                        <Route path="/view" element={<StandaloneLiveChat />} />
                        <Route path="/display" element={<StandaloneLiveChat />} />
                    </Routes>
                </Suspense>
            </BrowserRouter>
        </>
    )
}

export default App
