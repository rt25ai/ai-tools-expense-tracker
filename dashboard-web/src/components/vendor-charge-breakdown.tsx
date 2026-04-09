"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrencyIls, formatDateLabel } from "@/lib/formatters";

type VendorChargeDetail = {
  id: string;
  date: string;
  amountIls: number;
  description: string;
  monthKey?: string;
  monthLabel?: string;
  monthHref?: string;
};

type VendorChargeGroup = {
  name: string;
  total: number;
  chargeCount: number;
  charges: VendorChargeDetail[];
};

export function VendorChargeBreakdown({
  vendors,
}: {
  vendors: VendorChargeGroup[];
}) {
  const [openVendors, setOpenVendors] = useState<Record<string, boolean>>({});

  return (
    <div className="mt-6 space-y-3">
      {vendors.map((vendor) => {
        const isOpen = openVendors[vendor.name] ?? false;

        return (
          <div
            key={vendor.name}
            className="overflow-hidden rounded-[22px] border border-white/8 bg-black/20"
          >
            <button
              type="button"
              onClick={() =>
                setOpenVendors((current) => ({
                  ...current,
                  [vendor.name]: !isOpen,
                }))
              }
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 p-4 text-right transition-colors hover:bg-white/[0.03]"
            >
              <div>
                <p className="font-medium text-white">{vendor.name}</p>
                <div className="mt-1 inline-flex items-center gap-2 text-sm text-cyan-300">
                  <span>{vendor.chargeCount} חיובים</span>
                  {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </div>
              </div>
              <p className="text-lg font-semibold text-cyan-200">{formatCurrencyIls(vendor.total)}</p>
            </button>

            {isOpen ? (
              <div className="border-t border-white/8 bg-white/[0.02] px-4 py-3">
                <div className="space-y-2">
                  {vendor.charges.map((charge) => (
                    <div
                      key={charge.id}
                      className="grid gap-2 rounded-2xl border border-white/6 bg-black/20 px-4 py-3 md:grid-cols-[160px_130px_1fr]"
                    >
                      <div className="text-sm text-zinc-300">{formatDateLabel(charge.date)}</div>
                      <div className="text-sm font-medium text-cyan-200">{formatCurrencyIls(charge.amountIls)}</div>
                      <div className="text-sm text-zinc-400">
                        {charge.monthHref && charge.monthLabel ? (
                          <Link
                            href={charge.monthHref}
                            className="ml-2 inline-flex text-cyan-300 transition-colors hover:text-cyan-200"
                          >
                            {charge.monthLabel}
                          </Link>
                        ) : null}
                        <span>{charge.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
