import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { TodayPage } from "@/components/real-pages";
import { getTodayData } from "@/lib/data";

export default async function Home({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const data = await getTodayData(date);
  if (data.context.status === "setup") return <SetupRequired />;
  return <AppShell profile={data.context.profile} email={data.context.user?.email}><TodayPage data={data} /></AppShell>;
}
export const instant = false;
