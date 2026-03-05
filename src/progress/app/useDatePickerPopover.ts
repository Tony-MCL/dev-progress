// src/progress/app/useDatePickerPopover.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { TableCoreDatePickerRequest } from "../../core/TableTypes";

export function useDatePickerPopover() {
  const [datePickReq, setDatePickReq] =
    useState<TableCoreDatePickerRequest | null>(null);

  const datePickReqRef = useRef<TableCoreDatePickerRequest | null>(null);

  useEffect(() => {
    datePickReqRef.current = datePickReq;
  }, [datePickReq]);

  const closeDatePickerUI = useCallback(() => {
    setDatePickReq(null);
  }, []);

  // TableCore -> App: åpne datepicker som popover (App eier UI)
  const onRequestDatePicker = useCallback((req: TableCoreDatePickerRequest) => {
    setDatePickReq(req);
  }, []);

  return {
    datePickReq,
    datePickReqRef,
    closeDatePickerUI,
    onRequestDatePicker,
    setDatePickReq,
  };
}
