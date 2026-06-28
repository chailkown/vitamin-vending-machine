const VERSION = 6;
const SIZE = 41;
const DATA_CODEWORDS = 136;
const ECC_CODEWORDS_PER_BLOCK = 18;
const DATA_BLOCKS = 2;
const DATA_CODEWORDS_PER_BLOCK = 68;
const MASK = 0;

const gfExp = new Array(512);
const gfLog = new Array(256);

let x = 1;
for (let i = 0; i < 255; i += 1) {
  gfExp[i] = x;
  gfLog[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) {
  gfExp[i] = gfExp[i - 255];
}

const gfMul = (a, b) => {
  if (a === 0 || b === 0) return 0;
  return gfExp[gfLog[a] + gfLog[b]];
};

const reedSolomonGenerator = (degree) => {
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(result.length + 1).fill(0);
    result.forEach((coef, index) => {
      next[index] ^= gfMul(coef, gfExp[i]);
      next[index + 1] ^= coef;
    });
    result = next;
  }
  return result;
};

const reedSolomonRemainder = (data, degree) => {
  const generator = reedSolomonGenerator(degree);
  const result = new Array(degree).fill(0);
  data.forEach((value) => {
    const factor = value ^ result.shift();
    result.push(0);
    generator.slice(0, degree).forEach((coef, index) => {
      result[index] ^= gfMul(coef, factor);
    });
  });
  return result;
};

const appendBits = (bits, value, length) => {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
};

const encodeDataCodewords = (text) => {
  const bytes = Array.from(new TextEncoder().encode(text));
  const bits = [];

  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacityBits = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    codewords.push(value);
  }

  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < DATA_CODEWORDS) {
    codewords.push(pads[padIndex % 2]);
    padIndex += 1;
  }

  if (codewords.length > DATA_CODEWORDS) {
    throw new Error('QR Version 6 용량을 초과했습니다.');
  }

  return codewords;
};

const interleaveBlocks = (dataCodewords) => {
  const dataBlocks = [];
  const eccBlocks = [];

  for (let i = 0; i < DATA_BLOCKS; i += 1) {
    const block = dataCodewords.slice(i * DATA_CODEWORDS_PER_BLOCK, (i + 1) * DATA_CODEWORDS_PER_BLOCK);
    dataBlocks.push(block);
    eccBlocks.push(reedSolomonRemainder(block, ECC_CODEWORDS_PER_BLOCK));
  }

  const result = [];
  for (let i = 0; i < DATA_CODEWORDS_PER_BLOCK; i += 1) {
    dataBlocks.forEach((block) => result.push(block[i]));
  }
  for (let i = 0; i < ECC_CODEWORDS_PER_BLOCK; i += 1) {
    eccBlocks.forEach((block) => result.push(block[i]));
  }
  return result;
};

const makeGrid = () => ({
  modules: Array.from({ length: SIZE }, () => Array(SIZE).fill(false)),
  reserved: Array.from({ length: SIZE }, () => Array(SIZE).fill(false)),
});

const setModule = (grid, row, col, dark, reserve = true) => {
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
  grid.modules[row][col] = Boolean(dark);
  if (reserve) grid.reserved[row][col] = true;
};

const drawFinder = (grid, row, col) => {
  for (let y = -1; y <= 7; y += 1) {
    for (let xx = -1; xx <= 7; xx += 1) {
      const r = row + y;
      const c = col + xx;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
      const dark =
        y >= 0 && y <= 6 && xx >= 0 && xx <= 6 &&
        (y === 0 || y === 6 || xx === 0 || xx === 6 || (y >= 2 && y <= 4 && xx >= 2 && xx <= 4));
      setModule(grid, r, c, dark);
    }
  }
};

const drawAlignment = (grid, row, col) => {
  for (let y = -2; y <= 2; y += 1) {
    for (let xx = -2; xx <= 2; xx += 1) {
      const dark = Math.max(Math.abs(y), Math.abs(xx)) !== 1;
      setModule(grid, row + y, col + xx, dark);
    }
  }
};

const reserveFormat = (grid) => {
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      setModule(grid, 8, i, false);
      setModule(grid, i, 8, false);
    }
  }
  for (let i = 0; i < 8; i += 1) setModule(grid, 8, SIZE - 1 - i, false);
  for (let i = 0; i < 7; i += 1) setModule(grid, SIZE - 1 - i, 8, false);
};

const drawFunctionPatterns = (grid) => {
  drawFinder(grid, 0, 0);
  drawFinder(grid, 0, SIZE - 7);
  drawFinder(grid, SIZE - 7, 0);

  drawAlignment(grid, 34, 34);

  for (let i = 8; i < SIZE - 8; i += 1) {
    const dark = i % 2 === 0;
    setModule(grid, 6, i, dark);
    setModule(grid, i, 6, dark);
  }

  setModule(grid, 4 * VERSION + 9, 8, true);
  reserveFormat(grid);
};

const getFormatBits = () => {
  const errorCorrectionLevel = 0b01; // Level L
  let data = (errorCorrectionLevel << 3) | MASK;
  let value = data << 10;
  const generator = 0x537;
  for (let i = 14; i >= 10; i -= 1) {
    if ((value >>> i) & 1) value ^= generator << (i - 10);
  }
  return ((data << 10) | value) ^ 0x5412;
};

const drawFormatBits = (grid) => {
  const bits = getFormatBits();
  const bit = (index) => ((bits >>> index) & 1) === 1;

  for (let i = 0; i <= 5; i += 1) setModule(grid, 8, i, bit(i));
  setModule(grid, 8, 7, bit(6));
  setModule(grid, 8, 8, bit(7));
  setModule(grid, 7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) setModule(grid, 14 - i, 8, bit(i));

  for (let i = 0; i < 8; i += 1) setModule(grid, SIZE - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i += 1) setModule(grid, 8, SIZE - 15 + i, bit(i));
};

const maskBit = (row, col) => ((row + col) % 2) === 0;

const drawCodewords = (grid, codewords) => {
  const bits = [];
  codewords.forEach((codeword) => appendBits(bits, codeword, 8));

  let bitIndex = 0;
  let upward = true;

  for (let col = SIZE - 1; col >= 1; col -= 2) {
    if (col === 6) col -= 1;
    for (let i = 0; i < SIZE; i += 1) {
      const row = upward ? SIZE - 1 - i : i;
      for (let offset = 0; offset < 2; offset += 1) {
        const c = col - offset;
        if (grid.reserved[row][c]) continue;
        const raw = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        setModule(grid, row, c, raw !== maskBit(row, c), false);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
};

export const createVersion6QrMatrix = (text) => {
  const grid = makeGrid();
  drawFunctionPatterns(grid);
  drawCodewords(grid, interleaveBlocks(encodeDataCodewords(text)));
  drawFormatBits(grid);
  return grid.modules;
};

export const qrMatrixToDataUrl = (matrix, scale = 8, quiet = 4) => {
  const moduleCount = matrix.length;
  const canvas = document.createElement('canvas');
  canvas.width = (moduleCount + quiet * 2) * scale;
  canvas.height = (moduleCount + quiet * 2) * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';

  matrix.forEach((row, y) => {
    row.forEach((dark, xx) => {
      if (dark) ctx.fillRect((xx + quiet) * scale, (y + quiet) * scale, scale, scale);
    });
  });

  return canvas.toDataURL('image/png');
};
