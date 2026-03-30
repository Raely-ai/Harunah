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

  return (
    <div className="fixed inset-0 flex flex-col bg-white text-slate-900">
      {/* Content */}
      <main className="flex-1 relative overflow-hidden">
        {activeTab === 'discover' && <SocialDiscoverScreen currentUser={currentUser} onNavigate={setActiveTab} onBack={onBack} />}
        {activeTab === 'match' && <SocialMatchScreen currentUser={currentUser} onNavigate={setActiveTab} />}
        {activeTab === 'messages' && <SocialMessagesScreen currentUser={currentUser} onNavigate={setActiveTab} />}
        {activeTab === 'profile' && <SocialProfileScreen currentUser={currentUser} onNavigate={setActiveTab} onEdit={onEdit} />}
        {activeTab === 'wallet' && <SocialWalletScreen currentUser={currentUser} onNavigate={setActiveTab} />}
      </main>

      {/* Bottom Nav */}
      <SocialBottomNav activeTab={activeTab} onNavigate={setActiveTab} />
    </div>
  );
}
