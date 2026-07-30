import type { AslSignLesson, CurriculumUnit, PracticeWord } from '../types/asl'

export const ASL_ALPHABET: AslSignLesson[] = [
  {
    id: 'A',
    displayName: 'A',
    category: 'letter',
    motion: 'static',
    difficulty: 'easy',
    handshapeDescription:
      'Make a fist and rest your thumb up against the side of your curled fingers — the thumb stays on the outside, not tucked in.',
    tip: 'Think of a thumbs-up that got shy and tucked in next to your fist.',
    recognizable: true,
  },
  {
    id: 'B',
    displayName: 'B',
    category: 'letter',
    motion: 'static',
    difficulty: 'easy',
    handshapeDescription:
      'Hold your hand flat with all four fingers together pointing straight up, and fold your thumb across your palm.',
    tip: 'Like a "stop" hand, but with the thumb tucked flat across the palm.',
    recognizable: true,
  },
  {
    id: 'C',
    displayName: 'C',
    category: 'letter',
    motion: 'static',
    difficulty: 'easy',
    handshapeDescription: 'Curve your whole hand into the shape of a "C", as if holding a small cup.',
    tip: 'Literally just draw the letter C with the curve of your hand.',
    recognizable: true,
  },
  {
    id: 'D',
    displayName: 'D',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription:
      'Point your index finger straight up. Touch your thumb to your middle finger while the ring and pinky curl into your palm, forming a small circle underneath the pointing finger.',
    tip: 'One finger standing tall, with a little circle holding it up.',
    recognizable: true,
  },
  {
    id: 'E',
    displayName: 'E',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription: 'Curl all four fingertips down to touch your thumb, like a closed claw.',
    tip: 'Scrunch your whole hand up small, like you\'re squeezing something tiny.',
    recognizable: true,
  },
  {
    id: 'F',
    displayName: 'F',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription:
      'Touch your thumb and index fingertip together to form a small circle, while the middle, ring, and pinky fingers stand up straight.',
    tip: 'An "OK" sign with the three remaining fingers standing tall.',
    recognizable: true,
  },
  {
    id: 'G',
    displayName: 'G',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription:
      'Point your index finger and thumb straight out to the side (horizontally), like a small gun, with the other fingers curled into your palm.',
    tip: 'Point sideways like a tiny finger-gun aimed at the horizon.',
    recognizable: true,
  },
  {
    id: 'H',
    displayName: 'H',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription:
      'Extend your index and middle fingers together, pointing sideways (horizontal), with your thumb resting on the folded ring and pinky.',
    tip: 'Like a "U" that fell over on its side.',
    recognizable: true,
  },
  {
    id: 'I',
    displayName: 'I',
    category: 'letter',
    motion: 'static',
    difficulty: 'easy',
    handshapeDescription: 'Fold your thumb and every finger except your pinky into a fist, and stick your pinky straight up.',
    tip: 'Just your pinky saying hello.',
    recognizable: true,
  },
  {
    id: 'J',
    displayName: 'J',
    category: 'letter',
    motion: 'motion',
    difficulty: 'hard',
    handshapeDescription:
      'Start in the same handshape as "I" (pinky up, everything else folded), then trace the curve of a "J" in the air with your pinky.',
    tip: 'It\'s an "I" that goes for a little swoop — since it needs movement over time, a single still photo can\'t capture it, so live practice won\'t quiz you on this one yet.',
    recognizable: false,
  },
  {
    id: 'K',
    displayName: 'K',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription:
      'Form a "V" with your index and middle fingers pointing up, and touch your thumb between them at the middle finger\'s base.',
    tip: 'A "V" with the thumb sneaking in between the two fingers.',
    recognizable: true,
  },
  {
    id: 'L',
    displayName: 'L',
    category: 'letter',
    motion: 'static',
    difficulty: 'easy',
    handshapeDescription:
      'Stick your thumb out to the side and your index finger straight up, forming an "L" shape, while the other three fingers fold down.',
    tip: 'Like flashing an L for "L"!',
    recognizable: true,
  },
  {
    id: 'M',
    displayName: 'M',
    category: 'letter',
    motion: 'static',
    difficulty: 'hard',
    handshapeDescription:
      'Tuck your thumb under your index, middle, and ring fingers, which fold down flat over it.',
    tip: 'Three fingers stacked over the thumb — remember "M" has three fingers on top, one more than "N".',
    recognizable: true,
  },
  {
    id: 'N',
    displayName: 'N',
    category: 'letter',
    motion: 'static',
    difficulty: 'hard',
    handshapeDescription: 'Tuck your thumb under your index and middle fingers, which fold down flat over it.',
    tip: 'Just two fingers over the thumb — "N" has one less finger on top than "M".',
    recognizable: true,
  },
  {
    id: 'O',
    displayName: 'O',
    category: 'letter',
    motion: 'static',
    difficulty: 'easy',
    handshapeDescription: 'Curve all your fingertips, including the thumb, together so they touch, forming an "O" shape.',
    tip: 'Make your whole hand into a little donut shape.',
    recognizable: true,
  },
  {
    id: 'P',
    displayName: 'P',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription:
      'Like "K", but tipped downward: form a "V" with your index and middle fingers pointing down, with your thumb between them.',
    tip: 'A "K" that took a nosedive toward the floor.',
    recognizable: true,
  },
  {
    id: 'Q',
    displayName: 'Q',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription: 'Like "G", but tipped downward: point your thumb and index finger straight down.',
    tip: 'A "G" that\'s pointing down at your shoes.',
    recognizable: true,
  },
  {
    id: 'R',
    displayName: 'R',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription: 'Cross your index and middle fingers, folding the other fingers into your palm.',
    tip: 'Cross your fingers, literally, like you\'re hoping for good luck.',
    recognizable: true,
  },
  {
    id: 'S',
    displayName: 'S',
    category: 'letter',
    motion: 'static',
    difficulty: 'hard',
    handshapeDescription: 'Make a fist with your thumb wrapped across the front of your fingers.',
    tip: 'A classic closed fist, thumb wrapped in front — easy to mix up with "A" or "T", so check the thumb placement.',
    recognizable: true,
  },
  {
    id: 'T',
    displayName: 'T',
    category: 'letter',
    motion: 'static',
    difficulty: 'hard',
    handshapeDescription: 'Make a fist with your thumb tucked between your index and middle fingers.',
    tip: 'A fist with the thumb peeking out between the first two fingers.',
    recognizable: true,
  },
  {
    id: 'U',
    displayName: 'U',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription:
      'Extend your index and middle fingers straight up together, touching, with the other fingers folded down.',
    tip: 'Two fingers standing up straight and close together, like a "V" that hasn\'t opened up yet.',
    recognizable: true,
  },
  {
    id: 'V',
    displayName: 'V',
    category: 'letter',
    motion: 'static',
    difficulty: 'easy',
    handshapeDescription: 'Extend your index and middle fingers in a "V" shape (peace sign), spread apart.',
    tip: 'The classic peace sign.',
    recognizable: true,
  },
  {
    id: 'W',
    displayName: 'W',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription:
      'Extend your index, middle, and ring fingers and spread them apart, while your thumb holds your pinky down.',
    tip: 'Three spread fingers — count them out for a "W".',
    recognizable: true,
  },
  {
    id: 'X',
    displayName: 'X',
    category: 'letter',
    motion: 'static',
    difficulty: 'medium',
    handshapeDescription:
      'Bend your index finger into a hook shape, folding the other fingers into a fist with your thumb alongside.',
    tip: 'A little finger hook, like a tiny candy cane.',
    recognizable: true,
  },
  {
    id: 'Y',
    displayName: 'Y',
    category: 'letter',
    motion: 'static',
    difficulty: 'easy',
    handshapeDescription:
      'Extend your thumb and pinky out to the sides while the other three fingers fold down — the "hang loose" shape.',
    tip: 'Shaka! Hang loose with your thumb and pinky out.',
    recognizable: true,
  },
  {
    id: 'Z',
    displayName: 'Z',
    category: 'letter',
    motion: 'motion',
    difficulty: 'hard',
    handshapeDescription: 'Extend your index finger and trace the shape of a "Z" in the air.',
    tip: 'Draw a Z with your fingertip, just like writing it on paper — since it\'s a motion sign, still-frame recognition can\'t detect it yet.',
    recognizable: false,
  },
]

