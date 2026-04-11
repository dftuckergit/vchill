import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="w-full max-w-3xl text-center">
        <h1 className="text-[32px] leading-[1.0] font-black text-[#163a59]">
          Welcome to the 13th V Chill Playoff Pool
        </h1>

        <h2 className="mt-10 text-[24px] leading-[1.2] font-black text-[#163a59]">
          🏒 How to play? 🏒
        </h2>
        <p className="mt-3 text-[16px] leading-[1.2] text-zinc-800">
          It&apos;s the most casual NHL playoff pool there is. Each round you
          pick a 12-player roster.
          <br />
          When those players score in the playoffs, you score.
          <br />
          Top scores from each round win $100 and the overall winner pockets the
          rest.
        </p>

        <h2 className="mt-10 text-[24px] leading-[1.2] font-black text-[#163a59]">
          💸 Get in 💸
        </h2>
        <p className="mt-3 text-[16px] leading-[1.2] text-zinc-800">
          Send $40 CAD or €25 to dftucker@gmail.com — please pay by Friday,
          April 18.
          <br />
          <br />
          Next, we&apos;ll email you a pick code. Enter it on the{" "}
          <Link
            className="font-semibold text-[#163a59] underline hover:opacity-80"
            href="/make-picks"
          >
            Make picks
          </Link>{" "}
          page on this site.
          <br />
          Lock in your roster. Round deadlines will show on your pick page once
          you&apos;re there.
        </p>

        <h2 className="mt-10 text-[24px] leading-[1.2] font-black text-[#163a59]">
          🗣 The more, the chiller 🗣
        </h2>
        <p className="mt-3 text-[16px] leading-[1.2] text-zinc-800">
          Know a degenerate who loves hockey? Tell them to join!
        </p>
      </div>
    </main>
  );
}
