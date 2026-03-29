import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, MessageSquare, Lock, Plus, Search, Filter, Sparkles, ChevronRight, Zap } from "lucide-react";
import { db, auth } from "../lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { SocialRoom, SocialProfile } from "../types";
import CreateRoomModal from "./CreateRoomModal";

interface SocialRoomListProps {
  onJoinRoom: (room: SocialRoom) => void;
  profile: SocialProfile | null;
}

export default function SocialRoomList({ onJoinRoom, profile }: SocialRoomListProps) {
  const [rooms, setRooms] = useState<SocialRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    if (!auth.currentUser) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "socialRooms"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialRoom));
      setRooms(Array.from(new Map(roomData.map(r => [r.id, r])).values()));
      setIsLoading(false);
    }, (error) => {
      console.error("Rooms listener error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         room.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || room.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const filters = [
    { id: 'all', label: 'Tümü', icon: Users },
    { id: 'chat', label: 'Sohbet', icon: MessageSquare },
    { id: 'topic', label: 'Konu', icon: Filter },
    { id: 'music', label: 'Müzik', icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Canlı Odalar</h2>
            <p className="text-zinc-500 text-sm">Şu an aktif olan sohbetler</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-6 py-3 bg-zinc-900 text-white rounded-2xl shadow-xl shadow-zinc-900/20 hover:bg-zinc-800 transition-all flex items-center gap-2 font-bold text-sm active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Oda Kur</span>
          </button>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
          <input
            type="text"
            placeholder="Oda veya konu ara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-zinc-50 rounded-2xl border border-zinc-100 focus:bg-white focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all shadow-sm outline-none text-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
          {filters.map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                activeFilter === filter.id 
                  ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/20' 
                  : 'bg-white text-zinc-500 border border-zinc-100 hover:bg-zinc-50'
              }`}
            >
              <filter.icon className="w-3.5 h-3.5" />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-48 bg-zinc-50 animate-pulse rounded-[2.5rem] border border-zinc-100" />
          ))
        ) : filteredRooms.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-zinc-50 rounded-[2.5rem] border-2 border-dashed border-zinc-200">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <MessageSquare className="w-8 h-8 text-zinc-200" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900">Oda Bulunamadı</h3>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto mt-2">
              Aradığın kriterlerde aktif oda yok. Hemen bir tane sen oluştur!
            </p>
          </div>
        ) : (
          filteredRooms.map((room) => (
            <motion.button
              key={room.id}
              layoutId={room.id}
              onClick={() => onJoinRoom(room)}
              className="group relative bg-white p-6 rounded-[2.5rem] border border-zinc-100 hover:border-zinc-900 transition-all text-left shadow-sm hover:shadow-2xl hover:shadow-zinc-200/50 hover:-translate-y-1 active:scale-[0.98]"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2.5 rounded-2xl ${
                    room.type === 'chat' ? 'bg-zinc-900 text-white' :
                    room.type === 'music' ? 'bg-amber-500 text-white' :
                    room.type === 'topic' ? 'bg-emerald-500 text-white' :
                    'bg-zinc-900 text-white'
                  } shadow-lg shadow-current/10`}>
                    {room.type === 'chat' ? <MessageSquare className="w-5 h-5" /> :
                     room.type === 'music' ? <Sparkles className="w-5 h-5" /> :
                     room.type === 'topic' ? <Filter className="w-5 h-5" /> :
                     <Zap className="w-5 h-5" />}
                  </div>
                  {room.isPrivate && (
                    <div className="p-2.5 bg-zinc-50 text-zinc-400 rounded-2xl border border-zinc-100">
                      <Lock className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">{room.memberCount} Aktif</span>
                </div>
              </div>

              <h3 className="text-lg font-bold text-zinc-900 mb-2 group-hover:text-zinc-900 transition-colors line-clamp-1 tracking-tight">
                {room.name}
              </h3>
              <p className="text-xs text-zinc-500 line-clamp-2 mb-6 h-8 leading-relaxed">
                {room.description || "Bu oda için açıklama girilmemiş."}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
                <div className="flex -space-x-2 overflow-hidden">
                  {[1, 2, 3].map(i => (
                    <div key={`avatar-placeholder-${i}`} className="inline-block h-7 w-7 rounded-full ring-2 ring-white bg-zinc-100 border border-zinc-50" />
                  ))}
                  {room.memberCount > 3 && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-[8px] font-bold text-zinc-400 ring-2 ring-white border border-zinc-50 uppercase">
                      +{room.memberCount - 3}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-zinc-900 font-bold text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                  Katıl <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>

      <AnimatePresence>
        {isCreateModalOpen && (
          <CreateRoomModal 
            onClose={() => setIsCreateModalOpen(false)} 
            onCreated={(room) => onJoinRoom(room)}
            profile={profile}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
