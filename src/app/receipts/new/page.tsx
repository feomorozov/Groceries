import Link from "next/link";
import { redirect } from "next/navigation";
import { NewReceiptFlow } from "@/components/new-receipt-flow";
import { SiteHeader } from "@/components/site-header";
import { getAppMember } from "@/lib/auth";
export default async function NewReceiptPage() {
  const auth = await getAppMember();
  if (!auth.user) redirect("/login"); if (!auth.member) redirect("/not-allowed");
  return <main className="shell"><SiteHeader email={auth.user.email}/><Link href="/" className="back">← Back</Link><h1>Add receipt</h1><NewReceiptFlow/></main>;
}
