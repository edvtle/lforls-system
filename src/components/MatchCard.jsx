import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faLocationDot, faTag } from "@fortawesome/free-solid-svg-icons";

const MatchCard = ({ item }) => {
  if (!item) {
    return null;
  }

  const confidenceClass =
    item.match.label === "Strong Match"
      ? "match-card-confidence-strong"
      : item.match.label === "Possible Match"
        ? "match-card-confidence-possible"
        : "match-card-confidence-weak";

  return (
    <article className="match-card">
      <img src={item.image} alt={item.name} className="match-card-image" />

      <div className="match-card-body">
        <div className="match-card-head">
          <div>
            <p className="page-kicker">{item.match.score}% match</p>
            <h3>{item.name}</h3>
          </div>
          <span className={`match-card-confidence ${confidenceClass}`}>{item.match.label}</span>
        </div>

        <p className="match-card-meta">
          <FontAwesomeIcon icon={faTag} /> {item.category} <span>•</span> <FontAwesomeIcon icon={faLocationDot} /> {item.location}
        </p>

        <div className="match-card-reasons">
          {item.match.reasons.length ? item.match.reasons.map((reason) => <span key={reason}>{reason}</span>) : <span>Limited similarity signals</span>}
        </div>

        <Link className="match-card-action" to={`/details/${item.id}`}>
          View details <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
        </Link>
      </div>
    </article>
  );
};

export default MatchCard;
