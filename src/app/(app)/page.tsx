import { TodayPage } from "@/components/real-pages";
import { getTodayData } from "@/lib/data";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const data = await getTodayData(date);
  return <TodayPage data={data} />;
}
