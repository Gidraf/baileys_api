import React, { useState } from 'react';
import { Code2, Copy, CheckCircle2 } from 'lucide-react';

export default function CodeSnippet({ snippets }) {
  const [activeTab, setActiveTab] = useState(Object.keys(snippets)[0]);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(snippets[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-lg border border-[#222d34] bg-[#0b141a] my-4">
      <div className="bg-[#111b21] border-b border-[#222d34] p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-300">Integration Code</span>
        </div>
        <button onClick={copyCode} className="text-gray-400 hover:text-white transition-colors">
          {copied ? <CheckCircle2 className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      
      <div className="flex border-b border-[#222d34] bg-[#0b141a] overflow-x-auto">
        {Object.keys(snippets).map(lang => (
          <button
            key={lang}
            onClick={() => setActiveTab(lang)}
            className={`px-6 py-2 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
              activeTab === lang 
                ? 'text-[#25D366] border-b-2 border-[#25D366] bg-[#111b21]' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      <div className="p-4 bg-[#0b141a] overflow-x-auto relative">
         <pre className="text-sm font-mono text-emerald-400">
           {snippets[activeTab]}
         </pre>
      </div>
    </div>
  );
}
