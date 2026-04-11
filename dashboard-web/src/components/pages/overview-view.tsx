import { getDashboardModel } from "@/lib/dashboard-data";
import { OverviewViewClient } from "@/components/pages/overview-view-client";

export function OverviewView() {
  return <OverviewViewClient model={getDashboardModel()} />;
}
