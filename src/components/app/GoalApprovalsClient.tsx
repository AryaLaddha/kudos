"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck, Check, X, Loader2, Trophy, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PendingGoal } from "@/types";
import { approveGoal, rejectGoal } from "@/app/(app)/admin/goal-approvals/actions";

interface Props {
  initialGoals: PendingGoal[];
}

function initialsOf(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function GoalApprovalsClient({ initialGoals }: Props) {
  const router = useRouter();
  const [goals, setGoals] = useState(initialGoals);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Pagination
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(goals.length / PAGE_SIZE));
  // Keep the current page valid as goals are approved/rejected off the list.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageGoals = goals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reject dialog state
  const [rejecting, setRejecting] = useState<PendingGoal | null>(null);
  const [reason, setReason] = useState("");

  function handleApprove(goal: PendingGoal) {
    setPendingId(goal.id);
    startTransition(async () => {
      const result = await approveGoal(goal.id);
      setPendingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
      toast.success(`Approved "${goal.title}" for ${goal.user_name}`);
      router.refresh();
    });
  }

  function openReject(goal: PendingGoal) {
    setRejecting(goal);
    setReason("");
  }

  function handleReject() {
    if (!rejecting) return;
    const target = rejecting;
    setPendingId(target.id);
    startTransition(async () => {
      const result = await rejectGoal(target.id, reason);
      setPendingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setGoals((prev) => prev.filter((g) => g.id !== target.id));
      setRejecting(null);
      setReason("");
      toast.success(`Rejected "${target.title}"`);
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <ClipboardCheck className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Goal Approvals</h1>
          <p className="text-sm text-slate-500">
            {goals.length === 0
              ? "Nothing waiting for review"
              : `${goals.length} goal${goals.length === 1 ? "" : "s"} awaiting your review`}
          </p>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">The approval queue is empty</p>
          <p className="text-xs text-slate-400 mt-1">New goal submissions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageGoals.map((goal) => {
            const busy = isPending && pendingId === goal.id;
            return (
              <div
                key={goal.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-start"
              >
                {/* User */}
                <div className="flex items-center gap-2.5 sm:w-44 sm:flex-shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={goal.user_avatar ?? undefined} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                      {initialsOf(goal.user_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{goal.user_name}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                      {new Date(goal.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Goal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {goal.status === "achieved" ? (
                      <Trophy className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    ) : (
                      <Target className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                    )}
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{goal.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{goal.description}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                    {goal.category} · {goal.points} pts · {goal.status}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 sm:flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(goal)}
                    disabled={busy}
                    className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReject(goal)}
                    disabled={busy}
                    className="h-8 gap-1.5 text-xs px-3 border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 gap-1.5 text-xs px-3 border-slate-200"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 gap-1.5 text-xs px-3 border-slate-200"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Reject reason dialog */}
      <Dialog open={rejecting !== null} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject goal</DialogTitle>
            <DialogDescription>
              {rejecting ? `Let ${rejecting.user_name} know why "${rejecting.title}" was rejected.` : ""}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            maxLength={500}
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejecting(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {isPending && pendingId === rejecting?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Reject goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
