export type QrMatrix = boolean[][];

interface RsBlockDefinition {
  count: number;
  totalCodewords: number;
  dataCodewords: number;
}

interface VersionDefinition {
  version: number;
  alignmentCenters: number[];
  blocks: RsBlockDefinition[];
}

const VERSION_DEFINITIONS: VersionDefinition[] = [
  { version: 1, alignmentCenters: [], blocks: [{ count: 1, totalCodewords: 26, dataCodewords: 19 }] },
  { version: 2, alignmentCenters: [6, 18], blocks: [{ count: 1, totalCodewords: 44, dataCodewords: 34 }] },
  { version: 3, alignmentCenters: [6, 22], blocks: [{ count: 1, totalCodewords: 70, dataCodewords: 55 }] },
  { version: 4, alignmentCenters: [6, 26], blocks: [{ count: 1, totalCodewords: 100, dataCodewords: 80 }] },
  { version: 5, alignmentCenters: [6, 30], blocks: [{ count: 1, totalCodewords: 134, dataCodewords: 108 }] },
  { version: 6, alignmentCenters: [6, 34], blocks: [{ count: 2, totalCodewords: 86, dataCodewords: 68 }] },
  { version: 7, alignmentCenters: [6, 22, 38], blocks: [{ count: 2, totalCodewords: 98, dataCodewords: 78 }] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
let value = 1;
for (let index = 0; index < 255; index += 1) {
  GF_EXP[index] = value;
  GF_LOG[value] = index;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let index = 255; index < GF_EXP.length; index += 1) GF_EXP[index] = GF_EXP[index - 255];

function gfMultiply(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  return GF_EXP[GF_LOG[left] + GF_LOG[right]];
}

function multiplyPolynomials(left: number[], right: number[]): number[] {
  const result = new Array(left.length + right.length - 1).fill(0);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      result[leftIndex + rightIndex] ^= gfMultiply(left[leftIndex], right[rightIndex]);
    }
  }
  return result;
}

function reedSolomonGenerator(degree: number): number[] {
  let polynomial = [1];
  for (let index = 0; index < degree; index += 1) {
    polynomial = multiplyPolynomials(polynomial, [1, GF_EXP[index]]);
  }
  return polynomial;
}

function reedSolomonRemainder(data: number[], degree: number): number[] {
  const generator = reedSolomonGenerator(degree);
  const working = [...data, ...new Array(degree).fill(0)];
  for (let index = 0; index < data.length; index += 1) {
    const factor = working[index];
    if (factor === 0) continue;
    for (let generatorIndex = 0; generatorIndex < generator.length; generatorIndex += 1) {
      working[index + generatorIndex] ^= gfMultiply(generator[generatorIndex], factor);
    }
  }
  return working.slice(data.length);
}

class BitBuffer {
  private readonly bits: number[] = [];

  push(valueToPush: number, length: number): void {
    for (let index = length - 1; index >= 0; index -= 1) this.bits.push((valueToPush >>> index) & 1);
  }

  get length(): number {
    return this.bits.length;
  }

  toBytes(): number[] {
    const bytes: number[] = [];
    for (let offset = 0; offset < this.bits.length; offset += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) byte = (byte << 1) | (this.bits[offset + bit] ?? 0);
      bytes.push(byte);
    }
    return bytes;
  }
}

function chooseVersion(byteLength: number): VersionDefinition {
  for (const definition of VERSION_DEFINITIONS) {
    const dataCodewords = definition.blocks.reduce((sum, block) => sum + block.count * block.dataCodewords, 0);
    if (4 + 8 + byteLength * 8 <= dataCodewords * 8) return definition;
  }
  throw new Error("QR payload is too long for the local encoder.");
}

