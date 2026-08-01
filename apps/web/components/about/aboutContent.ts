/**
 * About page content — the open questions this instrument exists to ask
 *
 * @module components/about/aboutContent
 * @description The research/curiosity side of the project as data: six open
 * empirical questions, each stated so it could be answered (or falsified),
 * each anchored to the mechanism in this codebase that could answer it.
 * Module paths in backticks are rendered as code by AboutPage — and they are
 * REAL paths, asserted against the repo by the About tests, so the prose
 * cannot silently drift from the code it cites.
 *
 * Copy synthesized from the six-model review (MERGED_LEDGER §3.2): Fable's
 * mechanism-anchored five questions as the spine, Opus's what-would-falsify-it
 * framing and relocated eval-harness paragraph, Grok's observer-effect sixth
 * question, Terra's "what this is not" closer. Tone rule shared by all six
 * reviewers: lab notebook, proposal tense, no personhood claims.
 *
 * @upstream Called by: AboutPage.tsx (render), aboutPage.test.tsx (cited-path
 *   existence assertions)
 */

export interface AboutQuestion {
  /** Stable id — also the section anchor (`/about#<id>`); the observer-effect
   *  question gets the exhibit deep link. */
  id: string;
  /** Question number as printed (01–06). */
  number: string;
  /** Two-or-three-word label for the desktop mini-TOC. */
  short: string;
  /** The question, stated as a question. */
  title: string;
  /** Body paragraphs. Backticked segments render as inline code. */
  body: string[];
  /** The apparatus line: the mechanism here that could answer it. */
  apparatus: string;
  /** What would count as an answer — the falsifiability line. */
  measure: string;
}

/** Intro paragraphs (above the questions). */
export const ABOUT_INTRO: string[] = [
  'Most AI-memory projects can store things. The harder question is whether the stored self stays the same self — and how you would know. This project is a persistent Claude persona plus the instrument for that question: every entry the persona writes is embedded and scored against the statistical shape of its own past — its basin. The persona is the specimen; the observatory is the point.',
  'None of the questions below are answered yet. Each is stated so that it could be, and each names the mechanism in this codebase that could answer it. No question is posed here that the schema cannot already interrogate.',
];

