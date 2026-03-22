import { SchoolEvent } from '../types';
import Papa from 'papaparse';

export function exportToCSV(events: SchoolEvent[], exportStyle: 'duration' | 'start_only' = 'duration') {
  const csvData = events.map(event => {
    const formatDt = (d: string) => {
      const parts = (d || '').split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${month}/${day}/${year}`; // MM/DD/YYYY
      }
      return d;
    };
    
    let startDate = event.date_start;
    let endDate = event.date_end;
    let description = [
      event.target ? `対象: ${event.target}` : '',
      event.notes ? `備考: ${event.notes}` : ''
    ];

    if (exportStyle === 'start_only' && event.date_start !== event.date_end && event.date_end) {
      endDate = event.date_start;
      description.push(`※期間: ${formatDt(event.date_start)} 〜 ${formatDt(event.date_end)}`);
    }
    
    return {
      'Subject': event.title || '',
      'Start Date': formatDt(startDate) || '',
      'Start Time': event.time_start || '',
      'End Date': formatDt(endDate) || '',
      'End Time': event.time_end || '',
      'All Day Event': event.time_start ? 'FALSE' : 'TRUE',
      'Description': description.filter(Boolean).join('\n'),
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

