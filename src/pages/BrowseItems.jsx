import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTag, faLocationDot, faCircleQuestion, faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import SearchBar from "../components/ui/SearchBar";
import SelectDropdown from "../components/ui/SelectDropdown";
import { getMarketplaceItems } from "../utils/itemStore";
import "../styles/Browse.css";

const categoryOptions = ["All", "Electronics", "IDs", "Bags", "Clothing", "Others"];
const statusOptions = ["All", "Lost", "Found"];
const confidenceOptions = ["All", "90%+", "70-89%", "Below 70%"];
const sortOptions = ["Newest", "Oldest", "Highest Match", "Nearest Location"];

const inferCategory = (item) => {
  const source = `${item.category} ${item.name}`.toLowerCase();
  if (source.includes("electronic") || source.includes("headphone")) return "Electronics";
  if (source.includes("bag")) return "Bags";
  if (source.includes("clothing") || source.includes("shirt") || source.includes("jacket")) return "Clothing";
  if (
    source.includes("id") ||
    source.includes("wallet") ||
    source.includes("key") ||
    source.includes("accessor") ||
    source.includes("personal")
  ) {
    return "IDs";
  }
  return "Others";
};

const confidenceBucket = (matchPercent) => {
  if (matchPercent >= 90) return "90%+";
  if (matchPercent >= 70) return "70-89%";
  return "Below 70%";
};

const MetaIcon = ({ type }) => {
  const icons = {
    category: faTag,
    location: faLocationDot,
    default: faCircleQuestion,
  };

  return <FontAwesomeIcon icon={icons[type] ?? icons.default} fixedWidth aria-hidden="true" focusable="false" />;
};

