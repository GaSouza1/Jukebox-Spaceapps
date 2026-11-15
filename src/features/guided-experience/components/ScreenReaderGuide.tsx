import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { errorText, loadingText } from "../../comparison/dataStatus";
import { formatCoordinates, regions } from "../../data/regions";
import { useComparisonData } from "../../data/useComparisonData";
import {
  describeComparisonSonification,
  REGION_SOUND,
} from "../../sonification/describeSonification";
import { useComparisonStore } from "../../../stores/comparisonStore";
import { useGuidedExperience } from "../hooks/useGuidedExperience";
import { guidedText } from "../i18n/en";
import { GUIDED_STEP_IDS } from "../types/guidedExperience";
import { GuidedStep } from "./GuidedStep";
import { StableText } from "../../../components/StableText";

const STEPS_ID = "sr-guide-steps";
const DESCRIPTION_ID = "sr-guide-description";
const LANDMARK_LABEL_ID = "sr-guide-label";
const NAV_LABEL_ID = "sr-guide-nav-label";

/**
 * Screen Reader First guide, mounted once in the layout so it works on every page.
 *
 * - It adds no visual panel: the whole landmark is visually hidden (`.sr-guide`)
 *   and only shows while something inside it has keyboard focus, so sighted
 *   keyboard users can still see where focus is (WCAG 2.4.7).
 * - It has no controls of its own besides its navigation: steps point to the
 *   real controls with links and never change regions or the player.
 * - Nothing is announced unless the user starts it; each step announces only
 *   its heading, via focus.
 */
export function ScreenReaderGuide() {
  const { controls: guide, entryButtonRef } = useGuidedExperience();
  const t = guidedText;

  return (
    <aside className="sr-guide" aria-labelledby={LANDMARK_LABEL_ID}>
      {/* Landmark and nav names come from real text, so page translation sees them. */}
      <p id={LANDMARK_LABEL_ID} className="sr-guide-label">
        {t.landmark}
      </p>
      <button
        ref={entryButtonRef}
        type="button"
        onClick={guide.start}
        aria-describedby={DESCRIPTION_ID}
        aria-expanded={guide.active}
        aria-controls={guide.active ? STEPS_ID : undefined}
      >
        <StableText>{guide.active ? t.restartButton : t.startButton}</StableText>
      </button>
      <p id={DESCRIPTION_ID}>{t.startDescription}</p>

      {guide.active && (
        <div id={STEPS_ID}>
          <GuidedStep
            key={`${guide.session}-${guide.stepIndex}`}
            number={guide.stepIndex + 1}
            total={guide.stepCount}
            title={t.steps[guide.stepId]}
          >
            {guide.stepId === "welcome" && <WelcomeStep />}
            {guide.stepId === "regions" && <RegionsStep />}
            {guide.stepId === "spatial" && <SpatialStep />}
            {guide.stepId === "prepare" && <PrepareStep />}
            {guide.stepId === "explore" && <ExploreStep />}
          </GuidedStep>
          <p id={NAV_LABEL_ID} className="sr-only">
            {t.navLabel}
          </p>
          <nav aria-labelledby={NAV_LABEL_ID}>
            {!guide.isFirst && (
              <button type="button" onClick={guide.back}>
                {t.back}
              </button>
            )}
            {guide.isLast ? (
              <button type="button" onClick={guide.close}>
                {t.finish}
              </button>
            ) : (
              <button type="button" onClick={guide.next}>
                {t.next}
              </button>
            )}
            {!guide.isLast && (
              <button type="button" onClick={guide.close}>
                {t.close}
              </button>
            )}
          </nav>
        </div>
      )}
    </aside>
  );
}

/** In-page link on Explore; elsewhere a link to the Explore page itself. */
function ExploreLink({ hash, children }: { hash: string; children: ReactNode }) {
  const { pathname } = useLocation();
  if (pathname === "/explore") return <a href={`#${hash}`}>{children}</a>;
  return <Link to="/explore">{children}</Link>;
}

