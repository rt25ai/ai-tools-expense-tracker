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
        description="מסך הגדרות מסודר עם שורות קבועות, פריסת שני טורים ופעולה מרכזית אחת לכל אזור. זו התשתית שאפשר להרחיב עם עוד אוטומציות."
      />
      <SettingsPageClient initialSettings={model.settings} />
    </>
  );
}
