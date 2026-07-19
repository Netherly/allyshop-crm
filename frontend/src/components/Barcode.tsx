import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface Props {
  value: string;
  height?: number;
  width?: number; // ширина одной полосы
  fontSize?: number;
  displayValue?: boolean;
}

// Рисует штрих-код CODE128 в SVG. Скрывается, если значение пустое/некорректное.
export function Barcode({ value, height = 50, width = 2, fontSize = 14, displayValue = true }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        height,
        width,
        fontSize,
        displayValue,
        margin: 4,
        background: '#ffffff',
      });
    } catch {
      // некорректное значение — просто ничего не рисуем
    }
  }, [value, height, width, fontSize, displayValue]);

  if (!value) return null;
  return <svg ref={ref} />;
}