function createCodewords(payload: string, definition: VersionDefinition): number[] {
  const payloadBytes = Array.from(new TextEncoder().encode(payload));
  const dataCodewordCount = definition.blocks.reduce((sum, block) => sum + block.count * block.dataCodewords, 0);
  const buffer = new BitBuffer();
  buffer.push(0b0100, 4);
  buffer.push(payloadBytes.length, 8);
  for (const byte of payloadBytes) buffer.push(byte, 8);

  const maximumBits = dataCodewordCount * 8;
  buffer.push(0, Math.min(4, maximumBits - buffer.length));
  while (buffer.length % 8 !== 0) buffer.push(0, 1);
  const dataCodewords = buffer.toBytes();
  let padIndex = 0;
  while (dataCodewords.length < dataCodewordCount) {
    dataCodewords.push(padIndex % 2 === 0 ? 0xec : 0x11);
    padIndex += 1;
  }

  const dataBlocks: number[][] = [];
  const errorBlocks: number[][] = [];
  let offset = 0;
  for (const blockDefinition of definition.blocks) {
    for (let count = 0; count < blockDefinition.count; count += 1) {
      const block = dataCodewords.slice(offset, offset + blockDefinition.dataCodewords);
      offset += blockDefinition.dataCodewords;
      dataBlocks.push(block);
      errorBlocks.push(reedSolomonRemainder(block, blockDefinition.totalCodewords - blockDefinition.dataCodewords));
    }
  }

  const interleaved: number[] = [];
  const maximumDataLength = Math.max(...dataBlocks.map((block) => block.length));
  for (let index = 0; index < maximumDataLength; index += 1) {
    for (const block of dataBlocks) if (index < block.length) interleaved.push(block[index]);
  }
  const maximumErrorLength = Math.max(...errorBlocks.map((block) => block.length));
  for (let index = 0; index < maximumErrorLength; index += 1) {
    for (const block of errorBlocks) if (index < block.length) interleaved.push(block[index]);
  }
  return interleaved;
}

function createEmptyMatrix(size: number): Array<Array<boolean | null>> {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

function setModule(matrix: Array<Array<boolean | null>>, row: number, column: number, dark: boolean): void {
  if (row < 0 || column < 0 || row >= matrix.length || column >= matrix.length) return;
  matrix[row][column] = dark;
}

function placeFinder(matrix: Array<Array<boolean | null>>, row: number, column: number): void {
  for (let rowOffset = -1; rowOffset <= 7; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 7; columnOffset += 1) {
      const inside = rowOffset >= 0 && rowOffset <= 6 && columnOffset >= 0 && columnOffset <= 6;
      const dark = inside && (
        rowOffset === 0 || rowOffset === 6 || columnOffset === 0 || columnOffset === 6
        || (rowOffset >= 2 && rowOffset <= 4 && columnOffset >= 2 && columnOffset <= 4)
      );
      setModule(matrix, row + rowOffset, column + columnOffset, dark);
    }
  }
}

function placeAlignment(matrix: Array<Array<boolean | null>>, centerRow: number, centerColumn: number): void {
  if (matrix[centerRow][centerColumn] !== null) return;
  for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
    for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
      const distance = Math.max(Math.abs(rowOffset), Math.abs(columnOffset));
      setModule(matrix, centerRow + rowOffset, centerColumn + columnOffset, distance !== 1);
    }
  }
}

function formatInfoBits(mask: number): number {
  const generator = 0x537;
  const formatMask = 0x5412;
  const data = (0b01 << 3) | mask;
  let remainder = data << 10;
  const bitLength = (input: number) => input === 0 ? 0 : 32 - Math.clz32(input);
  while (bitLength(remainder) >= bitLength(generator)) {
    remainder ^= generator << (bitLength(remainder) - bitLength(generator));
  }
  return ((data << 10) | remainder) ^ formatMask;
}

function reserveAndPlaceFormat(matrix: Array<Array<boolean | null>>, mask: number, writeValues: boolean): void {
  const size = matrix.length;
  const bits = formatInfoBits(mask);
  for (let index = 0; index < 15; index += 1) {
    const dark = writeValues ? ((bits >>> index) & 1) === 1 : false;
    const verticalRow = index < 6 ? index : index < 8 ? index + 1 : size - 15 + index;
    setModule(matrix, verticalRow, 8, dark);

    const horizontalColumn = index < 8 ? size - index - 1 : index < 9 ? 7 : 15 - index - 1;
    setModule(matrix, 8, horizontalColumn, dark);
  }
  setModule(matrix, size - 8, 8, writeValues);
}


function versionInfoBits(version: number): number {
  const generator = 0x1f25;
  let remainder = version << 12;
  const bitLength = (input: number) => input === 0 ? 0 : 32 - Math.clz32(input);
  while (bitLength(remainder) >= bitLength(generator)) {
    remainder ^= generator << (bitLength(remainder) - bitLength(generator));
  }
  return (version << 12) | remainder;
}

function reserveAndPlaceVersion(matrix: Array<Array<boolean | null>>, version: number, writeValues: boolean): void {
  if (version < 7) return;
  const size = matrix.length;
  const bits = versionInfoBits(version);
  for (let index = 0; index < 18; index += 1) {
    const dark = writeValues ? ((bits >>> index) & 1) === 1 : false;
    const row = Math.floor(index / 3);
    const column = (index % 3) + size - 11;
    setModule(matrix, row, column, dark);
    setModule(matrix, column, row, dark);
  }
}

