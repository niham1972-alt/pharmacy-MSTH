import { IsString, Length } from 'class-validator';

export class RejectExpenseDto {
  @IsString()
  @Length(3, 500)
  rejectedReason!: string;
}
