// Kategorierne i afstemningen. Rækkefølgen her er rækkefølgen på siden.
// `id` bruges i databasen, så ret den ikke, efter der er afgivet stemmer.
export const CATEGORIES = [
  {
    id: 'humorspreder',
    emoji: '☀️',
    title: 'Årets humørspreder',
    text: 'Personen, der altid spreder smil, grin og god energi omkring sig! Uanset om det er mandag morgen eller en ekstra travl arbejdsdag, formår vedkommende at løfte stemningen og få kollegaerne i godt humør. Med sin positive energi og smittende glæde gør denne person arbejdsdagen lidt sjovere for alle!',
  },
  {
    id: 'original',
    emoji: '🌟',
    title: 'Årets original',
    text: 'Personen, der med sin helt unikke personlighed sætter et særligt præg på kontoret! Uanset om det er med skøre påfund, sjove kommentarer, særlige vaner eller sin helt egen måde at gøre tingene på, formår vedkommende altid at skille sig ud fra mængden. En kollega, der gør hverdagen lidt mere farverig, underholdende og uforudsigelig – og som kontoret bare ikke ville være det samme uden!',
  },
  {
    id: 'hverdagshelt',
    emoji: '🦸‍♀️',
    title: 'Årets hverdagshelt',
    text: 'Personen, der altid står klar med en hjælpende hånd og en løsning, når udfordringerne melder sig! Uanset hvor travlt der er, formår vedkommende at bevare overblikket, tænke kreativt og træde til, når det brænder på. En ægte holdspiller, der får tingene til at lykkes, gør hverdagen lettere for sine kollegaer og altid er klar til at gøre en ekstra indsats!',
  },
  {
    id: 'dansegulv',
    emoji: '🪩',
    title: 'Årets dansegulvsdronning/-konge',
    text: 'Personen, der aldrig lader et godt beat gå til spilde! Når musikken spiller, er vedkommende den første på dansegulvet og ofte den sidste til at forlade det. Med vilde moves, masser af energi og en feststemning i top er denne person altid klar til at give den gas! 💃🥂',
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
