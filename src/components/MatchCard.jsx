import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faLocationDot, faTag } from "@fortawesome/free-solid-svg-icons";

const getScoreTone = (score = 0) => {
  if (score >= 80) return "strong";
  if (score >= 50) return "possible";
  return "weak";
};

const MatchCard = ({ item, matchMode = "all" }) => {
  if (!item) {
    return null;
  }

  const score = Number(item.match?.score || 0);
  const scoreTone = getScoreTone(score);
  const detailsPath = `/details/${item.id}?from=matches&mode=${encodeURIComponent(matchMode)}`;
  const itemStatusLabel = item.status === "Lost" ? "Lost item" : "Found item";

  return (
    <article className="match-card">
      <img src={item.image} alt={item.name} className="match-card-image" />

      <div className="match-card-body">
        <div className="match-card-head">
          <div>
            <p className="page-kicker">{item.match?.label || "Similarity match"}</p>
            <h3>{item.name}</h3>
          </div>
          <div className={`match-card-score-panel match-card-score-panel-${scoreTone}`}>
            <strong>{score}%</strong>
            <span>match</span>
          </div>
        </div>

        <p className="match-card-meta">
          <FontAwesomeIcon icon={faTag} /> {item.category}
          <span className="match-card-meta-dot">•</span>
          <FontAwesomeIcon icon={faLocationDot} /> {item.location}
        </p>

        <div className="match-card-reasons">
          <span className="match-card-status">{itemStatusLabel}</span>
          {item.match?.reasons?.length ? (
            item.match.reasons.map((reason) => <span key={reason}>{reason}</span>)
          ) : (
            <span>Limited similarity signals</span>
          )}
        </div>

        <div className="match-card-actions">
          <Link className="match-card-action" to={detailsPath}>
            View details <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default MatchCard;