export const WORD_SIGNS: AslSignLesson[] = [
  {
    id: 'ILY',
    displayName: 'I Love You',
    category: 'word',
    motion: 'static',
    difficulty: 'easy',
    handshapeDescription:
      'Extend your thumb, index finger, and pinky while folding your middle and ring fingers down — a combination of the letters I, L, and Y in one handshape.',
    tip: 'It blends I + L + Y into a single well-known sign — recognition in v1 only covers the alphabet, so practice mode won\'t quiz this one, but it\'s a fun one to learn anyway!',
    recognizable: false,
  },
]

export const ALL_SIGNS: AslSignLesson[] = [...ASL_ALPHABET, ...WORD_SIGNS]

/** Signs the live webcam classifier can currently attempt to recognize (Practice/Quiz draw from this pool). */
export const RECOGNIZABLE_SIGNS: AslSignLesson[] = ALL_SIGNS.filter((sign) => sign.recognizable)

export const CURRICULUM_UNITS: CurriculumUnit[] = [
  {
    id: 'unit-1-easy',
    title: 'Unit 1: Easy Handshapes',
    description:
      'Start with the most visually distinct letters — shapes that look nothing alike, so they\'re the easiest to tell apart with a camera or a friend watching.',
    signIds: ['A', 'B', 'C', 'F', 'I', 'L', 'O', 'Y'],
  },
  {
    id: 'unit-2-building',
    title: 'Unit 2: Building Skills',
    description:
      'Add the rest of the static, single-handshape letters. These take a bit more finger control, but each one is still held in one still position.',
    signIds: ['D', 'E', 'G', 'H', 'K', 'P', 'Q', 'R', 'U', 'V', 'W', 'X'],
  },
  {
    id: 'unit-3-tricky',
    title: 'Unit 3: Tricky Handshapes',
    description:
      'M, N, S, and T are all closed-fist shapes that differ only in exactly where the thumb tucks — take it slow and double check thumb placement, since these are the letters learners mix up most.',
    signIds: ['M', 'N', 'S', 'T'],
  },
  {
    id: 'unit-4-motion',
    title: 'Unit 4: Motion Signs',
    description:
      'J and Z are the only two letters in the alphabet that require movement rather than a single held shape, so live camera practice can\'t verify them yet — learn them here for completeness.',
    signIds: ['J', 'Z'],
  },
  {
    id: 'unit-5-bonus',
    title: 'Bonus Signs',
    description: 'A few whole-word signs beyond the alphabet, starting with a widely recognized favorite.',
    signIds: ['ILY'],
  },
]

