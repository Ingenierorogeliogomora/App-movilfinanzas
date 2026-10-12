// Automatic categorization for imported transactions. Person-specific rules
// (learned when the user re-categorizes something) always win over the
// built-in dictionary of common US merchants.

import type { Rule, TxType } from './types';

const NOISE = [
  /\bpurchase authorized on \d{1,2}\/\d{1,2}\b/g,
  /\brecurring payment authorized on \d{1,2}\/\d{1,2}\b/g,
  /\b(pos|debit card|check card|checkcard|visa|mastercard|mc|card) (purchase|debit|pymt|payment)\b/g,
  /\bpos\b/g,
  /\bdbt crd\b/g,
  /\bach (debit|credit|withdrawal)\b/g,
  /\bweb id\b.*$/g,
  /\bppd id\b.*$/g,
  /\bcard \d{4}\b/g,
  /\b(sq|tst|sp|pp|pypl|paypal|dd|py) \*?\s*/g,
];

/** Lowercase, accent-free, without card numbers, dates and bank boilerplate. */
export function normalizeDescription(desc: string): string {
  let s = (desc || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[*#]/g, ' ');
  for (const re of NOISE) s = s.replace(re, ' ');
  return s
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ')
    .replace(/\b[a-z]*\d{3,}[a-z0-9]*\b/g, ' ')
    .replace(/[^a-z0-9&.' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Payment rails: the useful part of "ZELLE TO JUAN PEREZ" is the person, so
// these keep more words (a rule for "zelle to" would catch every Zelle).
const RAILS = /^(zelle|venmo|cash ?app|cashapp|paypal|apple cash|wire|ach|online|mobile|transfer|payment|recurring|check|cheque|deposit|withdrawal|atm|xfer)$/;

/** Short merchant identity used to group transactions ("netflix.com", "uber eats"). */
export function merchantKey(desc: string): string {
  const words = normalizeDescription(desc)
    .split(' ')
    .filter((w) => w.length >= 2 && /[a-z]/.test(w) && !/^(the|of|and|inc|llc|co|ca|tx|fl|ny|us|usa)$/.test(w));
  return words.slice(0, words.length && RAILS.test(words[0]) ? 4 : 2).join(' ');
}

interface BuiltinRule {
  key: string;
  type?: TxType;
  words: string[];
}

// Ordered by priority. Merchant rules come before generic transfer phrases so
// "DUKE ENERGY ONLINE PAYMENT" is a utility, not a transfer.
const MERCHANT_RULES: BuiltinRule[] = [
  {
    key: 'interest_fees',
    words: [
      'interest charge', 'finance charge', 'purchase interest', 'interest on purchases', 'late fee',
      'late payment fee', 'annual fee', 'membership fee', 'overdraft', 'nsf fee', 'returned item fee',
      'monthly service fee', 'service charge', 'maintenance fee', 'atm fee', 'foreign transaction fee',
      'cash advance fee', 'balance transfer fee', 'intereses', 'comision',
    ],
  },
  {
    key: 'family_support',
    words: [
      'remitly', 'western union', 'moneygram', 'xoom', 'ria money', 'ria financial', 'sendwave',
      'viamericas', 'intermex', 'dolex', 'boss revolution', 'pangea', 'taptap send', 'worldremit',
    ],
  },
  {
    key: 'subscriptions',
    words: [
      'netflix', 'spotify', 'hulu', 'disney plus', 'disneyplus', 'hbo max', 'max.com', 'paramount',
      'peacock', 'apple.com bill', 'apple.com', 'itunes', 'icloud', 'youtube premium', 'youtube tv',
      'google storage', 'google one', 'amazon prime', 'prime video', 'audible', 'kindle unlimited',
      'siriusxm', 'sirius xm', 'pandora', 'openai', 'chatgpt', 'microsoft 365', 'adobe', 'dropbox',
      'crunchyroll', 'playstation plus', 'xbox game pass', 'nintendo online', 'patreon', 'onlyfans',
      'duolingo', 'canva', 'linkedin premium', 'new york times', 'nytimes', 'wsj',
    ],
  },
  {
    key: 'dining',
    words: [
      'uber eats', 'ubereats', 'doordash', 'grubhub', 'postmates', 'mcdonald', 'starbucks', 'chipotle',
      'subway', 'taco bell', 'wendy', 'burger king', 'dunkin', 'chick fil', 'chickfila', 'popeyes',
      'kfc', 'pizza', 'domino', 'papa john', 'little caesars', 'panera', 'five guys', 'shake shack',
      'in n out', 'whataburger', 'sonic drive', 'jack in the box', 'arby', 'panda express', 'ihop',
      'denny', 'applebee', 'olive garden', 'chili', 'buffalo wild', 'outback', 'texas roadhouse',
      'red lobster', 'cracker barrel', 'wingstop', 'jersey mike', 'jimmy john', 'dairy queen',
      'restaurant', 'restaurante', 'taqueria', 'cafe', 'coffee', 'bakery', 'panaderia', 'grill',
      'kitchen', 'sushi', 'bar & grill',
    ],
  },
  {
    key: 'groceries',
    words: [
      'walmart', 'wal mart', 'wm supercenter', 'kroger', 'publix', 'safeway', 'aldi', 'trader joe',
      'whole foods', 'wholefds', 'h e b', 'heb', 'costco', 'sams club', "sam's club", 'food lion',
      'wegmans', 'meijer', 'winco', 'sprouts', 'albertsons', 'vons', 'ralphs', 'fred meyer',
      'harris teeter', 'giant food', 'stop & shop', 'stop shop', 'hy vee', 'hyvee', 'food 4 less',
      'smart & final', 'save a lot', 'piggly wiggly', 'winn dixie', 'fiesta mart', 'el super',
      'vallarta', 'northgate', 'cardenas', 'la michoacana', 'supermercado', 'supermarket', 'grocery',
      'groceries', 'food market', 'farmers market', 'instacart', 'carniceria',
    ],
  },
  {
    key: 'transportation',
    words: [
      'shell', 'chevron', 'exxon', 'exxonmobil', 'mobil', 'bp', 'speedway', 'wawa', 'circle k',
      'valero', 'marathon', 'sunoco', 'citgo', 'quiktrip', 'qt', 'racetrac', 'murphy usa', 'murphy oil',
      'sheetz', 'casey', 'pilot', 'loves travel', 'arco', 'conoco', 'phillips 66', 'gulf oil',
      'uber', 'lyft', 'metro', 'mta', 'bart', 'transit', 'parking', 'parkmobile', 'toll', 'tollway', 'ez pass',
      'ezpass', 'sunpass', 'fastrak', 'txtag', 'autozone', 'o reilly', 'advance auto', 'jiffy lube',
      'valvoline', 'firestone', 'discount tire', 'pep boys', 'car wash', 'dmv', 'gas station',
      'gasolinera',
    ],
  },
  {
    key: 'utilities',
    words: [
      'duke energy', 'pg&e', 'pge', 'con ed', 'coned', 'fpl', 'florida power', 'georgia power',
      'dominion energy', 'xcel energy', 'southern california edison', 'sce', 'socalgas', 'nicor',
      'atmos energy', 'centerpoint', 'reliant', 'txu', 'entergy', 'aep', 'dte energy', 'consumers energy',
      'eversource', 'national grid', 'peco', 'comed', 'water', 'electric', 'energy', 'utility',
      'utilities', 'waste management', 'republic services', 'sewer',
    ],
  },
  {
    key: 'phone_internet',
    words: [
      'comcast', 'xfinity', 'spectrum', 'charter', 'cox comm', 'optimum', 'frontier', 'at&t', 'att ',
      'verizon', 't mobile', 'tmobile', 'sprint', 'cricket', 'metro by t', 'metropcs', 'boost mobile',
      'mint mobile', 'visible', 'google fi', 'straight talk', 'tracfone', 'total wireless',
      'us mobile', 'starlink', 'internet',
    ],
  },
  {
    key: 'insurance',
    words: [
      'geico', 'progressive', 'state farm', 'allstate', 'farmers ins', 'liberty mutual', 'usaa',
      'nationwide', 'travelers', 'root insurance', 'lemonade', 'metlife', 'aflac', 'insurance',
      'seguro', 'aseguranza',
    ],
  },
  {
    key: 'health',
    words: [
      'cvs', 'walgreens', 'rite aid', 'pharmacy', 'farmacia', 'medical', 'clinic', 'clinica',
      'hospital', 'dental', 'dentist', 'doctor', 'urgent care', 'labcorp', 'quest diagnostics',
      'optometr', 'vision', 'kaiser', 'goodrx',
    ],
  },
  {
    key: 'personal_care',
    words: [
      'planet fitness', 'la fitness', '24 hour fitness', 'anytime fitness', 'crunch fitness',
      'equinox', 'gym', 'salon', 'barber', 'barberia', 'nail', 'nails', 'spa', 'ulta', 'sephora', 'great clips',
      'supercuts', 'sally beauty',
    ],
  },
  {
    key: 'entertainment',
    words: [
      'amc', 'regal', 'cinemark', 'cinema', 'theater', 'theatre', 'ticketmaster', 'stubhub',
      'eventbrite', 'steam', 'playstation', 'xbox', 'nintendo', 'twitch', 'dave & buster',
      'topgolf', 'bowling', 'concert', 'museum', 'six flags', 'disneyland', 'universal studios',
    ],
  },
  {
    key: 'travel',
    words: [
      'airline', 'airlines', 'delta air', 'united air', 'american air', 'southwest', 'jetblue',
      'spirit air', 'frontier air', 'alaska air', 'volaris', 'aeromexico', 'avianca', 'hotel',
      'marriott', 'hilton', 'hyatt', 'holiday inn', 'airbnb', 'vrbo', 'expedia', 'booking.com',
      'priceline', 'hertz', 'enterprise rent', 'avis', 'budget rent', 'greyhound', 'amtrak',
    ],
  },
  {
    key: 'education_kids',
    words: [
      'tuition', 'school', 'college', 'university', 'universidad', 'coursera', 'udemy', 'daycare',
      'child care', 'childcare', 'guarderia', 'kindercare', 'scholastic',
    ],
  },
  {
    key: 'pets',
    words: ['petco', 'petsmart', 'chewy', 'veterinar', 'vet clinic', 'banfield', 'bark box'],
  },
  {
    key: 'gifts_donations',
    words: ['donation', 'donacion', 'church', 'iglesia', 'gofundme', 'red cross', 'unicef', 'charity', 'tithe', 'diezmo'],
  },
  {
    key: 'shopping',
    words: [
      'amazon', 'amzn', 'target', 'best buy', 'home depot', 'lowes', "lowe's", 'ebay', 'etsy', 'shein',
      'temu', 'tj maxx', 'tjmaxx', 'marshalls', 'ross stores', 'ross dress', 'macy', 'nordstrom',
      'kohls', "kohl's", 'old navy', 'gap', 'h&m', 'zara', 'nike', 'adidas', 'foot locker', 'ikea',
      'wayfair', 'dollar tree', 'dollar general', 'family dollar', 'five below', 'big lots',
      'burlington', 'walmart.com', 'apple store', 'gamestop', 'michaels', 'hobby lobby', 'joann',
      'bed bath', 'staples', 'office depot', 'dicks sporting', 'academy sports', 'aliexpress',
    ],
  },
  {
    key: 'housing',
    words: ['rent', '=renta', 'apartment', 'apartments', 'property management', 'hoa', 'mortgage', 'hipoteca', 'landlord'],
  },
  {
    key: 'debt_payments',
    words: [
      'affirm', 'klarna', 'afterpay', 'sezzle', 'zip pay', 'student loan', 'navient', 'nelnet',
      'mohela', 'aidvantage', 'great lakes', 'sallie mae', 'auto loan', 'car payment', 'toyota financial',
      'honda finance', 'ford credit', 'ally auto', 'santander consumer', 'carmax auto', 'westlake',
      'credit acceptance', 'upstart', 'sofi loan', 'lendingclub', 'onemain', 'prestamo',
    ],
  },
  {
    key: 'savings_investments',
    words: [
      'vanguard', 'fidelity', 'schwab', 'robinhood', 'acorns', 'stash', 'betterment', 'wealthfront',
      'webull', 'etrade', 'e trade', 'coinbase', 'transfer to savings', 'to savings', 'ahorro',
    ],
  },
];

const INCOME_RULES: BuiltinRule[] = [
  {
    key: 'salary',
    words: ['payroll', 'direct dep', 'dir dep', 'salary', 'paycheck', 'nomina', 'adp', 'gusto', 'paychex', 'wages', 'sueldo'],
  },
  {
    key: 'other_income',
    words: ['interest paid', 'interest earned', 'dividend', 'cashback', 'cash back', 'tax refund', 'irs treas', 'reward'],
  },
  {
    key: 'side_income',
    words: ['stripe', 'square inc', 'uber driver', 'lyft driver', 'doordash dasher', 'etsy deposit', 'shopify'],
  },
];

// Credit card payments and moves between own accounts are not spending: the
// purchases themselves are already counted. Counting them would double it.
const TRANSFER_WORDS = [
  'payment thank you', 'payment - thank you', 'thank you payment', 'autopay', 'auto pay', 'automatic payment',
  'credit crd', 'credit card payment', 'card payment', 'crd epay', 'epayment', 'e payment', 'mobile pymt',
  'mobile payment', 'online payment thank', 'payment received', 'transfer to', 'transfer from',
  'online transfer', 'xfer', 'internal transfer', 'applecard', 'capital one', 'discover e payment',
  'amex epayment', 'chase card', 'citi card', 'barclaycard', 'synchrony', 'pago tarjeta', 'transferencia',
];

function matches(haystack: string, word: string): boolean {
  // A leading "=" forces a whole-word match ("=renta" must not match "rental").
  const whole = word.startsWith('=');
  const w = word.replace(/^=/, '').replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  if (!w) return false;
  const padded = ` ${haystack.replace(/\./g, ' ').replace(/\s+/g, ' ')} `;
  // Short tokens must match a whole word ("bp", "rent"); longer ones a word start.
  if (whole || w.length <= 4) return padded.includes(` ${w} `);
  return padded.includes(` ${w}`);
}

/** The rule with the most specific (longest) matching keyword wins. */
function findBuiltin(rules: BuiltinRule[], desc: string): BuiltinRule | null {
  let best: BuiltinRule | null = null;
  let bestLen = 0;
  for (const r of rules) {
    for (const w of r.words) {
      if (w.length > bestLen && matches(desc, w)) {
        best = r;
        bestLen = w.length;
      }
    }
  }
  return best;
}

export interface CategorizeContext {
  rules: Rule[];
  /** Maps built-in category keys to the person's category ids. */
  idByKey: Map<string, string>;
}

export interface Categorized {
  type: TxType;
  categoryId: string | null;
  source: 'rule' | 'builtin' | 'default';
}

export function categorize(description: string, direction: 'in' | 'out', ctx: CategorizeContext): Categorized {
  const desc = normalizeDescription(description);
  const fallbackType: TxType = direction === 'in' ? 'income' : 'expense';

  // 1) Person's own rules, longest (most specific) pattern first.
  let bestRule: Rule | null = null;
  for (const r of ctx.rules) {
    // An "expense" rule must not turn a refund into a purchase, and vice versa.
    if (r.txType === 'expense' && direction === 'in') continue;
    if (r.txType === 'income' && direction === 'out') continue;
    const p = normalizeDescription(r.pattern);
    if (p && matches(desc, p) && (!bestRule || p.length > normalizeDescription(bestRule.pattern).length)) {
      bestRule = r;
    }
  }
  if (bestRule) {
    return {
      type: bestRule.txType ?? fallbackType,
      categoryId: bestRule.categoryId,
      source: 'rule',
    };
  }

  const byKey = (key: string) => ctx.idByKey.get(key) ?? null;

  if (direction === 'in') {
    const income = findBuiltin(INCOME_RULES, desc);
    if (income) return { type: 'income', categoryId: byKey(income.key), source: 'builtin' };
    if (TRANSFER_WORDS.some((w) => matches(desc, w))) return { type: 'transfer', categoryId: null, source: 'builtin' };
    // Money back from a store is a refund, not a raise.
    if (findBuiltin(MERCHANT_RULES, desc)) return { type: 'income', categoryId: byKey('refunds'), source: 'builtin' };
    return { type: 'income', categoryId: null, source: 'default' };
  }

  const merchant = findBuiltin(MERCHANT_RULES, desc);
  if (merchant) return { type: 'expense', categoryId: byKey(merchant.key), source: 'builtin' };
  if (TRANSFER_WORDS.some((w) => matches(desc, w))) return { type: 'transfer', categoryId: null, source: 'builtin' };
  return { type: 'expense', categoryId: null, source: 'default' };
}

/** Pattern saved when the person corrects a category, so it applies next time. */
export function ruleFromDescription(description: string): string {
  return merchantKey(description) || normalizeDescription(description).slice(0, 24);
}
