import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name)

  constructor(private notificationsService: NotificationsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scanOverdueNodes() {
    this.logger.log('Scanning for overdue nodes...')
    try {
      const result = await this.notificationsService.scanOverdue()
      this.logger.log(`Overdue scan complete. Scanned ${result.scanned} nodes.`)
    } catch (error) {
      this.logger.error('Overdue scan failed', error)
    }
  }
}
