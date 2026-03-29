import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  MessageCircle, 
  Sparkles, 
  Search, 
  Settings, 
  Plus, 
  ArrowRight, 
  MapPin, 
  Wallet, 
  User,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Star,
  Compass,
  MessageSquare,
  Quote,
  Target,
  Moon,
  Zap,
  Clock,
  Calendar,
  Globe,
  MoreVertical,
  Bell
} from "lucide-react";
import { collection, query, where, getDocs, limit, doc, updateDoc, getDoc, setDoc, increment, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { SocialProfile } from "../types";
import { toast } from "sonner";
import EditSocialProfileModal from "./EditSocialProfileModal";
import DiscoverFeed from "./DiscoverFeed";
import SocialMessages from "./SocialMessages";
import SocialRoomList from "./SocialRoomList";
import SocialRoomView from "./SocialRoomView";
import { SocialRoom, SocialRoomMember } from "../types";
import HostPackageModal from "./HostPackageModal";
import SocialBalanceScreen from "./SocialBalanceScreen";
import { UserActionMenu } from "./UserActionMenu";
import { SocialSettingsModal } from "./SocialSettingsModal";
import { createSocialNotification } from '../services/socialNotificationService';
import { calculateCompatibility } from '../services/socialDiscoveryService';
import { NotificationCenter } from "./NotificationCenter";

interface SocialHubProps {
  userProfile: any;
  socialProfile: SocialProfile | null;
  onReturnToFortune: () => void;
  onUpdateSocialProfile: (profile: SocialProfile) => void;
}

type SocialTab = 'discover' | 'rooms' | 'messages' | 'balance' | 'profile';

export default function SocialHub({ userProfile, socialProfile, onReturnToFortune, onUpdateSocialProfile }: SocialHubProps) {
  const [activeTab, setActiveTab] = useState<SocialTab>('discover');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<SocialProfile | null>(null);
  const [activeRoom, setActiveRoom] = useState<SocialRoom | null>(null);
  const [isHostPackageModalOpen, setIsHostPackageModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'socialNotifications'),
      where('userId', '==', auth.currentUser.uid),
      where('isRead', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotificationsCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      const updateLastActive = async () => {
        try {
          await setDoc(doc(db, 'socialProfiles', auth.currentUser!.uid), {
            lastActiveAt: new Date().toISOString()
          }, { merge: true });
        } catch (error) {
          console.error('Error updating lastActiveAt:', error);
        }
      };
      updateLastActive();

      // Check for host package expiry
      if (socialProfile?.hosting?.activePackage?.expiresAt) {
        const expiresAt = new Date(socialProfile.hosting.activePackage.expiresAt).getTime();
        const now = Date.now();
        const diff = expiresAt - now;
        const oneDay = 24 * 60 * 60 * 1000;

        if (diff > 0 && diff < oneDay) {
          // Check if we already sent this notification today
          const lastWarning = localStorage.getItem(`host_expiry_warning_${socialProfile.uid}`);
          const today = new Date().toDateString();
          
          if (lastWarning !== today) {
            createSocialNotification(
              socialProfile.uid,
              'host_package_expiry',
              'Host Paketi Bitiş Uyarısı!',
              'Host paketiniz 24 saat içinde sona erecek. Odalarınızın kapanmaması için paketinizi yenilemeyi unutmayın.',
              {
                packageType: socialProfile.hosting.activePackage.type
              },
              '/social/profile'
            );
            localStorage.setItem(`host_expiry_warning_${socialProfile.uid}`, today);
          }
        }
      }
    }
  }, [socialProfile]);

  const handleJoinRoom = async (room: SocialRoom) => {
    if (!auth.currentUser || !socialProfile) return;
    
    try {
      // Check if already a member
      const memberId = `${room.id}_${auth.currentUser.uid}`;
      const memberDoc = await getDoc(doc(db, "socialRoomMembers", memberId));
      
      if (!memberDoc.exists()) {
        // Check room capacity
        if (room.memberCount >= room.maxMembers) {
          toast.error("Oda dolu.");
          return;
        }

        // Join room
        await setDoc(doc(db, "socialRoomMembers", memberId), {
          id: memberId,
          roomId: room.id,
          uid: auth.currentUser.uid,
          role: 'listener',
          joinedAt: new Date().toISOString(),
          isMuted: false,
          nickname: socialProfile.nickname,
          photoURL: socialProfile.photoURL || ""
        });

        // Update member count
        await updateDoc(doc(db, "socialRooms", room.id), {
          memberCount: increment(1)
        });
      }

      setActiveRoom(room);
    } catch (error) {
      console.error("Join room error:", error);
      toast.error("Odaya katılamadınız.");
    }
  };

  const navItems = [
    { id: 'discover', label: 'Keşfet', icon: Compass },
    { id: 'rooms', label: 'Odalar', icon: MessageSquare },
    { id: 'messages', label: 'Mesajlar', icon: MessageCircle },
    { id: 'balance', label: 'Bakiye', icon: Wallet },
    { id: 'profile', label: 'Profil', icon: User },
  ];

  return (
    <div className="fixed inset-0 bg-white flex flex-col social-theme select-none overflow-hidden z-[60]">
      {/* Header */}
      <header className="px-6 pt-14 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-xl z-40 border-b border-zinc-100 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onReturnToFortune}
            className="w-10 h-10 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all hover:bg-zinc-100 active:scale-95"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 leading-tight">Ahlas Social</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Canlı</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsNotificationsOpen(true)}
            className="w-10 h-10 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all hover:bg-zinc-100 active:scale-95 relative"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            )}
          </button>
          <button 
            onClick={() => setIsSettingsModalOpen(true)}
            className="w-10 h-10 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all hover:bg-zinc-100 active:scale-95"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 pb-32 custom-scrollbar flex flex-col relative">
        <AnimatePresence mode="wait">
          {activeTab === 'discover' && socialProfile && (
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <DiscoverFeed 
                currentSocialProfile={socialProfile}
                onViewProfile={(profile) => setViewingProfile(profile)}
              />
            </motion.div>
          )}

          {activeTab === 'rooms' && (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 pt-4"
            >
              <SocialRoomList onJoinRoom={handleJoinRoom} profile={socialProfile} />
            </motion.div>
          )}

          {activeTab === 'messages' && (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col -mx-6"
            >
              <SocialMessages />
            </motion.div>
          )}

          {activeTab === 'balance' && socialProfile && (
            <motion.div
              key="balance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              <SocialBalanceScreen 
                userProfile={userProfile}
                socialProfile={socialProfile}
                onOpenHostPackages={() => setIsHostPackageModalOpen(true)}
              />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 pt-4"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className="w-32 h-32 rounded-[3rem] bg-zinc-100 overflow-hidden border-4 border-white shadow-2xl shadow-zinc-200/50">
                    <img 
                      src={socialProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${socialProfile?.nickname}`} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button 
                    onClick={() => setIsEditModalOpen(true)}
                    className="absolute bottom-0 right-0 w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shadow-xl shadow-zinc-900/20 border-2 border-white"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-2xl font-bold text-zinc-900">{socialProfile?.nickname}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{socialProfile?.age}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    {socialProfile?.region || 'Türkiye'}
                  </div>
                </div>

                {/* Completeness Indicator */}
                <div className="w-full max-w-[240px] space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Profil Doluluğu</span>
                    <span className="text-[10px] font-bold text-zinc-900">{socialProfile?.completeness || 0}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${socialProfile?.completeness || 0}%` }}
                      className="h-full bg-zinc-900 rounded-full"
                    />
                  </div>
                </div>

                {/* Hosting Status */}
                <div className="w-full space-y-3">
                  <div className="p-5 rounded-3xl bg-amber-50 border border-amber-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Host Durumu</p>
                        <p className="text-xs font-bold text-zinc-900">
                          {socialProfile?.hosting?.activePackage 
                            ? `${socialProfile.hosting.activePackage.type === 'daily' ? 'Günlük' : socialProfile.hosting.activePackage.type === 'weekly' ? 'Haftalık' : 'Aylık'} Paket Aktif`
                            : new Date(socialProfile?.hosting?.freeTrialUntil || '') > new Date()
                            ? 'Ücretsiz Deneme Aktif'
                            : 'Paket Bulunmuyor'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsHostPackageModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-amber-600 transition-colors"
                    >
                      {socialProfile?.hosting?.activePackage ? 'Yenile' : 'Paket Al'}
                    </button>
                  </div>
                  
                  {/* Countdown Display */}
                  {(socialProfile?.hosting?.activePackage || (socialProfile?.hosting?.freeTrialUntil && new Date(socialProfile.hosting.freeTrialUntil) > new Date())) && (
                    <div className="px-5 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          {socialProfile?.hosting?.activePackage ? 'Paket Bitişine Kalan' : 'Ücretsiz Host Süren'}
                        </span>
                      </div>
                      <CountdownTimer 
                        expiryDate={socialProfile?.hosting?.activePackage?.expiresAt || socialProfile?.hosting?.freeTrialUntil || ''} 
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bio & Vibe */}
              <div className="space-y-4">
                <div className="p-6 rounded-[2rem] bg-zinc-50 border border-zinc-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <Quote className="w-4 h-4 text-zinc-300" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Hakkımda</span>
                  </div>
                  <p className="text-zinc-600 text-sm leading-relaxed italic">
                    "{socialProfile?.bio || 'Henüz bir biyografi eklenmemiş.'}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                      <Sparkles className="w-5 h-5 text-zinc-900" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Vibe</p>
                      <p className="text-xs font-bold text-zinc-900 capitalize">{socialProfile?.vibe}</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                      <Target className="w-5 h-5 text-zinc-900" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amaç</p>
                      <p className="text-xs font-bold text-zinc-900 capitalize">{socialProfile?.socialPurpose}</p>
                    </div>
                  </div>
                </div>

                {/* Cosmic Identity / Birth Info */}
                <div className="p-6 rounded-[2rem] bg-zinc-900 text-white space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16" />
                  <div className="flex items-center gap-3 relative">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Kozmik Kimlik</h4>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Yıldız Haritan</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 relative">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Tarih</span>
                      </div>
                      <p className="text-[11px] font-bold">{socialProfile?.birthDate ? new Date(socialProfile.birthDate).toLocaleDateString('tr-TR') : '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <Clock className="w-3 h-3" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Saat</span>
                      </div>
                      <p className="text-[11px] font-bold">{socialProfile?.birthTime || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <Globe className="w-3 h-3" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Yer</span>
                      </div>
                      <p className="text-[11px] font-bold truncate">{socialProfile?.birthPlace || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Takipçi", value: "124" },
                  { label: "Takip", value: "89" },
                  { label: "Beğeni", value: "1.2K" }
                ].map((stat) => (
                  <div key={stat.label} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-center space-y-1">
                    <p className="text-lg font-bold text-zinc-900">{stat.value}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {[
                  { label: "Fal Modülüne Dön", icon: Sparkles, onClick: onReturnToFortune },
                  { label: "Profili Düzenle", icon: User, onClick: () => setIsEditModalOpen(true) },
                  { label: "Güvenlik ve Gizlilik", icon: ShieldCheck, onClick: () => setIsSettingsModalOpen(true) },
                  { label: "Yardım ve Destek", icon: MessageCircle },
                  { label: "Çıkış Yap", icon: LogOut, danger: true, onClick: () => auth.signOut() }
                ].map((item) => (
                  <button 
                    key={item.label} 
                    onClick={item.onClick}
                    className={`w-full p-5 rounded-2xl border border-zinc-50 flex items-center justify-between group transition-all duration-300 ${
                      item.danger ? 'bg-rose-50/50 text-rose-600' : 'bg-zinc-50 text-zinc-900 hover:bg-white hover:border-zinc-200 hover:shadow-lg hover:shadow-zinc-200/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.danger ? 'bg-rose-100' : 'bg-white shadow-sm'}`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm">{item.label}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${item.danger ? 'text-rose-300' : 'text-zinc-300 group-hover:text-zinc-900'}`} />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isEditModalOpen && socialProfile && (
            <EditSocialProfileModal 
              profile={socialProfile}
              onClose={() => setIsEditModalOpen(false)}
              onUpdate={onUpdateSocialProfile}
            />
          )}
          {viewingProfile && (
            <ProfileDetailView 
              profile={viewingProfile} 
              onClose={() => setViewingProfile(null)}
              onMessage={() => {
                setViewingProfile(null);
                setActiveTab('messages');
              }}
            />
          )}
          {activeRoom && (
            <SocialRoomView 
              room={activeRoom} 
              userProfile={userProfile}
              onLeave={() => setActiveRoom(null)}
              onViewProfile={(profile) => setViewingProfile(profile)}
            />
          )}
          {socialProfile && (
            <HostPackageModal 
              isOpen={isHostPackageModalOpen}
              profile={socialProfile}
              onClose={() => setIsHostPackageModalOpen(false)}
              onSuccess={() => setIsHostPackageModalOpen(false)}
            />
          )}
          {socialProfile && (
            <SocialSettingsModal
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              profile={socialProfile}
              onUpdate={onUpdateSocialProfile}
            />
          )}

          <NotificationCenter 
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            onNavigate={(link) => {
              if (link.startsWith('/social/chat/')) {
                setActiveTab('messages');
              } else if (link === '/social/messages') {
                setActiveTab('messages');
              } else if (link === '/social/balance') {
                setActiveTab('balance');
              } else if (link === '/social/profile') {
                setActiveTab('profile');
              }
            }}
          />
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl border-t border-zinc-100 px-8 py-4 pb-10 flex items-center justify-between z-40">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as SocialTab)}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative ${
              activeTab === item.id ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <div className={`p-1 transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'scale-100'}`}>
              <item.icon className="w-6 h-6" strokeWidth={activeTab === item.id ? 2.5 : 2} />
            </div>
            
            <span className={`text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-300 ${
              activeTab === item.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
            }`}>
              {item.label}
            </span>

            {activeTab === item.id && (
              <motion.div 
                layoutId="nav-indicator"
                className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-1 bg-zinc-900 rounded-full"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

function CountdownTimer({ expiryDate }: { expiryDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(expiryDate).getTime() - Date.now();
      if (difference <= 0) return null;

      return {
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (!remaining) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiryDate]);

  if (!timeLeft) return <span className="text-xs font-bold text-rose-500">Süre Doldu</span>;

  return (
    <div className="flex items-center gap-1 font-mono text-xs font-bold text-zinc-900">
      <span>{timeLeft.hours.toString().padStart(2, '0')}s</span>
      <span className="text-zinc-300">:</span>
      <span>{timeLeft.minutes.toString().padStart(2, '0')}d</span>
      <span className="text-zinc-300">:</span>
      <span>{timeLeft.seconds.toString().padStart(2, '0')}s</span>
    </div>
  );
}

function ProfileDetailView({ profile, onClose, onMessage }: { profile: SocialProfile, onClose: () => void, onMessage: () => void }) {
  const [score, setScore] = useState<any>(null);

  useEffect(() => {
    if (profile && auth.currentUser) {
      // We need the viewer's profile to calculate compatibility
      const fetchViewerProfile = async () => {
        const viewerDoc = await getDoc(doc(db, "socialProfiles", auth.currentUser!.uid));
        if (viewerDoc.exists()) {
          const viewerProfile = viewerDoc.data() as SocialProfile;
          const compatibility = calculateCompatibility(viewerProfile, profile);
          setScore(compatibility);
        }
      };
      fetchViewerProfile();
    }
  }, [profile]);

  const handleSendMessage = async () => {
    if (!auth.currentUser) return;

    // Check if blocked
    if (profile.blockedUids?.includes(auth.currentUser.uid)) {
      toast.error("Bu kullanıcıya mesaj gönderemezsiniz.");
      return;
    }

    // Check target user's messaging settings
    const settings = profile.settings;
    if (settings) {
      if (settings.whoCanMessage === 'nobody') {
        toast.error("Bu kullanıcı mesaj alımını kapatmış.");
        return;
      }
      
      if (settings.whoCanMessage === 'friends') {
        // Check if friends
        const friendshipId = [auth.currentUser.uid, profile.uid].sort().join('_');
        const friendshipDoc = await getDoc(doc(db, "friendships", friendshipId));
        if (!friendshipDoc.exists() || friendshipDoc.data()?.status !== 'active') {
          toast.error("Sadece arkadaşları bu kullanıcıya mesaj atabilir.");
          return;
        }
      }
    }

    // Check target user's friend request settings
    if (settings && settings.whoCanAddFriend === 'nobody') {
      toast.error("Bu kullanıcı arkadaşlık isteklerini kapatmış.");
      return;
    }

    try {
      // Create a chat request or check if friendship exists
      const requestId = doc(collection(db, "friendshipRequests")).id;
      await setDoc(doc(db, "friendshipRequests", requestId), {
        id: requestId,
        fromUid: auth.currentUser.uid,
        toUid: profile.uid,
        status: 'pending',
        timestamp: new Date().toISOString(),
        message: "Sana bir mesaj göndermek istiyor."
      });

      await createSocialNotification(
        profile.uid,
        'new_friend_request',
        'Yeni Arkadaşlık İsteği!',
        `${auth.currentUser?.displayName || 'Birisi'} sana arkadaşlık isteği gönderdi.`,
        {
          senderId: auth.currentUser?.uid,
          senderName: auth.currentUser?.displayName || 'Birisi',
          senderPhoto: auth.currentUser?.photoURL || undefined
        },
        '/social/messages'
      );

      toast.success("Sohbet isteği gönderildi!");
      onMessage();
    } catch (error) {
      console.error("Send message error:", error);
      toast.error("İşlem başarısız oldu.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-white flex flex-col"
    >
      <header className="px-6 pt-12 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-10">
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-900"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h2 className="font-bold text-zinc-900">{profile.nickname}</h2>
        <UserActionMenu
          targetUid={profile.uid}
          targetName={profile.nickname}
          context="profile"
          onBlockSuccess={onClose}
          trigger={
            <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-colors">
              <MoreVertical className="w-5 h-5" />
            </div>
          }
        />
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-12 space-y-8">
        <div className="relative aspect-[3/4] rounded-[3rem] overflow-hidden shadow-2xl shadow-zinc-200/50 mt-4">
          <img 
            src={profile.photoURL || `https://picsum.photos/seed/${profile.uid}/800/1200`} 
            alt={profile.nickname}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8 right-8 p-6 rounded-[2.5rem] bg-white/80 backdrop-blur-xl border border-white/40 shadow-xl flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">{profile.nickname}, {profile.age || '??'}</h1>
              <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                <MapPin className="w-3.5 h-3.5" />
                {profile.region || 'Bilinmeyen Konum'}
              </div>
            </div>
            {score && !isNaN(score.total) && score.total > 0 && (
              <div className="px-4 py-2 rounded-2xl bg-zinc-900/5 border border-zinc-900/5 flex flex-col items-center">
                <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Uyum</span>
                <span className="text-sm font-black text-zinc-900">{score.total}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-8 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 space-y-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Quote className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Hakkımda</span>
            </div>
            <p className="text-zinc-600 leading-relaxed italic text-lg">
              "{profile.bio || 'Henüz bir biyografi eklenmemiş.'}"
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 space-y-2">
              <Sparkles className="w-5 h-5 text-zinc-900" />
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Vibe</p>
              <p className="font-bold text-zinc-900 capitalize">{profile.vibe}</p>
            </div>
            <div className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 space-y-2">
              <Target className="w-5 h-5 text-zinc-900" />
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amaç</p>
              <p className="font-bold text-zinc-900 capitalize">{profile.socialPurpose}</p>
            </div>
          </div>

          <div className="p-8 rounded-[2.5rem] bg-zinc-900 text-white space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                <Moon className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-bold">Kozmik Detaylar</h4>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Doğum Tarihi</p>
                <p className="text-sm font-bold">{profile.birthDate ? new Date(profile.birthDate).toLocaleDateString('tr-TR') : '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Doğum Yeri</p>
                <p className="text-sm font-bold">{profile.birthPlace || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSendMessage}
          className="w-full py-6 rounded-[2rem] bg-zinc-900 text-white font-bold text-sm uppercase tracking-widest shadow-2xl shadow-zinc-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <MessageCircle className="w-5 h-5" />
          Mesaj Gönder
        </button>
      </div>
    </motion.div>
  );
}