export const PRACTICE_WORDS: PracticeWord[] = [
  { word: 'CAT', hint: 'A common house pet that says meow.' },
  { word: 'DOG', hint: "A loyal pet often called man's best friend." },
  { word: 'SUN', hint: 'The star at the center of our solar system.' },
  { word: 'BOOK', hint: 'You read this, page by page.' },
  { word: 'MOM', hint: 'A word for your mother.' },
  { word: 'TREE', hint: 'Tall, has leaves and roots, grows in a forest.' },
  { word: 'STAR', hint: 'You can see these twinkling in the night sky.' },
  { word: 'BALL', hint: 'Round toy you can throw, kick, or bounce.' },
  { word: 'RAIN', hint: 'Water that falls from clouds.' },
  { word: 'LOVE', hint: 'A deep feeling of care and affection.' },
  { word: 'FISH', hint: 'Lives in water and breathes through gills.' },
  { word: 'BIRD', hint: 'A feathered animal that can usually fly.' },
  { word: 'MOON', hint: "The bright object that orbits Earth at night." },
  { word: 'GAME', hint: 'An activity you play, often with rules and fun.' },
  { word: 'MILK', hint: 'A white drink that often comes from cows.' },
  { word: 'DESK', hint: 'A piece of furniture you sit at to work or study.' },
  { word: 'CAKE', hint: 'A sweet baked treat, often for birthdays.' },
  { word: 'HELLO', hint: 'A friendly greeting you say to someone.' },
  { word: 'SNOW', hint: 'Soft, cold, white flakes that fall in winter.' },
  { word: 'JAZZ', hint: 'A musical genre — fittingly, this word uses both motion letters, J and Z, so it can\'t be fully verified live yet.' },
]

export function getSignById(id: string): AslSignLesson | undefined {
  return ALL_SIGNS.find((sign) => sign.id === id)
}

export const PLATFORM_DISCLAIMER: string =
  'American Sign Language is a complete, rich, and independent language with its own grammar, syntax, and vital facial and non-manual markers — it is not simply English spelled out letter by letter. This platform teaches the fingerspelling alphabet and a small handful of signs as a first, friendly step into ASL, not as a substitute for the language itself. Fingerspelling is a genuinely useful skill on its own (it\'s how signers spell names, places, and words with no established sign), but real fluency and cultural fluency come from sustained learning with Deaf instructors and immersion in the Deaf community. We warmly encourage every learner who enjoys this platform to keep going: seek out Deaf-led classes, local Deaf events, and native signers, and let this be a starting point rather than a destination.'
