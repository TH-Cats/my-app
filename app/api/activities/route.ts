import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || '1');
    const pageSize = 20;

    const activities = await prisma.activity.findMany({
      orderBy: { startTime: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        provider: true,
        providerId: true,
        type: true,
        startTime: true,
        durationSec: true,
        distanceM: true,
        elevationM: true,
        avgHr: true,
        avgCadence: true,
        caloriesKcal: true,
        temperatureC: true,
        excludeFromLearning: true,
      },
    });

    const total = await prisma.activity.count();

    return NextResponse.json({
      activities,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error('Failed to fetch activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
