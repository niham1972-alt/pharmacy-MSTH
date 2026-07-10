import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { UsersService } from './users.service';
import { AssignRoleDto, GrantBranchAccessDto, GrantOverrideDto, InviteUserDto, SetPasswordDto, UpdateUserDto } from './dto/users.dto';

const MANAGE = ['super_admin', 'admin'] as const;

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // --- Self-service (any authenticated user), declared before :id ----------
  @Get('me')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<ControllerResult<unknown>> {
    return { data: await this.users.me(user), message: 'Current user fetched' };
  }

  @Post('login-event')
  @Roles('super_admin', 'admin', 'pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor')
  async loginEvent(@CurrentUser() user: AuthenticatedUser, @Req() req: { headers: Record<string, string>; ip?: string }): Promise<ControllerResult<unknown>> {
    return { data: await this.users.recordLogin(user, { ipAddress: req.ip, userAgent: req.headers['user-agent'] }), message: 'Login recorded' };
  }

  @Get('permission-matrix')
  @Roles('super_admin')
  async matrix(): Promise<ControllerResult<unknown>> {
    return { data: this.users.permissionMatrix(), message: 'Permission matrix fetched' };
  }

  // --- Admin user management -----------------------------------------------
  @Get()
  @Roles(...MANAGE)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string>): Promise<ControllerResult<unknown>> {
    const r = await this.users.list(user, q);
    return { data: r.data, message: 'Users fetched', meta: { page: r.page, limit: r.limit, total: r.total, totalPages: r.totalPages } };
  }

  @Post('invite')
  @Roles(...MANAGE)
  async invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteUserDto): Promise<ControllerResult<unknown>> {
    return { data: await this.users.invite(user, dto), message: 'User invited' };
  }

  @Get(':id')
  @Roles(...MANAGE)
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.users.detail(user, id), message: 'User fetched' };
  }

  @Put(':id')
  @Roles(...MANAGE)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserDto): Promise<ControllerResult<unknown>> {
    return { data: await this.users.update(user, id, dto), message: 'User updated' };
  }

  @Post(':id/set-password')
  @Roles(...MANAGE)
  async setPassword(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetPasswordDto): Promise<ControllerResult<unknown>> {
    return { data: await this.users.setPassword(user, id, dto.password), message: 'Password set' };
  }

  @Post(':id/roles')
  @Roles(...MANAGE)
  async assignRole(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignRoleDto): Promise<ControllerResult<unknown>> {
    return { data: await this.users.assignRole(user, id, dto), message: 'Role assigned' };
  }

  @Delete(':id/roles/:role')
  @Roles(...MANAGE)
  async removeRole(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('role') role: string): Promise<ControllerResult<unknown>> {
    return { data: await this.users.removeRole(user, id, role), message: 'Role removed' };
  }

  @Post(':id/branch-access')
  @Roles(...MANAGE)
  async grantBranch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: GrantBranchAccessDto): Promise<ControllerResult<unknown>> {
    return { data: await this.users.grantBranch(user, id, dto), message: 'Branch access granted' };
  }

  @Delete(':id/branch-access/:branchId')
  @Roles(...MANAGE)
  async revokeBranch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('branchId') branchId: string): Promise<ControllerResult<unknown>> {
    return { data: await this.users.revokeBranch(user, id, branchId), message: 'Branch access revoked' };
  }

  @Post(':id/suspend')
  @Roles(...MANAGE)
  async suspend(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.users.suspend(user, id), message: 'User suspended' };
  }

  @Post(':id/reactivate')
  @Roles(...MANAGE)
  async reactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.users.reactivate(user, id), message: 'User reactivated' };
  }

  @Post(':id/deactivate')
  @Roles(...MANAGE)
  async deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.users.deactivate(user, id), message: 'User deactivated' };
  }

  @Post(':id/revoke-sessions')
  @Roles(...MANAGE)
  async revokeSessions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.users.revokeSessions(user, id), message: 'Sessions revoked' };
  }

  @Get(':id/login-activity')
  @Roles(...MANAGE)
  async loginActivity(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ControllerResult<unknown>> {
    return { data: await this.users.loginActivity(user, id), message: 'Login activity fetched' };
  }

  @Post(':id/permission-overrides')
  @Roles(...MANAGE)
  async grantOverride(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: GrantOverrideDto): Promise<ControllerResult<unknown>> {
    return { data: await this.users.grantOverride(user, id, dto), message: 'Override granted' };
  }

  @Delete(':id/permission-overrides/:key')
  @Roles(...MANAGE)
  async removeOverride(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('key') key: string): Promise<ControllerResult<unknown>> {
    return { data: await this.users.removeOverride(user, id, key), message: 'Override removed' };
  }
}
