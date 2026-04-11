import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
  faFilter,
  faListCheck,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import MatchCard from "../components/MatchCard";
import { homeItems } from "../data/items";
import { rankFoundMatches, scoringWeights } from "../utils/matching";

const defaultReport = {
  itemName: "Black Leather Wallet",
  category: "Accessories",
  locationLost: "Library",
  dateLost: "2026-04-08",
  description: "Slim wallet with IDs and cards",
  identifiers: "Worn edge and student card slot",
  color: "Black",
  hasImage: true,
};

const MatchResults = () => {
  const location = useLocation();

  const lostReport = useMemo(() => {
    const fromState = location.state?.lostReport;
    if (fromState) {
      return fromState;
    }

    const fromStorage = localStorage.getItem("lforls:lastLostReport");
    if (fromStorage) {
      try {
        return JSON.parse(fromStorage);
      } catch {
        return defaultReport;
      }
    }

    return defaultReport;
  }, [location.state]);

  const matches = useMemo(() => rankFoundMatches(lostReport, homeItems, 8), [lostReport]);

  const summary = useMemo(() => {
    const strong = matches.filter((item) => item.match.score >= 80).length;
    const possible = matches.filter((item) => item.match.score >= 50 && item.match.score < 80).length;
    const weak = matches.filter((item) => item.match.score < 50).length;
    return { strong, possible, weak };
  }, [matches]);

  const topMatches = matches.slice(0, 5);

  return (
    <section className="match-results-page">
      <section className="page-card match-hero">
        <div>
          <p className="page-kicker">Matching system</p>
          <h2 className="page-title">Possible Matches Found</h2>
          <p className="page-description">
            We compared your lost-item report with found-item records using a weighted scoring model for fast and transparent results.
          </p>
        </div>

        <div className="match-hero-badges">
          <span>
            <FontAwesomeIcon icon={faCircleCheck} /> {summary.strong} Strong
          </span>
          <span>
            <FontAwesomeIcon icon={faCircleExclamation} /> {summary.possible} Possible
          </span>
          <span>
            <FontAwesomeIcon icon={faCircleXmark} /> {summary.weak} Weak
          </span>
        </div>
      </section>

      <section className="page-card match-query-card">
        <p className="page-kicker">Report context</p>
        <div className="match-query-grid">
          <div>
            <span>Item</span>
            <strong>{lostReport.itemName}</strong>
          </div>
          <div>
            <span>Category</span>
            <strong>{lostReport.category}</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>{lostReport.locationLost}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{lostReport.dateLost}</strong>
          </div>
        </div>
      </section>

      <section className="match-columns">
        <div className="page-card match-main-list">
          <div className="match-section-head">
            <h3>Top Matches</h3>
            <p>Showing top 5 results by score</p>
          </div>

          <div className="match-card-list" role="list">
            {topMatches.map((item) => (
              <MatchCard key={item.id} item={item} />
            ))}
          </div>
        </div>

        <aside className="page-card match-side-panel">
          <div className="match-section-head">
            <h3>
              <FontAwesomeIcon icon={faFilter} /> Why This Matched
            </h3>
            <p>Scoring is weighted and visible.</p>
          </div>

          <ul className="match-weight-list">
            <li>
              <span>Category</span>
              <strong>{scoringWeights.category}%</strong>
            </li>
            <li>
              <span>Name similarity</span>
              <strong>{scoringWeights.name}%</strong>
            </li>
            <li>
              <span>Location</span>
              <strong>{scoringWeights.location}%</strong>
            </li>
            <li>
              <span>Date proximity</span>
              <strong>{scoringWeights.date}%</strong>
            </li>
            <li>
              <span>Description</span>
              <strong>{scoringWeights.description}%</strong>
            </li>
            <li>
              <span>Image cues</span>
              <strong>{scoringWeights.image}%</strong>
            </li>
          </ul>

          {topMatches[0] ? (
            <div className="match-breakdown">
              <p className="page-kicker">Top result breakdown</p>
              <h4>{topMatches[0].name}</h4>
              <ul>
                <li>Category: {topMatches[0].match.breakdown.category}%</li>
                <li>Name: {topMatches[0].match.breakdown.name}%</li>
                <li>Location: {topMatches[0].match.breakdown.location}%</li>
                <li>Date: {topMatches[0].match.breakdown.date}%</li>
                <li>Description: {topMatches[0].match.breakdown.description}%</li>
                <li>Image: {topMatches[0].match.breakdown.image}%</li>
              </ul>
            </div>
          ) : null}

          <div className="match-safety-card">
            <p>
              <FontAwesomeIcon icon={faShieldHalved} /> Safety check before claim
            </p>
            <ul>
              <li>Ask for unique marks or serial details</li>
              <li>Use in-app contact flow before sharing details</li>
              <li>Report suspicious claims immediately</li>
            </ul>
          </div>

          <div className="match-notify-note">
            <FontAwesomeIcon icon={faBell} /> New strong matches trigger in-app alerts.
          </div>

          <div className="match-section-head">
            <h3>
              <FontAwesomeIcon icon={faListCheck} /> UX checklist
            </h3>
          </div>
          <ul className="match-checklist">
            <li>Match percentage is clearly shown</li>
            <li>Reasons are visible and easy to trust</li>
            <li>Only top results are shown to avoid overload</li>
          </ul>
        </aside>
      </section>
    </section>
  );
};

export default MatchResults;
