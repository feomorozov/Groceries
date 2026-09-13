import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateReceipt, allocateWeighted, calculateBalances } from "../src/lib/money";
import type { ReceiptInput, RoommateId } from "../src/lib/types";

const ids = ["michael", "kevin", "feo", "saketh"] as RoommateId[];
function receipt(id: string, payerId: RoommateId, itemData: Array<[number, RoommateId[]]>, extras: Partial<ReceiptInput> = {}): ReceiptInput {
  const sum = itemData.reduce((n,[c]) => n+c,0);
  return { id, merchant:"Store", purchasedAt:"2026-09-12", payerId, subtotalCents:sum, taxCents:0, adjustmentCents:0, totalCents:sum, imageId:null,
    items:itemData.map(([lineTotalCents,roommateIds],i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,description:`Item ${i}`,quantity:null,unitPriceCents:null,lineTotalCents,roommateIds})), ...extras };
}
test("single person owns the full item", () => assert.deepEqual(allocateReceipt(receipt("a","michael",[[1200,["feo"]]])).portions, {michael:0,kevin:0,feo:1200,saketh:0}));
test("two people split equally", () => assert.deepEqual(allocateWeighted(1200,[1,1]),[600,600]));
test("three people receive a deterministic remainder cent", () => assert.deepEqual(allocateWeighted(1000,[1,1,1]),[334,333,333]));
test("four people split equally", () => assert.deepEqual(allocateWeighted(1200,[1,1,1,1]),[300,300,300,300]));
test("payer included creates no self-debt", () => { const b=calculateBalances([receipt("a","michael",[[1000,["michael","kevin"]]])]); assert.equal(b.find(x=>x.first==="michael"&&x.second==="kevin")?.cents,500); });
test("payer excluded owes the full portion", () => { const b=calculateBalances([receipt("a","michael",[[1000,["kevin"]]])]); assert.deepEqual(b.find(x=>x.first==="michael"&&x.second==="kevin"),{first:"michael",second:"kevin",debtor:"kevin",creditor:"michael",cents:1000}); });
test("reciprocal obligations net across multiple receipts", () => { const b=calculateBalances([receipt("a","kevin",[[4000,["michael"]]]),receipt("b","michael",[[1700,["kevin"]]])]); assert.deepEqual(b[0],{first:"michael",second:"kevin",debtor:"michael",creditor:"kevin",cents:2300}); });
test("all six pairs are represented", () => assert.equal(calculateBalances([receipt("a","michael",[[10,ids]])]).length,6));
test("tax and adjustment are allocated by positive item value", () => { const r=receipt("a","michael",[[300,["kevin"]],[700,["feo"]]],{taxCents:101,adjustmentCents:-1,totalCents:1100}); const a=allocateReceipt(r); assert.deepEqual(a.items.map(x=>x.adjustmentCents),[30,70]); assert.deepEqual(a.portions,{michael:0,kevin:330,feo:770,saketh:0}); });
test("allocations always reconcile with discounts and negative lines", () => { const r=receipt("a","michael",[[1000,["michael","kevin","feo"]],[-100,["michael","kevin","feo"]]],{taxCents:73,adjustmentCents:-23,totalCents:950}); const a=allocateReceipt(r); assert.equal(Object.values(a.portions).reduce((n,c)=>n+c,0),950); });
test("editing a receipt changes derived balances", () => { const old=calculateBalances([receipt("a","michael",[[1000,["kevin"]]])])[0]; const edited=calculateBalances([receipt("a","michael",[[400,["kevin"]]])])[0]; assert.equal(old.cents,1000); assert.equal(edited.cents,400); });
test("deleting a receipt removes it from derived balances", () => { const before=calculateBalances([receipt("a","michael",[[1000,["kevin"]]])])[0]; const after=calculateBalances([])[0]; assert.equal(before.cents,1000); assert.equal(after.cents,0); });
test("unreconciled receipts are rejected", () => assert.throws(()=>allocateReceipt(receipt("a","michael",[[100,["kevin"]]],{totalCents:101})),/Reconcile/));
