import { PageHeader } from "@/components/page-header";
import { SettingsPageClient } from "@/components/settings-page-client";
import { getDashboardModel } from "@/lib/dashboard-data";

export default function SettingsPage() {
  const model = getDashboardModel();

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Project settings"
        description="A proper settings surface with fixed rows, two-column label/control layout, and one clear action per section. This is the shell we can extend once we wire in more automation."
      />
      <SettingsPageClient initialSettings={model.settings} />
    </>
  );
}
