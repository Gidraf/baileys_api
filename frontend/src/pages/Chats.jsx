import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, Loader2, Rss } from 'lucide-react';

export default function Chats() {
  const sessionId = localStorage.getItem('baileys_session');
  const [activeTab, setActiveTab] = useState('contacts');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchData(activeTab);
    }
  }, [sessionId, activeTab]);

  const fetchData = async (tab) => {
    setLoading(true);
    setData([]);
    try {
      let endpoint = `/api/sessions/${sessionId}/profile/contacts`;
      if (tab === 'groups') endpoint = `/api/sessions/${sessionId}/groups`;
      if (tab === 'channels') endpoint = `/api/sessions/${sessionId}/newsletter/subscribed`;
      
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        // Extract array depending on endpoint format
        if (Array.isArray(json)) setData(json);
        else if (json.data && Array.isArray(json.data)) setData(json.data);
        else if (typeof json === 'object') setData(Object.values(json));
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center mt-20 space-y-4">
        <MessageSquare className="w-16 h-16 text-gray-600" />
        <h2 className="text-2xl font-semibold text-gray-400">Not Connected</h2>
        <p className="text-gray-500">Please go to the Dashboard to link a device first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] mt-4 border border-[#222d34] rounded-2xl overflow-hidden glass">
      
      {/* Sidebar / Tabs */}
      <div className="flex bg-[#111b21] border-b border-[#222d34]">
        <button 
          onClick={() => setActiveTab('contacts')}
          className={`flex-1 py-4 flex items-center justify-center space-x-2 font-medium transition-colors ${activeTab === 'contacts' ? 'text-[#25D366] border-b-2 border-[#25D366]' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <Users className="w-5 h-5" /> <span>Contacts</span>
        </button>
        <button 
          onClick={() => setActiveTab('groups')}
          className={`flex-1 py-4 flex items-center justify-center space-x-2 font-medium transition-colors ${activeTab === 'groups' ? 'text-[#25D366] border-b-2 border-[#25D366]' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <MessageSquare className="w-5 h-5" /> <span>Groups</span>
        </button>
        <button 
          onClick={() => setActiveTab('channels')}
          className={`flex-1 py-4 flex items-center justify-center space-x-2 font-medium transition-colors ${activeTab === 'channels' ? 'text-[#25D366] border-b-2 border-[#25D366]' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <Rss className="w-5 h-5" /> <span>Channels</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#0b141a]">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-[#25D366]" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-500">
            No data found for {activeTab}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((item, idx) => {
              const name = item.name || item.subject || item.notify || item.id || 'Unknown';
              const jid = item.id || item.jid || 'Unknown JID';
              return (
                <div key={idx} className="bg-[#111b21] border border-[#222d34] p-4 rounded-xl flex flex-col justify-between hover:border-[#25D366]/50 transition-colors">
                  <div className="font-semibold text-white truncate" title={name}>{name}</div>
                  <div className="text-xs text-gray-500 mt-2 font-mono truncate">{jid}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
