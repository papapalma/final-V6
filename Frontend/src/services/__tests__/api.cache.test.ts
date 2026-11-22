import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, apiClient } from '../api';

describe('ApiService secure GET cache & in-flight deduplication', () => {
  beforeEach(() => {
    sessionStorage.clear();
    api.clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    api.clearCache();
    sessionStorage.clear();
  });

  it('caches GET responses for 15s and clones payloads so caller mutations cannot poison the cache', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: [{ id: '1', name: 'Original' }] },
    } as any);

    const first = await api.get('/programs');
    expect(getSpy).toHaveBeenCalledTimes(1);
    // Mutate returned array in place
    first.data.push({ id: '999', name: 'Mutated' });
    first.data[0].name = 'Tampered';

    const second = await api.get('/programs');
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(second.data).toEqual([{ id: '1', name: 'Original' }]);
  });

  it('deduplicates concurrent identical GET requests into a single network call', async () => {
    let resolveReq!: (val: any) => void;
    const pending = new Promise((resolve) => {
      resolveReq = resolve;
    });
    const getSpy = vi.spyOn(apiClient, 'get').mockReturnValue(pending as any);

    const p1 = api.get('/items', { category: 'tools' });
    const p2 = api.get('/items', { category: 'tools' });

    resolveReq({ data: { success: true, data: [{ id: 'i1' }] } });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(r1.data).toEqual([{ id: 'i1' }]);
    expect(r2.data).toEqual([{ id: 'i1' }]);
  });

  it('invalidates cached GET entries immediately on any write (POST/PUT/PATCH/DELETE)', async () => {
    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: { success: true, data: ['v1'] } } as any)
      .mockResolvedValueOnce({ data: { success: true, data: ['v2'] } } as any);
    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, data: { ok: true } } } as any);

    const before = await api.get('/programs');
    expect(before.data).toEqual(['v1']);

    await api.post('/programs', { name: 'New' });

    const after = await api.get('/programs');
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(after.data).toEqual(['v2']);
  });

  it('never caches sensitive endpoints (/auth/, /messages, /notifications)', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: {} },
    } as any);

    await api.get('/auth/me');
    await api.get('/auth/me');
    await api.get('/messages/conversations');
    await api.get('/messages/conversations');
    await api.get('/notifications');
    await api.get('/notifications');

    expect(getSpy).toHaveBeenCalledTimes(6);
  });

  it('isolates cache across session/token changes so a new user/tenant never reads stale data', async () => {
    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: { success: true, data: ['tenant-A'] } } as any)
      .mockResolvedValueOnce({ data: { success: true, data: ['tenant-B'] } } as any);

    sessionStorage.setItem('bmdc-auth-token', 'enc:v1:token-tenant-a');
    const a = await api.get('/trainees');
    expect(a.data).toEqual(['tenant-A']);

    // Simulate switching account/tenant token
    sessionStorage.setItem('bmdc-auth-token', 'enc:v1:token-tenant-b');
    const b = await api.get('/trainees');
    expect(b.data).toEqual(['tenant-B']);
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('bypasses cache on X-Skip-Cache and strips the internal header before sending', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: ['fresh'] },
    } as any);

    await api.get('/programs');
    await api.get('/programs', undefined, { headers: { 'X-Skip-Cache': 'true' } });

    expect(getSpy).toHaveBeenCalledTimes(2);
    const secondCallConfig = getSpy.mock.calls[1][1] as any;
    expect(secondCallConfig?.headers?.['X-Skip-Cache']).toBeUndefined();
  });
});
