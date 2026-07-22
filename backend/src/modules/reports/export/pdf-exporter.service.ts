import { Injectable } from '@nestjs/common';
import { TabularReport } from '../interfaces/report-filters.interface';

/**
 * Self-contained, dependency-free PDF writer (no external lib). Renders a report
 * as a paginated, monospaced text document — a valid, openable PDF carrying the
 * exact figures. (The polished, presentation-grade P&L layout is rendered on the
 * client from ProfitLossStatementView and printed to PDF via the browser; see README.)
 */
@Injectable()
export class PdfExporterService {
  private readonly LINES_PER_PAGE = 52;
  private readonly LEADING = 14;
  private readonly TOP = 780;
  private readonly LEFT = 40;

  toPdfBuffer(title: string, report: TabularReport): Buffer {
    const lines = this.layout(title, report);
    return this.buildPdf(lines);
  }

  private layout(title: string, report: TabularReport): string[] {
    const widths = report.columns.map((c) => Math.max(c.label.length, 10));
    report.rows.forEach((r) => report.columns.forEach((c, i) => { widths[i] = Math.max(widths[i], String(r[c.key] ?? '').length); }));
    const cap = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + '…' : s).padEnd(w);
    const rowLine = (vals: Array<string | number | null>) => report.columns.map((_, i) => cap(String(vals[i] ?? ''), Math.min(widths[i], 28))).join('  ');

    const out: string[] = [title, ''.padEnd(title.length, '='), ''];
    out.push(rowLine(report.columns.map((c) => c.label)));
    out.push(''.padEnd(rowLine(report.columns.map((c) => c.label)).length, '-'));
    for (const r of report.rows) out.push(rowLine(report.columns.map((c) => r[c.key] ?? '')));
    if (report.summary) {
      out.push('', 'Summary:');
      for (const [k, v] of Object.entries(report.summary)) out.push(`  ${k}: ${v}`);
    }
    return out;
  }

  private esc(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  private buildPdf(allLines: string[]): Buffer {
    // Chunk into pages.
    const pages: string[][] = [];
    for (let i = 0; i < allLines.length; i += this.LINES_PER_PAGE) pages.push(allLines.slice(i, i + this.LINES_PER_PAGE));
    if (pages.length === 0) pages.push(['(no data)']);

    const objects: string[] = [];
    const fontObj = pages.length * 2 + 3; // font is the last object
    const kidsRefs: string[] = [];

    pages.forEach((pageLines, idx) => {
      const contentObjNum = 3 + idx * 2;
      const pageObjNum = contentObjNum + 1;
      kidsRefs.push(`${pageObjNum} 0 R`);
      let stream = 'BT\n/F1 10 Tf\n' + `${this.LEFT} ${this.TOP} Td\n` + `${this.LEADING} TL\n`;
      pageLines.forEach((ln, i) => { stream += (i === 0 ? `(${this.esc(ln)}) Tj\n` : `T*\n(${this.esc(ln)}) Tj\n`); });
      stream += 'ET';
      objects[contentObjNum] = `${contentObjNum} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`;
      objects[pageObjNum] = `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>\nendobj\n`;
    });

    objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
    objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kidsRefs.join(' ')}] /Count ${pages.length} >>\nendobj\n`;
    objects[fontObj] = `${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`;

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    const totalObjs = fontObj;
    for (let n = 1; n <= totalObjs; n++) {
      offsets[n] = Buffer.byteLength(pdf, 'utf8');
      pdf += objects[n] ?? `${n} 0 obj\n<< >>\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= totalObjs; n++) pdf += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
  }
}
