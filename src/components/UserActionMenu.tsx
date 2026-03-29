import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, ShieldAlert, Ban, MoreVertical, X } from 'lucide-react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { toast } from 'sonner';
import { ReportModal } from './ReportModal';

interface UserActionMenuProps {
  targetUid: string;
  targetName: string;
  context: 'explore' | 'profile' | 'chat' | 'room';
  onViewProfile?: () => void;
  onBlockSuccess?: () => void;
  className?: string;
  trigger?: React.ReactNode;
}

export const UserActionMenu: React.FC<UserActionMenuProps> = ({
  targetUid,
  targetName,
  context,
  onViewProfile,
  onBlockSuccess,
  className = '',
  trigger
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlock = async () => {
    if (!auth.currentUser) return;
    if (window.confirm(`${targetName} kullanıcısını engellemek istediğinize emin misiniz?`)) {
      setIsBlocking(true);
      try {
        const profileRef = doc(db, 'socialProfiles', auth.currentUser.uid);
        await updateDoc(profileRef, {
          blockedUids: arrayUnion(targetUid)
        });
        toast.success(`${targetName} engellendi.`);
        setIsOpen(false);
        onBlockSuccess?.();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'socialProfiles');
        toast.error('Engelleme işlemi başarısız oldu.');
      } finally {
        setIsBlocking(false);
      }
    }
  };

  if (auth.currentUser?.uid === targetUid) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 hover:bg-black/5 rounded-full transition-colors"
      >
        {trigger || <MoreVertical className="w-5 h-5 text-zinc-400" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[80]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-[90]"
            >
              <div className="p-2 space-y-1">
                {onViewProfile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewProfile();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Profili Gör
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBlock();
                  }}
                  disabled={isBlocking}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Ban className="w-4 h-4" />
                  {isBlocking ? 'Engelleniyor...' : 'Engelle'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReportModal(true);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-amber-600 hover:bg-amber-50 transition-colors"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Şikayet Et
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReportModal && (
          <ReportModal
            targetUid={targetUid}
            targetName={targetName}
            context={context}
            onClose={() => setShowReportModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
