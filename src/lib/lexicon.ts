// Lightweight English lexicons used for the abstraction-ratio analysis and stopword filtering.
// We deliberately keep these small and fast — no external NLP packages needed at runtime.

export const STOPWORDS = new Set<string>([
  'a','about','above','after','again','against','all','am','an','and','any','are',"aren't",'as','at',
  'be','because','been','before','being','below','between','both','but','by',
  "can't",'cannot','could',"couldn't",
  'did',"didn't",'do','does',"doesn't",'doing',"don't",'down','during',
  'each',
  'few','for','from','further',
  'had',"hadn't",'has',"hasn't",'have',"haven't",'having','he',"he'd","he'll","he's",'her','here',"here's",'hers','herself','him','himself','his','how',"how's",
  'i',"i'd","i'll","i'm","i've",'if','in','into','is',"isn't",'it',"it's",'its','itself',
  "let's",
  'me','more','most',"mustn't",'my','myself',
  'no','nor','not',
  'of','off','on','once','only','or','other','ought','our','ours','ourselves','out','over','own',
  'same',"shan't",'she',"she'd","she'll","she's",'should',"shouldn't",'so','some','such',
  'than','that',"that's",'the','their','theirs','them','themselves','then','there',"there's",'these','they',"they'd","they'll","they're","they've",'this','those','through','to','too',
  'under','until','up',
  'very',
  'was',"wasn't",'we',"we'd","we'll","we're","we've",'were',"weren't",'what',"what's",'when',"when's",'where',"where's",'which','while','who',"who's",'whom','why',"why's",'with',"won't",'would',"wouldn't",
  'you',"you'd","you'll","you're","you've",'your','yours','yourself','yourselves',
  // narrative filler
  'said','say','says','just','really','very','quite','rather','perhaps','maybe','seem','seems','seemed',
]);

// Very common abstract / cognitive vocabulary. A high frequency of these words signals
// "telling" prose (abstraction-heavy) versus "showing" (concrete sensory verbs/nouns).
export const ABSTRACT_WORDS = new Set<string>([
  'feel','feels','felt','feeling','feelings','thought','thoughts','think','thinks','thinking',
  'realize','realized','realizes','realization','understand','understood','understands',
  'know','knew','known','knows','knowing','knowledge',
  'believe','believed','believes','belief','wonder','wondered','wonders',
  'remember','remembered','remembers','memory','memories','forget','forgot','forgotten',
  'wish','wished','wishes','hope','hoped','hopes','fear','feared','fears','anger','angry',
  'love','loved','loves','hate','hated','hates','sad','sadness','happy','happiness','joy',
  'mind','heart','soul','spirit','idea','ideas','sense','senses','sensation','emotion','emotions',
  'truth','reality','existence','meaning','purpose','destiny','fate','justice','freedom',
  'consciousness','awareness','perception','understanding','realization',
  'somehow','suddenly','obviously','clearly','probably','possibly','definitely','certainly',
  'time','moment','instant','life','lives','death','world','universe','nature','being',
  'situation','condition','state','feeling','manner','way','ways','aspect','aspects','sort','kind',
]);

// Concrete sensory verbs and nouns — body, motion, objects, places.
export const CONCRETE_WORDS = new Set<string>([
  // body / motion
  'walk','walked','walking','run','ran','running','jump','jumped','sit','sat','stand','stood',
  'reach','reached','grab','grabbed','push','pushed','pull','pulled','throw','threw','catch','caught',
  'open','opened','close','closed','shut','slammed','tap','tapped','knock','knocked',
  'turn','turned','step','stepped','lean','leaned','crouch','crouched','kneel','knelt',
  'eyes','hand','hands','fingers','foot','feet','knee','knees','shoulder','shoulders','mouth','lips','teeth','jaw','throat','chest','spine','skin',
  // sensory
  'cold','warm','hot','wet','dry','rough','smooth','sharp','soft','hard','heavy','light',
  'red','blue','green','yellow','black','white','grey','gray','brown','silver','gold',
  'rain','snow','wind','sun','moon','stars','smoke','fire','ash','dust','mud','water','ice',
  // objects / places
  'door','window','table','chair','floor','wall','ceiling','stairs','street','road','car','truck','bus','train','phone','book','knife','gun','glass','bottle','cup','plate','bag','coat','shirt','boots','hat','keys','lamp','lock',
  'kitchen','bedroom','hallway','garage','basement','porch','garden','forest','river','beach','field','barn','cellar','attic','alley','bridge','market','platform','engine','desk','clock',
  // sounds / smells
  'whisper','whispered','shout','shouted','cry','cried','laugh','laughed','growl','growled','sigh','sighed','hiss','hissed','crash','crashed','smell','smelled','scent',
]);
