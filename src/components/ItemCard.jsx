import { Link } from "react-router-dom";

const ItemCard = ({ item }) => {
  if (!item) {
    return null;
  }

  return (
    <Link to={`/details/${item.id}`} className="item-card-link">
      <article className="item-card">
        <div className="item-image-wrap">
          <img src={item.image} alt={item.name} className="item-image" />
          <span className={`item-status item-status-${item.status.toLowerCase()}`}>{item.status}</span>
        </div>
        <div className="item-body">
          <div className="item-row">
            <h4 className="item-name">{item.name}</h4>
            <span className="item-match">Match {item.matchPercent}%</span>
          </div>
          <p className="item-meta">{item.category}</p>
          <p className="item-meta">{item.location}</p>
          <p className="item-meta item-date">{item.date}</p>
        </div>
      </article>
    </Link>
  );
};

export default ItemCard;
