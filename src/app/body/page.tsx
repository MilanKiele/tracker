import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { BodyPage } from "@/components/real-pages";
import { getBodyData } from "@/lib/data";

export const instant = false;
export default async function Page() {
  const data = await getBodyData();
  if (data.context.status === "setup") return <SetupRequired />;
  return <AppShell profile={data.context.profile} email={data.context.user?.email}><BodyPage data={data} /></AppShell>;
}
