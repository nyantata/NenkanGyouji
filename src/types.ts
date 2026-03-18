export interface SchoolEvent {
  id: string;
  date: string;
  title: string;
  category: string;
  target: string | null;
  time_start: string | null;
  time_end: string | null;
  notes: string | null;
  selected: boolean;
}

export const CATEGORIES = [
  { id: "grade", name: "学年行事" },
  { id: "meeting", name: "職員会議" },
  { id: "exam", name: "試験" },
  { id: "open_school", name: "学校説明会" },
  { id: "other", name: "その他" }
];
