import { formatMoney } from "@/lib/money";
import { ALL_IDS, nameOf, type PairBalance, type RoommateId } from "@/lib/types";

function Pair({ balance }: { balance: PairBalance }) {
  if (!balance.debtor) return <div className="pair-value zero"><strong>$0.00</strong><span>Settled</span></div>;
  return <div className="pair-value"><strong>{formatMoney(balance.cents)}</strong><span>{nameOf(balance.debtor)} <b aria-hidden="true">→</b> {nameOf(balance.creditor!)}</span></div>;
}
export function Balances({ balances }: { balances: PairBalance[] }) {
  const get = (a: RoommateId, b: RoommateId) => balances.find((p) => p.first === a && p.second === b)!;
  return <>
    <div className="pair-table" aria-label="Pairwise balances">
      <div className="corner" />{ALL_IDS.slice(1).map((id) => <div className="colhead" key={id}>{nameOf(id)}</div>)}
      <div className="rowhead">Michael</div>{ALL_IDS.slice(1).map((id) => <Pair key={id} balance={get("michael", id)} />)}
      <div className="rowhead">Kevin</div><div className="blank" aria-hidden="true" /><Pair balance={get("kevin", "feo")} /><Pair balance={get("kevin", "saketh")} />
      <div className="rowhead">Feo</div><div className="blank" aria-hidden="true" /><div className="blank" aria-hidden="true" /><Pair balance={get("feo", "saketh")} />
    </div>
    <div className="mobile-pairs" aria-label="Pairwise balances">
      {balances.map((p) => <div className="mobile-pair" key={`${p.first}-${p.second}`}>
        <span>{p.debtor ? <>{nameOf(p.debtor)} <b aria-hidden="true">→</b> {nameOf(p.creditor!)}</> : <>{nameOf(p.first)} · {nameOf(p.second)}</>}</span>
        <strong>{formatMoney(p.cents)}</strong>
      </div>)}
    </div>
  </>;
}
