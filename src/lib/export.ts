import { createEvents, EventAttributes } from 'ics';
import { SchoolEvent } from '../types';
import Papa from 'papaparse';

export function exportToICS(events: SchoolEvent[]) {
  const icsEvents: EventAttributes[] = events.map(event => {
    const [year, month, day] = event.date.split('-').map(Number);
    
    let start: [number, number, number, number, number] | [number, number, number] = [year, month, day];
    let end: [number, number, number, number, number] | [number, number, number] | undefined = undefined;
    
    if (event.time_start) {
      const [hour, minute] = event.time_start.split(':').map(Number);
      start = [year, month, day, hour, minute];
      
      if (event.time_end) {
        const [endHour, endMinute] = event.time_end.split(':').map(Number);
        end = [year, month, day, endHour, endMinute];
      } else {
        // デフォルトで1時間
        end = [year, month, day, hour + 1, minute];
      }
    }

    return {
      title: event.title,
      start,
      end,
      description: [
        event.target ? `対象: ${event.target}` : '',
        event.notes ? `備考: ${event.notes}` : ''
      ].filter(Boolean).join('\n'),
    };
  });

  createEvents(icsEvents, (error, value) => {
    if (error) {
      console.error(error);
      return;
    }
    const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar_${new Date().toISOString().replace(/[:.]/g, '')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

export function exportToCSV(events: SchoolEvent[]) {
  const csvData = events.map(event => {
    const parts = event.date.split('-');
    let formattedDate = event.date;
    if (parts.length === 3) {
      const [year, month, day] = parts;
      formattedDate = `${month}/${day}/${year}`; // MM/DD/YYYY
    }
    
    return {
      'Subject': event.title,
      'Start Date': formattedDate,
      'Start Time': event.time_start || '',
      'End Date': formattedDate,
      'End Time': event.time_end || '',
      'All Day Event': event.time_start ? 'FALSE' : 'TRUE',
      'Description': [
        event.target ? `対象: ${event.target}` : '',
        event.notes ? `備考: ${event.notes}` : ''
      ].filter(Boolean).join('\n'),
      'Location': ''
    };
  });

  const csv = Papa.unparse(csvData);
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calendar_${new Date().toISOString().replace(/[:.]/g, '')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
