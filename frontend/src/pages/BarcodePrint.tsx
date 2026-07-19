import { useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { api } from '@/lib/api';
import { productTitle } from '@/lib/format';
import { ProductPicker, PickedProduct } from '@/components/ProductPicker';
import { Barcode } from '@/components/Barcode';
import { Product } from '@/types';

// Собирает картинку-этикетку: сверху название товара (кириллица через canvas), снизу штрих-код.
function labelDataUrl(p: Product): { url: string; ratio: number } {
  const bc = document.createElement('canvas');
  JsBarcode(bc, p.barcode ?? '', {
    format: 'CODE128',
    height: 60,
    width: 2,
    fontSize: 16,
    margin: 4,
    displayValue: true,
    background: '#ffffff',
  });

  const nameH = 22;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(bc.width, 240);
  canvas.height = bc.height + nameH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.font = '14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(productTitle(p), canvas.width / 2, 15, canvas.width - 8);
  ctx.drawImage(bc, (canvas.width - bc.width) / 2, nameH);

  return { url: canvas.toDataURL('image/png'), ratio: canvas.height / canvas.width };
}

// Генерирует PDF с сеткой этикеток заданного количества.
function generatePdf(product: Product, qty: number) {
  const { url, ratio } = labelDataUrl(product);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const cols = 3;
  const rows = 8;
  const perPage = cols * rows;
  const marginX = 10;
  const marginY = 12;
  const cellW = (210 - marginX * 2) / cols;
  const cellH = (297 - marginY * 2) / rows;

  // Размер картинки внутри ячейки с сохранением пропорций.
  let imgW = cellW - 6;
  let imgH = imgW * ratio;
  if (imgH > cellH - 6) {
    imgH = cellH - 6;
    imgW = imgH / ratio;
  }

  for (let i = 0; i < qty; i++) {
    const idx = i % perPage;
    if (i > 0 && idx === 0) doc.addPage();
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const x = marginX + c * cellW + (cellW - imgW) / 2;
    const y = marginY + r * cellH + (cellH - imgH) / 2;
    doc.addImage(url, 'PNG', x, y, imgW, imgH);
  }

  doc.save(`barcodes-${product.barcode}.pdf`);
}

export function BarcodePrint() {
  const [pick, setPick] = useState<PickedProduct | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState('10');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pick) {
      setProduct(null);
      return;
    }
    api
      .get<Product>(`/products/${pick.id}`)
      .then((r) => setProduct(r.data))
      .catch(() => setProduct(null));
  }, [pick]);

  function download() {
    setError('');
    if (!product?.barcode) {
      setError('У товара нет штрих-кода');
      return;
    }
    const n = Math.min(Math.max(Number(qty) || 1, 1), 500);
    generatePdf(product, n);
  }

  return (
    <div className="tab-pane">
      <div className="text-muted" style={{ marginBottom: 16 }}>
        Выберите товар и количество — получите PDF с этикетками для печати.
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="field">
          <label className="field__label">Товар</label>
          <ProductPicker value={pick} onChange={setPick} />
        </div>
        <div className="field">
          <label className="field__label">Количество этикеток</label>
          <input
            className="input"
            type="number"
            min="1"
            max="500"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <span className="field__hint">до 500 штук за раз</span>
        </div>

        {product?.barcode && (
          <div className="field">
            <label className="field__label">Предпросмотр</label>
            <div className="barcode-preview">
              <Barcode value={product.barcode} height={50} />
            </div>
          </div>
        )}

        <div className="actions">
          <button className="btn btn--primary" onClick={download} disabled={!product?.barcode}>
            Скачать PDF
          </button>
        </div>
      </div>
    </div>
  );
}
