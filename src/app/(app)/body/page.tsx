import { BodyPage } from "@/components/real-pages";
import { getBodyData } from "@/lib/data";

export default async function Page() {
  const data = await getBodyData();
  return <BodyPage data={data} />;
}
