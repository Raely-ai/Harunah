import React from 'react';
import { motion } from 'motion/react';
import { Bell, Shield, FileText, HelpCircle, Trash2, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';

interface SettingsViewProps {
  onBack: () => void;
  onDeleteAccount: () => void;
}

export default function SettingsView({ onBack, onDeleteAccount }: SettingsViewProps) {
  const [notifications, setNotifications] = React.useState(true);

  return (
    <div className="w-full max-w-2xl mx-auto pt-8 px-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-purple-200/60"
        >
          <ChevronLeft className="w-6 h-6" />
        </motion.button>
        <div>
          <h1 className="text-2xl font-serif font-bold text-amber-50">Ayarlar</h1>
          <p className="text-xs text-purple-200/40 uppercase tracking-widest">Uygulama Tercihleri</p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-8">
        {/* Notifications */}
        <div className="space-y-3">
          <h3 className="px-5 text-xs font-bold text-purple-200/40 uppercase tracking-widest">Bildirimler</h3>
          <div className="p-5 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-amber-50/80 block">Anlık Bildirimler</span>
                <span className="text-xs text-purple-200/40">Kehanetler hazır olduğunda haber ver</span>
              </div>
            </div>
            <button 
              onClick={() => setNotifications(!notifications)}
              className={`w-12 h-6 rounded-full transition-all duration-300 relative ${notifications ? 'bg-amber-500' : 'bg-white/10'}`}
            >
              <motion.div 
                animate={{ x: notifications ? 26 : 2 }}
                className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-lg"
              />
            </button>
          </div>
        </div>

        {/* Legal & Support */}
        <div className="space-y-3">
          <h3 className="px-5 text-xs font-bold text-purple-200/40 uppercase tracking-widest">Destek & Yasal</h3>
          <div className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden divide-y divide-white/5">
            {[
              { label: 'Gizlilik Politikası', icon: Shield },
              { label: 'Kullanım Koşulları', icon: FileText },
              { label: 'Destek / İletişim', icon: MessageCircle },
              { label: 'Yardım Merkezi', icon: HelpCircle },
            ].map((item) => (
              <button key={item.label} className="w-full p-5 flex items-center justify-between group hover:bg-white/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-purple-200/40 group-hover:text-amber-400 transition-colors">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-amber-50/80">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-purple-200/20 group-hover:text-amber-400 transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="space-y-3 pt-4">
          <h3 className="px-5 text-xs font-bold text-red-500/60 uppercase tracking-widest">Tehlikeli Bölge</h3>
          <button 
            onClick={onDeleteAccount}
            className="w-full p-5 rounded-3xl bg-red-500/5 border border-red-500/10 flex items-center justify-between group hover:bg-red-500/10 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-red-400 block">Hesabı Sil</span>
                <span className="text-xs text-red-500/40">Tüm verilerin kalıcı olarak silinir</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-red-500/20 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
