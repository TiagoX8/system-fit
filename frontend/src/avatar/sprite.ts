/**
 * Pixel art do Caçador: uma grade 16x24 de caracteres por camada.
 *
 * Cada caractere é uma cor lógica (pele, cabelo, primária do set...) que só
 * ganha valor na hora de desenhar, com as cores que o backend manda no
 * catálogo. Assim um set novo é só uma paleta, não um desenho novo.
 */

export const WIDTH = 16
export const HEIGHT = 24

export type Grid = string[]

type Cell = [row: number, col: number, char: string]

function grid(cells: Cell[]): Grid {
  const rows = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => '.'))

  for (const [row, col, char] of cells) {
    if (rows[row] && col >= 0 && col < WIDTH) {
      rows[row][col] = char
    }
  }

  return rows.map((row) => row.join(''))
}

function span(row: number, from: number, to: number, char: string): Cell[] {
  const cells: Cell[] = []

  for (let col = from; col <= to; col += 1) {
    cells.push([row, col, char])
  }

  return cells
}

function column(col: number, from: number, to: number, char: string): Cell[] {
  const cells: Cell[] = []

  for (let row = from; row <= to; row += 1) {
    cells.push([row, col, char])
  }

  return cells
}

/** Corpo, rosto e a roupa base: 'S' pele, 'A' primária, 'B' secundária, 'T' detalhe. */
export const BODY: Grid = [
  '................',
  '................',
  '.....SSSSSS.....',
  '....SSSSSSSS....',
  '....SSSSSSSS....',
  '....SEESSEES....',
  '....SSSSSSSS....',
  '.....SssssS.....',
  '....SSSSSSSS....',
  '.....SSSSSS.....',
  '......SSSS......',
  '...TTAAAAAATT...',
  '..AAAAAAAAAAAA..',
  '..AAAAAAAAAAAA..',
  '..AAAAAAAAAAAA..',
  '..SAAAAAAAAAAS..',
  '...AAAAAAAAAA...',
  '...TTTTTTTTTT...',
  '...BBBB..BBBB...',
  '...BBBB..BBBB...',
  '...BBBB..BBBB...',
  '...BBBB..BBBB...',
  '..TTTTT..TTTTT..',
  '..TTTTT..TTTTT..',
]

/** Cabelos: 'H' cor principal, 'h' sombra. */
export const HAIR: Record<string, Grid> = {
  curto: [
    '................',
    '.....hhhhhh.....',
    '....hHHHHHHh....',
    '...hHHHHHHHHh...',
    '...hH......Hh...',
    ...Array.from({ length: 19 }, () => '................'),
  ],
  espetado: grid([
    ...span(0, 4, 5, 'h'),
    ...span(0, 7, 8, 'h'),
    ...span(0, 10, 11, 'h'),
    ...span(1, 4, 11, 'H'),
    ...span(2, 3, 12, 'H'),
    [3, 3, 'h'],
    [3, 4, 'H'],
    [3, 11, 'H'],
    [3, 12, 'h'],
    [4, 3, 'h'],
    [4, 12, 'h'],
  ]),
  longo: grid([
    ...span(1, 5, 10, 'h'),
    ...span(2, 4, 11, 'H'),
    ...span(3, 3, 12, 'H'),
    ...column(3, 4, 6, 'h'),
    ...column(12, 4, 6, 'h'),
    ...column(4, 4, 6, 'H'),
    ...column(11, 4, 6, 'H'),
    ...column(3, 7, 9, 'h'),
    ...column(12, 7, 9, 'h'),
    ...column(4, 7, 8, 'h'),
    ...column(11, 7, 8, 'h'),
  ]),
  moicano: grid([
    ...span(0, 6, 9, 'h'),
    ...span(1, 6, 9, 'H'),
    [1, 5, 'h'],
    [1, 10, 'h'],
    ...span(2, 5, 10, 'H'),
    [2, 4, 'h'],
    [2, 11, 'h'],
    ...span(3, 5, 10, 'H'),
    [3, 3, 'h'],
    [3, 12, 'h'],
  ]),
}

/** Detalhes que o set adiciona por cima do corpo. */
export const FEATURES: Record<string, Grid> = {
  shoulders: grid([
    ...span(11, 2, 3, 'T'),
    ...span(11, 12, 13, 'T'),
    ...span(12, 1, 3, 'T'),
    ...span(12, 12, 14, 'T'),
    [13, 2, 'T'],
    [13, 13, 'T'],
  ]),
  belt: grid([...span(17, 3, 12, 'T'), [16, 7, 'T'], [16, 8, 'T']]),
  helmet: grid([
    ...span(2, 4, 11, 'T'),
    [3, 3, 'T'],
    [3, 12, 'T'],
    [4, 3, 'T'],
    [4, 12, 'T'],
  ]),
  cape: grid([
    ...column(0, 12, 20, 'C'),
    ...column(1, 11, 20, 'C'),
    ...column(14, 11, 20, 'C'),
    ...column(15, 12, 20, 'C'),
    ...span(21, 0, 2, 'C'),
    ...span(21, 13, 15, 'C'),
  ]),
}

/** Armas: 'V' lâmina, 'G' cabo. */
export const WEAPON: Record<string, Grid> = {
  nenhuma: grid([]),
  bastao: grid([...column(14, 6, 17, 'G')]),
  adaga: grid([...column(14, 10, 13, 'V'), ...column(14, 14, 16, 'G')]),
  espada: grid([
    ...column(14, 5, 13, 'V'),
    ...span(14, 13, 15, 'V'),
    ...column(14, 15, 17, 'G'),
  ]),
  machado: grid([
    ...span(5, 13, 15, 'V'),
    ...span(6, 13, 15, 'V'),
    ...span(7, 13, 15, 'V'),
    ...column(14, 8, 17, 'G'),
  ]),
  alabarda: grid([
    ...column(14, 2, 5, 'V'),
    [4, 13, 'V'],
    [4, 15, 'V'],
    ...column(14, 6, 19, 'G'),
  ]),
  sombras: grid([
    ...column(14, 3, 13, 'V'),
    ...column(13, 6, 12, 'V'),
    ...span(14, 12, 15, 'V'),
    ...column(14, 15, 17, 'G'),
  ]),
}
