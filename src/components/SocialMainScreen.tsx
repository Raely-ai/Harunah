import { useState } from "react";
import { Heart } from "lucide-react";
import SocialBottomNav from "./SocialBottomNav";
import SocialDiscoverScreen from "./SocialDiscoverScreen";
import SocialMatchScreen from "./SocialMatchScreen";
import SocialMessagesScreen from "./SocialMessagesScreen";
import SocialProfileScreen from "./SocialProfileScreen";
import SocialWalletScreen from "./SocialWalletScreen";
import { UserProfile } from "../types";

export default function SocialMainScreen({ currentUser, onBack, onEdit }: { currentUser: UserProfile, onBack: () => void, onEdit: () => void }) {
  const [activeTab, setActiveTab] = useState('discover');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    setIsChatOpen(false);
  };

  const showTopTabs = (activeTab === 'discover' || activeTab === 'match') && !isChatOpen;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F6F4F8] text-slate-900">
      {/* Top Tabs */}
      {showTopTabs && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center bg-white/60 backdrop-blur-2xl border border-white/40 rounded-full p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
          <button 
            onClick={() => handleNavigate('discover')}
            className={`px-8 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'discover' ? 'bg-white text-heading shadow-lg scale-105' : 'text-muted hover:text-heading hover:bg-white/20'}`}
          >
            Keşfet
          </button>
          <button 
            onClick={() => handleNavigate('match')}
            className={`px-8 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'match' ? 'bg-white text-heading shadow-lg scale-105' : 'text-muted hover:text-heading hover:bg-white/20'}`}
          >
            Karşılaşma
          </button>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 relative overflow-hidden pt-14">
        {activeTab === 'discover' && <SocialDiscoverScreen currentUser={currentUser} onNavigate={handleNavigate} onBack={onBack} config={null} />}
        {activeTab === 'match' && <SocialMatchScreen currentUser={currentUser} onNavigate={handleNavigate} />}
        {activeTab === 'messages' && <SocialMessagesScreen currentUser={currentUser} onNavigate={handleNavigate} onChatOpenChange={setIsChatOpen} />}
        {activeTab === 'profile' && <SocialProfileScreen currentUser={currentUser} onNavigate={handleNavigate} />}
        {activeTab === 'wallet' && <SocialWalletScreen currentUser={currentUser} onNavigate={handleNavigate} />}
      </main>

      {/* Bottom Nav */}
      {!(activeTab === 'messages' && isChatOpen) && <SocialBottomNav activeTab={activeTab} onNavigate={handleNavigate} />}
    </div>
  );
}
