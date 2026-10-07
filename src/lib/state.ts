import type { OwnedCard, Owner, Transaction, WelcomeOffer } from "./domain";
import { initialCards } from "./rules";
import { getPeriod, singaporeDate } from "./periods";

export interface Goal {
  id: string;
  name: string;
  destination: string;
  targetMiles: number;
  targetDate?: string;
}
export interface AppState {
  schemaVersion: 1;
  cards: OwnedCard[];
  transactions: Transaction[];
  offers: WelcomeOffer[];
  goals: Goal[];
  mileBalance: number;
  mileValueSgd: number;
}
export const today = () => singaporeDate(new Date());
export function emptyState(): AppState {
  return {
    schemaVersion: 1,
    cards: initialCards(),
    transactions: [],
    offers: [],
    goals: [
      {
        id: "new-zealand",
        name: "New Zealand Honeymoon",
        destination: "New Zealand",
        targetMiles: 240000,
      },
    ],
    mileBalance: 0,
    mileValueSgd: 0.015,
  };
}
export function demoState(): AppState {
  const date = today();
  const cards = initialCards().map((card) => ({
    ...card,
    status: ["citi-rewards", "hsbc-revolution", "trust-freedom"].includes(
      card.templateId,
    )
      ? ("active" as const)
      : ("inactive" as const),
    usageKnown: true,
    statementDay: 15,
    openingPeriodStart: getPeriod(
      date,
      card.templateId === "citi-rewards" ? "statement-month" : "calendar-month",
      15,
    )!.start,
    openingSpendSgd:
      card.templateId === "citi-rewards"
        ? 388
        : card.templateId === "hsbc-revolution"
          ? 816
          : 0,
  }));
  cards.push({
    id: "nurul-citi",
    templateId: "citi-rewards",
    owner: "Nurul",
    status: "active",
    usageKnown: true,
    statementDay: 15,
    openingPeriodStart: getPeriod(date, "statement-month", 15)!.start,
    openingSpendSgd: 220,
  });
  const trust = cards.find((card) => card.templateId === "trust-freedom");
  const deadline = new Date(`${date}T00:00:00Z`);
  deadline.setUTCDate(deadline.getUTCDate() + 13);
  return {
    ...emptyState(),
    cards,
    mileBalance: 152430,
    offers: trust
      ? [
          {
            id: "sample-welcome",
            cardId: trust.id,
            name: "Sample welcome offer",
            startsOn: getPeriod(date, "calendar-month")!.start,
            deadline: deadline.toISOString().slice(0, 10),
            tiers: [
              { spendSgd: 1000, miles: 20000 },
              { spendSgd: 3000, miles: 30000 },
            ],
            openingSpendSgd: 760,
            plannedNaturalSpendSgd: 300,
            sourceUrl: "",
            verified: true,
            eligibilityConfirmed: true,
          },
        ]
      : [],
  };
}
export function formatMoney(amount: number, decimals = 0) {
  return `S$${amount.toLocaleString("en-SG", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
export function formatMiles(amount: number) {
  return Math.round(amount).toLocaleString("en-SG");
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Singapore",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}
export function makeId() {
  return crypto.randomUUID();
}
export function isOwner(value: unknown): value is Owner {
  return value === "Aleem" || value === "Nurul";
}
