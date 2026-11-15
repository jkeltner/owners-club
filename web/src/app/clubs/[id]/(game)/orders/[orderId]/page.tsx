// The pick is in. The first one earns Shareholder; every one sets up the
// reason to come back: the company's next earnings report.
import Link from "next/link";
import { notFound } from "next/navigation";
import { closeHasPassed, fillDay } from "@/game/ledger";
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
  const locked = waiting && closeHasPassed(order.placedAt);
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  if (order.side === "sell") {
    const gain = (order.gainShort ?? 0) + (order.gainLong ?? 0);
    const back = (order.filledAmount ?? 0) - (order.fee ?? 0) - (order.tax ?? 0);
    return (
      <Page className="done-screen">
        <Card>
          <p className="eyebrow">
            {order.status === "filled" ? "Sold" : order.status === "cancelled" ? "Sell cancelled" : order.status === "rejected" ? "Sell didn't go through" : "Selling"}
          </p>
          <h1>
            {order.status === "filled" ? `${usd(order.filledAmount ?? 0, true)} of ${name}` : `About ${usd(order.amount)} of ${name}`}
          </h1>
          {order.status === "filled" && order.fillDate && (
            <>
              <dl className="fill-lines">
                <div>
                  <dt>
                    Sold {(order.shares ?? 0).toFixed(3)} shares at {usd(order.fillPrice ?? 0, true)}
                  </dt>
                  <dd>{usd(order.filledAmount ?? 0, true)}</dd>
                </div>
                <div>
                  <dt>Fee</dt>
                  <dd>−{usd(order.fee ?? 0, true)}</dd>
                </div>
                <div>
                  <dt>
                    {(order.tax ?? 0) > 0
                      ? `Tax on the ${usd(gain, true)} these shares gained`
                      : (order.tax ?? 0) < 0
                        ? `Tax back, because these shares lost ${usd(-gain, true)} and you'd paid tax on gains before`
                        : gain > 0
                          ? `No tax: your earlier losses covered the ${usd(gain, true)} gain`
                          : gain < 0
                            ? `No tax: these shares lost ${usd(-gain, true)}, which will lower the tax on later gains`
                            : "No tax: these shares hadn't gained"}
                  </dt>
                  <dd>
                    {(order.tax ?? 0) > 0 ? "−" : (order.tax ?? 0) < 0 ? "+" : ""}
                    {usd(Math.abs(order.tax ?? 0), true)}
                  </dd>
                </div>
                <div className="fill-total">
                  <dt>Went back into your S&amp;P 500 index fund</dt>
                  <dd>{usd(back, true)}</dd>
                </div>
              </dl>
              <p className="muted small">Sold at the close on {day(order.fillDate)}.</p>
            </>
          )}
          {order.note && <p className="notice">{order.note}</p>}
          {order.status === "waiting" && (
            <p className="muted">
              {locked
                ? "The market has closed on this order. It goes through overnight, at that closing price."
                : `Your sell goes through at the market close on ${day(fillDay(order.placedAt))} (4 pm in New York), or the next day the market is open. You're selling ${(order.askedShares ?? 0).toFixed(3)} shares at whatever the price is then, so the dollars will be a little different. Until then you still own them, and you can still cancel.`}
            </p>
          )}
          {order.status === "cancelled" && <p className="muted">You cancelled this before the market closed, so nothing was sold. You still own the shares, and there was no fee or tax.</p>}
          {order.status === "rejected" && <p className="muted">Nothing was sold, so you still own what you had, and there was no fee or tax.</p>}
        </Card>
        <Link className="btn btn-primary" href={clubPath(id, "/portfolio")}>
          Back to your portfolio
        </Link>
        {waiting && !locked && <CancelForm clubId={id} orderId={order.id} amount={usd(order.amount)} name={name} selling />}
      </Page>
    );
  }

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
          Your thesis · {order.status === "filled" ? order.ticker : `${usd(order.amount)} of ${order.ticker}`}
        </p>
        {thesis && <p className="quote">&ldquo;{thesisText(thesis)}&rdquo;</p>}
        {thesis && metric && (
          <div className="prediction-pill">
            🎯 {metric.label}: {fmtPrediction(thesis.predictionUnit, thesis.predictionValue)} or more
          </div>
        )}
        {order.status === "filled" && order.filledAmount != null && order.fillDate && (
          <dl className="fill-lines">
            <div>
              <dt>Moved out of your index fund</dt>
              <dd>{usd(order.filledAmount, true)}</dd>
            </div>
            <div>
              <dt>Fee</dt>
              <dd>−{usd(order.fee ?? 0, true)}</dd>
            </div>
            {order.tax != null && order.tax !== 0 && (
              <div>
                <dt>{order.tax > 0 ? "Tax on what your index money had gained" : "Tax back, because your index money had lost value"}</dt>
                <dd>
                  {order.tax > 0 ? "−" : "+"}
                  {usd(Math.abs(order.tax), true)}
                </dd>
              </div>
            )}
            <div className="fill-total">
              <dt>
                Went into {name}: {(order.shares ?? 0).toFixed(3)} shares at {usd(order.fillPrice ?? 0, true)}
              </dt>
              <dd>{usd(order.filledAmount - (order.fee ?? 0) - (order.tax ?? 0), true)}</dd>
            </div>
          </dl>
        )}
        {order.note && <p className="notice">{order.note}</p>}
        <p className="muted small">
          {waiting
            ? locked
              ? "The market has closed on this order. It goes through overnight, at that closing price."
              : `Your buy goes through at the market close on ${day(fillDay(order.placedAt))} (4 pm in New York), or the next day the market is open. Until then the money stays in your index fund, and you can still cancel.`
            : order.status === "filled"
              ? `Bought at the close on ${day(order.fillDate!)}.`
              : "This order didn't go through. The money is still in your index fund, and your thesis is saved as a draft."}{" "}
          {order.status !== "rejected" && "Your clubmates can read your thesis when they go to make a pick."}
        </p>
      </Card>

      <Link className="btn btn-primary" href={clubPath(id, "/portfolio")}>
        See your portfolio
      </Link>
      <Link className="btn btn-ghost" href={clubPath(id, "/pick")}>
        Make another pick
      </Link>
      {waiting && !locked && <CancelForm clubId={id} orderId={order.id} amount={usd(order.amount)} name={name} />}
    </Page>
  );
}
