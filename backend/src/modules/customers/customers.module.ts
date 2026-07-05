import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Module, Injectable } from '@nestjs/common';
import { IsOptional, IsString, Length } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';

// STUB — see Module 8 (Customers/Patients) for the authoritative module.

class QuickAddCustomerDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  search(pharmacyId: string, term?: string) {
    return this.prisma.customer.findMany({
      where: {
        pharmacyId,
        isActive: true,
        ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { phone: { contains: term } }] } : {}),
      },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  create(pharmacyId: string, dto: QuickAddCustomerDto) {
    return this.prisma.customer.create({ data: { pharmacyId, name: dto.name, phone: dto.phone, email: dto.email } });
  }
}

const READ = ['super_admin', 'admin', 'pharmacist', 'cashier', 'accountant', 'auditor'] as const;
const WRITE = ['super_admin', 'admin', 'pharmacist', 'cashier'] as const;

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @Roles(...READ)
  async list(@CurrentUser() user: AuthenticatedUser, @Query('search') search?: string): Promise<ControllerResult<unknown>> {
    return { data: await this.service.search(user.pharmacyId, search), message: 'Customers fetched' };
  }

  @Post()
  @Roles(...WRITE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: QuickAddCustomerDto): Promise<ControllerResult<unknown>> {
    return { data: await this.service.create(user.pharmacyId, dto), message: 'Customer created' };
  }
}

@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
