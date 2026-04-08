"use client";

import { useDeferredValue, useState } from "react";
import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EnrichedTransaction, TransactionSource } from "@/lib/dashboard-data";
import { formatCurrencyUsd, formatDateLabel, formatMonthLabel } from "@/lib/formatters";

function badgeTone(source: TransactionSource) {
  switch (source) {
    case "auto":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
    case "email-imported":
      return "border-sky-400/20 bg-sky-400/10 text-sky-200";
    case "ai-extracted":
      return "border-violet-400/20 bg-violet-400/10 text-violet-200";
    default:
      return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }
}

const columns: ColumnDef<EnrichedTransaction>[] = [
  {
    accessorKey: "date",
    header: "תאריך",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-zinc-100">{formatDateLabel(row.original.date)}</p>
        <p className="text-xs tracking-[0.18em] text-zinc-500">{formatMonthLabel(row.original.monthKey, "short")}</p>
      </div>
    ),
  },
  {
    accessorKey: "tool",
    header: "ספק",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-zinc-100">{row.original.tool}</p>
        <p className="text-sm text-zinc-500">{row.original.category}</p>
      </div>
    ),
  },
  {
    accessorKey: "description",
    header: "תיאור",
    cell: ({ row }) => <p className="max-w-[320px] text-sm leading-6 text-zinc-400">{row.original.description}</p>,
  },
  {
    accessorKey: "type",
    header: "סוג",
    cell: ({ row }) => (
      <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-200 capitalize">
        {row.original.type === "recurring" ? "חוזר" : "חד־פעמי"}
      </Badge>
    ),
  },
  {
    accessorKey: "source",
    header: "מקור",
    cell: ({ row }) => (
      <Badge variant="outline" className={badgeTone(row.original.source)}>
        {row.original.source === "manual"
          ? "ידני"
          : row.original.source === "auto"
            ? "אוטומטי"
            : row.original.source === "email-imported"
              ? "יובא ממייל"
              : "חולץ ב־AI"}
      </Badge>
    ),
  },
  {
    accessorKey: "confidence",
    header: "אמינות",
    cell: ({ row }) => <span className="text-sm text-zinc-300">{Math.round(row.original.confidence * 100)}%</span>,
  },
  {
    accessorKey: "amount",
    header: "סכום",
    cell: ({ row }) => <span className="font-medium text-emerald-200">{formatCurrencyUsd(row.original.amount)}</span>,
  },
];

export function TransactionsTable({ data }: { data: EnrichedTransaction[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ confidence: false });

  const deferredSearch = useDeferredValue(globalFilter);
  const filteredData = data.filter((transaction) => {
    const searchTarget = `${transaction.tool} ${transaction.description} ${transaction.category}`.toLowerCase();
    const matchesSearch = searchTarget.includes(deferredSearch.toLowerCase());
    const matchesSource = sourceFilter === "all" || transaction.source === sourceFilter;
    const matchesType = typeFilter === "all" || transaction.type === typeFilter;
    return matchesSearch && matchesSource && matchesType;
  });

  // TanStack Table is intentionally stateful here; this warning is expected for this integration.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter: deferredSearch, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function exportCsv() {
    const rows = table.getSortedRowModel().rows.map((row) => row.original);
    const csv = [
      ["date", "tool", "description", "type", "source", "confidence", "amount"].join(","),
      ...rows.map((row) =>
        [
          row.date,
          `"${row.tool}"`,
          `"${row.description.replaceAll('"', '""')}"`,
          row.type,
          row.source,
          Math.round(row.confidence * 100),
          row.amount.toFixed(2),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transactions-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="חפש לפי ספק, תיאור או קטגוריה"
              className="h-11 border-white/10 bg-white/[0.04] pr-9 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-11 w-full border-white/10 bg-white/[0.04] text-zinc-100 sm:w-[180px]">
              <SelectValue placeholder="מקור" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המקורות</SelectItem>
              <SelectItem value="manual">ידני</SelectItem>
              <SelectItem value="auto">אוטומטי</SelectItem>
              <SelectItem value="email-imported">יובא ממייל</SelectItem>
              <SelectItem value="ai-extracted">חולץ ב־AI</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-11 w-full border-white/10 bg-white/[0.04] text-zinc-100 sm:w-[180px]">
              <SelectValue placeholder="סוג" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל החיובים</SelectItem>
              <SelectItem value="recurring">חוזר</SelectItem>
              <SelectItem value="one-time">חד־פעמי</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]">
                <SlidersHorizontal className="size-4" />
                עמודות
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-white/10 bg-[#111418] text-zinc-100">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                    className="capitalize"
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={exportCsv} className="bg-emerald-500 text-black hover:bg-emerald-400">
            <Download className="size-4" />
            ייצוא CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-white/6 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-14 text-zinc-500">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-white/6 hover:bg-white/[0.025]">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="border-white/6">
                <TableCell colSpan={columns.length} className="h-24 text-center text-zinc-500">
                  אין עסקאות שתואמות את הסינון הנוכחי.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 rounded-[24px] border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <p>
          מוצגות {table.getRowModel().rows.length} מתוך {filteredData.length} שורות מסוננות
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-white/10 bg-transparent text-zinc-100 hover:bg-white/[0.08]"
          >
            הקודם
          </Button>
          <span className="px-2 text-zinc-500">
            עמוד {table.getState().pagination.pageIndex + 1} מתוך {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-white/10 bg-transparent text-zinc-100 hover:bg-white/[0.08]"
          >
            הבא
          </Button>
        </div>
      </div>
    </div>
  );
}
