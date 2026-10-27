import { NutritionPage } from "@/components/real-pages";
import { getNutritionData } from "@/lib/data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const data = await getNutritionData(date);
  return <NutritionPage data={data} />;
}
