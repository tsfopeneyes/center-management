import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import RandomLiveChatBoard from '../../src/pages/RandomLiveChatBoard';
createRoot(document.getElementById('root')).render(<BrowserRouter><RandomLiveChatBoard /></BrowserRouter>);
