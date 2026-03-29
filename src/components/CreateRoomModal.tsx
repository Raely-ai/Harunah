import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Users, MessageSquare, Lock, Unlock, Zap, Target, AlertCircle } from "lucide-react";
import { db, auth } from "../lib/firebase";
import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { toast } from "sonner";
import { SocialRoom, SocialProfile } from "../types";

interface CreateRoomModalProps {
  onClose: () => void;
  onCreated: (room: SocialRoom) => void;
  profile: SocialProfile;
}

export default function CreateRoomModal({ onClose, onCreated, profile }: CreateRoomModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'chat',
    maxMembers: 20,
    maxSpeakers: 5,
    isPrivate: false,
    password: '',
    isDonationEnabled: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if hosting is allowed
  const isFreeTrialActive = new Date(profile.hosting?.freeTrialUntil || '').getTime() > Date.now();
  const isActivePackage = profile.hosting?.activePackage && new Date(profile.hosting.activePackage.expiresAt).getTime() > Date.now();
  const canHost = isFreeTrialActive || isActivePackage;

  // Donation is only allowed for paid packages
  const canEnableDonation = !!isActivePackage;

  useEffect(() => {
    if (!canEnableDonation && formData.isDonationEnabled) {
      setFormData(prev => ({ ...prev, isDonationEnabled: false }));
    }
  }, [canEnableDonation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    if (!canHost) {
      toast.error("Oda açmak için aktif bir host paketiniz olmalıdır.");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Oda adı gereklidir.");
      return;
    }

    setIsSubmitting(true);
    try {
      const roomId = doc(collection(db, "socialRooms")).id;
      const newRoom: SocialRoom = {
        id: roomId,
        name: formData.name,
        description: formData.description,
        type: formData.type,
        maxMembers: formData.maxMembers,
        maxSpeakers: formData.maxSpeakers,
        isPrivate: formData.isPrivate,
        password: formData.isPrivate ? formData.password : undefined,
        isDonationEnabled: formData.isDonationEnabled,
        hostUid: auth.currentUser.uid,
        status: 'active',
        createdAt: new Date().toISOString(),
        memberCount: 1,
        activeSpeakerCount: 1
      };

      await setDoc(doc(db, "socialRooms", roomId), newRoom);
      
      // Add host as member
      const memberId = `${roomId}_${auth.currentUser.uid}`;
      await setDoc(doc(db, "socialRoomMembers", memberId), {
        id: memberId,
        roomId,
        uid: auth.currentUser.uid,
        role: 'host',
        joinedAt: new Date().toISOString(),
        isMuted: false,
        nickname: profile.nickname || "Gezgin",
        photoURL: profile.photoURL || ""
      });

      toast.success("Oda başarıyla oluşturuldu!");
      onCreated(newRoom);
      onClose();
    } catch (error) {
      console.error("Create room error:", error);
      toast.error("Oda oluşturulurken bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Yeni Oda Oluştur
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {!canHost && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-900">Host Yetkiniz Bulunmuyor</p>
                <p className="text-[10px] text-red-700 mt-1">
                  Ücretsiz deneme süreniz dolmuş. Oda açmak için lütfen bir host paketi satın alın.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Oda Adı</label>
            <input
              type="text"
              disabled={!canHost}
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-3 bg-stone-100 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 transition-all disabled:opacity-50"
              placeholder="Örn: Gece Sohbetleri"
              maxLength={30}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Açıklama</label>
            <textarea
              disabled={!canHost}
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-3 bg-stone-100 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 transition-all min-h-[80px] disabled:opacity-50"
              placeholder="Oda hakkında kısa bir bilgi..."
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Oda Türü</label>
              <select
                disabled={!canHost}
                value={formData.type}
                onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="w-full p-3 bg-stone-100 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 transition-all appearance-none disabled:opacity-50"
              >
                <option value="chat">Sohbet</option>
                <option value="topic">Konu Tartışma</option>
                <option value="music">Müzik</option>
                <option value="fun">Eğlence</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Max Kişi</label>
              <input
                disabled={!canHost}
                type="number"
                value={formData.maxMembers}
                onChange={e => setFormData(prev => ({ ...prev, maxMembers: parseInt(e.target.value) }))}
                className="w-full p-3 bg-stone-100 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 transition-all disabled:opacity-50"
                min={2}
                max={100}
              />
            </div>
          </div>

          <div className={`flex items-center justify-between p-3 bg-stone-50 rounded-2xl ${!canHost ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                {formData.isPrivate ? <Lock className="w-5 h-5 text-amber-600" /> : <Unlock className="w-5 h-5 text-stone-400" />}
              </div>
              <div>
                <p className="text-sm font-bold text-stone-800">Özel Oda</p>
                <p className="text-xs text-stone-500">Şifre ile giriş yapılır</p>
              </div>
            </div>
            <button
              type="button"
              disabled={!canHost}
              onClick={() => setFormData(prev => ({ ...prev, isPrivate: !prev.isPrivate }))}
              className={`w-12 h-6 rounded-full transition-colors relative ${formData.isPrivate ? 'bg-amber-500' : 'bg-stone-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isPrivate ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <AnimatePresence>
            {formData.isPrivate && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full p-3 bg-stone-100 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="Oda şifresi"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`flex items-center justify-between p-3 bg-stone-50 rounded-2xl ${!canEnableDonation ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Target className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-800">Donate Açık</p>
                <p className="text-xs text-stone-500">
                  {canEnableDonation ? 'Hediye gönderimi aktif' : 'Sadece ücretli host paketleri için'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!canEnableDonation}
              onClick={() => setFormData(prev => ({ ...prev, isDonationEnabled: !prev.isDonationEnabled }))}
              className={`w-12 h-6 rounded-full transition-colors relative ${formData.isDonationEnabled ? 'bg-amber-500' : 'bg-stone-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isDonationEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !canHost}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Oluşturuluyor...' : 'Odayı Başlat'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
