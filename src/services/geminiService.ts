import { GoogleGenAI } from "@google/genai";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export interface PromptData {
  name: string;
  birthDate: string;
  relationshipStatus: string;
  jobStatus: string;
  gender: string;
  extraInfo?: string;
  type: string;
  cards?: string[]; // For Tarot
  images?: string[]; // For Coffee/Water
  questions?: string[]; // For multiple questions
}

const DEFAULT_PROMPTS: Record<string, string> = {
  tarot: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Seçtiği kartlar: {kartlar}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu tarot falını yorumla.",
  coffee: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu kahve falını yorumla.",
  water: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu su falını yorumla.",
  ebced: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu ebced falını yorumla.",
  yildizname: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu yıldızname falını yorumla.",
  havas: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu havas falını yorumla.",
  dream: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Gördüğü rüya: {ekbilgi}. Lütfen bu rüyayı yorumla.",
  horoscope: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. Burcu: {ekbilgi}. Lütfen bu burç için günlük yorum yap."
};

export interface FortuneResult {
  text: string;
  promptSource: "admin" | "default";
  promptId: string;
}

export const generateFortune = async (data: PromptData): Promise<FortuneResult> => {
  let template = DEFAULT_PROMPTS[data.type] || DEFAULT_PROMPTS.tarot;
  let promptSource: "admin" | "default" = "default";
  let promptId = "default_" + data.type;

  console.log(`[Fortune] Attempting to fetch prompt for type: ${data.type}`);

  try {
    const promptDoc = await getDoc(doc(db, "prompts", data.type));
    if (promptDoc.exists()) {
      template = promptDoc.data().content;
      promptSource = "admin";
      promptId = data.type;
      console.log(`[Fortune] Admin prompt found for ${data.type}. Using custom template.`);
    } else {
      console.warn(`[Fortune] No admin prompt found for ${data.type}. Falling back to DEFAULT_PROMPTS.`);
    }
  } catch (error) {
    console.error(`[Fortune] Error fetching prompt for ${data.type} from Firestore:`, error);
    console.log(`[Fortune] Falling back to DEFAULT_PROMPTS due to fetch error.`);
  }

  // Replace placeholders
  let prompt = template
    .replace(/{isim}/g, data.name)
    .replace(/{dogumtarihi}/g, data.birthDate)
    .replace(/{iliskidurumu}/g, data.relationshipStatus)
    .replace(/{isdurumu}/g, data.jobStatus)
    .replace(/{cinsiyet}/g, data.gender)
    .replace(/{ekbilgi}/g, data.extraInfo || "Belirtilmedi")
    .replace(/{soruları}/g, data.questions?.join(", ") || "Belirtilmedi")
    .replace(/{tur}/g, data.type);

  if (data.cards) {
    prompt = prompt.replace(/{kartlar}/g, data.cards.join(", "));
  }

  console.log(`[Fortune] Final Prompt Metadata:`, {
    type: data.type,
    docId: data.type,
    promptSource,
    promptId,
    templateLength: template.length
  });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Sen 'Ahlas' isminde, çok derin ve mistik bir kahinsin. Kullanıcının verdiği bilgilere göre ona özel, etkileyici ve gerçekçi bir fal yorumu yapmalısın. Dilin gizemli, şiirsel ama anlaşılır olmalı. Yorumun en az 300 kelime olmalı.",
      },
    });

    if (!response.text) {
      throw new Error("AI returned empty content");
    }

    return {
      text: response.text,
      promptSource,
      promptId
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error(error instanceof Error ? error.message : "Kehanet alınırken bir hata oluştu.");
  }
};

// Compatibility functions
export const getCoffeeFortune = async (data: any) => generateFortune({ ...data, type: 'coffee' });
export const getTarotReading = async (data: any) => generateFortune({ ...data, type: 'tarot' });
export const getDailyHoroscope = async (sign: string) => generateFortune({ name: 'Kullanıcı', birthDate: '', relationshipStatus: '', jobStatus: '', gender: '', type: 'horoscope', extraInfo: sign });
export const getDreamInterpretation = async (dream: string) => generateFortune({ name: 'Kullanıcı', birthDate: '', relationshipStatus: '', jobStatus: '', gender: '', type: 'dream', extraInfo: dream });

