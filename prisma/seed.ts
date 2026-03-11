import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FORMS = [
  {
    key: "offerings",
    formId: "14",
    title: "Tool to prioritise your offerings",
    formUrl: "",
    sortOrder: 0,
  },
  {
    key: "sectors",
    formId: "15",
    title: "Tool to Prioritise and Target Clients for maximum ROI",
    formUrl: "",
    sortOrder: 1,
  },
  {
    key: "objectives",
    formId: "8",
    title: "How to Spotlight Your Objectives",
    formUrl: "",
    sortOrder: 2,
  },
  {
    key: "advantage",
    formId: "11",
    title: "How to create an Advantage",
    formUrl: "",
    sortOrder: 3,
  },
  {
    key: "market",
    formId: "16",
    title: "Tool to determine your most effective route to market",
    formUrl: "",
    sortOrder: 4,
  },
  {
    key: "swot",
    formId: "12",
    title: "Business SWOT Analysis Questionnaire",
    formUrl: "",
    sortOrder: 5,
  },
  {
    key: "ratesCard",
    formId: "23",
    title: "Questionnaire to Calculate Labour Rates Card",
    formUrl: "",
    sortOrder: 6,
  },
  {
    key: "risks",
    formId: "39",
    title: "How to identify risks and plan to avoid them",
    formUrl: "",
    sortOrder: 7,
  },
  {
    key: "financial",
    formId: "25",
    title: "How to Forecast Your Financial Performance",
    formUrl: "",
    sortOrder: 8,
  },
  {
    key: "final",
    formId: "29",
    title: "Final Step - Reflections and Summary",
    formUrl: "",
    sortOrder: 9,
  },
];

async function main() {
  for (const form of FORMS) {
    await prisma.cognitoForm.upsert({
      where: { key: form.key },
      create: form,
      update: {
        formId: form.formId,
        title: form.title,
        sortOrder: form.sortOrder,
        // formUrl is intentionally not overwritten on update so admin changes are preserved
      },
    });
  }
  console.log(`Seeded ${FORMS.length} CognitoForm records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
