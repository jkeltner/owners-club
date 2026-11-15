// The game screens: the phone-width column, the prototype's look, and the
// book of plain explanations every tappable term opens.
import { Bricolage_Grotesque } from "next/font/google";
import type { ReactNode } from "react";
import { TermsProvider } from "./_ui/terms";
import { termBook } from "./_ui/terms_data";
import "./game.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display", display: "swap" });

export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`game ${display.variable}`}>
      <div className="app">
        <TermsProvider book={termBook()}>{children}</TermsProvider>
      </div>
    </div>
  );
}
