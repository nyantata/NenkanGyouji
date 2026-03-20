import { GoogleGenAI, Type } from "@google/genai";
import { SchoolEvent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeCalendar(fileData: string, mimeType: string, fileText?: string): Promise<Omit<SchoolEvent, 'id' | 'selected'>[]> {
  const prompt = `
提供された学校の年間行事計画から、行事のリストを抽出してください。
【重要】4月から翌年3月までの1年間すべての行事を、途中で省略することなく最後まで完全に抽出してください。
原文に存在する情報のみを抽出し、推測・補完は一切しないでください。
対象学年は '1年', '2年', '全学年' などの文字列で抽出してください。
カテゴリは行事の内容から適切なもの（例: 学年行事、職員会議、試験、学校説明会、その他 など）を推測して日本語で設定してください。

以下のJSONスキーマに従って出力してください。
`;

  const parts: any[] = [{ text: prompt }];

  if (mimeType === 'application/pdf') {
    parts.push({
      inlineData: {
        data: fileData,
        mimeType: "application/pdf"
      }
    });
  } else if (fileText) {
    parts.push({ text: `ファイル内容:\n${fileText}` });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts },
    config: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "YYYY-MM-DD形式の日付。日付が特定できない場合（例: 4月上旬）は、その文字列をそのまま出力してください。" },
            title: { type: Type.STRING, description: "行事名" },
            category: { type: Type.STRING, description: "カテゴリ名（日本語）" },
            target: { type: Type.STRING, description: "対象学年 (例: 1年, 全学年)。不明な場合はnull" },
            time_start: { type: Type.STRING, description: "開始時刻 HH:MM形式。不明な場合はnull" },
            time_end: { type: Type.STRING, description: "終了時刻 HH:MM形式。不明な場合はnull" },
            notes: { type: Type.STRING, description: "備考・詳細。不明な場合はnull" }
          },
          required: ["date", "title", "category"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  try {
    const data = JSON.parse(text);
    return data;
  } catch (e) {
    console.error("Failed to parse JSON", text);
    throw new Error("Failed to parse AI response");
  }
}
