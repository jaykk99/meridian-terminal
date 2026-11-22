import qrcode from 'qrcode-generator';

/** Render any string as a QR data URL for the pairing modal. */
export function qrDataUrl(data: string, cellSize = 6, margin = 8): string {
  const qr = qrcode(0, 'M');
  qr.addData(data);
  qr.make();
  return qr.createDataURL(cellSize, margin);
}
