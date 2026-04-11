import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

const SelectDropdown = ({ value, onChange, options, className = "search-select", wrapperClassName = "" }) => {
  return (
    <div className={`select-dropdown ${wrapperClassName}`.trim()}>
      <select className={className} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          if (typeof option === "object" && option !== null) {
            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            );
          }

          return (
            <option key={option} value={option}>
              {option}
            </option>
          );
        })}
      </select>
        <span className="select-dropdown-icon" aria-hidden="true">
          <FontAwesomeIcon icon={faChevronDown} />
        </span>
    </div>
  );
};

export default SelectDropdown;
