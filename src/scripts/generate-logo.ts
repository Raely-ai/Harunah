import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generate() {
  console.log("Generating logo...");
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: 'A mystical logo for an astrology app named LASYA. The logo features a stylized letter L made of a glowing ribbon with purple, pink, and gold gradients. There are small magical sparkles around it. Clean white background, high quality, modern design, isolated on white.',
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      },
    });

    let base64Data = null;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        base64Data = part.inlineData.data;
        break;
      }
    }

    if (base64Data) {
      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
      }
      fs.writeFileSync(path.join(publicDir, 'logo.png'), Buffer.from(base64Data, 'base64'));
      console.log("Logo saved to public/logo.png");
    } else {
      console.error("No image data found in response.");
      process.exit(1);
    }
  } catch (e) {
    console.error("Error generating logo:", e);
    process.exit(1);
  }
}

generate();
