import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import api, { setAccessToken, getAccessToken, refreshSession } from './client';

describe('api client', () => {
  let apiMock: MockAdapter;
  let axiosMock: MockAdapter;

  beforeEach(() => {
    setAccessToken(null);
    apiMock = new MockAdapter(api);
    axiosMock = new MockAdapter(axios);
  });

  afterEach(() => {
    apiMock.restore();
    axiosMock.restore();
    vi.restoreAllMocks();
  });

  it('attaches the access token as a Bearer header when set', async () => {
    setAccessToken('tok-1');
    apiMock.onGet('/api/urls').reply(200, { data: [] });
    await api.get('/urls');
    expect(apiMock.history.get[0].headers?.Authorization).toBe('Bearer tok-1');
  });

  it('sends no Authorization header when no token is set', async () => {
    apiMock.onGet('/api/urls').reply(200, { data: [] });
    await api.get('/urls');
    expect(apiMock.history.get[0].headers?.Authorization).toBeUndefined();
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    setAccessToken('stale');
    const handler = apiMock.onGet('/api/urls');
    handler.replyOnce(401);
    handler.reply(200, { data: { ok: true } });
    axiosMock.onPost('/api/auth/refresh').reply(200, { data: { accessToken: 'fresh' } });

    const res = await api.get('/urls');
    expect(res.data).toEqual({ data: { ok: true } });
    expect(axiosMock.history.post).toHaveLength(1);
    expect(getAccessToken()).toBe('fresh');
    expect(apiMock.history.get).toHaveLength(2);
    expect(apiMock.history.get[1].headers?.Authorization).toBe('Bearer fresh');
  });

  it('coalesces concurrent 401s into a single refresh call', async () => {
    setAccessToken('stale');
    const handler = apiMock.onGet('/api/urls');
    handler.replyOnce(401);
    handler.replyOnce(401);
    handler.reply(200, { data: { ok: true } });
    axiosMock.onPost('/api/auth/refresh').reply(200, { data: { accessToken: 'fresh' } });

    const [a, b] = await Promise.all([api.get('/urls'), api.get('/urls')]);
    expect(a.data).toEqual({ data: { ok: true } });
    expect(b.data).toEqual({ data: { ok: true } });
    expect(axiosMock.history.post).toHaveLength(1);
  });

  it('shares one refresh call between concurrent refreshSession callers', async () => {
    axiosMock
      .onPost('/api/auth/refresh')
      .reply(200, { data: { user: { id: 'u1' }, accessToken: 'fresh' } });
    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
    expect(a.accessToken).toBe('fresh');
    expect(b.accessToken).toBe('fresh');
    expect(axiosMock.history.post).toHaveLength(1);
  });

  it('clears the token and emits auth:unauthorized when refresh fails', async () => {
    setAccessToken('stale');
    apiMock.onGet('/api/urls').reply(401);
    axiosMock.onPost('/api/auth/refresh').reply(401, { success: false });
    const listener = vi.fn();
    window.addEventListener('auth:unauthorized', listener);

    await expect(api.get('/urls')).rejects.toMatchObject({ response: { status: 401 } });
    expect(getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:unauthorized', listener);
  });

  it('does not retry 401s from /auth/* endpoints', async () => {
    apiMock.onPost('/api/auth/login').reply(401, { success: false });
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(axiosMock.history.post).toHaveLength(0);
    expect(apiMock.history.post).toHaveLength(1);
  });

  it('does not refresh for non-401 errors', async () => {
    setAccessToken('tok-1');
    apiMock.onGet('/api/urls').reply(500, { success: false });
    await expect(api.get('/urls')).rejects.toMatchObject({ response: { status: 500 } });
    expect(axiosMock.history.post).toHaveLength(0);
    expect(getAccessToken()).toBe('tok-1');
  });
});
