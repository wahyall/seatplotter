/** index 0-based → letter. 0→A, 25→Z */
export function indexToChar(i: number): string {
  return String.fromCharCode(65 + i);
}

/** letter → index. A→0, Z→25 */
export function charToIndex(c: string): number {
  return c.toUpperCase().charCodeAt(0) - 65;
}

/** 0-based index → Excel-style letters: 0→A, 25→Z, 26→AA, …, 51→AZ */
export function indexToExcelLetters(zeroBased: number): string {
  if (zeroBased < 0) return "";
  let n = zeroBased + 1;
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

const MAX_COL_SPAN = 52;

/** Column numbers left → right as displayed. */
export function getColHeaders(
  colStartChar: string,
  cols: number,
  reverseCol: boolean,
): string[] {
  const startNumber = charToIndex(colStartChar) + 1;
  const headers = Array.from({ length: cols }, (_, i) =>
    String(startNumber + i),
  );
  return reverseCol ? [...headers].reverse() : headers;
}

/** Row letters top → bottom as displayed, configurable start letter. */
export function getRowHeaders(rowStartChar: string, rows: number): string[] {
  const start = charToIndex(rowStartChar);
  return Array.from({ length: rows }, (_, i) => indexToExcelLetters(start + i));
}

export function generateSeatLabel(
  rowIndex: number,
  colIndex: number,
  rowHeaders: string[],
  colHeaders: string[],
): string {
  return `${rowHeaders[rowIndex]}${colHeaders[colIndex]}`;
}

export function generateSeatsForLayout(
  layoutId: string,
  rows: number,
  cols: number,
  colStartChar: string,
  reverseCol: boolean,
) {
  const rowHeaders = getRowHeaders("A", rows);
  const colHeaders = getColHeaders(colStartChar, cols, reverseCol);
  const seats: Array<{
    layout_id: string;
    row: number;
    col: number;
    label: string;
    category_id: null;
    is_empty: boolean;
    is_checked: boolean;
    checked_at: null;
  }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      seats.push({
        layout_id: layoutId,
        row: r,
        col: c,
        label: generateSeatLabel(r, c, rowHeaders, colHeaders),
        category_id: null,
        is_empty: false,
        is_checked: false,
        checked_at: null,
      });
    }
  }
  return seats;
}

export function validateColRange(colStartChar: string, cols: number) {
  const startIdx = charToIndex(colStartChar);
  if (startIdx < 0 || startIdx > 52) {
    return {
      valid: false as const,
      errorMsg: `Angka awal kolom tidak valid.`,
    };
  }
  if (cols < 1 || cols > MAX_COL_SPAN) {
    return {
      valid: false as const,
      errorMsg: `Jumlah kolom harus 1–${MAX_COL_SPAN}.`,
    };
  }
  if (startIdx + cols > MAX_COL_SPAN) {
    const startNumber = startIdx + 1;
    const endNumber = startNumber + cols - 1;
    return {
      valid: false as const,
      errorMsg: `Melebihi ${MAX_COL_SPAN}. Mulai ${startNumber} + ${cols} kolom = sampai ${endNumber}.`,
    };
  }
  return { valid: true as const, errorMsg: "" };
}
