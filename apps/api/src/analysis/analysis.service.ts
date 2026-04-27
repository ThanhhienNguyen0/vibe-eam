import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ImpactDirection = 'downstream' | 'upstream';

export type ImpactResult = {
  startKey: string;
  direction: ImpactDirection;
  maxDepth: number;
  visitedKeys: string[];
  relations: Array<{
    key: string;
    type: string;
    sourceKey: string;
    targetKey: string;
  }>;
};

@Injectable()
export class AnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async impact(params: {
    branchId: string;
    elementKey: string;
    direction: ImpactDirection;
    maxDepth: number;
  }): Promise<ImpactResult> {
    const start = await this.prisma.element.findUnique({
      where: { branchId_key: { branchId: params.branchId, key: params.elementKey } },
      select: { key: true },
    });
    if (!start) throw new NotFoundException('Start element not found in branch');

    const rels = await this.prisma.relation.findMany({
      where: { branchId: params.branchId },
      select: { key: true, type: true, sourceKey: true, targetKey: true },
    });

    const nextMap = new Map<string, string[]>();
    const edgeByPair = new Map<string, { key: string; type: string; sourceKey: string; targetKey: string }[]>();

    for (const r of rels) {
      const from = params.direction === 'downstream' ? r.sourceKey : r.targetKey;
      const to = params.direction === 'downstream' ? r.targetKey : r.sourceKey;

      const arr = nextMap.get(from) ?? [];
      arr.push(to);
      nextMap.set(from, arr);

      const pairKey = `${from}::${to}`;
      const edges = edgeByPair.get(pairKey) ?? [];
      edges.push({ key: r.key, type: r.type, sourceKey: r.sourceKey, targetKey: r.targetKey });
      edgeByPair.set(pairKey, edges);
    }

    const maxDepth = Math.max(1, Math.min(50, params.maxDepth));
    const visited = new Set<string>();
    const queue: Array<{ key: string; depth: number }> = [{ key: params.elementKey, depth: 0 }];
    visited.add(params.elementKey);

    while (queue.length) {
      const cur = queue.shift()!;
      if (cur.depth >= maxDepth) continue;
      const next = nextMap.get(cur.key) ?? [];
      for (const nk of next) {
        if (visited.has(nk)) continue;
        visited.add(nk);
        queue.push({ key: nk, depth: cur.depth + 1 });
      }
    }

    const visitedKeys = Array.from(visited);
    const visitedSet = new Set(visitedKeys);
    const usedEdges: ImpactResult['relations'] = [];

    for (const r of rels) {
      if (!visitedSet.has(r.sourceKey) || !visitedSet.has(r.targetKey)) continue;
      usedEdges.push(r);
    }

    return {
      startKey: params.elementKey,
      direction: params.direction,
      maxDepth,
      visitedKeys,
      relations: usedEdges,
    };
  }
}

