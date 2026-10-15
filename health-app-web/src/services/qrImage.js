import QRCode from 'qrcode';
export const createQrDataUrl = async (text) => {
  if (typeof text !== 'string' || !text || new TextEncoder().encode(text).length > 1800) {
    throw new Error('QR 데이터가 너무 큽니다. 입력 내용을 줄여주세요.');
  }
  try { return await QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 4, width: 512 }); }
  catch { throw new Error('QR 생성에 실패했습니다. 입력 크기를 확인하고 다시 시도해주세요.'); }
};
