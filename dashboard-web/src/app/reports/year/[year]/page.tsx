import { notFound } from "next/navigation";
import { YearReportPageClient } from "@/components/pages/year-report-page-client";
import { getReportYears, getYearReport } from "@/lib/dashboard-data";
import { formatMonthLabel } from "@/lib/formatters";
import { monthReportHref } from "@/lib/report-links";

export const dynamicParams = false;

export function generateStaticParams() {
  return getReportYears().map((year) => ({ year }));
}

export default async function YearReportPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const report = getYearReport(year);

  if (!report) {
    notFound();
  }

  const allTransactions = report.months.flatMap((month) => month.transactions);
  const vendorChargeBreakdown = report.topVendors.map((vendor) => ({
    ...vendor,
    charges: allTransactions
      .filter((transaction) => transaction.tool === vendor.name)
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        amountIls: transaction.amountIls,
        description: transaction.description,
        monthKey: transaction.monthKey,
        monthLabel: formatMonthLabel(transaction.monthKey),
        monthHref: monthReportHref(transaction.monthKey),
      })),
  }));

  return <YearReportPageClient report={report} vendorChargeBreakdown={vendorChargeBreakdown} />;
}
