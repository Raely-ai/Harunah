import { db } from "../lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

const MALE_NAMES = ["Ahmet", "Mehmet", "Can", "Deniz", "Emre", "Fatih", "Gökhan", "Hakan", "İlker", "Kerem", "Mert", "Oğuz", "Selim", "Tolga", "Umut", "Volkan", "Yasin", "Zafer", "Barış", "Cem"];
const FEMALE_NAMES = ["Ayşe", "Fatma", "Zeynep", "Elif", "Selin", "Derya", "Ece", "Gizem", "Hande", "İrem", "Melis", "Naz", "Özge", "Pelin", "Seda", "Tuğçe", "Yasemin", "Buse", "Ceren", "Demet"];
const BIOS = [
  "Hayatı dolu dolu yaşamayı severim. Yeni yerler keşfetmek en büyük tutkum.",
  "Kahve ve kitap ikilisi vazgeçilmezim. Huzurlu bir pazar günü gibiyim.",
  "Müzik ruhun gıdasıdır. Konserlerde buluşalım mı?",
  "Doğa yürüyüşleri ve huzur. Şehrin gürültüsünden kaçış.",
  "Gülümsemek en güzel aksesuarım. Pozitif enerji yayıyorum.",
  "Sanatla iç içe bir yaşam. Galerilerde kaybolmayı severim.",
  "Spor benim için bir yaşam tarzı. Sağlıklı beslenme ve bolca hareket.",
  "Hayallerimin peşinden gidiyorum. Gelecek planları yapmayı severim.",
  "Basit yaşam, büyük mutluluklar. Küçük şeylerden keyif alırım.",
  "Yeni lezzetler denemek hobim. Mutfakta yaratıcıyım."
];
const INTERESTS = ["Seyahat", "Müzik", "Kitap", "Spor", "Sanat", "Yemek", "Doğa", "Teknoloji", "Sinema", "Fotoğrafçılık"];
const ZODIAC_SIGNS = ["Koç", "Boğa", "İkizler", "Yengeç", "Aslan", "Başak", "Terazi", "Akrep", "Yay", "Oğlak", "Kova", "Balık"];

export async function runSeed() {
  const mode = (import.meta as any).env?.MODE;
  console.log("MODE:", mode);
  if (mode === 'production') {
    console.error("Cannot run seed script in production!");
    return;
  }

  console.log("Starting seed script...");

  const usersCollection = collection(db, "users");

  const createDemoUser = async (gender: 'male' | 'female', index: number) => {
    const name = gender === 'male' ? MALE_NAMES[index] : FEMALE_NAMES[index];
    const userId = `demo_${gender}_${index}`;
    
    const userDoc = doc(usersCollection, userId);
    
    const userData = {
      displayName: name,
      email: `${userId}@demo.com`,
      createdAt: new Date(),
      social: {
        nickname: name,
        gender: gender,
        age: 18 + Math.floor(Math.random() * 13),
        zodiacSign: ZODIAC_SIGNS[Math.floor(Math.random() * ZODIAC_SIGNS.length)],
        lookingFor: "Ciddi ilişki",
        bio: BIOS[Math.floor(Math.random() * BIOS.length)],
        interests: INTERESTS.slice(0, 3 + Math.floor(Math.random() * 3)),
        socialEnabled: true,
        profileCompleted: true,
        socialVisible: true,
        banned: false,
        photos: [`https://api.dicebear.com/9.x/adventurer/svg?seed=${userId}`]
      }
    };

    try {
      await setDoc(userDoc, userData);
      console.log(`Created user: ${name} (${gender})`);
    } catch (error) {
      console.error(`Error creating user ${name} (${gender}):`, error);
    }
  };

  try {
    for (let i = 0; i < 20; i++) {
      await createDemoUser('male', i);
      await createDemoUser('female', i);
    }
    console.log("Seed script finished!");
  } catch (error) {
    console.error("Error in seed script:", error);
  }
}
