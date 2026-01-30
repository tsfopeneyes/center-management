import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import StudentDashboard from './pages/StudentDashboard'
import Kiosk from './pages/Kiosk'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Landing />} />
                    <Route path="student" element={<StudentDashboard />} />
                    <Route path="admin" element={<AdminDashboard />} />
                    {/* Legacy or unused routes can be kept or removed */}
                    <Route path="dashboard" element={<Dashboard />} />
                </Route>
                <Route path="kiosk" element={<Kiosk />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
