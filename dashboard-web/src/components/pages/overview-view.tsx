import { getDashboardModel } from "@/lib/dashboard-data";
import { OverviewViewClient } from "@/components/pages/overview-view-client";
import type { OverviewPageModel } from "@/components/pages/overview-view-client";

export function OverviewView() {
  const dashboardModel = getDashboardModel();
  const topVendors = dashboardModel.vendors.slice(0, 6);
  const recurringVendors = dashboardModel.vendors.filter((vendor) => vendor.billingStatus === "active");
  const overviewVendors = [...new Map([...topVendors, ...recurringVendors].map((vendor) => [vendor.name, vendor])).values()];
  const model: OverviewPageModel = {
    raw: {
      current_month: dashboardModel.raw.current_month,
      generated: dashboardModel.raw.generated,
      exchange_rate_fetched_at: dashboardModel.raw.exchange_rate_fetched_at,
      exchange_rate_updated_at: dashboardModel.raw.exchange_rate_updated_at,
      exchange_rate_source: dashboardModel.raw.exchange_rate_source,
      usd_rate: dashboardModel.raw.usd_rate,
    },
    stats: dashboardModel.stats,
    settings: dashboardModel.settings,
    monthlySeries: dashboardModel.monthlySeries,
    recurringSeries: dashboardModel.recurringSeries,
    vendors: overviewVendors.map((vendor) => ({
      name: vendor.name,
      totalSpend: vendor.totalSpend,
      lastChargeDate: vendor.lastChargeDate,
      expectedAmount: vendor.expectedAmount,
      nextExpectedDate: vendor.nextExpectedDate,
      billingStatus: vendor.billingStatus,
      source: vendor.source,
      category: vendor.category,
      chargeCount: vendor.chargeCount,
    })),
    needsReview: dashboardModel.needsReview,
    auditLog: dashboardModel.auditLog,
    currentMonthTransactions: dashboardModel.transactions
      .filter((transaction) => transaction.monthKey === dashboardModel.raw.current_month)
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        tool: transaction.tool,
        amountIls: transaction.amountIls,
        description: transaction.description,
      })),
  };

  return <OverviewViewClient model={model} />;
}
