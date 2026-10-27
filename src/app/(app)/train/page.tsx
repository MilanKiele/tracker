import { TrainPage } from "@/components/real-pages";
import { getTrainingData } from "@/lib/data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; plan?: string }>;
}) {
  const { session, plan } = await searchParams;
  const data = await getTrainingData();
  return (
    <TrainPage
      key={`${session || ""}:${plan || ""}`}
      data={{ ...data, openSessionId: session, openPlanId: plan }}
    />
  );
}
