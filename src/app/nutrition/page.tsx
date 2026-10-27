import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { NutritionPage } from "@/components/real-pages";
import { getNutritionData } from "@/lib/data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const data = await getNutritionData(date);
  if (data.context.status === "setup") return <SetupRequired />;
  return (
    <AppShell profile={data.context.profile} email={data.context.user?.email}>
      <NutritionPage data={data} />
    </AppShell>
  );
}
export const instant = false;
