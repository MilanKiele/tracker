import { AccountPage } from "@/components/real-pages";
import { getAccountData } from "@/lib/data";

export default async function Page() {
  const data = await getAccountData();
  return <AccountPage data={data} />;
}
