import { Injectable } from '@nestjs/common';
import { TabularReport } from '../interfaces/report-filters.interface';

@Injectable()
export class CsvExporterService {
  /** RFC-4180-ish CSV: quote fields containing comma/quote/newline, double inner quotes. */
  private cell(v: string | number | null | undefined): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  toCsv(report: TabularReport): string {
    const header = report.columns.map((c) => this.cell(c.label)).join(',');
    const body = report.rows.map((row) => report.columns.map((c) => this.cell(row[c.key])).join(',')).join('\n');
    let out = `${header}\n${body}`;
    if (report.summary) {
      out += '\n\n';
      out += Object.entries(report.summary).map(([k, v]) => `${this.cell(k)},${this.cell(v)}`).join('\n');
    }
    return out;
  }
}
