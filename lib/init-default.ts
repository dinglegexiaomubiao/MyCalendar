import { prisma } from "./prisma";

export async function ensureDefaultCouple(): Promise<{
  coupleId: string;
  schedule: {
    raoBaseDate: string;
    raoBaseCycleDay: number;
    raoCycleLength: number;
    raoDayShiftDays: number;
    raoNightShiftDays: number;
    raoRestDays: number;
    liRestType: "weekend_and_holiday" | "weekend_only";
  };
}> {
  let couple = await prisma.couple.findFirst({
    include: { schedule: true },
  });

  if (!couple) {
    couple = await prisma.couple.create({
      data: {
        schedule: {
          create: {
            raoBaseDate: "2026-04-08",
            raoBaseCycleDay: 7,
            raoCycleLength: 9,
            raoDayShiftDays: 4,
            raoNightShiftDays: 3,
            raoRestDays: 2,
            liRestType: "weekend_and_holiday",
          },
        },
      },
      include: { schedule: true },
    });
  }

  if (!couple.schedule) {
    throw new Error("Couple exists but schedule is missing");
  }

  return {
    coupleId: couple.id,
    schedule: couple.schedule as unknown as {
      raoBaseDate: string;
      raoBaseCycleDay: number;
      raoCycleLength: number;
      raoDayShiftDays: number;
      raoNightShiftDays: number;
      raoRestDays: number;
      liRestType: "weekend_and_holiday" | "weekend_only";
    },
  };
}
