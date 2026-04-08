// src/print2/PrintPreviewOverlay.tsx
import React, { useMemo, useState } from "react";
import type { ColumnDef, RowData } from "../core/TableTypes";
import type { DepLink } from "../progress/ProgressCore";
import type { ProjectInfo } from "../progress/ProjectModal";
import { buildPrintModel } from "./PrintModel";
import PrintRenderer from "./PrintRenderer";
import { useI18n } from "../i18n";

type PrintLayoutMode = "full" | "table" | "gantt";

type Props = {
  columns: ColumnDef[];
  rows: RowData[];
  visibleRowIds?: string[];
  dependencies: DepLink[];
  watermarkSvgSrc?: string;

  projectInfo?: ProjectInfo;

  logoSrc?: string;

  showWatermark?: boolean;
  watermarkText?: string;

  showBarLabels?: boolean;
  barLabelKey?: string;

  defaultBarColor?: string;

  onClose: () => void;
};

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDays(dt: Date, days: number): Date {
  const x = new Date(dt);
  x.setDate(x.getDate() + days);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isAppVisibleColumn(c: ColumnDef): boolean {
  const x: any = c;
  if (x?.visible === false) return false;
  if (x?.hidden === true) return false;
  if (x?.isHidden === true) return false;
  if (x?.show === false) return false;
  if (x?.isVisible === false) return false;
  return true;
}

export default function PrintPreviewOverlay({
  columns,
  rows,
  visibleRowIds,
  dependencies,
  projectInfo,
  logoSrc,
  showWatermark,
  watermarkSvgSrc,
  watermarkText,
  showBarLabels,
  barLabelKey,
  defaultBarColor,
  onClose,
}: Props) {
  const i18n: any = useI18n();
  const t = i18n.t;
  const locale =
    String(i18n.lang ?? i18n.locale ?? i18n.language ?? "").trim() || "en";

  const tt = (key: string, fallback: string) => {
    try {
      const v = String(t(key) ?? "").trim();
      if (!v || v === key) return fallback;
      return v;
    } catch {
      return fallback;
    }
  };

  const [pageSize, setPageSize] = useState<"A4" | "A3" | "LETTER" | "TABLOID">(
    "A4"
  );
  const [includeDeps, setIncludeDeps] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<PrintLayoutMode>("full");

  const [printColKeys, setPrintColKeys] = useState<string[]>(() =>
    columns.filter(isAppVisibleColumn).map((c) => c.key)
  );

  React.useEffect(() => {
    setPrintColKeys(columns.filter(isAppVisibleColumn).map((c) => c.key));
  }, [columns]);

  const wmText = watermarkText ?? "MCL Progress • FREE";

  const filteredColumns = useMemo(() => {
    const must = new Set<string>();

    if (columns[0]?.key) must.add(columns[0].key);

    const ownerCol = columns.find((c) => c.key === "owner");
    if (ownerCol?.key) must.add(ownerCol.key);

    const allowed = new Set([...printColKeys, ...must]);
    return columns.filter((c) => allowed.has(c.key));
  }, [columns, printColKeys]);

  const shownRows = useMemo(() => {
    const ids = Array.isArray(visibleRowIds) ? visibleRowIds : [];
    if (!ids.length) return rows;

    const allowed = new Set(ids);
    return rows.filter((r) => allowed.has(r.id));
  }, [rows, visibleRowIds]);

  const ownerColors = useMemo(() => {
    const out: Record<string, string> = {};
    const owners = projectInfo?.owners ?? [];
    for (const o of owners) {
      const name = String(o?.name ?? "").trim();
      const color = String(o?.color ?? "").trim();
      if (name && color) out[name] = color;
    }
    return out;
  }, [projectInfo]);

  const model = useMemo(() => {
    return buildPrintModel(
      {
        columns: filteredColumns,
        rows: shownRows,
        dependencies,
        ownerColors,
        defaultBarColor,
      },
      {
        pageSize:
          pageSize === "LETTER" || pageSize === "TABLOID" ? "A4" : pageSize,
        includeDependencies: includeDeps,
        orientation: "landscape",
        marginMm: { top: 8, right: 8, bottom: 8, left: 8 },
      }
    );
  }, [
    filteredColumns,
    shownRows,
    dependencies,
    ownerColors,
    defaultBarColor,
    pageSize,
    includeDeps,
  ]);

  const baseLogo = `${import.meta.env.BASE_URL}mcl-logo.png`;
  const resolvedLogo = logoSrc ?? baseLogo;

  const headerLeftLines = useMemo(() => {
    const p = projectInfo;

    const customer = (p?.customerName ?? "").trim();
    const left1 = `${tt("printPreview.customerLabel", "Customer:")} ${
      customer || tt("printPreview.notSet", "Not set")
    }`;

    const startISO = model?.range?.startISO ? String(model.range.startISO) : "";
    const totalDays = Number(model?.range?.totalDays ?? 0);
    const endISO =
      startISO && totalDays > 0
        ? toISODate(addDays(parseISO(startISO), Math.max(0, totalDays - 1)))
        : "";

    const left2 =
      startISO && endISO
        ? `${tt("printPreview.projectPeriodLabel", "Project period:")} ${startISO} – ${endISO}`
        : `${tt("printPreview.projectPeriodLabel", "Project period:")} ${tt(
            "printPreview.notSet",
            "Not set"
          )}`;

    return [left1, left2];
  }, [projectInfo, model, tt]);

  const title = useMemo(() => {
    const name = (projectInfo?.projectName ?? "").trim();
    return name || tt("printPreview.projectNameNotSet", "Project name not set");
  }, [projectInfo, tt]);

  const pageCssSize =
    pageSize === "A3"
      ? "A3 landscape"
      : pageSize === "A4"
      ? "A4 landscape"
      : pageSize === "LETTER"
      ? "Letter landscape"
      : "Tabloid landscape";

  const pageW = model.layout.pagePx.w;

  const resolvedBarLabelKey =
    barLabelKey ?? columns?.[0]?.key ?? filteredColumns?.[0]?.key ?? "title";

  const rowCountText = `${shownRows.length}`;

  return (
    <div
      className="p2-overlay"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            margin: 0 !important;
            padding: 0 !important;
          }

          .app-shell > *:not(.p2-overlay) {
            display: none !important;
          }

          .p2-overlay {
            position: static !important;
            inset: auto !important;
            display: block !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .p2-controls {
            display: none !important;
          }

          .p2-preview-scroll {
            display: block !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }

          .p2-print-area {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: ${pageW}px !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 auto !important;
            background: white !important;
          }

          @page {
            size: ${pageCssSize};
            margin: 0;
          }
        }
      `}</style>

      <div
        className="p2-controls"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "rgba(20,20,20,0.92)",
          color: "white",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 800 }}>{tt("printPreview.topTitle", "Print preview")}</div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 12,
          }}
        >
          <label style={{ fontSize: 12, opacity: 0.9 }}>
            {tt("printPreview.paperLabel", "Paper")}
          </label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as any)}
            style={{
              height: 30,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.10)",
              color: "white",
              padding: "0 8px",
              outline: "none",
            }}
          >
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="LETTER">US Letter</option>
            <option value="TABLOID">US Tabloid / Ledger</option>
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 12,
          }}
        >
          <label style={{ fontSize: 12, opacity: 0.9 }}>
            {tt("printPreview.layoutModeLabel", "Print type")}
          </label>
          <select
            value={layoutMode}
            onChange={(e) => setLayoutMode(e.target.value as PrintLayoutMode)}
            style={{
              height: 30,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.10)",
              color: "white",
              padding: "0 8px",
              outline: "none",
            }}
          >
            <option value="full">{tt("printPreview.modeFull", "Complete")}</option>
            <option value="table">{tt("printPreview.modeTable", "Table only")}</option>
            <option value="gantt">{tt("printPreview.modeGantt", "Gantt only")}</option>
          </select>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 12,
          }}
        >
          <input
            type="checkbox"
            checked={includeDeps}
            onChange={(e) => setIncludeDeps(e.target.checked)}
            disabled={layoutMode !== "full" && layoutMode !== "gantt"}
          />
          <span style={{ fontSize: 12, opacity: 0.9 }}>
            {tt("printPreview.includeDeps", "Include dependencies")}
          </span>
        </label>

        <div
          style={{
            marginLeft: 12,
            fontSize: 12,
            opacity: 0.9,
            padding: "4px 8px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
          }}
        >
          {tt("printPreview.printAsShown", "Print as shown")} · {rowCountText}{" "}
          {tt("printPreview.rowsShown", "rows")}
        </div>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            height: 32,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.14)",
            color: "white",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          {tt("printPreview.printBtn", "Print")}
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            height: 32,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.10)",
            color: "white",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          {tt("printPreview.closeBtn", "Close")}
        </button>
      </div>

      <div
        className="p2-preview-scroll"
        style={{
          flex: 1,
          overflow: "auto",
          padding: 18,
          background: "rgba(0,0,0,0.12)",
        }}
      >
        <div className="p2-print-area" style={{ margin: "0 auto", width: pageW }}>
          <PrintRenderer
            model={model}
            mode={layoutMode}
            logoSrc={resolvedLogo}
            headerLeftLines={headerLeftLines}
            headerRightLines={[]}
            showWatermark={Boolean(showWatermark)}
            watermarkText={wmText}
            watermarkSvgSrc={watermarkSvgSrc}
            title={title}
            locale={locale}
            showBarLabels={Boolean(showBarLabels)}
            barLabelKey={resolvedBarLabelKey}
          />
        </div>
      </div>
    </div>
  );
}
