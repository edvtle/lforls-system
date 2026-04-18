import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

const getCroppedBlob = async (imageSrc, cropAreaPixels) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");

  canvas.width = cropAreaPixels.width;
  canvas.height = cropAreaPixels.height;

  const context = canvas.getContext("2d");
  context.drawImage(
    image,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    cropAreaPixels.width,
    cropAreaPixels.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
  });
};

const ImageCropModal = ({
  isOpen,
  imageSrc,
  fileName = "image.jpg",
  onCancel,
  onApply,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !isApplying) {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isApplying, onCancel]);

  useEffect(() => {
    if (!isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [isOpen]);

  const handleCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      return;
    }

    setIsApplying(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      if (!blob) {
        return;
      }

      const croppedFile = new File([blob], fileName, { type: "image/jpeg" });
      onApply(croppedFile);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen || !imageSrc) {
    return null;
  }

  return (
    <div className="report-crop-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="report-crop-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Crop uploaded image"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="report-crop-head">
          <div>
            <p className="report-crop-kicker">Image editor</p>
            <h3>Crop image</h3>
            <p>Adjust the frame so the item is centered and clear.</p>
          </div>

          <button
            type="button"
            className="report-crop-close"
            aria-label="Close cropper"
            onClick={onCancel}
            disabled={isApplying}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="report-crop-stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={4 / 3}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <label className="report-crop-zoom">
          <span>Zoom level</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <strong>{zoom.toFixed(1)}x</strong>
        </label>

        <div className="report-crop-actions">
          <button type="button" className="report-secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="report-primary-button"
            onClick={handleApply}
            disabled={isApplying}
          >
            {isApplying ? "Applying..." : "Use Cropped Image"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
