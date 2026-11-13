import { TERMS_VERSION } from "@/clubs/clubs";

export const metadata = { title: "Privacy · Owners Club" };

export default function Privacy() {
  return (
    <main className="status prose">
      <h1>Privacy Policy</h1>
      <p className="sub">Version {TERMS_VERSION}. We keep as little as the game needs.</p>

      <h2>What we store</h2>
      <ul>
        <li>Your email address and, if you sign in with Google, the name and picture Google shares with us.</li>
        <li>The name and avatar you choose in each club, and your answer to &quot;how much do you know about stocks?&quot;</li>
        <li>What you do in the game: picks, trades, theses, predictions, comments, lesson progress.</li>
        <li>Your conversations with the AI coach.</li>
        <li>When you agreed to the Terms, and which version.</li>
        <li>Basic technical records needed to run the site, such as sign-in sessions and error logs.</li>
      </ul>
      <p>We don&apos;t ask for your birthdate, address, phone number or any payment details.</p>

      <h2>Who can see it</h2>
      <ul>
        <li>
          <b>Your club</b> sees your club name, avatar, theses, comments and results. Clubmates see your holdings as shares of your portfolio, a week late.
        </li>
        <li>
          <b>Your club&apos;s organizers</b> who don&apos;t play themselves can see every player&apos;s holdings, trades, theses, returns and progress as they happen.
        </li>
        <li>
          <b>Your coach conversations</b> are private to you. Organizers and clubmates can&apos;t read them.
        </li>
        <li>
          <b>The people who run Owners Club</b> can access the data to operate and fix the service.
        </li>
      </ul>
      <p>Nobody outside your club can see your club.</p>

      <h2>Who else handles it</h2>
      <p>
        We use a small number of companies to run the service: a web host, a database host, an email sender for sign-in codes, Google if you choose Google sign-in,
        and Anthropic, whose AI model powers the coach. What you write to the coach is sent to that model to produce its reply. We don&apos;t sell your data and we
        don&apos;t show ads.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Game data is kept while your club is active. Coach conversations are kept for the season and then deleted. You can ask us to delete your account and its
        data at any time.
      </p>

      <h2>Under 13</h2>
      <p>Owners Club is for people 13 and older. If we learn an account belongs to someone younger, we delete the account and its data.</p>

      <h2>Cookies</h2>
      <p>We use one cookie to keep you signed in. There is no advertising or cross-site tracking.</p>

      <h2>Questions</h2>
      <p>Ask your club&apos;s organizer, or open an issue on the project&apos;s public code repository.</p>
    </main>
  );
}
