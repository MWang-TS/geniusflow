import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator'

export class WikiQueryDto {
  @IsString()
  question: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxPages?: number = 5
}
