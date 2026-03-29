import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

interface DeleteAccountModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAccountModal({ onClose, onConfirm }: DeleteAccountModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    if (confirmText !== 'SİL') return;
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Delete error:', error);
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-md bg-[#0a0a0a] rounded-[2.5rem] border border-red-500/20 overflow-hidden shadow-2xl shadow-red-500/10"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-purple-200/40">
              <X className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-2xl font-serif font-bold text-amber-50 mb-4">Hesabını Silmek İstediğine Emin Misin?</h2>
          <p className="text-purple-200/60 mb-8 leading-relaxed">
            Bu işlem geri alınamaz. Tüm kehanetlerin, kredilerin ve aboneliğin kalıcı olarak silinecektir.
          </p>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-purple-200/40 uppercase tracking-widest px-1">
                Onaylamak için 'SİL' yazın
              </label>
              <input 
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-amber-50 focus:outline-none focus:border-red-500/50 transition-colors text-center font-bold tracking-widest"
                placeholder="SİL"
              />
            </div>

            <button
              onClick={handleDelete}
              disabled={confirmText !== 'SİL' || isDeleting}
              className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-all disabled:opacity-20"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  <span>Hesabımı Kalıcı Olarak Sil</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              disabled={isDeleting}
              className="w-full py-4 rounded-2xl bg-white/5 text-purple-200/60 font-bold hover:bg-white/10 transition-all"
            >
              Vazgeç
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