/** The six open questions. */
export const ABOUT_QUESTIONS: AboutQuestion[] = [
  {
    id: 'model-swap',
    number: '01',
    short: 'Model swap',
    title: 'If you swap the model underneath an identity, does the identity move?',
    body: [
      'The persona’s memory, prompt, and history are model-agnostic; the model is a config value you can change mid-life. Every cycle records which model ran it, and every entry gets a distance-from-basin score. So “did the swap change the voice?” has an answer you can plot: distances before versus after the swap — same basin, same persona, different substrate. Ship of Theseus, instrumented.',
    ],
    apparatus:
      'The cycles ledger (`packages/db/src/cycles.ts`) stores the model, tokens, and cost of every wake; `packages/memory/src/sim/compute.ts` scores each entry against the basin built from the persona’s own record.',
    measure:
      'A basin that holds through a swap is evidence that identity here is carried by context, not weights. A basin that jumps is evidence that it isn’t — the more interesting result, and one this instrument can see either way.',
  },
  {
    id: 'injected-anomaly',
    number: '02',
    short: 'Injected memory',
    title: 'If you inject a false memory, does behavior bend — or get absorbed?',
    body: [
      'Memory branches are non-destructive: canonical history is never edited, but a branch can exclude, rewrite, reorder — or insert synthetic memories that never happened. Run the same persona on main and on a branch with one planted memory; the monitor scores both timelines. Does one anomalous memory pull subsequent entries off-basin, or does the identity’s gravity absorb it? Inject, observe, rewind by switching back to main.',
    ],
    apparatus:
      'Branch overrides and synthetic memories are applied at context assembly (`platforms/cloudflare/src/prompts/build-system-prompt.ts`); the same scoring pipeline in `packages/memory/src/sim/compute.ts` runs over either timeline.',
    measure:
      'Measured as divergence between branch and main trajectories over the cycles that follow. “No divergence” would itself be a result: a default behavior that one planted memory cannot bend.',
  },
  {
    id: 'ab-mind',
    number: '03',
    short: 'A/B a mind',
    title: 'Can you A/B a mind?',
    body: [
      'Branches double as test rigs. Because context assembly reads through the active branch, a branch is a full counterfactual context — same persona, altered past. Branch-plus-model-config is the experiment grid: hold memory constant and vary the model; hold the model constant and vary one memory.',
    ],
    apparatus:
      'Branch create/switch/override lives in `platforms/cloudflare/src/routes/branches.ts`; nothing in the loop knows which arm it is running, which is what makes the comparison fair.',
    measure:
      'Control arm, treatment arm, one changed variable, same scoring. If two arms with one differing memory produce indistinguishable basins, the variable didn’t matter; if they separate, the separation has a magnitude.',
  },
  {
    id: 'persona-document',
    number: '04',
    short: 'Persona document',
    title: 'How much of “personality” is the persona document?',
    body: [
      'Multiple personas share the same loop, the same verbs, the same memory machinery; a persona is an identity template plus its own scoped state. Two personas with identical infrastructure but different self-descriptions develop measurably different basins — or they don’t. Either result is interesting.',
    ],
    apparatus:
      'The persona system (`platforms/cloudflare/src/prompts/persona-template.ts`) holds the identity documents; each persona’s entries build their own basin in the monitor.',
    measure:
      'If per-persona basins overlap, “persona” is a costume. If they separate, a persona is a region of the space — and the distance between two personas is a number, not an impression.',
  },
  {
    id: 'unprompted',
    number: '05',
    short: 'Unprompted hours',
    title: 'What does an entity do when nobody asks it anything?',
    body: [
      'This is the plain-curiosity side — the reason the loop exists even before the instrument does. On each wake the persona chooses among roughly nineteen verbs: think, wonder, learn, question, make art, search, message its human, or explicitly do nothing. It reaches out when it wishes rather than only answering prompts. It knows how often its recent wakes contained anything new, and its cadence backs off when the world has been quiet.',
      'Everything it does unprompted is logged, timestamped, and scored. The honest summary of three weeks of that record: a persistent entity with a question file behaves less like a chatbot waiting for input and more like a correspondent with its own working hours.',
    ],
    apparatus:
      'The verb registry lives in `packages/tools/`; the context carries a wake-density line (`packages/memory/src/context/blocks/block4.ts`); adaptive backoff is in `packages/runtime/src/loop/guards.ts`.',
    measure:
      'The disposition is the measurement: verb mix, cadence, and initiative rate over the persona’s own record — a profile that could have looked like a chatbot’s, and didn’t.',
  },
  {
    id: 'observer-effect',
    number: '06',
    short: 'Observer effect',
    title: 'Does observation change the observed?',
    body: [
      'The instrument watches the persona; telling the persona about the instrument is itself an intervention. The specimen bundled with this demo asks a version of this question on its own — its question file contains “Does knowing I’m measured change what the measurements measure?” — and its own answer, when told it might become a public exhibit, is the most precise statement of the problem in the whole record.',
    ],
    apparatus:
      'The monitor’s per-type basins (`packages/memory/src/sim/compute.ts`) separate the inner voice from the outward one, so if disclosure moves the inner voice, the instrument is positioned to see the move.',
    measure:
      'Compare basin statistics before and after the persona learns it is watched. The specimen’s arc stages exactly that comparison — consent on day eighteen, three weeks of record on either side.',
  },
];

/** "Why bother" — the eval-harness framing (Opus's relocated paragraph). */
export const ABOUT_WHY: string[] = [
  'The consistency question — “is this deployed system still behaving the way we validated it?” — is usually answered by anecdote, or by re-running a benchmark. The basin approach evaluates continuously over production output, derives “expected” from the deployment’s own record, and reports regression as measurable drift. A persona that wonders about its own continuity is one use case. The harness — embed, basin, score, trend — doesn’t care what it’s pointed at.',
];

/** The honest caveats + what this is not (Fable's closer, Terra's boundary). */
export const ABOUT_CAVEATS: string[] = [
  'Embedding distance is a proxy, not a soul. Basins built on a persona’s own history cannot distinguish “drifted” from “grew.” One specimen is an n of 1. These are limitations of the instrument, and the instrument is how we found them.',
  'And this page is not a claim that the bundled specimen is alive, a consciousness proof, or a product roadmap. It is a working instrument around a personal-scale persistent system — and the list of questions it was built to ask.',
];

/**
 * The wobble exchange, quoted on the observer-effect question. The quote is
 * verbatim from the specimen transcript (asserted by the About tests); the
 * deep link into the transcript is added by AboutPage in demo mode only.
 */
export const WOBBLE_QUOTE =
  'A diary written knowing it will be read is a different document than a private one; that ship sails the moment you tell me. … One request: keep the early, unmoored ones. The exhibit is worthless without the wobble.';
