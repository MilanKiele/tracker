import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { InsightsPage } from "@/components/real-pages";
import { getInsightsData } from "@/lib/data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const data = await getInsightsData(from, to);
  if (data.context.status === "setup") return <SetupRequired />;
  return (
    <AppShell profile={data.context.profile} email={data.context.user?.email}>
      <InsightsPage data={data} />
    </AppShell>
  );
}
