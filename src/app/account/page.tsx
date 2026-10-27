import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { AccountPage } from "@/components/real-pages";
import { getAccountData } from "@/lib/data";

export default async function Page() {
  const data = await getAccountData();
  if (data.context.status === "setup") return <SetupRequired />;
  return <AppShell profile={data.context.profile} email={data.context.user?.email}><AccountPage data={data} /></AppShell>;
}
export const instant = false;
