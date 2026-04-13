// src/core/utils/fileIO.ts

export function safeParseJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function downloadTextFile(filename: string, mime: string, text: string) {
  const anyWin = window as any;
  const picker = anyWin?.showSaveFilePicker;

  const fallbackDownload = () => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  // If File System Access API is available (Chromium), use native "save as" dialog
  if (typeof picker === "function") {
    (async () => {
      try {
        const lower = String(filename || "").toLowerCase();
        const ext = lower.includes(".") ? "." + lower.split(".").pop() : "";

        // Base accept mapping (note: mime may include charset; we normalize a bit)
        const mimeBase = String(mime || "").split(";")[0].trim();

        let accept: Record<string, string[]> | undefined;

        if (ext === ".mclp" || mimeBase === "application/json") {
          accept = { "application/json": [".mclp", ".json"] };
        } else if (ext === ".tsv" || mimeBase === "text/tab-separated-values") {
          accept = { "text/tab-separated-values": [".tsv"] };
        } else if (ext === ".csv" || mimeBase === "text/csv") {
          accept = { "text/csv": [".csv"] };
        } else if (mimeBase.startsWith("text/")) {
          accept = { [mimeBase]: [ext || ".txt"] };
        }

        const handle = await anyWin.showSaveFilePicker({
          suggestedName: filename,
          types: accept
            ? [
                {
                  description: "File",
                  accept,
                },
              ]
            : undefined,
        });

        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
      } catch (e: any) {
        // ✅ User cancel => do nothing (NO fallback)
        const name = String(e?.name || "");
        if (name === "AbortError") return;

        // ✅ Real error => show message, no fallback
        console.warn("[Progress] Save dialog failed:", e);
        alert("Kunne ikke lagre filen. Prøv igjen.");
      }
    })();
    return;
  }

  // Non-Chromium browsers:
  // Her har vi ikke native picker. Du ba om at fallback er uønsket når bruker avbryter,
  // men uten picker finnes det ikke "avbryt"-case — kun download.
  // Hvis du heller vil blokkere helt her, kan vi gjøre det.
  fallbackDownload();
}

export function pickTextFile(
  accept: string
): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ name: file.name, text: String(reader.result ?? "") });
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };

    input.click();
  });
}
