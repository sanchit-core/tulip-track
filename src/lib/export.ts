import type { Group, GroupStats, ProfileUser } from "./types";
import { isoLabel } from "./stats";
import { formatLong } from "./dates";

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

async function saveText(filename: string, content: string, mime = "text/plain"): Promise<void> {
  const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (isTauri) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({ defaultPath: filename, filters: [{ name: "File", extensions: ["csv"] }] });
      if (path) {
        await writeTextFile(path, content);
        return;
      }
      return; // user cancelled
    } catch {
      /* fall through to browser download */
    }
  }
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportAttendanceCSV(input: {
  group: Group;
  groupName: string;
  members: ProfileUser[];
  stats: GroupStats;
  filename: string;
}): Promise<void> {
  const { members, stats, filename } = input;
  const dates = stats.dates;
  const header = ["Member", "Email", ...dates.map((d) => isoLabel(d)), "Present", "Late", "Absent", "Excused", "% Present"];
  const rows = members.map((m) => {
    const t = stats.byMember[m.id];
    const dayCells = dates.map((d) => stats.memberDaily[m.id]?.[d] ?? "");
    return [
      m.name,
      m.email,
      ...dayCells,
      t.present,
      t.late,
      t.absent,
      t.excused,
      `${t.percent}%`,
    ];
  });
  await saveText(filename, toCSV(header, rows));
}

// ---------------------------------------------------------------------------
// PDF export (jspdf)
// ---------------------------------------------------------------------------

export async function exportAttendancePDF(input: {
  group: Group;
  groupName: string;
  members: ProfileUser[];
  stats: GroupStats;
  filename: string;
}) {
  const { groupName, members, stats, filename } = input;
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const total = stats.totals;
  const sum = total.total || 1;

  // Header band
  doc.setFillColor(255, 77, 109);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Tulip Track — Attendance Report", 40, 40);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${groupName}`, 40, 60);
  doc.text(generateReportRange(stats) + `  ·  Exported ${new Date().toLocaleString()}`, 40, 75);

  // Summary row (4 chips as simple boxes + values)
  const chips: [string, string, string][] = [
    ["Present", `${total.present}`, "#16a34a"],
    ["Late", `${total.late}`, "#f59e0b"],
    ["Excused", `${total.excused}`, "#7c6cf0"],
    ["Absent", `${total.absent}`, "#ef4444"],
  ];
  const chipW = (pageW - 80 - 60) / 4;
  let x = 40;
  doc.setFont("helvetica", "normal");
  for (const [label, value, color] of chips) {
    doc.setDrawColor(224, 228, 238);
    doc.setFillColor(250, 251, 254);
    doc.roundedRect(x, 108, chipW, 58, 8, 8, "FD");
    const [cr, cg, cb] = parseIntHex(color);
    doc.setFillColor(cr, cg, cb);
    doc.circle(x + 16, 122, 6, "F");
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(53, 60, 76);
    doc.text(value, x + 30, 128);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(105, 113, 138);
    doc.text(label, x + 30, 144);
    x += chipW + 20;
  }

  doc.setFontSize(9);
  doc.setTextColor(105, 113, 138);
  doc.text(
    `Attendance rate: ${total.percent}%  ·  ${members.length} members  ·  ${stats.dates.length} days`,
    40,
    190,
  );

  // Member table
  const body = members.map((m) => {
    const t = stats.byMember[m.id];
    return [m.name, m.email || "—", t.present, `${t.percent}%`, t.late, t.excused, t.absent];
  });

  autoTable(doc, {
    startY: 205,
    head: [["Member", "Email", "Present", "%", "Late", "Excused", "Absent"]],
    body,
    margin: { left: 40, right: 40 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 7, textColor: [23, 23, 23] },
    headStyles: { fillColor: [255, 77, 109], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 118, fontStyle: "bold" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
    },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(154, 163, 184);
      doc.text(`Tulip Track · page ${page}`, pageW / 2, pageH - 24, { align: "center" });
    },
  });

  doc.save(filename);
}

function generateReportRange(stats: GroupStats): string {
  const dates = stats.dates;
  if (dates.length === 0) return "";
  return `${formatLong(dates[0])} — ${formatLong(dates[dates.length - 1])}`;
}

function parseIntHex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}