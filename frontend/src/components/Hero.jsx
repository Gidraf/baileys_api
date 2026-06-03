import React from 'react';
import { Rocket, Briefcase, Home, Church, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <div className="w-full flex flex-col items-center justify-center space-y-12 mt-8 mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      {/* Header Section */}
      <div className="text-center max-w-4xl space-y-6">
        <div className="inline-flex items-center space-x-2 bg-[#25D366]/10 text-[#25D366] px-4 py-2 rounded-full font-medium text-sm border border-[#25D366]/20">
          <Rocket className="w-4 h-4" />
          <span>Open Source Baileys API</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
          Automate WhatsApp <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#25D366] to-[#128C7E]">Without the Meta API Hassle</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
          Getting approved and setting up the official Meta API takes a massive amount of time and effort. 
          I am launching this open-source software for free to help you easily connect, automate, and test WhatsApp directly via your browser.
        </p>
        <div className="flex items-center justify-center space-x-4 pt-4">
          <Link to="/playground" className="bg-[#25D366] hover:bg-[#128C7E] text-white px-8 py-4 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(37,211,102,0.4)] flex items-center">
            Try the Playground <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
          <Link to="/docs" className="bg-[#111b21] hover:bg-[#222d34] border border-[#222d34] text-white px-8 py-4 rounded-xl font-bold transition-all">
            Read the Docs
          </Link>
        </div>
      </div>

      {/* Ajiriwa Upsell Section */}
      <div className="w-full max-w-6xl mt-12">
        <div className="glass p-1 rounded-3xl bg-gradient-to-br from-[#25D366]/20 to-transparent">
          <div className="bg-[#0b141a] rounded-[22px] p-8 md:p-12 border border-[#222d34] flex flex-col md:flex-row items-center justify-between gap-12">
            
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center space-x-2 bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full font-medium text-xs border border-blue-500/20 uppercase tracking-wider">
                Enterprise Ready
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                Need a Reliable, All-in-One <br/> Business Solution?
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                If you want a fully integrated ERP, CRM, marketing toolset, and advanced automation out-of-the-box, consider signing up for <strong className="text-white">Ajiriwa</strong>. Create a free account and instantly unlock powerful, industry-specific WhatsApp automations.
              </p>
              
              <a href="https://ajiriwa.gidraf.dev" target="_blank" rel="noreferrer" className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <span>Sign up on ajiriwa.gidraf.dev</span>
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {/* Feature 1 */}
              <div className="bg-[#111b21] p-6 rounded-2xl border border-[#222d34] hover:border-blue-500/50 transition-colors">
                <Briefcase className="w-8 h-8 text-blue-400 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Recruitment & HR</h3>
                <p className="text-sm text-gray-400">Automatically review CVs and instantly reply to applicants directly via WhatsApp.</p>
              </div>
              {/* Feature 2 */}
              <div className="bg-[#111b21] p-6 rounded-2xl border border-[#222d34] hover:border-[#25D366]/50 transition-colors">
                <CheckCircle2 className="w-8 h-8 text-[#25D366] mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">E-commerce & Delivery</h3>
                <p className="text-sm text-gray-400">Manage online businesses and delivery logistics using WhatsApp to seamlessly communicate.</p>
              </div>
              {/* Feature 3 */}
              <div className="bg-[#111b21] p-6 rounded-2xl border border-[#222d34] hover:border-purple-500/50 transition-colors">
                <Home className="w-8 h-8 text-purple-400 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Real Estate</h3>
                <p className="text-sm text-gray-400">Save property listings and send interactive location pins to clients, eliminating the need to meet just for directions. Manage properties easily.</p>
              </div>
              {/* Feature 4 */}
              <div className="bg-[#111b21] p-6 rounded-2xl border border-[#222d34] hover:border-yellow-500/50 transition-colors">
                <Church className="w-8 h-8 text-yellow-400 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Churches & Ministries</h3>
                <p className="text-sm text-gray-400">Automatically send church bulletins and announcements to your entire congregation with the help of AI.</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
