import Link from "next/link";
import { NewReceiptFlow } from "@/components/new-receipt-flow";

export default function NewReceiptPage() {
  return <main className="shell"><Link href="/" className="back">← Back</Link><h1>Add receipt</h1><NewReceiptFlow/></main>;
}
