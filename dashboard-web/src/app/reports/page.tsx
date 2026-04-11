import { ReportsPageClient } from "@/components/pages/reports-page-client";
import { getMonthReports, getReportYears, getYearReport, type ReportYear } from "@/lib/dashboard-data";

export default function ReportsPage() {
  const months = getMonthReports();
  const yearReports = getReportYears()
    .map((year) => getYearReport(year))
    .filter((report): report is ReportYear => report !== null);

  return <ReportsPageClient months={months} yearReports={yearReports} />;
}
