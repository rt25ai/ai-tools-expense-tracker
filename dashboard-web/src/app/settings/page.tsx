import { PageHeader } from "@/components/page-header";
import { SettingsPageClient } from "@/components/settings-page-client";
import { getDashboardModel } from "@/lib/dashboard-data";

export default function SettingsPage() {
  const model = getDashboardModel();

  return (
    <>
      <PageHeader
        eyebrow="הגדרות"
        title="הגדרות הפרויקט"
      />
      <SettingsPageClient initialSettings={model.settings} />
    </>
  );
}
