import { notFound } from "next/navigation";
import { MonthReportPageClient } from "@/components/pages/month-report-page-client";
import { getMonthReport, getMonthReports } from "@/lib/dashboard-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return getMonthReports().map((month) => ({ monthKey: month.key }));
}

export default async function MonthReportPage({
  params,
}: {
  params: Promise<{ monthKey: string }>;
}) {
  const { monthKey } = await params;
  const report = getMonthReport(monthKey);

  if (!report) {
    notFound();
  }

  const vendorChargeBreakdown = report.topVendors.map((vendor) => ({
    ...vendor,
    charges: report.transactions
      .filter((transaction) => transaction.tool === vendor.name)
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        amountIls: transaction.amountIls,
        description: transaction.description,
      })),
  }));

  return <MonthReportPageClient report={report} vendorChargeBreakdown={vendorChargeBreakdown} />;
}
