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
  questions?: string[]; // For multiple questions
}

const DEFAULT_PROMPTS: Record<string, string> = {
  tarot: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Seçtiği kartlar: {kartlar}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu tarot falını yorumla.",
  coffee: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu kahve falını yorumla.",
  water: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu su falını yorumla.",
  ebced: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu ebced falını yorumla.",
  yildizname: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu yıldızname falını yorumla.",
  havas: "Kullanıcı {isim}, {dogumtarihi} doğumlu, {cinsiyet}. İlişki durumu: {iliskidurumu}, İş durumu: {isdurumu}. Soruları: {soruları}. Ek bilgi: {ekbilgi}. Lütfen bu havas falını yorumla."
};

export const generateFortune = async (data: PromptData) => {
  let template = DEFAULT_PROMPTS[data.type] || DEFAULT_PROMPTS.tarot;

  try {
    const promptDoc = await getDoc(doc(db, "prompts", data.type));
    if (promptDoc.exists()) {
      template = promptDoc.data().content;
    }
  } catch (error) {
    console.warn("Could not fetch prompt from Firestore, using default:", error);
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

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Sen 'Ahlas' isminde, çok derin ve mistik bir kahinsin. Kullanıcının verdiği bilgilere göre ona özel, etkileyici ve gerçekçi bir fal yorumu yapmalısın. Dilin gizemli, şiirsel ama anlaşılır olmalı. Yorumun en az 300 kelime olmalı.",
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Kehanet alınırken bir hata oluştu.");
  }
};

// Compatibility functions
export const getCoffeeFortune = async (data: any) => generateFortune({ ...data, type: 'coffee' });
export const getTarotReading = async (data: any) => generateFortune({ ...data, type: 'tarot' });
export const getDailyHoroscope = async (sign: string) => generateFortune({ name: 'Kullanıcı', birthDate: '', relationshipStatus: '', jobStatus: '', gender: '', type: 'horoscope', extraInfo: sign });
export const getDreamInterpretation = async (dream: string) => generateFortune({ name: 'Kullanıcı', birthDate: '', relationshipStatus: '', jobStatus: '', gender: '', type: 'dream', extraInfo: dream });

