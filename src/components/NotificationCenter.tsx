import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  X, 
  Heart, 
  UserPlus, 
  MessageCircle, 
  Gift, 
  Wallet, 
  ShieldAlert, 
  ChevronRight,
  Check,
  Trash2
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { SocialNotification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (link: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose, onNavigate }) => {
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser || !isOpen) return;

    const q = query(
      collection(db, 'socialNotifications'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SocialNotification[];
      setNotifications(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'socialNotifications', id), { isRead: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!auth.currentUser) return;
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.isRead).forEach(n => {
        batch.update(doc(db, 'socialNotifications', n.id), { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'socialNotifications', id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearAll = async () => {
    if (!auth.currentUser) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'socialNotifications', n.id));
      });
      await batch.commit();
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  const getIcon = (type: SocialNotification['type']) => {
    switch (type) {
      case 'new_match': return <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />;
      case 'new_friend_request': return <UserPlus className="w-5 h-5 text-indigo-500" />;
      case 'new_message': return <MessageCircle className="w-5 h-5 text-emerald-500" />;
      case 'gift_received': return <Gift className="w-5 h-5 text-amber-500" />;
      case 'withdrawal_result': return <Wallet className="w-5 h-5 text-emerald-600" />;
      case 'host_package_expiry': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      default: return <Bell className="w-5 h-5 text-zinc-400" />;
    }
  };

  const handleNotificationClick = (n: SocialNotification) => {
    if (!n.isRead) markAsRead(n.id);
    if (n.link && onNavigate) {
      onNavigate(n.link);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[110]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[120] flex flex-col"
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Bildirimler</h2>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest mt-1">
                  {notifications.filter(n => !n.isRead).length} Yeni Bildirim
                </p>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
                    title="Hepsini okundu işaretle"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={onClose}
                  className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-50 flex items-center justify-center">
                    <Bell className="w-8 h-8 text-zinc-200" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-900">Henüz Bildirim Yok</p>
                    <p className="text-sm text-zinc-400">Yeni bir olay olduğunda burada göreceksin.</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {notifications.map((n) => (
                    <div 
                      key={n.id}
                      className={`p-6 flex gap-4 transition-colors relative group ${n.isRead ? 'bg-white' : 'bg-zinc-50/50'}`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-bold truncate ${n.isRead ? 'text-zinc-900' : 'text-zinc-900'}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: tr })}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 leading-relaxed">
                          {n.message}
                        </p>
                        {n.link && (
                          <button 
                            onClick={() => handleNotificationClick(n)}
                            className="text-xs font-bold text-zinc-900 flex items-center gap-1 mt-2 hover:underline"
                          >
                            Detayları Gör <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.isRead && (
                          <button 
                            onClick={() => markAsRead(n.id)}
                            className="p-1.5 rounded-lg bg-zinc-100 text-zinc-500 hover:text-zinc-900"
                            title="Okundu işaretle"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => deleteNotification(n.id)}
                          className="p-1.5 rounded-lg bg-zinc-100 text-zinc-500 hover:text-red-500"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {!n.isRead && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-6 border-t border-zinc-100">
                <button 
                  onClick={clearAll}
                  className="w-full py-4 rounded-2xl border border-zinc-200 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:bg-zinc-50 transition-all"
                >
                  Tümünü Temizle
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
