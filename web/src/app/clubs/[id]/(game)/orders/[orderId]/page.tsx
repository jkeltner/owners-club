// The pick is in. The first one earns Shareholder; every one sets up the
// reason to come back: the company's next earnings report.
import Link from "next/link";
import { notFound } from "next/navigation";
import { orderOf, thesisText } from "@/game/picks";
import { fmtPrediction, metricById } from "@/game/thesis_text";
import { usd } from "@/lib/format";
import { RANKS } from "@/lib/ranks";
import { displayName } from "@/market/names";
import { companyView } from "@/market/read";
import { clubPath, companyPath, requirePlayer } from "../../_lib/player";
import { Card, Page } from "../../_ui/ui";
import { CancelForm } from "./cancel_form";

export const dynamic = "force-dynamic";

export default async function Done({ params, searchParams }: { params: Promise<{ id: string; orderId: string }>; searchParams: Promise<{ first?: string }> }) {
  const { id, orderId } = await params;
  const { first } = await searchParams;
  const { membership } = await requirePlayer(id, clubPath(id, `/orders/${orderId}`));
  const found = await orderOf(orderId, membership.id);
  if (!found) notFound();
  const { order, thesis } = found;
  const c = await companyView(order.ticker);
  const name = c?.name ?? displayName(order.ticker, order.ticker);
  const earned = first === "1";
  const metric = thesis ? metricById(thesis.predictionMetric) : undefined;
  const waiting = order.status === "waiting";

  if (order.status === "cancelled") {
    return (
      <Page className="done-screen">
        <Card>
          <p className="eyebrow">Order cancelled</p>
          <h1>
            {usd(order.amount)} of {name}
          </h1>
          <p className="muted">
            You cancelled this order before the market closed, so nothing was bought. The money never left your index fund and there was no fee. Your thesis is saved as a
            draft if you want to come back to it.
          </p>
        </Card>
        <Link className="btn btn-primary" href={clubPath(id)}>
          Back to the club
        </Link>
        <Link className="btn btn-ghost" href={companyPath(id, order.ticker)}>
          Look at {name} again
        </Link>
      </Page>
    );
  }

  return (
    <Page className="done-screen">
      <div className="rank-reveal">
        <div className="rank-badge">
          <span className="rank-icon">{earned ? RANKS[0].icon : "✅"}</span>
        </div>
        <p className="eyebrow">{earned ? "Rank earned" : "Your pick"}</p>
        <h1 className="rank-name">{earned ? RANKS[0].name : `${name}, in.`}</h1>
        <p className="muted">
          {earned
            ? `You made a pick with a real reason. Next up: ${RANKS[1].name}.`
            : "Picks don't change your rank; using what you learn in your theses does."}
        </p>
      </div>

      {c?.earnings ? (
        <Card className="countdown">
          <div className="countdown-days">{Math.max(0, c.earnings.daysAway)}</div>
          <div>
            <b>
              {name} reports in {c.earnings.daysAway === 1 ? "1 day" : `${Math.max(0, c.earnings.daysAway)} days`}
              {c.earnings.status === "estimated" ? ", give or take" : ""}.
            </b>
            <p>We&apos;ll see if you were right.</p>
          </div>
        </Card>
      ) : (
        <Card className="countdown">
          <div className="countdown-days">📅</div>
          <div>
            <b>{name} reports its results every 3 months.</b>
            <p>We&apos;ll check your prediction at the next one.</p>
          </div>
        </Card>
      )}

      <Card className="my-thesis">
        <p className="eyebrow">
          Your thesis · {usd(order.amount)} of {order.ticker}
        </p>
        {thesis && <p className="quote">&ldquo;{thesisText(thesis)}&rdquo;</p>}
        {thesis && metric && (
          <div className="prediction-pill">
            🎯 {metric.label}: {fmtPrediction(thesis.predictionUnit, thesis.predictionValue)} or more
          </div>
        )}
        <p className="muted small">
          {waiting
            ? "Your buy goes through the next time the market closes (4 pm in New York, Monday to Friday). Until then the money stays in your index fund."
            : order.status === "filled"
              ? `Bought on ${order.fillDate}${order.fillPrice != null ? ` at ${usd(order.fillPrice, true)} a share` : ""}.`
              : "This order didn't go through."}{" "}
          Your clubmates can read your thesis when they go to make a pick.
        </p>
      </Card>

      <Link className="btn btn-primary" href={clubPath(id)}>
        Back to the club
      </Link>
      <Link className="btn btn-ghost" href={clubPath(id, "/pick")}>
        Make another pick
      </Link>
      {waiting && <CancelForm clubId={id} orderId={order.id} amount={usd(order.amount)} name={name} />}
    </Page>
  );
}
