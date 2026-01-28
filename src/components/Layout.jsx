import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Home, LogOut } from 'lucide-react';

const Layout = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white shadow-sm p-4 sticky top-0 z-[100]">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <Link
                        to="/"
                        className="text-xl font-bold text-blue-600 flex items-center gap-2"
                    >
                        <Home size={24} />
                        SCI CENTER
                    </Link>
                    <nav className="flex gap-4">
                        {/* Admin Link Removed */}
                    </nav>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full p-4">
                <Outlet />
            </main>

            <footer className="p-4 text-center text-gray-400 text-sm">
                © 2024 SCI CENTER
            </footer>
        </div>
    );
};

export default Layout;
