import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Response } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = '服务器内部错误'
    let code = 500001

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const res = exception.getResponse()
      if (typeof res === 'string') {
        message = res
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>
        message = (r.message as string) || message
      }

      switch (status) {
        case 400:
          code = 400001
          break
        case 401:
          code = 401001
          break
        case 403:
          code = 403001
          break
        case 404:
          code = 404001
          break
        case 409:
          code = 409001
          break
        case 422:
          code = 422001
          break
        case 429:
          code = 429001
          break
        default:
          code = 500001
      }
    }

    response.status(status).json({
      code,
      data: null,
      message,
    })
  }
}
