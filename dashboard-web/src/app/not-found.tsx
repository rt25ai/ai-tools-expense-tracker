import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = {
  title: "העמוד לא נמצא | מעקב הוצאות כלי AI",
};

export default function NotFound() {
  return (
    <div className="flex min-h-[68vh] items-center justify-center">
      <Card className="w-full max-w-2xl border-white/8 bg-white/[0.03] p-8 text-right shadow-none">
        <p className="text-[11px] tracking-[0.18em] text-zinc-500">404</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">העמוד שחיפשת לא נמצא</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
          ייתכן שהקישור השתנה, שהעמוד הוסר, או שהכתובת הוזנה בצורה לא מלאה. אפשר לחזור למסך הראשי ולהמשיך
          משם.
        </p>
        <div className="mt-8">
          <Button asChild className="bg-emerald-500 text-black hover:bg-emerald-400">
            <Link href="/">
              חזרה למסך הראשי
              <ArrowUpLeft className="size-4" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
