import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Chats from './pages/Chats';
import Playground from './pages/Playground';
import Docs from './pages/Docs';
import WebhookPlayground from './pages/WebhookPlayground';
import Hero from './components/Hero';
import { MessageSquare, LayoutDashboard, Terminal, AlertTriangle, BookOpen, Webhook } from 'lucide-react';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0b141a] text-gray-200 flex flex-col font-sans">
        
        {/* Header / Navbar */}
        <header className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-8 h-8 text-[#25D366]" />
            <h1 className="text-xl font-bold tracking-wide">Baileys API</h1>
          </div>
          
          <nav className="flex space-x-6">
            <Link to="/" className="flex items-center space-x-2 hover:text-[#25D366] transition-colors">
              <LayoutDashboard className="w-5 h-5" />
              <span className="hidden sm:block">Dashboard</span>
            </Link>
            <Link to="/chats" className="flex items-center space-x-2 hover:text-[#25D366] transition-colors">
              <MessageSquare className="w-5 h-5" />
              <span className="hidden sm:block">Chats & Channels</span>
            </Link>
            <Link to="/playground" className="flex items-center space-x-2 hover:text-[#25D366] transition-colors">
              <Terminal className="w-5 h-5" />
              <span className="hidden sm:block">API Playground</span>
            </Link>
            <Link to="/webhooks" className="flex items-center space-x-2 hover:text-[#25D366] transition-colors">
              <Webhook className="w-5 h-5" />
              <span className="hidden sm:block">Webhooks</span>
            </Link>
            <Link to="/docs" className="flex items-center space-x-2 hover:text-[#25D366] transition-colors">
              <BookOpen className="w-5 h-5" />
              <span className="hidden sm:block">Documentation</span>
            </Link>
          </nav>
        </header>

        {/* Security Notice */}
        <div className="max-w-7xl mx-auto w-full px-6 mt-6">
           <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start space-x-3 text-yellow-500 text-sm">
             <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
             <div>
                <p className="font-semibold text-yellow-400">Security & Privacy Notice</p>
                <p className="opacity-90 mt-1">We value your privacy. All authentications and session data are stored securely on your browser. <strong>We automatically delete every session daily</strong>. This tool is open source and completely free.</p>
             </div>
           </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-6 flex flex-col">
          <Routes>
            <Route path="/" element={
              <>
                <Hero />
                <Dashboard />
              </>
            } />
            <Route path="/chats" element={<Chats />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/webhooks" element={<WebhookPlayground />} />
            <Route path="/docs" element={<Docs />} />
          </Routes>
        </main>

        <footer className="py-6 text-center text-sm text-gray-500 border-t border-[#222d34] mt-auto">
          Built with React & Baileys • Open Source • Powered by <a href="https://ajiriwa.gidraf.dev" className="text-[#25D366] hover:underline">Ajiriwa</a>
        </footer>
      </div>
    </BrowserRouter>
  );
}
