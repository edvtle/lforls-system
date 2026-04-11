const InputText = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  trailing,
  onTrailingClick,
  name,
}) => {
  return (
    <label className="relative block">
      <span className="auth-input-label absolute -top-2 left-3 z-10 bg-[#0F0F0F] px-2 text-[13px] font-semibold leading-none text-[#F8F8F8]">{label}</span>
      <div className="auth-input-shell flex items-center rounded-md border border-[#5DD62C] bg-transparent">
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="auth-input-field h-12 w-full bg-transparent px-4 text-[16px] font-normal text-[#F8F8F8] outline-none placeholder:font-normal placeholder:text-[#F8F8F8]/45"
        />
        {trailing && (
          <button
            type="button"
            onClick={onTrailingClick}
            className="auth-input-trailing mr-2 inline-flex h-8 w-8 items-center justify-center text-[#5DD62C] hover:opacity-95"
            aria-label="Toggle password visibility"
          >
            {trailing}
          </button>
        )}
      </div>
    </label>
  );
};

export default InputText;