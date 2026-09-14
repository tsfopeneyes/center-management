import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './supabaseClient'
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
const GuestMobileWelcome = lazy(() => import('./pages/GuestMobileWelcome'))
const StandaloneLiveChat = lazy(() => import('./pages/StandaloneLiveChat'))
const RandomLiveChatBoard = lazy(() => import('./pages/RandomLiveChatBoard'))
const TvSignageViewer = lazy(() => import('./pages/TvSignageViewer'))
const ScreenViewer = lazy(() => import('./pages/ScreenViewer'))
const CommunityChannelPage = lazy(() => import('./pages/CommunityChannelPage'))

function App() {
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

        const trackWebSession = async () => {
            try {
                let stored = null;
                try {
                    stored = localStorage.getItem('user') || localStorage.getItem('admin_user');
                } catch (err) {}
                if (!stored) return;
                const currentUser = JSON.parse(stored);
                if (!currentUser?.id) return;
                // Record every new web-app session. The helper verifies the
                // database write and has a REST fallback for mobile browsers.
                await trackUserWebActivity(currentUser, { force: true });
            } catch (e) {
                console.error('Failed to track web session:', e);
            }
        };

        loadGlobalSettings();
        trackWebSession();
    }, []);

    return (
        <>
            {window.location.pathname.toLowerCase() !== '/screen' && <AppAlertDialog />}
            <BrowserRouter>
                <Suspense fallback={<div className="min-h-screen bg-[#F8F9FA]" aria-hidden="true" />}>
                    <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/checkin" element={<GuestMobileWelcome />} />
                        <Route path="/guest" element={<GuestMobileWelcome />} />
                        <Route path="/welcome" element={<GuestMobileWelcome />} />
                        <Route path="/p/:id" element={<PublicProgramDetail />} />
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