function WelcomeStep() {
  const t = guidedText;
  return (
    <>
      <p>{t.welcome.intro}</p>
      <p>{t.welcome.plan}</p>
      <ol>
        {GUIDED_STEP_IDS.map((id) => (
          <li key={id}>{t.steps[id]}</li>
        ))}
      </ol>
      <p>{t.welcome.noAutoplay}</p>
    </>
  );
}

function RegionsStep() {
  const t = guidedText;
  const { regionA, regionB } = useComparisonStore();
  if (!regionA || !regionB) return null;
  const identity = (key: "a" | "b") =>
    `${REGION_SOUND[key].line}, ${REGION_SOUND[key].timbre}, ${REGION_SOUND[key].channel}`;
  return (
    <>
      <p>{t.hints.regions}</p>
      <p>{t.regions.current}</p>
      <ul>
        <StableText as="li">
          {t.regions.regionLine(
            "A",
            regionA.name,
            regionA.country,
            formatCoordinates(regionA),
            identity("a"),
          )}
        </StableText>
        <StableText as="li">
          {t.regions.regionLine(
            "B",
            regionB.name,
            regionB.country,
            formatCoordinates(regionB),
            identity("b"),
          )}
        </StableText>
      </ul>
      <p>{t.regions.where}</p>
      <p>
        <ExploreLink hash="comparison-setup">{t.regions.goTo}</ExploreLink>
      </p>
      <p>{t.regions.available}</p>
      <ul>
        {regions.map((region) => (
          <li key={region.id}>
            {region.name}, {region.country}: {formatCoordinates(region)}
          </li>
        ))}
      </ul>
    </>
  );
}

function SpatialStep() {
  const t = guidedText;
  const { regionA, regionB } = useComparisonStore();
  if (!regionA || !regionB) return null;
  return (
    <>
      <ul>
        <StableText as="li">{t.spatial.cueChannel(regionA.name, regionB.name)}</StableText>
        <StableText as="li">
          {t.spatial.cueTimbre(
            regionA.name,
            REGION_SOUND.a.timbre,
            regionB.name,
            REGION_SOUND.b.timbre,
          )}
        </StableText>
      </ul>
      <p>{t.hints.stereo}</p>
      <p>{t.spatial.sequential}</p>
      <p>
        <ExploreLink hash="player-title">{t.spatial.goTo}</ExploreLink>
      </p>
    </>
  );
}

function PrepareStep() {
  const t = guidedText.prepare;
  const speed = useComparisonStore((s) => s.playbackSpeed);
  // The same data as the Explore page (one shared request per region), on any page.
  const state = useComparisonData();
  if (!state) return null;
  if (state.status !== "ready") {
    return (
      <>
        <StableText as="p">
          {state.status === "loading" ? loadingText(state.loading) : errorText(state)}
        </StableText>
        <p>
          <ExploreLink hash="player-title">{t.goTo}</ExploreLink>
        </p>
      </>
    );
  }
  const description = describeComparisonSonification(state.data, speed, "both");
  return (
    <>
      <p>{t.intro}</p>
      <dl>
        {description.facts.map((fact) => (
          <div key={fact.id}>
            <dt>{fact.label}</dt>
            <StableText as="dd">{fact.text}</StableText>
          </div>
        ))}
      </dl>
      <p>{t.howToListen}</p>
      <p>
        <ExploreLink hash="player-title">{t.goTo}</ExploreLink>
      </p>
    </>
  );
}

function ExploreStep() {
  const t = guidedText.explore;
  return (
    <>
      <p>{t.intro}</p>
      <ul>
        {t.items.map((item) => (
          <li key={item.hash}>
            <ExploreLink hash={item.hash}>{item.text}</ExploreLink>
          </li>
        ))}
      </ul>
      <p>{t.restart}</p>
    </>
  );
}
