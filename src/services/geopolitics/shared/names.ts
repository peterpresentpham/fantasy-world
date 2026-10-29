import { createSeededRandom } from 'src/services/utils/math';

const starts = [
  'Al',
  'Bel',
  'Cor',
  'Dor',
  'El',
  'Fal',
  'Gal',
  'Har',
  'Is',
  'Kor',
  'Lor',
  'Mar',
  'Nor',
  'Or',
  'Pel',
  'Quel',
  'Riv',
  'Sel',
  'Tor',
  'Val',
  'Wen',
  'Yar',
  'Zor',

  // new
  'Ar',
  'Bar',
  'Cer',
  'Drak',
  'Eld',
  'Fen',
  'Gor',
  'Hel',
  'Ith',
  'Jar',
  'Kel',
  'Lun',
  'Mor',
  'Ner',
  'Ost',
  'Pra',
  'Quin',
  'Ran',
  'Sar',
  'Thal',
  'Ul',
  'Var',
  'Vor',
  'Xan',
  'Yel',
  'Zen',

  // more “regional” flavor
  'Bao',
  'Dai',
  'Hua',
  'Kyo',
  'Min',
  'Shen',
  'Tian',
  'Xia',
  'Kaz',
  'Uz',
  'Tur',
  'Alt',
  'Bukh',
  'Nov',
  'Petro',
  'Vlad',
  'Zem',
];

const mids = [
  'a',
  'e',
  'i',
  'o',
  'u',
  'ae',
  'ia',
  'oa',
  'ei',

  // new
  'ai',
  'au',
  'ou',
  'ie',
  'ui',
  'aa',
  'eo',
  'io',

  // consonant blends (adds realism)
  'ar',
  'or',
  'ir',
  'ur',
  'an',
  'en',
  'in',
  'on',
  'al',
  'el',
  'il',
  'ol',

  // exotic flavor
  'ya',
  'yo',
  'yu',
  'kh',
  'zh',
  'sh',
];

const ends = [
  'dor',
  'land',
  'ria',
  'mar',
  'vale',
  'stan',
  'mere',
  'gard',
  'wyn',
  'crest',

  // new classic
  'nia',
  'lia',
  'via',
  'tan',
  'ron',
  'ros',
  'tis',
  'nus',
  'grad',
  'burg',
  'heim',
  'hold',
  'ford',
  'port',

  // regional
  'khan',
  'abad',
  'istan',
  'pur',
  'jing',
  'zhou',
  'shan',
  'sk',
  'vich',
  'ova',

  // softer / fantasy
  'lune',
  'thia',
  'dell',
  'vara',
  'mora',
  'zeth',
];

export function createRegionalName(seed: string, namespace: string, id: number, prefix?: string) {
  const random = createSeededRandom(`${seed}:${namespace}:${id}:name`);
  const start = starts[Math.floor(random() * starts.length)] as string;
  const mid = mids[Math.floor(random() * mids.length)] as string;
  const end = ends[Math.floor(random() * ends.length)] as string;
  const root = `${start}${mid}${end}`;
  return prefix ? `${prefix} ${root}` : root;
}
