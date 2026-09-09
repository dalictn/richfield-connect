import { callFunction } from '../firebaseApi';
import type { DirectoryResponse, DirectorySearch } from '../types/directory';

/**
 * Member discovery.
 *
 * Firestore rules deny reading other users' documents, so this cannot be a
 * client-side query — the callable applies each member's field visibility
 * before anything leaves the server.
 */
export function searchDirectory(search: DirectorySearch): Promise<DirectoryResponse> {
  return callFunction<DirectorySearch, DirectoryResponse>('searchDirectory', {
    query: search.query?.trim() || undefined,
    role: search.role,
    skill: search.skill?.trim().toLowerCase() || undefined,
  });
}
