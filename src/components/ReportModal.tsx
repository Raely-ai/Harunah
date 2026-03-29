import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Send, CheckCircle2 } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { toast } from 'sonner';

interface ReportModalProps {
  targetUid: string;
  targetName: string;
  context: 'explore' | 'profile' | 'chat' | 'room';
  onClose: () => void;
}

const REPORT_REASONS = [
  { id: 'harassment', label: 'Taciz' },
  { id: 'spam', label: 'Spam' },
  { id: 'fake_profile', label: 'Sahte Profil' },
  { id: 'profanity', label: 'Küfür / Hakaret' },
  { id: 'sexual_content', label: 'Cinsel İçerik' },
  { id: 'inappropriate_behavior', label: 'Uygunsuz Davranış' },
  { id: 'other', label: 'Diğer' }
];

export const ReportModal: React.FC<ReportModalProps> = ({ targetUid, targetName, context, onClose }) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.error('Lütfen bir şikayet sebebi seçin');
      return;
    }

    if (!auth.currentUser) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'socialReports'), {
        fromUid: auth.currentUser.uid,
        toUid: targetUid,
        reason: selectedReason,
        description,
        context,
        timestamp: new Date().toISOString(),
        status: 'pending'
      });
      setIsSuccess(true);
      setTimeout(onClose, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'socialReports');
      toast.error('Şikayet iletilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Şikayet Et</h3>
              <p className="text-xs text-zinc-500 font-medium">{targetName} kullanıcısını şikayet ediyorsunuz</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isSuccess ? (
            <div className="py-12 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-zinc-900">Şikayetiniz Alındı</h4>
                <p className="text-sm text-zinc-500 font-medium">
                  Geri bildiriminiz için teşekkürler. Moderasyon ekibimiz en kısa sürede inceleyecektir.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">
                  Şikayet Sebebi
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => setSelectedReason(reason.id)}
                      className={`w-full p-4 rounded-2xl text-left text-sm font-medium transition-all border ${
                        selectedReason === reason.id
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-100 hover:bg-zinc-100'
                      }`}
                    >
                      {reason.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">
                  Açıklama (Opsiyonel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Eklemek istediğiniz detaylar..."
                  className="w-full p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 min-h-[100px] resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedReason}
                className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-zinc-200"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Şikayeti Gönder
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
