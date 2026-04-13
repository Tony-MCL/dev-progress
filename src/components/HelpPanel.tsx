// src/components/HelpPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import "../styles/panel.css";

type HelpPanelProps = {
  open: boolean;
  onClose: () => void;
};

type FaqItem = {
  q: string;
  a: string[];
  bullets: string[];
};

function parseFaqText(raw: string): FaqItem[] {
  const text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  // Split blocks by empty lines
  const blocks = text.split(/\n{2,}/g).map((b) => b.trim()).filter(Boolean);

  const items: FaqItem[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    // Expected:
    // Q: ...
    // A: ...
    // - bullet
    let q = "";
    const a: string[] = [];
    const bullets: string[] = [];

    for (const line of lines) {
      if (line.startsWith("Q:")) {
        q = line.slice(2).trim();
        continue;
      }
      if (line.startsWith("A:")) {
        const rest = line.slice(2).trim();
        if (rest) a.push(rest);
        continue;
      }
      if (line.startsWith("- ")) {
        bullets.push(line.slice(2).trim());
        continue;
      }
      // Continuation lines:
      if (bullets.length > 0) {
        // treat as bullet continuation if previous was bullet-like
        bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line}`.trim();
      } else if (a.length > 0) {
        a[a.length - 1] = `${a[a.length - 1]} ${line}`.trim();
      } else if (!q) {
        // If someone edits text and forgets Q:
        q = line;
      } else {
        a.push(line);
      }
    }

    if (!q) continue;

    items.push({
      q,
      a,
      bullets,
    });
  }

  return items;
}

/**
 * Expand keyboard hints so the same help text works for both Windows + macOS.
 * Examples:
 * - "Ctrl + Z"  -> "Ctrl / ⌘ + Z"
 * - "Alt"       -> "Alt / ⌥"
 * - "Cmd"       -> "Ctrl / ⌘"
 *
 * This is intentionally simple string-based expansion (no new i18n keys needed).
 */
function expandShortcutText(input: string): string {
  let s = String(input ?? "");

  // Normalize some variants first
  s = s.replace(/\bCommand\b/gi, "Cmd");
  s = s.replace(/\bOption\b/gi, "Alt");

  // Expand modifiers
  s = s.replace(/\bCtrl\b/g, "Ctrl / ⌘");
  s = s.replace(/\bCmd\b/g, "Ctrl / ⌘");
  s = s.replace(/\bAlt\b/g, "Alt / ⌥");
  s = s.replace(/\bShift\b/g, "Shift / ⇧");

  // Common keys (keep conservative to avoid weird replacements in normal prose)
  s = s.replace(/\bBackspace\b/g, "Backspace / ⌫");
  s = s.replace(/\bEnter\b/g, "Enter / ↵");
  s = s.replace(/\bEsc\b/g, "Esc / ⎋");
  s = s.replace(/\bEscape\b/g, "Esc / ⎋");

  return s;
}

export default function HelpPanel({ open, onClose }: HelpPanelProps) {
  const { t } = useI18n();

  const [shouldRender, setShouldRender] = useState(open);

  useEffect(() => {
    if (open) setShouldRender(true);
    else {
      const timeout = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const faqItems = useMemo(() => {
    // IMPORTANT: Only strings through t() (no arrays/objects in i18n)
    const raw = String(t("help.faqText") ?? "").trim();
    return parseFaqText(raw);
  }, [t]);

  if (!shouldRender) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const intro = expandShortcutText(String(t("help.intro") ?? ""));
  const outro = expandShortcutText(String(t("help.outro") ?? ""));

  return (
    <div
      className={`mcl-panel-overlay ${open ? "open" : "closing"}`}
      onClick={handleOverlayClick}
    >
      <aside
        className={`mcl-help-panel ${open ? "open" : "closing"}`}
        role="dialog"
        aria-modal="true"
        // Make panel layout robust + allow body scroll
        style={{ display: "flex", flexDirection: "column", maxHeight: "90vh" }}
      >
        <div className="mcl-help-header" style={{ flex: "0 0 auto" }}>
          <h2 className="mcl-help-title">{t("help.title")}</h2>
          <button
            type="button"
            className="mcl-help-close"
            onClick={onClose}
            aria-label={t("help.closeAria")}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="mcl-help-body"
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            paddingRight: 8,
          }}
        >
          <p style={{ marginTop: 0 }}>{intro}</p>

          <div style={{ display: "grid", gap: 10 }}>
            {faqItems.map((it, idx) => {
              const q = expandShortcutText(it.q);
              const a = it.a.map((p) => expandShortcutText(p));
              const bullets = it.bullets.map((b) => expandShortcutText(b));

              return (
                <details
                  key={`faq-${idx}`}
                  style={{
                    border: "1px solid var(--mcl-border, rgba(255,255,255,0.12))",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <summary style={{ cursor: "pointer", fontWeight: 700, outline: "none" }}>
                    {q}
                  </summary>

                  <div style={{ marginTop: 8 }}>
                    {a.map((p, i) => (
                      <p key={`a-${idx}-${i}`} style={{ marginTop: i === 0 ? 0 : 8 }}>
                        {p}
                      </p>
                    ))}

                    {bullets.length > 0 ? (
                      <ul style={{ marginTop: 8 }}>
                        {bullets.map((b, i2) => (
                          <li key={`b-${idx}-${i2}`}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>

          <p style={{ marginTop: 14 }}>{outro}</p>
        </div>
      </aside>
    </div>
  );
}
