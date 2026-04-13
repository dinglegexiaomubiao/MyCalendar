import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const holidays2026 = [
  { date: "2026-01-01", name: "元旦", type: "holiday", year: 2026 },
  { date: "2026-01-02", name: "元旦", type: "holiday", year: 2026 },
  { date: "2026-01-03", name: "元旦", type: "holiday", year: 2026 },
  { date: "2026-02-15", name: "春节", type: "holiday", year: 2026 },
  { date: "2026-02-16", name: "春节", type: "holiday", year: 2026 },
  { date: "2026-02-17", name: "春节", type: "holiday", year: 2026 },
  { date: "2026-02-18", name: "春节", type: "holiday", year: 2026 },
  { date: "2026-02-19", name: "春节", type: "holiday", year: 2026 },
  { date: "2026-02-20", name: "春节", type: "holiday", year: 2026 },
  { date: "2026-02-21", name: "春节", type: "holiday", year: 2026 },
  { date: "2026-02-22", name: "春节", type: "holiday", year: 2026 },
  { date: "2026-02-23", name: "春节", type: "holiday", year: 2026 },
  { date: "2026-04-04", name: "清明节", type: "holiday", year: 2026 },
  { date: "2026-04-05", name: "清明节", type: "holiday", year: 2026 },
  { date: "2026-04-06", name: "清明节", type: "holiday", year: 2026 },
  { date: "2026-05-01", name: "劳动节", type: "holiday", year: 2026 },
  { date: "2026-05-02", name: "劳动节", type: "holiday", year: 2026 },
  { date: "2026-05-03", name: "劳动节", type: "holiday", year: 2026 },
  { date: "2026-05-04", name: "劳动节", type: "holiday", year: 2026 },
  { date: "2026-05-05", name: "劳动节", type: "holiday", year: 2026 },
  { date: "2026-06-19", name: "端午节", type: "holiday", year: 2026 },
  { date: "2026-06-20", name: "端午节", type: "holiday", year: 2026 },
  { date: "2026-06-21", name: "端午节", type: "holiday", year: 2026 },
  { date: "2026-09-25", name: "中秋节", type: "holiday", year: 2026 },
  { date: "2026-09-26", name: "中秋节", type: "holiday", year: 2026 },
  { date: "2026-09-27", name: "中秋节", type: "holiday", year: 2026 },
  { date: "2026-10-01", name: "国庆节", type: "holiday", year: 2026 },
  { date: "2026-10-02", name: "国庆节", type: "holiday", year: 2026 },
  { date: "2026-10-03", name: "国庆节", type: "holiday", year: 2026 },
  { date: "2026-10-04", name: "国庆节", type: "holiday", year: 2026 },
  { date: "2026-10-05", name: "国庆节", type: "holiday", year: 2026 },
  { date: "2026-10-06", name: "国庆节", type: "holiday", year: 2026 },
  { date: "2026-10-07", name: "国庆节", type: "holiday", year: 2026 },
];

const workdays2026 = [
  { date: "2026-01-04", name: "元旦调休", type: "workday_makeup", year: 2026 },
  { date: "2026-02-14", name: "春节调休", type: "workday_makeup", year: 2026 },
  { date: "2026-02-28", name: "春节调休", type: "workday_makeup", year: 2026 },
  { date: "2026-05-09", name: "劳动节调休", type: "workday_makeup", year: 2026 },
  { date: "2026-09-20", name: "国庆调休", type: "workday_makeup", year: 2026 },
  { date: "2026-10-10", name: "国庆调休", type: "workday_makeup", year: 2026 },
];

async function main() {
  for (const h of [...holidays2026, ...workdays2026]) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: h,
      create: h,
    });
  }

  console.log("✅ 2026 holidays seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
