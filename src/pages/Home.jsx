import { useMemo, useState } from "react";
import ItemCard from "../components/ItemCard";
import ActionButtonLink from "../components/ui/ActionButtonLink";
import SearchBar from "../components/ui/SearchBar";
import SelectDropdown from "../components/ui/SelectDropdown";
import { getMarketplaceItems } from "../utils/itemStore";
import "../styles/Home.css";

const Home = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [location, setLocation] = useState("All Locations");
  const [date, setDate] = useState("All Dates");
  const items = getMarketplaceItems();

  const categoryOptions = useMemo(() => ["All Categories", ...new Set(items.map((item) => item.category))], [items]);
  const locationOptions = useMemo(() => ["All Locations", ...new Set(items.map((item) => item.location))], [items]);
  const dateOptions = useMemo(() => ["All Dates", ...new Set(items.map((item) => item.date))], [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery =
        !query ||
        [item.name, item.category, item.location, item.status, item.date].some((value) =>
          value.toLowerCase().includes(query),
        );
      const matchesCategory = category === "All Categories" || item.category === category;
      const matchesLocation = location === "All Locations" || item.location === location;
      const matchesDate = date === "All Dates" || item.date === date;

      return matchesQuery && matchesCategory && matchesLocation && matchesDate;
    });
  }, [search, category, location, date, items]);

  const hasItems = items.length > 0;
  const showEmptyState = hasItems && filteredItems.length === 0;
  const promoImagePath = "/manconfused.png";

  return (
    <div className="home-page">
      <section className="home-showcase">
        <div className="home-left-column">
          <div className="search-panel home-promo-search">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search lost or found items..."
              ariaLabel="Search lost or found items"
            />

            <div className="search-filters">
              <SelectDropdown value={category} onChange={setCategory} options={categoryOptions} />
              <SelectDropdown value={location} onChange={setLocation} options={locationOptions} />
              <SelectDropdown value={date} onChange={setDate} options={dateOptions} />
            </div>
          </div>

          <article className="home-promo page-card">
            <div className="home-promo-body">
              <div className="home-promo-figure" aria-hidden="true">
                <img src={promoImagePath} alt="" className="home-promo-image" />
              </div>
              <div className="home-promo-copy">
                <h2 className="hero-title">Lost something? Found something?</h2>
                <p className="hero-subtitle">Report and find items instantly using AI.</p>

                <div className="hero-actions">
                  <ActionButtonLink to="/report/lost" variant="lost">
                    Report Lost Item
                  </ActionButtonLink>
                  <ActionButtonLink to="/report/found" variant="found">
                    Report Found Item
                  </ActionButtonLink>
                </div>
              </div>
            </div>
          </article>
        </div>

        <article className="home-results page-card">
          <div className="section-heading">
            <h3 className="section-title">Recent items and matches</h3>
            <p className="section-meta">{filteredItems.length} item{filteredItems.length === 1 ? "" : "s"} shown</p>
          </div>

          {showEmptyState ? (
            <section className="empty-state">
              <div className="empty-illustration" aria-hidden="true">
                <span>⌁</span>
              </div>
              <h4>No items match your filters.</h4>
              <p>Try changing category, location, date, or search keyword.</p>
            </section>
          ) : (
            <div className="items-grid items-grid-compact">
              {filteredItems.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
};

export default Home;
