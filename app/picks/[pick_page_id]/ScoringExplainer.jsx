/** Static copy; kept as a Server Component and passed into PicksClient as children
 *  so Turbopack/HMR cannot desync SSR vs client markup for this block. */
export default function ScoringExplainer() {
  return (
    <div className="mt-8 text-center text-[16px] leading-[1.35] text-zinc-800 sm:mt-10">
      <p className="font-semibold text-[#163a59]">Scoring</p>
      <p className="mt-2">
        Forwards / Defence earn 1 point per goal / assist
      </p>
      <p className="mt-1.5">
        Goalies earn 2 points for a win and 1 bonus point for a shutout
      </p>
      <p className="mt-1.5">Star players earn double points for the round</p>
    </div>
  );
}