const BrowseItems = () => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("All");
  const [confidence, setConfidence] = useState("All");
  const [sortBy, setSortBy] = useState("Newest");
  const [visibleCount, setVisibleCount] = useState(4);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const items = getMarketplaceItems();

  const enrichedItems = useMemo(
    () => items.map((item) => ({ ...item, browseCategory: inferCategory(item) })),
    [items],
  );

  const locationSuggestions = useMemo(
    () => [...new Set(enrichedItems.map((item) => item.location))].sort((a, b) => a.localeCompare(b)),
    [enrichedItems],
  );

  const liveSuggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return enrichedItems
      .filter((item) => [item.name, item.location, item.category].some((v) => v.toLowerCase().includes(normalized)))
      .slice(0, 5)
      .map((item) => item.name);
  }, [enrichedItems, query]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedLocation = location.trim().toLowerCase();

    const result = enrichedItems.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        [item.name, item.category, item.location, item.description].some((v) =>
          v.toLowerCase().includes(normalizedQuery),
        );

      const matchesCategory = category === "All" || item.browseCategory === category;
      const matchesLocation = !normalizedLocation || item.location.toLowerCase().includes(normalizedLocation);
      const matchesDate = !date || item.date === date;
      const matchesStatus = status === "All" || item.status === status;
      const matchesConfidence = confidence === "All" || confidenceBucket(item.matchPercent) === confidence;

      return matchesQuery && matchesCategory && matchesLocation && matchesDate && matchesStatus && matchesConfidence;
    });

    if (sortBy === "Newest") {
      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sortBy === "Oldest") {
      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (sortBy === "Highest Match") {
      result.sort((a, b) => b.matchPercent - a.matchPercent);
    } else if (sortBy === "Nearest Location") {
      result.sort((a, b) => a.location.localeCompare(b.location));
    }

    return result;
  }, [enrichedItems, query, category, location, date, status, confidence, sortBy]);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleItems.length < filteredItems.length;

  const resetFilters = () => {
    setQuery("");
    setCategory("All");
    setLocation("");
    setDate("");
    setStatus("All");
    setConfidence("All");
    setSortBy("Newest");
    setVisibleCount(4);
  };

  const applyQuery = (value) => {
    setQuery(value);
    setVisibleCount(4);
  };

  return (
    <section className="browse-page">
      <div className="browse-toolbar">
        <SearchBar
          value={query}
          onChange={applyQuery}
          placeholder="Search items..."
          ariaLabel="Search items"
          shellClassName="browse-search-shell"
          iconClassName="browse-search-icon"
          inputClassName="browse-search-input"
        />

        {liveSuggestions.length > 0 ? (
          <div className="browse-suggestions" role="listbox" aria-label="Search suggestions">
            {liveSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="browse-suggestion"
                onClick={() => applyQuery(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <div className="browse-toolbar-row">
          <SelectDropdown
            className="browse-sort"
            value={sortBy}
            onChange={setSortBy}
            options={sortOptions.map((option) => ({ value: option, label: `Sort: ${option}` }))}
          />

          <button type="button" className="browse-filter-toggle" onClick={() => setIsFiltersOpen(true)}>
            Filter
          </button>
        </div>
      </div>

      <div className="browse-layout">
        <aside className={`browse-sidebar page-card ${isFiltersOpen ? "browse-sidebar-open" : ""}`}>
          <div className="browse-sidebar-head">
            <h3>Filters</h3>
            <button type="button" className="browse-close-filters" onClick={() => setIsFiltersOpen(false)}>
              Close
            </button>
          </div>

          <label className="browse-field">
            <span>Category</span>
            <SelectDropdown value={category} onChange={setCategory} options={categoryOptions} className="browse-select" />
          </label>

          <label className="browse-field">
            <span>Location</span>
            <SelectDropdown
              value={location}
              onChange={setLocation}
              options={[
                { value: "", label: "Location" },
                ...locationSuggestions.map((option) => ({ value: option, label: option })),
              ]}
              className="browse-select"
            />
          </label>

          <label className="browse-field">
            <span>Date</span>
            <div className="browse-date-input-wrap">
              <input className="browse-date-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              <span className="browse-date-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faCalendarDays} />
              </span>
            </div>
          </label>

          <label className="browse-field">
            <span>Status</span>
            <SelectDropdown value={status} onChange={setStatus} options={statusOptions} className="browse-select" />
          </label>

          <label className="browse-field">
            <span>Match Confidence</span>
            <SelectDropdown
              value={confidence}
              onChange={setConfidence}
              options={confidenceOptions}
              className="browse-select"
            />
          </label>

          <button type="button" className="browse-reset" onClick={resetFilters}>
            Reset Filters
          </button>
        </aside>

        <section className="browse-content page-card">
          <div className="browse-content-head">
            <h2>Browse Items</h2>
            <p>{filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}</p>
          </div>

          {visibleItems.length === 0 ? (
            <div className="browse-empty">
              <h3>No items found</h3>
              <p>Try changing filters or report your item.</p>
            </div>
          ) : (
            <>
              <div className="browse-grid">
                {visibleItems.map((item) => (
                  <Link key={item.id} to={`/details/${item.id}`} className="browse-card">
                    <div className="browse-card-image-wrap">
                      <img src={item.image} alt={item.name} className="browse-card-image" />
                      <span className={`browse-status browse-status-${item.status.toLowerCase()}`}>{item.status}</span>
                    </div>

                    <div className="browse-card-body">
                      <h3>{item.name}</h3>
                      <p className="browse-meta-line">
                        <span className="browse-meta-icon">
                          <MetaIcon type="category" />
                        </span>
                        {item.browseCategory}
                      </p>
                      <p className="browse-meta-line">
                        <span className="browse-meta-icon">
                          <MetaIcon type="location" />
                        </span>
                        {item.location}
                      </p>
                      <p className="browse-meta-line">
                        <span className="browse-meta-icon">
                          <MetaIcon type="match" />
                        </span>
                        Match: {item.matchPercent}%
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {hasMore ? (
                <button
                  type="button"
                  className="browse-load-more"
                  onClick={() => setVisibleCount((count) => count + 4)}
                >
                  Load More
                </button>
              ) : null}
            </>
          )}
        </section>
      </div>
    </section>
  );
};

export default BrowseItems;
