import { PageHeader } from "@/components/page-header";
import { SettingsPageClient } from "@/components/settings-page-client";
import { getDashboardModel } from "@/lib/dashboard-data";

export default function SettingsPage() {
  const model = getDashboardModel();

  return (
    <>
      <PageHeader
        eyebrow="הגדרות"
        title="הגדרות פרויקט"
        description="משטח הגדרות תקני עם שורות קבועות, פריסת תווית/שליטה בשתי עמודות ופעולה אחת ברורה לכל סעיף. זוהי הקליפה שנוכל להרחיב ברגע שנחבר אוטומציות נוספות."
      />
      <SettingsPageClient initialSettings={model.settings} />
    </>
  );
}
