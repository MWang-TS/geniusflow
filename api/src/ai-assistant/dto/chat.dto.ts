import { IsString, IsArray, IsOptional, ValidateNested, IsIn } from 'class-validator'
import { Type } from 'class-transformer'

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant'

  @IsString()
  content: string
}

export class ChatRequestDto {
  @IsString()
  message: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[]
}
