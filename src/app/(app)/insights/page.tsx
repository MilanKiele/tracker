import { InsightsPage } from "@/components/real-pages";
import { getInsightsData } from "@/lib/data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const data = await getInsightsData(from, to);
  return <InsightsPage data={data} />;
}
