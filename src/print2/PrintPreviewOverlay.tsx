// src/print2/PrintPreviewOverlay.tsx
import React, { useMemo, useState } from "react";
import type { ColumnDef, RowData } from "../core/TableTypes";
import type { DepLink } from "../progress/ProgressCore";
import type { ProjectInfo } from "../progress/ProjectModal";
import { buildPrintModel } from "./PrintModel";
import PrintRenderer from "./PrintRenderer";
import { useI18n } from "../i18n";

type Props = {
  columns: ColumnDef[];
  rows: RowData[];
  dependencies: DepLink[];
  watermarkSvgSrc?: string;

  projectInfo?: ProjectInfo;

  // Branding/header
  logoSrc?: string;

  // Watermark (gratisbrukere)
  showWatermark?: boolean;
  watermarkText?: string;

  // ✅ NEW: bar-tekst i print (skal følge app-toggle)
  showBarLabels?: boolean;
  // ✅ NEW: hvilken celle som brukes som label (default: første kolonne)
  barLabelKey?: string;

  // ✅ NY: global default bar color (fra toolbar)
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

  const [pageSize, setPageSize] = useState<"A4" | "A3" | "LETTER" | "TABLOID">(
    "A4"
  );
  const [includeDeps, setIncludeDeps] = useState<boolean>(true);

  const [printColKeys, setPrintColKeys] = useState<string[]>(() =>
    columns.filter(isAppVisibleColumn).map((c) => c.key)
  );

  React.useEffect(() => {
    setPrintColKeys(columns.filter(isAppVisibleColumn).map((c) => c.key));
  }, [columns]);

  const wmText = watermarkText ?? "MCL Progress • FREE";

  const filteredColumns = useMemo(() => {
    const must = new Set<string>();
  
    // Første kolonne må alltid være med (typisk aktivitet/tittel)
    if (columns[0]?.key) must.add(columns[0].key);
  
    // Owner må alltid være tilgjengelig for print-modellen slik at bar-farger
    // kan beregnes, selv om kolonnen er skjult i selve utskriften.
    const ownerCol = columns.find((c) => c.key === "owner");
    if (ownerCol?.key) must.add(ownerCol.key);
  
    const allowed = new Set([...printColKeys, ...must]);
    return columns.filter((c) => allowed.has(c.key));
  }, [columns, printColKeys]);

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
        rows,
        dependencies,
        ownerColors,
        defaultBarColor, // ✅ NY: send global bar color til print-model
      },
      {
        pageSize: pageSize === "LETTER" || pageSize === "TABLOID" ? "A4" : pageSize, // (hvis PrintOptions kun støtter A4/A3)
        includeDependencies: includeDeps,
        orientation: "landscape",
        marginMm: { top: 8, right: 8, bottom: 8, left: 8 },
      }
    );
  }, [
    filteredColumns,
    rows,
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
    const left1 = `${t("printPreview.customerLabel")} ${
      customer || t("printPreview.notSet")
    }`;

    const startISO = model?.range?.startISO ? String(model.range.startISO) : "";
    const totalDays = Number(model?.range?.totalDays ?? 0);
    const endISO =
      startISO && totalDays > 0
        ? toISODate(addDays(parseISO(startISO), Math.max(0, totalDays - 1)))
        : "";

    const left2 =
      startISO && endISO
        ? `${t("printPreview.projectPeriodLabel")} ${startISO} – ${endISO}`
        : `${t("printPreview.projectPeriodLabel")} ${t("printPreview.notSet")}`;

    return [left1, left2];
  }, [projectInfo, model, t]);

  const title = useMemo(() => {
    const name = (projectInfo?.projectName ?? "").trim();
    return name || t("printPreview.projectNameNotSet");
  }, [projectInfo, t]);

  const pageCssSize =
    pageSize === "A3"
      ? "A3 landscape"
      : pageSize === "A4"
      ? "A4 landscape"
      : pageSize === "LETTER"
      ? "Letter landscape"
      : "Tabloid landscape";

  const pageW = model.layout.pagePx.w;
  const pageH = model.layout.pagePx.h;

  // ✅ labelKey default: første kolonne i *innkommende* kolonner (typisk "Aktivitet")
  const resolvedBarLabelKey =
    barLabelKey ?? columns?.[0]?.key ?? filteredColumns?.[0]?.key ?? "title";

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
        }}
      >
        <div style={{ fontWeight: 800 }}>{t("printPreview.topTitle")}</div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 12,
          }}
        >
          <label style={{ fontSize: 12, opacity: 0.9 }}>
            {t("printPreview.paperLabel")}
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
          />
          <span style={{ fontSize: 12, opacity: 0.9 }}>
            {t("printPreview.includeDeps")}
          </span>
        </label>

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
          {t("printPreview.printBtn")}
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
          {t("printPreview.closeBtn")}
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
            logoSrc={resolvedLogo}
            headerLeftLines={headerLeftLines}
            headerRightLines={[]}
            showWatermark={Boolean(showWatermark)}
            watermarkText={wmText}
            watermarkSvgSrc={watermarkSvgSrc}
            title={title}
            locale={locale}
            // ✅ NEW
            showBarLabels={Boolean(showBarLabels)}
            barLabelKey={resolvedBarLabelKey}
          />
        </div>
      </div>
    </div>
  );
}
