import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { excludeFromLearning } = body;

    if (typeof excludeFromLearning !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid excludeFromLearning value' },
        { status: 400 }
      );
    }

    const updatedActivity = await prisma.activity.update({
      where: { id },
      data: { excludeFromLearning },
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

    return NextResponse.json(updatedActivity);
  } catch (error) {
    console.error('Failed to update activity:', error);
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    );
  }
}
