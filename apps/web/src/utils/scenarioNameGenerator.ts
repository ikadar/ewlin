/**
 * Random scenario name generator.
 *
 * Pattern: `[adjectif de taille] [animal] [adjectif qualificatif]`
 * Each piece agrees in gender with the animal — "petite girafe bleue"
 * vs "grand dauphin bleu". Invariant adjectives just declare m === f.
 *
 * Vocabulary aimed at the warm/kid-friendly register the user
 * suggested (girafe bleue, dauphin mignon) — no business jargon, no
 * uppercase, no acronyms.
 */

interface Adjective {
  /** masculine form */
  m: string;
  /** feminine form */
  f: string;
}

interface Animal {
  name: string;
  gender: 'm' | 'f';
}

const SIZES: Adjective[] = [
  { m: 'petit',     f: 'petite' },
  { m: 'grand',     f: 'grande' },
  { m: 'gros',      f: 'grosse' },
  { m: 'moyen',     f: 'moyenne' },
  { m: 'énorme',    f: 'énorme' },
  { m: 'minuscule', f: 'minuscule' },
  { m: 'gigantesque', f: 'gigantesque' },
  { m: 'maousse',   f: 'maousse' },
  { m: 'vaste',     f: 'vaste' },
  { m: 'colossal',  f: 'colossale' },
];

const ANIMALS: Animal[] = [
  // Femelles grammaticales
  { name: 'girafe',     gender: 'f' },
  { name: 'baleine',    gender: 'f' },
  { name: 'tortue',     gender: 'f' },
  { name: 'panthère',   gender: 'f' },
  { name: 'gazelle',    gender: 'f' },
  { name: 'loutre',     gender: 'f' },
  { name: 'libellule',  gender: 'f' },
  { name: 'chenille',   gender: 'f' },
  { name: 'marmotte',   gender: 'f' },
  { name: 'antilope',   gender: 'f' },
  { name: 'taupe',      gender: 'f' },
  { name: 'grenouille', gender: 'f' },
  { name: 'abeille',    gender: 'f' },
  { name: 'sauterelle', gender: 'f' },
  { name: 'mouette',    gender: 'f' },
  { name: 'chouette',   gender: 'f' },
  { name: 'fourmi',     gender: 'f' },
  // Mâles grammaticaux
  { name: 'dauphin',    gender: 'm' },
  { name: 'lion',       gender: 'm' },
  { name: 'tigre',      gender: 'm' },
  { name: 'panda',      gender: 'm' },
  { name: 'koala',      gender: 'm' },
  { name: 'singe',      gender: 'm' },
  { name: 'lapin',      gender: 'm' },
  { name: 'ours',       gender: 'm' },
  { name: 'éléphant',   gender: 'm' },
  { name: 'kangourou',  gender: 'm' },
  { name: 'hérisson',   gender: 'm' },
  { name: 'écureuil',   gender: 'm' },
  { name: 'requin',     gender: 'm' },
  { name: 'pingouin',   gender: 'm' },
  { name: 'hippopotame',gender: 'm' },
  { name: 'rhinocéros', gender: 'm' },
  { name: 'perroquet',  gender: 'm' },
  { name: 'hibou',      gender: 'm' },
  { name: 'corbeau',    gender: 'm' },
  { name: 'paresseux',  gender: 'm' },
  { name: 'caméléon',   gender: 'm' },
];

const QUALITIES: Adjective[] = [
  // Couleurs
  { m: 'bleu',      f: 'bleue' },
  { m: 'rouge',     f: 'rouge' },
  { m: 'jaune',     f: 'jaune' },
  { m: 'violet',    f: 'violette' },
  { m: 'orange',    f: 'orange' },
  { m: 'vert',      f: 'verte' },
  { m: 'rose',      f: 'rose' },
  { m: 'doré',      f: 'dorée' },
  { m: 'argenté',   f: 'argentée' },
  { m: 'turquoise', f: 'turquoise' },
  // Caractères
  { m: 'mignon',    f: 'mignonne' },
  { m: 'joli',      f: 'jolie' },
  { m: 'gentil',    f: 'gentille' },
  { m: 'malin',     f: 'maligne' },
  { m: 'joyeux',    f: 'joyeuse' },
  { m: 'espiègle',  f: 'espiègle' },
  { m: 'curieux',   f: 'curieuse' },
  { m: 'courageux', f: 'courageuse' },
  { m: 'rusé',      f: 'rusée' },
  { m: 'paisible',  f: 'paisible' },
  { m: 'rieur',     f: 'rieuse' },
  { m: 'bavard',    f: 'bavarde' },
  { m: 'calme',     f: 'calme' },
  { m: 'timide',    f: 'timide' },
  { m: 'audacieux', f: 'audacieuse' },
  { m: 'agile',     f: 'agile' },
  { m: 'sage',      f: 'sage' },
  { m: 'sympa',     f: 'sympa' },
  { m: 'rêveur',    f: 'rêveuse' },
  { m: 'pétillant', f: 'pétillante' },
];

function pickRandom<T>(arr: ReadonlyArray<T>): T {
  // Caller guarantees the array is non-empty for our use; the cast
  // makes the return type non-nullable so the caller doesn't have to.
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/**
 * Returns a fresh, gender-agreed scenario name like
 * "petite girafe bleue" or "grand dauphin mignon".
 *
 * Pure : no I/O, deterministic given Math.random's output. Safe to
 * call from React effects.
 */
export function generateScenarioName(): string {
  const animal = pickRandom(ANIMALS);
  const size = pickRandom(SIZES);
  const quality = pickRandom(QUALITIES);
  return `${size[animal.gender]} ${animal.name} ${quality[animal.gender]}`;
}
