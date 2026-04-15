const baseClasses =
  "group relative w-full overflow-hidden rounded-full px-5 py-3 text-center text-[18px] font-semibold leading-none transition duration-300 focus:outline-none focus:ring-2 focus:ring-offset-0 hover:-translate-y-0.5 hover:shadow-lg";

const variantClasses = {
  primary: "bg-[#5DD62C] text-[#F8F8F8] shadow-[0_12px_28px_rgba(93,214,44,0.16)] focus:ring-[#5DD62C]",
  secondary: "bg-[#337418] text-[#F8F8F8] shadow-[0_12px_28px_rgba(51,116,24,0.16)] focus:ring-[#5DD62C]",
};

const Button = ({ type = "button", variant = "primary", children, onClick, disabled = false }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${disabled ? "cursor-not-allowed opacity-60 hover:translate-y-0 hover:shadow-none" : ""}`}
    >
      <span className="absolute inset-0 translate-x-[-140%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 transition-all duration-700 group-hover:translate-x-[140%] group-hover:opacity-100" />
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default Button;