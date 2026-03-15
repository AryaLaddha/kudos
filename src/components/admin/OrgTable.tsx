"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Check, X, Users, TrendingUp, Building2 } from "lucide-react";

export type OrgRow = {
  org_id: string;
  org_name: string;
  org_slug: string;
  price_per_seat: number;
  total_users: number;
  active_users_30d: number;
  mrr: number;
  created_at: string;
};

interface Props {
  orgs: OrgRow[];
}

function formatMrr(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function OrgTable({ orgs: initial }: Props) {
  const supabase = createClient();
  const [orgs, setOrgs] = useState<OrgRow[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(org: OrgRow) {
    setEditing(org.org_id);
    setEditVal(String(org.price_per_seat));
  }

  function cancelEdit() {
    setEditing(null);
    setEditVal("");
  }

  async function savePrice(orgId: string) {
    const price = parseFloat(editVal);
    if (isNaN(price) || price < 0) return;
    setSaving(true);
    const { error } = await supabase.rpc("admin_set_price_per_seat", {
      p_org_id: orgId,
      p_price: price,
    });
    if (!error) {
      setOrgs((prev) =>
        prev.map((o) =>
          o.org_id === orgId
            ? { ...o, price_per_seat: price, mrr: o.active_users_30d * price }
            : o
        )
      );
    }
    setSaving(false);
    setEditing(null);
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Organisation
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total users
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active (30d)
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
              £ / seat
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
              MRR
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Since
            </th>
          </tr>
        </thead>
        <tbody>
          {orgs.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                No organisations yet.
              </td>
            </tr>
          ) : (
            orgs.map((org, i) => (
              <tr
                key={org.org_id}
                className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${
                  i === orgs.length - 1 ? "border-b-0" : ""
                }`}
              >
                {/* Org name */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/20">
                      <Building2 className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{org.org_name}</p>
                      <p className="text-xs text-slate-500">/{org.org_slug}</p>
                    </div>
                  </div>
                </td>

                {/* Total users */}
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center gap-1.5 text-slate-300 font-medium">
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                    {org.total_users}
                  </span>
                </td>

                {/* Active users */}
                <td className="px-6 py-4 text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                      org.active_users_30d > 0
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        org.active_users_30d > 0 ? "bg-emerald-400" : "bg-slate-600"
                      }`}
                    />
                    {org.active_users_30d} active
                  </span>
                </td>

                {/* Price per seat — editable */}
                <td className="px-6 py-4 text-right">
                  {editing === org.org_id ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-slate-400">£</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePrice(org.org_id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="w-20 rounded-lg border border-indigo-500 bg-slate-800 px-2 py-1 text-right text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                      <button
                        onClick={() => savePrice(org.org_id)}
                        disabled={saving}
                        className="rounded-lg bg-emerald-600 p-1 text-white hover:bg-emerald-500 transition disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-lg bg-slate-700 p-1 text-slate-300 hover:bg-slate-600 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(org)}
                      className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-slate-300 hover:bg-slate-800 transition-colors"
                    >
                      £{org.price_per_seat.toFixed(2)}
                      <Pencil className="h-3 w-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </td>

                {/* MRR */}
                <td className="px-6 py-4 text-right">
                  <span className="flex items-center justify-end gap-1.5 font-semibold text-white">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    {formatMrr(org.mrr)}
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">per month</p>
                </td>

                {/* Since */}
                <td className="px-6 py-4 text-right text-xs text-slate-500">
                  {formatDate(org.created_at)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
