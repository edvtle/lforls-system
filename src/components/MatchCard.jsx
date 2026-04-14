import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faCircleCheck, faLocationDot, faTag } from "@fortawesome/free-solid-svg-icons";
import { getClaims } from "../utils/claimStore";

const MatchCard = ({ item }) => {
  if (!item) {
    return null;
  }

  const itemClaims = getClaims().filter((claim) => claim.itemId === item.id);
  const hasClaimRequest = item.status === "Found" && itemClaims.length > 0;

  return (
    <article className="match-card">
      <img src={item.image} alt={item.name} className="match-card-image" />

      <div className="match-card-body">
        <div className="match-card-head">
          <div>
            <p className="page-kicker">{item.match.score}% match</p>
            <h3>{item.name}</h3>
          </div>
          <span className="match-card-status">Found item</span>
        </div>

        <p className="match-card-meta">
          <FontAwesomeIcon icon={faTag} /> {item.category} <span>•</span> <FontAwesomeIcon icon={faLocationDot} /> {item.location}
        </p>

        <div className="match-card-reasons">
          {item.match.reasons.length ? item.match.reasons.map((reason) => <span key={reason}>{reason}</span>) : <span>Limited similarity signals</span>}
        </div>

        <div className="match-card-actions">
          <Link className="match-card-action" to={`/details/${item.id}`}>
            View details <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </Link>
          <Link className="match-card-action match-card-action-claim" to={`/details/${item.id}?claim=1`}>
            {hasClaimRequest ? "Claimed" : "Claim Item"} <FontAwesomeIcon icon={faCircleCheck} />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default MatchCard;
