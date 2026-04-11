const Modal = ({
  isOpen,
  onClose,
  ariaLabel = "Dialog",
  overlayClassName,
  panelClassName,
  children,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={overlayClassName} role="dialog" aria-modal="true" aria-label={ariaLabel} onClick={onClose}>
      <div className={panelClassName} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export default Modal;
