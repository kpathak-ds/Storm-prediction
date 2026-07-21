import { jsPDF } from 'jspdf';

export interface ReportOptions {
  title: string;
  locationName: string;
  metrics: {
    temp: number;
    feelsLike: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    rainfall: number;
    aqi?: number;
    riskLevel?: string;
  };
  summaryNotes: string[];
}

export class ReportService {
  /**
   * Generate formal PDF weather intelligence report
   */
  static generatePDFReport(options: ReportOptions): void {
    const doc = new jsPDF();
    const now = new Date().toLocaleString();

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('AEROTEMPEST WEATHER INTELLIGENCE REPORT', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${now}`, 14, 27);
    doc.text(`Target Location: ${options.locationName}`, 14, 33);

    // Divider Line
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 37, 196, 37);

    // Metrics Table Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('1. Core Meteorological Parameters', 14, 46);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const m = options.metrics;
    const tableData = [
      ['Temperature:', `${m.temp}°C (Feels Like ${m.feelsLike}°C)`],
      ['Relative Humidity:', `${m.humidity}%`],
      ['Barometric Pressure:', `${m.pressure} hPa`],
      ['Wind Speed:', `${m.windSpeed} km/h`],
      ['Precipitation Rate:', `${m.rainfall} mm/h`],
      ['Air Quality Index (AQI):', `${m.aqi ?? 'N/A'}`],
      ['Threat Classification:', `${m.riskLevel || 'LOW'}`],
    ];

    let startY = 54;
    tableData.forEach(([label, val]) => {
      doc.text(label, 18, startY);
      doc.text(val, 90, startY);
      startY += 7;
    });

    // Divider Line
    doc.line(14, startY + 2, 196, startY + 2);
    startY += 10;

    // Summary Notes Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Executive AI & Environmental Analysis', 14, startY);
    startY += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    options.summaryNotes.forEach(note => {
      const splitLines = doc.splitTextToSize(`• ${note}`, 180);
      doc.text(splitLines, 18, startY);
      startY += splitLines.length * 5 + 2;
    });

    // Save File
    const filename = `Weather_Report_${options.locationName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    doc.save(filename);
  }

  /**
   * Export tabular weather metrics as CSV download
   */
  static exportCSV(locationName: string, metrics: Record<string, any>[]): void {
    if (!metrics || !metrics.length) return;

    const headers = Object.keys(metrics[0]).join(',');
    const rows = metrics.map(row => Object.values(row).map(val => `"${val}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Weather_Data_${locationName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
