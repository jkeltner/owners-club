import Link from "next/link";
import { TERMS_VERSION } from "@/clubs/clubs";

export const metadata = { title: "Terms · Owners Club" };

export default function Terms() {
  return (
    <main className="status prose">
      <h1>Terms</h1>
      <p className="sub">Version {TERMS_VERSION}. Written to be read.</p>

      <h2>What Owners Club is</h2>
      <p>Owners Club is a game for learning how businesses and stocks work. You play in a private club with people you know.</p>

      <h2>The money is pretend</h2>
      <p>
        Every dollar, trade, fee, tax and return in the game is made up. Nothing here buys or sells a real stock, nothing can be cashed out, and there are no prizes
        of value.
      </p>

      <h2>The coach is an AI, and this isn&apos;t financial advice</h2>
      <p>
        The coach, the weekly recap and some explanations are written by an AI model, not a person. The coach asks questions and shows numbers; it is built never
        to tell you what to buy or sell. AI can be wrong. Nothing in the game is financial, investment or tax advice, and it shouldn&apos;t be used to make decisions
        with real money.
      </p>

      <h2>The numbers</h2>
      <p>
        Company numbers come from public filings and market data providers and are updated once a day. We work to keep them right, but they can be late, incomplete
        or wrong.
      </p>

      <h2>Who can play</h2>
      <p>
        You must be 13 or older. If we learn that an account belongs to someone under 13, we remove the account and its data. If you know of one, tell the club&apos;s
        organizer or us.
      </p>

      <h2>How to behave</h2>
      <p>
        Clubs are for friends, classes and families. Don&apos;t post anything hateful, harassing or private about someone else, don&apos;t try to get into a club you
        weren&apos;t invited to, and don&apos;t try to break the service. A club&apos;s organizers can see what the club&apos;s players do in the game, and we can remove
        accounts that break these rules.
      </p>

      <h2>What you write</h2>
      <p>
        Your theses and comments stay yours. You let us store them and show them to your club so the game can work. Your conversations with the coach are private
        to you; see the <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>No promises</h2>
      <p>
        Owners Club is an early, free project offered as it is, with no warranty. It may change, pause or end, and game history may be reset during testing. To the
        extent the law allows, we aren&apos;t liable for losses that come from using it.
      </p>

      <h2>Open source</h2>
      <p>The code is public under the MIT license. Someone else running their own copy is responsible for that copy.</p>

      <h2>Changes</h2>
      <p>If these terms change in a way that matters, you&apos;ll be asked to agree again the next time you sign in.</p>
    </main>
  );
}
