// The club's game rules as form fields, in the units people say them in.
import type { GameSettings } from "@/lib/rules";

const pct = (n: number) => String(Math.round(n * 10000) / 100);

export function SettingsFields({ settings }: { settings: GameSettings }) {
  return (
    <div className="settings-grid">
      <label className="field">
        Minimum hold (days)
        <input type="number" name="minHoldDays" min={0} max={365} step={1} defaultValue={settings.minHoldDays} />
        <small>How long a pick must be kept before it can be sold. The usual game is 91 days (3 months).</small>
      </label>
      <label className="field">
        Biggest single purchase (%)
        <input type="number" name="capAtPurchase" min={5} max={100} step={1} defaultValue={pct(settings.capAtPurchase)} />
        <small>The most of a portfolio one purchase can put into one company. Usual: 25%.</small>
      </label>
      <label className="field">
        Fee per trade (%)
        <input type="number" name="feeRate" min={0} max={5} step={0.05} defaultValue={pct(settings.feeRate)} />
        <small>Usual: 0.5% of each trade.</small>
      </label>
      <label className="field">
        Tax on gains held under 6 months (%)
        <input type="number" name="shortTermTaxRate" min={0} max={90} step={1} defaultValue={pct(settings.shortTermTaxRate)} />
        <small>Usual: 40%.</small>
      </label>
      <label className="field">
        Tax on gains held 6 months or more (%)
        <input type="number" name="longTermTaxRate" min={0} max={90} step={1} defaultValue={pct(settings.longTermTaxRate)} />
        <small>Usual: 20%.</small>
      </label>
    </div>
  );
}
