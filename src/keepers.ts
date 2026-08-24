export const ANNOUNCED_KEEPER_TEAMS = {
  Andy: { name: "Darn Tuten", key: "2025-t03", year: 2025 },
  Ethan: { name: "Uncle Rico", key: "2025-t02", year: 2025 },
  Evan: { name: "He Was a Skattebo", key: "2025-t04", year: 2025 },
  Joey: { name: "Jaxon smoking darts", key: "2025-t13", year: 2025 },
  Jordan: { name: "Ja'Marrican Horror Story", key: "2025-t10", year: 2025 },
  Marc: { name: "Slight Case of the Downs", key: "2025-t11", year: 2025 },
  Mark: { name: "The Pitt Stop", key: "2025-t06", year: 2025 },
  Matt: { name: "The Fungus Monangais", key: "2025-t12", year: 2025 },
  "Nate B.": { name: "A Purdy Strange Team", key: "2025-t05", year: 2025 },
  "Nate S.": { name: "Texas Smoked Brissett", key: "2025-t09", year: 2025 },
} as const;

type AnnouncedKeeper = {
  year: number;
  owner: keyof typeof ANNOUNCED_KEEPER_TEAMS;
  name: string;
  value: number;
  position: string;
  playerKey?: string;
};

export const ANNOUNCED_KEEPERS: readonly AnnouncedKeeper[] = [
  { year: 2026, owner: "Andy", name: "Javonte Williams", value: 3, position: "RB", playerKey: "espn-4361579" },
  { year: 2026, owner: "Andy", name: "Nico Collins", value: 6, position: "WR", playerKey: "espn-4258173" },
  { year: 2026, owner: "Andy", name: "Bhayshul Tuten", value: 1, position: "RB", playerKey: "espn-4882093" },
  { year: 2026, owner: "Ethan", name: "Tetairoa McMillan", value: 14, position: "WR", playerKey: "espn-4685472" },
  { year: 2026, owner: "Ethan", name: "Emeka Egbuka", value: 11, position: "WR", playerKey: "espn-4567750" },
  { year: 2026, owner: "Ethan", name: "Omarion Hampton", value: 37, position: "RB", playerKey: "espn-4685382" },
  { year: 2026, owner: "Evan", name: "CeeDee Lamb", value: 35, position: "WR", playerKey: "espn-4241389" },
  { year: 2026, owner: "Evan", name: "Jonathan Taylor", value: 45, position: "RB", playerKey: "espn-4242335" },
  { year: 2026, owner: "Evan", name: "Cam Skattebo", value: 2, position: "RB", playerKey: "espn-4696981" },
  { year: 2026, owner: "Joey", name: "Jahmyr Gibbs", value: 21, position: "RB", playerKey: "espn-4429795" },
  { year: 2026, owner: "Joey", name: "De'Von Achane", value: 1, position: "RB", playerKey: "espn-4429160" },
  { year: 2026, owner: "Joey", name: "Jaxson Dart", value: 2, position: "QB", playerKey: "espn-4689114" },
  { year: 2026, owner: "Jordan", name: "George Pickens", value: 10, position: "WR", playerKey: "espn-4426354" },
  { year: 2026, owner: "Jordan", name: "Tyler Warren", value: 3, position: "TE", playerKey: "espn-4431459" },
  { year: 2026, owner: "Jordan", name: "Caleb Williams", value: 36, position: "QB", playerKey: "espn-4431611" },
  { year: 2026, owner: "Marc", name: "Chase Brown", value: 7, position: "RB", playerKey: "espn-4362238" },
  { year: 2026, owner: "Marc", name: "Chris Olave", value: 4, position: "WR", playerKey: "espn-4361370" },
  { year: 2026, owner: "Marc", name: "Drake Maye", value: 30, position: "QB", playerKey: "espn-4431452" },
  { year: 2026, owner: "Mark", name: "Rashee Rice", value: 1, position: "WR", playerKey: "espn-4428331" },
  { year: 2026, owner: "Mark", name: "Bijan Robinson", value: 61, position: "RB", playerKey: "espn-4430807" },
  { year: 2026, owner: "Mark", name: "Brock Bowers", value: 2, position: "TE", playerKey: "espn-4432665" },
  { year: 2026, owner: "Matt", name: "Jayden Daniels", value: 33, position: "QB", playerKey: "espn-4426348" },
  { year: 2026, owner: "Matt", name: "Rome Odunze", value: 9, position: "WR", playerKey: "espn-4431299" },
  { year: 2026, owner: "Matt", name: "Brian Thomas Jr.", value: 7, position: "WR", playerKey: "espn-4432773" },
  { year: 2026, owner: "Nate B.", name: "Kyren Williams", value: 1, position: "RB", playerKey: "espn-4430737" },
  { year: 2026, owner: "Nate B.", name: "Travis Etienne Jr.", value: 2, position: "RB", playerKey: "espn-4239996" },
  { year: 2026, owner: "Nate B.", name: "Brock Purdy", value: 8, position: "QB", playerKey: "espn-4361741" },
  { year: 2026, owner: "Nate S.", name: "Jaxon Smith-Njigba", value: 9, position: "WR", playerKey: "espn-4430878" },
  { year: 2026, owner: "Nate S.", name: "Puka Nacua", value: 22, position: "WR", playerKey: "espn-4426515" },
  { year: 2026, owner: "Nate S.", name: "Drake London", value: 4, position: "WR", playerKey: "espn-4426502" },
];
