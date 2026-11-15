"use client";
// Taking a waiting order back. Two taps, so it can't happen by accident; the
// server checks again that the order is still waiting and belongs to the player.
import { useActionState, useState } from "react";
import { cancelWaitingOrder, type FormState } from "../../actions";

export function CancelForm({ clubId, orderId, amount, name, selling = false }: { clubId: string; orderId: string; amount: string; name: string; selling?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(cancelWaitingOrder, {});
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setAsking(true)}>
        Cancel this order
      </button>
    );
  }
  return (
    <form action={action} className="card">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="orderId" value={orderId} />
      <p>
        <b>Cancel your {name} order?</b>{" "}
        {selling
          ? "You keep the shares and there's no fee or tax, because nothing was sold."
          : `The ${amount} stays in your index fund and there's no fee, because nothing was bought. Your thesis is kept as a draft.`}
      </p>
      {state.problem && <p className="notice">{state.problem}</p>}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Cancelling…" : "Yes, cancel it"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)}>
        Keep the order
      </button>
    </form>
  );
}
