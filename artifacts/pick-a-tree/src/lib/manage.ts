import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  getGetWorkspaceSummaryQueryKey, getListManagedFarmsQueryKey, getListManagedTreesQueryKey, getListPublicFarmsQueryKey, getListPublicTreesQueryKey,
} from '@workspace/api-client-react';
import { errorMessage, errorStatus } from '@/lib/brand';

export const MANAGER_ROLES = ['administrator', 'super-administrator', 'farm-manager'];

export function canManageFarms(roles?: string[] | null) {
  return !!roles?.some((r) => MANAGER_ROLES.includes(r.split(':')[0].trim().toLowerCase().replace(/_/g, '-')));
}

export async function invalidateCatalogue(qc: QueryClient, farmId?: string) {
  const publicTreePrefix = String(getListPublicTreesQueryKey()[0]);
  await Promise.all([
    qc.invalidateQueries({ queryKey: getListManagedFarmsQueryKey() }),
    farmId ? qc.invalidateQueries({ queryKey: getListManagedTreesQueryKey(farmId) }) : Promise.resolve(),
    qc.invalidateQueries({ queryKey: getListPublicFarmsQueryKey() }),
    qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith(publicTreePrefix) }),
    qc.invalidateQueries({ queryKey: getGetWorkspaceSummaryQueryKey() }),
  ]);
}

export function useInvalidateCatalogue() {
  const qc = useQueryClient();
  return (farmId?: string) => invalidateCatalogue(qc, farmId);
}

export function saveErrorText(err: unknown) {
  const s = errorStatus(err);
  if (s === 409) return 'Someone saved a newer version of this record while you were editing. Reload the latest version, then re-apply your change.';
  if (s === 403) return 'Your account is signed in but does not hold a farm-management role for this record. Ask a verified administrator to grant it.';
  if (s === 401) return 'Your session has ended. Sign in again with your mobile number, then retry.';
  if (s === 400 || s === 422) return `The server rejected some fields: ${errorMessage(err)}`;
  return errorMessage(err);
}

export const MAX_IMAGES = 12;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
