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
    <div className="fixed inset-0 flex flex-col bg-[#F6F4F8] text-slate-900">
      {/* Content */}
      <main className="flex-1 relative overflow-hidden">
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
