import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SchedulerService } from './scheduler.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [ScheduleModule.forRoot(), NotificationsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
