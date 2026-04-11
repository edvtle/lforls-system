import { Link } from "react-router-dom";

const ActionButtonLink = ({ to, variant = "found", children, className = "" }) => {
  const resolvedVariant = variant === "lost" ? "hero-button-lost" : "hero-button-found";
  return (
    <Link to={to} className={`hero-button ${resolvedVariant} ${className}`.trim()}>
      {children}
    </Link>
  );
};

export default ActionButtonLink;
