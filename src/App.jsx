import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import StudentDashboard from './pages/StudentDashboard'
import Kiosk from './pages/Kiosk'
import SplashScreen from './components/common/SplashScreen'

function App() {
    const [isLoading, setIsLoading] = useState(() => {
        // Only show splash screen if it hasn't been shown in this session
        return !sessionStorage.getItem('splash_shown');
    });

    const handleFinishLoading = () => {
        sessionStorage.setItem('splash_shown', 'true');
        setIsLoading(false);
    };

    return (
        <>
            {isLoading && <SplashScreen finishLoading={handleFinishLoading} />}
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route element={<Layout />}>
                        <Route path="student" element={<StudentDashboard />} />
                        {/* Legacy or unused routes can be kept or removed */}
                        <Route path="dashboard" element={<Dashboard />} />
                    </Route>
                    <Route path="admin" element={<AdminDashboard />} />
                    <Route path="kiosk" element={<Kiosk />} />
                </Routes>
            </BrowserRouter>
        </>
    )
}

export default App
