import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

interface LegalScreenProps {
  type: 'privacy' | 'terms' | 'support' | 'help';
  onBack: () => void;
}

export default function LegalScreen({ type, onBack }: LegalScreenProps) {
  const content = {
    privacy: {
      title: 'Gizlilik Politikası',
      body: (
        <div className="space-y-4">
          <p>Lasya olarak kullanıcılarımızın gizliliğine büyük önem veriyoruz. Uygulamamız kapsamında işlediğimiz veriler, size daha kişiselleştirilmiş bir astroloji ve yaşam deneyimi sunmak amacıyla kullanılmaktadır.</p>
          <h4 className="font-bold text-slate-800">Hangi Verileri Topluyoruz?</h4>
          <p>Profil bilgileriniz, fal analizleri için girdiğiniz yorum verileri, paylaştığınız fotoğraflar (mevcutsa) ve uygulama içi etkileşimleriniz; astroloji analizi, uyum skorlama ve sosyal keşif özelliklerimizin çalışması için işlenmektedir.</p>
          <h4 className="font-bold text-slate-800">Veri Güvenliği ve Paylaşım</h4>
          <p>Kişisel verileriniz, yasal zorunluluklar haricinde hiçbir üçüncü taraf kişi veya kurumla izniniz olmadan paylaşılmaz. Güvenliğinizi sağlamak adına en güncel şifreleme ve veri koruma yöntemlerini kullanıyoruz.</p>
          <p>Uygulamamızı kullanarak bu veri işleme pratiklerini kabul etmiş sayılırsınız.</p>
        </div>
      )
    },
    terms: {
      title: 'Kullanım Koşulları',
      body: (
        <div className="space-y-4">
          <p>Lasya, astroloji, fal yorumları ve sosyal keşif hizmetleri sunan bir eğlence ve kişisel farkındalık platformudur.</p>
          <h4 className="font-bold text-slate-800">Hizmetin Amacı</h4>
          <p>Uygulamamızdaki tüm astrolojik içerikler, fal yorumları ve uyum analizleri kişisel farkındalık ve eğlence amaçlıdır. Profesyonel tıbbi, hukuki, finansal veya psikolojik bir tavsiye niteliği taşımaz.</p>
          <h4 className="font-bold text-slate-800">Kullanıcı Sorumluluğu</h4>
          <p>Uygulama üzerinden alınan hiçbir sonuç kesin bir gelecek vaadi olarak değerlendirilemez. Kullanıcılar, uygulama içerisindeki paylaşımlarından ve davranışlarından kendileri sorumludur. Topluluk kurallarını ihlal eden hesaplar askıya alınabilir veya silinebilir.</p>
        </div>
      )
    },
    support: {
      title: 'Destek / İletişim',
      body: (
        <div className="space-y-4">
          <p>Lasya ile ilgili görüşleriniz, önerileriniz veya karşılaştığınız teknik sorunlar bizim için çok değerli.</p>
          <p>Uygulama içerisindeki özelliklerin daha iyi çalışması veya yeni istekleriniz için bize her zaman ulaşabilirsiniz.</p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
            Destek Ekibimize ulaşmak için: <strong>supports@lasyaapp.com</strong>
          </div>
          <p>Mesajlarınıza 24-48 saat içerisinde geri dönüş sağlamaya çalışıyoruz.</p>
        </div>
      )
    },
    help: {
      title: 'Yardım Merkezi',
      body: (
        <div className="space-y-4">
          <p>Lasya'yı daha verimli kullanmanız için bazı ipuçları:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Profil:</strong> Profilinize fotoğraf eklemek ve net bir biyografi yazmak, uyum analizlerinin doğruluğunu artırabilir.</li>
            <li><strong>Jeton/Enerji:</strong> Fal yorumları ve özel özellikler jeton sistemi ile çalışır. Jetonlarınız bittiğinde mağaza bölümünden temin edebilirsiniz.</li>
            <li><strong>Bildirimler:</strong> Falınızın ne zaman hazır olduğundan haberdar olmak için bildirimleri açık tutun.</li>
            <li><strong>Teknik Sorunlar:</strong> Eğer uygulama takılıyor veya hata veriyorsa uygulamayı güncellemeyi veya önbelleği temizleyip tekrar giriş yapmayı deneyin.</li>
          </ul>
        </div>
      )
    }
  };

  const { title, body } = content[type];

  return (
    <div className="w-full max-w-2xl mx-auto pt-8 px-4 pb-24 bg-[#FAFAFA] min-h-screen">
      <div className="flex items-center gap-4 mb-8">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-800 shadow-sm"
        >
          <ChevronLeft className="w-6 h-6" />
        </motion.button>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      </div>
      <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm text-slate-600 leading-relaxed overflow-y-auto">
        {body}
      </div>
    </div>
  );
}
