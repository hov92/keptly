import { getActiveHousehold } from './households';

export type HouseholdRole = 'owner' | 'member' | 'child';

export type HouseholdPermissions = {
  role: HouseholdRole | null;
  canInviteMembers: boolean;
  canSwitchHouseholds: boolean;
  canManageProviders: boolean;
  canManageServiceRecords: boolean;
  canEditHousehold: boolean;
};

export async function getActiveHouseholdPermissions(): Promise<HouseholdPermissions> {
  const activeHousehold = await getActiveHousehold();
  const role = (activeHousehold?.role ?? null) as HouseholdRole | null;

  const isChild = role === 'child';
  const isOwner = role === 'owner';

  return {
    role,
    canInviteMembers: !isChild,
    canSwitchHouseholds: !isChild,
    canManageProviders: !isChild,
    canManageServiceRecords: !isChild,
    canEditHousehold: isOwner,
  };
}