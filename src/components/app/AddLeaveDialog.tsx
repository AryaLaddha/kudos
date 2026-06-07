"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLeave } from "@/app/(app)/leave/actions";
import { LEAVE_TYPES } from "@/lib/leave";
import type { Leave, LeaveType } from "@/types";
import { toast } from "sonner";
import { CalendarDays, Info } from "lucide-react";

interface AddLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  /** Pre-fills the From/To fields, e.g. when launched from a specific day. */
  defaultDate?: string | null;
  onSuccess: (leave: Leave) => void;
}

export default function AddLeaveDialog({
  open,
  onOpenChange,
  orgId,
  defaultDate,
  onSuccess,
}: AddLeaveDialogProps) {
  const [from, setFrom] = useState(defaultDate ?? "");
  const [to, setTo] = useState(defaultDate ?? "");
  const [type, setType] = useState<LeaveType | "">("");
  const [customLabel, setCustomLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleClose(value: boolean) {
    if (!value) {
      setFrom(defaultDate ?? "");
      setTo(defaultDate ?? "");
      setType("");
      setCustomLabel("");
    }
    onOpenChange(value);
  }

  function handleSave() {
    if (!from || !to) {
      toast.error("Please choose both a start and end date.");
      return;
    }
    if (!type) {
      toast.error("Please choose a leave type.");
      return;
    }
    if (type === "custom" && !customLabel.trim()) {
      toast.error("Please name your custom leave.");
      return;
    }

    startTransition(async () => {
      const result = await addLeave(from, to, type, customLabel, orgId);
      if (result.error || !result.leave) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      toast.success("Leave added to the calendar.");
      onSuccess(result.leave);
      handleClose(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <CalendarDays className="h-4 w-4 text-indigo-600" />
            Add Leave
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Your leave will appear on the shared team calendar.
          </p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                From <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  if (!to || e.target.value > to) setTo(e.target.value);
                }}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                To <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Leave Type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LeaveType | "")}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select type…</option>
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {type === "custom" && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Custom Leave Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Conference, Study Leave"
                value={customLabel}
                maxLength={40}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="text-sm"
                autoFocus
              />
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-xs text-emerald-800">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>Weekend days are excluded automatically — only working days show on the calendar.</span>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 border-t border-slate-100 bg-slate-50/50" showCloseButton>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isPending ? "Saving…" : "Save Leave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
