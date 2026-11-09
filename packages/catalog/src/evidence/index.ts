export type Grade = "A" | "B" | "C";

export type Source = {
  id: string;
  title: string;
  url: string;
  grade: Grade;
  year: number;
  /** Our own words. */
  summary: string;
};

// Ids match the prefixed lines in docs/research/sources.md.
export const sources: Source[] = [
  {
    id: "src-frandsen-2025-bjsm",
    title: "Running load spikes and injury (Frandsen 2025, BJSM blog)",
    url: "https://blogs.bmj.com/bjsm/?p=11751",
    grade: "B",
    year: 2025,
    summary: "Sudden jumps in running load are linked to more injuries than steady build-up.",
  },
  {
    id: "src-ioc-load-2016",
    title: "IOC consensus on load in sport and injury risk",
    url: "https://nih.brage.unit.no/nih-xmlui/handle/11250/2408720",
    grade: "A",
    year: 2016,
    summary:
      "Training load is a key injury lever. Rapid rises hurt, steady well-tolerated loading protects.",
  },
  {
    id: "src-issn-protein-2017",
    title: "ISSN position stand: protein and exercise",
    url: "https://cdr.lib.unc.edu/concern/articles/gh93h184p",
    grade: "A",
    year: 2017,
    summary:
      "Most active people do well on roughly 1.4 to 2.0 g of protein per kg bodyweight daily.",
  },
  {
    id: "src-energy-surplus",
    title: "Size of the energy surplus for muscle gain (Examine FAQ)",
    url: "https://examine.com/faq/should-the-magnitude-of-the-energy-surplus-depend-on-the-training-status-of-the-individual",
    grade: "C",
    year: 2024,
    summary:
      "A modest surplus of about 10 to 20 percent gains muscle with less fat than a big one.",
  },
  {
    id: "src-mifflin-1990",
    title: "Mifflin-St Jeor resting energy equation (AJCN)",
    url: "https://doi.org/10.1093/ajcn/51.2.241",
    grade: "A",
    year: 1990,
    summary:
      "Predicts resting energy use from weight, height, age and sex, good enough as a start.",
  },
  {
    id: "src-who-2020",
    title: "WHO 2020 physical activity guidelines",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/",
    grade: "A",
    year: 2020,
    summary:
      "Adults: 150 to 300 minutes of moderate activity a week plus strength work on two or more days.",
  },
  {
    id: "src-acsm-2026",
    title: "ACSM 2026 resistance training position stand (news summary)",
    url: "https://www.medicalnewstoday.com/amp/articles/new-resistance-training-guidelines-debunk-myths-stronger-muscles-strength-size",
    grade: "B",
    year: 2026,
    summary:
      "Many loads and rep ranges build strength and size if sets are taken close to hard effort.",
  },
  {
    id: "src-jospt-ankle-2021",
    title: "JOSPT ankle sprain clinical practice guideline",
    url: "https://www.orthopt.org/uploads/content_files/files/jospt.2021.0302.pdf",
    grade: "A",
    year: 2021,
    summary:
      "Early guided loading, balance and strength work beat prolonged rest after an ankle sprain.",
  },
  {
    id: "src-pedro-2024",
    title: "PEDro physiotherapy evidence database statistics",
    url: "https://pedro.org.au/english/pedro-statistics-2024/",
    grade: "B",
    year: 2024,
    summary:
      "A large index of rated physio trials, useful to check how strong a claim has evidence.",
  },
];

const byId = new Map(sources.map((s) => [s.id, s]));
export const getSource = (id: string) => byId.get(id);
