import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { BranchesModule } from './branches/branches.module';
import { ElementsModule } from './elements/elements.module';
import { RelationsModule } from './relations/relations.module';
import { AnalysisModule } from './analysis/analysis.module';
import { IoModule } from './io/io.module';
import { DiagramsModule } from './diagrams/diagrams.module';

@Module({
  imports: [
    PrismaModule,
    BranchesModule,
    DiagramsModule,
    ElementsModule,
    RelationsModule,
    AnalysisModule,
    IoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
