import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

const SearchBar = ({
  value,
  onChange,
  placeholder = "Search items...",
  ariaLabel = "Search items",
  icon,
  className = "",
  shellClassName = "search-input-shell",
  iconClassName = "search-input-icon",
  inputClassName = "search-input",
}) => {
  const resolvedIcon =
    icon ?? (
      <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon-svg" aria-hidden="true" focusable="false" />
    );

  return (
    <label className={`${shellClassName} ${className}`.trim()}>
      <span className={iconClassName} aria-hidden="true">
        {resolvedIcon}
      </span>
      <span className="sr-only">{ariaLabel}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClassName}
      />
    </label>
  );
};

export default SearchBar;
