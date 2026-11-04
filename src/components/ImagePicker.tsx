import { ChangeEvent, ReactNode, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { es } from "../i18n/es";
import { resizeImage } from "./images";

interface Props {
  image: string | null;
  size: { width: number; height: number };
  /** Guarda la nueva imagen (data URL) o null para quitarla. */
  onChange: (image: string | null) => Promise<void>;
  /** Qué se muestra sin imagen. */
  placeholder: ReactNode;
  className?: string;
  round?: boolean;
}

/** Imagen pulsable: al hacer clic se elige un archivo, se reduce y se guarda. */
export function ImagePicker({ image, size, onChange, placeholder, className = "", round = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await onChange(await resizeImage(file, size));
    } catch {
      setError(es.images.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`image-picker${round ? " image-round" : ""} ${className}`}>
      <label className="image-picker-area" title={image ? es.images.change : es.images.add}>
        {image ? <img src={image} alt="" /> : placeholder}
        <span className="image-picker-hover">
          <ImagePlus size={18} />
        </span>
        {busy && <span className="image-picker-busy" />}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} />
      </label>
      {image && !busy && (
        <button className="image-remove" title={es.images.remove} onClick={() => onChange(null)}>
          <X size={12} />
        </button>
      )}
      {error && <span className="error small">{error}</span>}
    </div>
  );
}
