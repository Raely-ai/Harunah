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

  return (
    <div className="fixed inset-0 flex flex-col bg-white text-slate-900">
      {/* Content */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        <div className={`flex-1 ${activeTab === 'discover' ? 'flex flex-col' : 'hidden'}`}>
          <SocialDiscoverScreen currentUser={currentUser} onNavigate={handleNavigate} onBack={onBack} config={null} isActive={activeTab === 'discover'} />
        </div>
        <div className={`flex-1 ${activeTab === 'match' ? 'flex flex-col' : 'hidden'}`}>
          <SocialMatchScreen currentUser={currentUser} onNavigate={handleNavigate} isActive={activeTab === 'match'} />
        </div>
        <div className={`flex-1 ${activeTab === 'messages' ? 'flex flex-col' : 'hidden'}`}>
          <SocialMessagesScreen currentUser={currentUser} onNavigate={handleNavigate} onChatOpenChange={setIsChatOpen} isActive={activeTab === 'messages'} />
        </div>
        <div className={`flex-1 ${activeTab === 'profile' ? 'flex flex-col' : 'hidden'}`}>
          <SocialProfileScreen currentUser={currentUser} onNavigate={handleNavigate} />
        </div>
        <div className={`flex-1 ${activeTab === 'wallet' ? 'flex flex-col' : 'hidden'}`}>
          <SocialWalletScreen currentUser={currentUser} onNavigate={handleNavigate} />
        </div>
      </main>

      {/* Bottom Nav */}
      {!(activeTab === 'messages' && isChatOpen) && <SocialBottomNav activeTab={activeTab} onNavigate={handleNavigate} />}
    </div>
  );
}
