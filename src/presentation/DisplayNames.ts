const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const OPAQUE_ID = new RegExp(`\\b(?:report|prop)[_-]${UUID}\\b|\\b${UUID}\\b|\\b[0-9a-f]{32}\\b`, 'gi');

const words = (text: string): string[] => text.split(/\s+/);
const CN_SURNAME = words('Tan Lim Lee Ng Chua Goh Wong Teo Ong Koh Yeo Chan Lau Low Sim Chew Foo Heng Seah Toh Phua Quek Ho Yap');
const CN_GIVEN = words('Wei Ming Hui Ling Jun Jie Siew Hwee Kai Xiang Mei Qi Zhi Hao Shu Fen Boon Kiat Li Ting Chee Keong Pei Shan Yi Xuan Jia Wen Xin Zi Han');
const MALE = ['Muhammad Faris', 'Ahmad Hafiz', 'Mohamed Irfan', 'Hakim', 'Zulkifli', 'Azman', 'Razali', 'Muhammad Syafiq', 'Danish', 'Aiman', 'Haziq', 'Amir'];
const FEMALE = ['Nur Aisyah', 'Siti Nurhaliza', 'Nurul Huda', 'Farhana', 'Aminah', 'Zahra', 'Liyana', 'Balqis', 'Sofia', 'Khadijah', 'Rahimah', 'Atiqah'];
const MY_FATHER = words('Ismail Rahman Yusof Osman Abdullah Salleh Zainal Mahmud Hamid Latiff Ibrahim Jaafar');
const IN_MALE = words('Rajesh Arun Suresh Vikram Kumar Ravi Anand Dinesh Mohan Karthik Gopal Vijay');
const IN_FEMALE = words('Priya Kavitha Deepa Lakshmi Anita Meena Revathi Sangeetha Devi Malathi Shanti Uma');
const IN_FATHER = words('Pillai Krishnan Subramaniam Muthusamy Nair Raman Chandran Govindasamy Rajan Suppiah Balakrishnan Naidu');
const EU_GIVEN = words('Daniel Sharon Marcus Jacqueline Gabriel Natalie Ryan Corinne Joshua Vanessa Dominic Clarice');
const EU_SURNAME = words('Pereira De-Souza Rozario Sequeira Oliveiro Westerhout Shepherdson Xavier Fernandez Rodrigues Gomes Lazaroo');

function mix(n: number): number {
  let x = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
const pick = <T>(list: readonly T[], n: number): T => list[n % list.length]!;

export function candidateSingaporeName(seedNum: number): string {
  const a = mix(seedNum), b = mix(a + 1), c = mix(b + 1), d = mix(c + 1);
  switch (a % 4) {
    case 0: return `${pick(CN_SURNAME, b)} ${pick(CN_GIVEN, c)} ${pick(CN_GIVEN, d)}`;
    case 1: { const f = b % 2 === 1; return `${pick(f ? FEMALE : MALE, c)} ${f ? 'binte' : 'bin'} ${pick(MY_FATHER, d)}`; }
    case 2: { const f = b % 2 === 1; return `${pick(f ? IN_FEMALE : IN_MALE, c)} ${f ? 'd/o' : 's/o'} ${pick(IN_FATHER, d)}`; }
    default: return `${pick(EU_GIVEN, b)} ${pick(EU_SURNAME, c).replace('-', ' ')}`;
  }
}

export function deterministicSingaporeName(seed: string): string {
  let h = 17;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return candidateSingaporeName(h);
}

/** A short, human-readable heading with fixture markers and opaque identifiers removed. */
export function cleanTitle(value: string | undefined | null, fallback: string): string {
  const cleaned = (value ?? '')
    .replace(/^\s*\[DEMO[^\]]*\]\s*/i, '')
    .replace(/^\s*DEMO(?:\s+\d{8}(?:\s+[A-Z0-9_-]+)?\b)?\s*[:#-]?\s*/i, '')
    .replace(OPAQUE_ID, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:–—|]+|[\s:–—|]+$/g, '')
    .trim();
  if (!cleaned || /^unassigned$/i.test(cleaned)) return fallback;
  return cleaned.charAt(0).toLocaleUpperCase() + cleaned.slice(1);
}

/** Build a compact task heading from its recorded task, pest, and locality. */
export function displayTaskName(taskType?: string, pestType?: string, locality?: string): string {
  const task = cleanTitle(taskType, 'Inspection');
  const pest = pestType ? cleanTitle(pestType, '') : '';
  const place = locality ? cleanTitle(locality, 'Reported location') : '';
  return [task, pest && !task.toLowerCase().includes(pest.toLowerCase()) ? pest : '', place]
    .filter(Boolean)
    .join(' · ');
}
