import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { TrainPage } from "@/components/real-pages";
import { getTrainingData } from "@/lib/data";

export default async function Page() {
  const data = await getTrainingData();
  if (data.context.status === "setup") return <SetupRequired />;
  return <AppShell profile={data.context.profile} email={data.context.user?.email}><TrainPage data={data} /></AppShell>;
}
export const instant = false;
