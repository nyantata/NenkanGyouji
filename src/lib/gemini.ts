import { GoogleGenAI, Type } from "@google/genai";
import { SchoolEvent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeCalendar(fileData: string, mimeType: string, fileText?: string): Promise<Omit<SchoolEvent, 'id' | 'selected'>[]> {
  const prompt = `
提供された学校の年間行事計画から、行事のリストを正確に抽出してください。
原文に存在する情報のみを抽出し、推測・補完は一切行わず、不明な項目は即座にnullを出力してください。

【抽出ルール】
1. 対象・名称・分類: 対象学年は「1年」「全学年」「教職員」等で指定。特定学年専用の行事は名称の先頭に学年を付与（例: 1年自宅学習）。カテゴリは簡潔に設定し、備考は重要補足のみ抽出。
2. 期間の厳密な抽出: 矢印（↓→〜等）や線で複数日にまたがる行事は、文字の開始日を「開始日」、記号の終了日を「終了日」として必ず1つの行事にまとめる（単日分割は厳禁）。単日行事は両方に同日を設定。
3. 日付の交差検証とズレ補正: 日付は「数字と曜日」で交差検証する。文字や矢印のわずかなはみ出しは無視し、主たる日付を正とする。
4. 月の境界と誤結合の防止: 複数の月（列）が並ぶ場合、隣の月のテキストを勝手に結合しない（例: 11月と12月の行事を繋げるのは厳禁）。各セルのテキストは独立して扱う。

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
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date_start: { type: Type.STRING, description: "YYYY-MM-DD形式の開始日。特定できない場合は文字列をそのまま出力。" },
            date_end: { type: Type.STRING, description: "YYYY-MM-DD形式の終了日。特定できない場合は文字列をそのまま出力。" },
            title: { type: Type.STRING, description: "行事名" },
            category: { type: Type.STRING, description: "カテゴリ名（日本語）" },
            target: { type: Type.STRING, description: "対象学年 (例: 1年, 全学年, 教職員)。不明な場合はnull" },
            time_start: { type: Type.STRING, description: "開始時刻 HH:MM形式。不明な場合はnull" },
            time_end: { type: Type.STRING, description: "終了時刻 HH:MM形式。不明な場合はnull" },
            notes: { type: Type.STRING, description: "備考・詳細。不明な場合はnull" }
          },
          required: ["date_start", "date_end", "title", "category"]
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
