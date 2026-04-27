import React from 'react';
import { motion } from 'motion/react';
import { Bell, Shield, FileText, HelpCircle, Trash2, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import LegalScreen from './LegalScreen';

interface SettingsViewProps {
  onBack: () => void;
  onDeleteAccount: () => void;
}

export default function SettingsView({ onBack, onDeleteAccount }: SettingsViewProps) {
  const [notifications, setNotifications] = React.useState(true);
  const [activeLegal, setActiveLegal] = React.useState<null | 'privacy' | 'terms' | 'support' | 'help'>(null);

  if (activeLegal) {
    return <LegalScreen type={activeLegal} onBack={() => setActiveLegal(null)} />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto pt-8 px-4 pb-24 bg-[#FAFAFA] min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-800 shadow-sm"
        >
          <ChevronLeft className="w-6 h-6" />
        </motion.button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ayarlar</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Uygulama Tercihleri</p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-8">
        {/* Notifications */}
        <div className="space-y-4">
          <h3 className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Bildirimler</h3>
          <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-slate-800 block">Anlık Bildirimler</span>
                <span className="text-xs text-slate-500">Kehanetler hazır olduğunda haber ver</span>
              </div>
            </div>
            <button 
              onClick={() => setNotifications(!notifications)}
              className={`w-12 h-6 rounded-full transition-all duration-300 relative ${notifications ? 'bg-indigo-600' : 'bg-slate-200'}`}
            >
              <motion.div 
                animate={{ x: notifications ? 26 : 2 }}
                className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>
        </div>

        {/* Legal & Support */}
        <div className="space-y-4">
          <h3 className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Destek & Yasal</h3>
          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
            {[
              { label: 'Gizlilik Politikası', icon: Shield, type: 'privacy' },
              { label: 'Kullanım Koşulları', icon: FileText, type: 'terms' },
              { label: 'Destek / İletişim', icon: MessageCircle, type: 'support' },
              { label: 'Yardım Merkezi', icon: HelpCircle, type: 'help' },
            ].map((item) => (
              <button 
                key={item.label} 
                onClick={() => setActiveLegal(item.type as any)}
                className="w-full p-5 flex items-center justify-between group hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-slate-800">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="space-y-4 pt-4">
          <h3 className="px-2 text-[11px] font-bold text-red-400 uppercase tracking-widest">Tehlikeli Bölge</h3>
          <button 
            onClick={onDeleteAccount}
            className="w-full p-5 rounded-3xl bg-white border border-red-100 shadow-sm flex items-center justify-between group hover:border-red-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-red-600 block">Hesabı Sil</span>
                <span className="text-xs text-red-400">Tüm verilerin kalıcı olarak silinir</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-red-300 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