function maskApplies(mask: number, row: number, column: number): boolean {
  switch (mask) {
    case 0: return (row + column) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return column % 3 === 0;
    case 3: return (row + column) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5: return ((row * column) % 2) + ((row * column) % 3) === 0;
    case 6: return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0;
    case 7: return (((row * column) % 3) + ((row + column) % 2)) % 2 === 0;
    default: return false;
  }
}

function buildMatrix(definition: VersionDefinition, codewords: number[], mask: number): QrMatrix {
  const size = 17 + definition.version * 4;
  const matrix = createEmptyMatrix(size);
  placeFinder(matrix, 0, 0);
  placeFinder(matrix, size - 7, 0);
  placeFinder(matrix, 0, size - 7);

  for (const row of definition.alignmentCenters) {
    for (const column of definition.alignmentCenters) placeAlignment(matrix, row, column);
  }
  for (let index = 8; index < size - 8; index += 1) {
    if (matrix[6][index] === null) matrix[6][index] = index % 2 === 0;
    if (matrix[index][6] === null) matrix[index][6] = index % 2 === 0;
  }
  reserveAndPlaceFormat(matrix, mask, false);
  reserveAndPlaceVersion(matrix, definition.version, false);

  let row = size - 1;
  let direction = -1;
  let byteIndex = 0;
  let bitIndex = 7;
  for (let column = size - 1; column > 0; column -= 2) {
    if (column === 6) column -= 1;
    while (true) {
      for (let offset = 0; offset < 2; offset += 1) {
        const targetColumn = column - offset;
        if (matrix[row][targetColumn] !== null) continue;
        let dark = byteIndex < codewords.length && ((codewords[byteIndex] >>> bitIndex) & 1) === 1;
        if (maskApplies(mask, row, targetColumn)) dark = !dark;
        matrix[row][targetColumn] = dark;
        bitIndex -= 1;
        if (bitIndex < 0) {
          byteIndex += 1;
          bitIndex = 7;
        }
      }
      row += direction;
      if (row < 0 || row >= size) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }
  reserveAndPlaceFormat(matrix, mask, true);
  reserveAndPlaceVersion(matrix, definition.version, true);
  return matrix.map((matrixRow) => matrixRow.map(Boolean));
}

function scoreMatrix(matrix: QrMatrix): number {
  const size = matrix.length;
  let score = 0;

  const scoreLine = (line: boolean[]) => {
    let lineScore = 0;
    let runLength = 1;
    for (let index = 1; index < line.length; index += 1) {
      if (line[index] === line[index - 1]) runLength += 1;
      else {
        if (runLength >= 5) lineScore += 3 + runLength - 5;
        runLength = 1;
      }
    }
    if (runLength >= 5) lineScore += 3 + runLength - 5;
    const bits = line.map((dark) => dark ? "1" : "0").join("");
    for (let index = 0; index <= bits.length - 11; index += 1) {
      const segment = bits.slice(index, index + 11);
      if (segment === "10111010000" || segment === "00001011101") lineScore += 40;
    }
    return lineScore;
  };

  for (let row = 0; row < size; row += 1) score += scoreLine(matrix[row]);
  for (let column = 0; column < size; column += 1) score += scoreLine(matrix.map((row) => row[column]));

  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const valueAtCell = matrix[row][column];
      if (matrix[row + 1][column] === valueAtCell && matrix[row][column + 1] === valueAtCell && matrix[row + 1][column + 1] === valueAtCell) score += 3;
    }
  }

  const darkCount = matrix.flat().filter(Boolean).length;
  const percentage = (darkCount * 100) / (size * size);
  score += Math.floor(Math.abs(percentage - 50) / 5) * 10;
  return score;
}

export function createQrMatrix(payload: string): QrMatrix {
  const normalized = payload.trim();
  if (!normalized) throw new Error("QR payload is required.");
  const payloadBytes = new TextEncoder().encode(normalized);
  const definition = chooseVersion(payloadBytes.length);
  const codewords = createCodewords(normalized, definition);
  let best = buildMatrix(definition, codewords, 0);
  let bestScore = scoreMatrix(best);
  for (let mask = 1; mask < 8; mask += 1) {
    const candidate = buildMatrix(definition, codewords, mask);
    const candidateScore = scoreMatrix(candidate);
    if (candidateScore < bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}

export function createQrSvgDataUri(payload: string, moduleSize = 8, quietZone = 4): string {
  const matrix = createQrMatrix(payload);
  const dimension = matrix.length + quietZone * 2;
  const path = matrix.flatMap((row, rowIndex) => row.map((dark, columnIndex) => dark
    ? `M${columnIndex + quietZone} ${rowIndex + quietZone}h1v1h-1z`
    : "")).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" width="${dimension * moduleSize}" height="${dimension * moduleSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#020617"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
