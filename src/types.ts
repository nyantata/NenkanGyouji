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

