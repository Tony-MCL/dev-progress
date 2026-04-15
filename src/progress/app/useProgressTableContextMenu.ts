import { useCallback, useEffect, useState } from "react";
import type {
  Selection,
  TableCoreContextMenuRequest,
} from "../../core/TableTypes";

type Args = {
  setSelection: React.Dispatch<React.SetStateAction<Selection | null>>;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onDeleteRows: () => void;
};

function hasSelection(sel: Selection | null | undefined): sel is Selection {
  return !!sel && sel.r1 >= 0 && sel.r2 >= 0 && sel.c1 >= 0 && sel.c2 >= 0;
}

function isCellInsideSelection(
  sel: Selection | null | undefined,
  row: number | null,
  col: number | null
) {
  if (!hasSelection(sel)) return false;
  if (typeof row !== "number" || typeof col !== "number") return false;

  const rMin = Math.min(sel.r1, sel.r2);
  const rMax = Math.max(sel.r1, sel.r2);
  const cMin = Math.min(sel.c1, sel.c2);
  const cMax = Math.max(sel.c1, sel.c2);

  return row >= rMin && row <= rMax && col >= cMin && col <= cMax;
}

export function useProgressTableContextMenu({
  setSelection,
  onInsertRowAbove,
  onInsertRowBelow,
  onDeleteRows,
}: Args) {
  const [tableContextMenu, setTableContextMenu] =
    useState<TableCoreContextMenuRequest | null>(null);

  const closeTableContextMenu = useCallback(() => {
    setTableContextMenu(null);
  }, []);

  const openTableContextMenu = useCallback(
    (req: TableCoreContextMenuRequest) => {
      if (
        typeof req.row === "number" &&
        typeof req.col === "number" &&
        !isCellInsideSelection(req.selection, req.row, req.col)
      ) {
        const nextSel = {
          r1: req.row,
          r2: req.row,
          c1: req.col,
          c2: req.col,
        };
        setSelection(nextSel);
        setTableContextMenu({
          ...req,
          selection: nextSel,
        });
        return;
      }

      setTableContextMenu(req);
    },
    [setSelection]
  );

  const handleInsertRowAbove = useCallback(() => {
    onInsertRowAbove();
    closeTableContextMenu();
  }, [onInsertRowAbove, closeTableContextMenu]);

  const handleInsertRowBelow = useCallback(() => {
    onInsertRowBelow();
    closeTableContextMenu();
  }, [onInsertRowBelow, closeTableContextMenu]);

  const handleDeleteRows = useCallback(() => {
    onDeleteRows();
    closeTableContextMenu();
  }, [onDeleteRows, closeTableContextMenu]);

  useEffect(() => {
    if (!tableContextMenu) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[role="menu"]')) return;
      closeTableContextMenu();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTableContextMenu();
    };

    const onScroll = () => closeTableContextMenu();
    const onResize = () => closeTableContextMenu();

    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [tableContextMenu, closeTableContextMenu]);

  return {
    tableContextMenu,
    openTableContextMenu,
    closeTableContextMenu,
    handleInsertRowAbove,
    handleInsertRowBelow,
    handleDeleteRows,
  };
}
