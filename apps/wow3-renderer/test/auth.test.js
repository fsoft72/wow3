import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDb, insertApiKey } from '../src/api/db.js';
import { hashKey, createApiKeyAuth } from '../src/api/middleware/auth.js';
import { createAdminAuth, signAdminToken } from '../src/api/middleware/admin-auth.js';

function makeReqReply(headers = {}, cookies = {}) {
  const reply = {
    _code: 200,
    _body: null,
    code(n) { this._code = n; return this; },
    send(b) { this._body = b; return this; },
  };
  const request = { headers, cookies };
  return { request, reply };
}

describe('createApiKeyAuth', () => {
  let db, auth;

  beforeEach(() => {
    db = createDb(':memory:');
    insertApiKey(db, { id: 'k1', label: 'test', keyHash: hashKey('good-key') });
    auth = createApiKeyAuth(db);
  });

  it('calls reply.code(401) when X-API-Key header is missing', async () => {
    const { request, reply } = makeReqReply({});
    await auth(request, reply);
    expect(reply._code).toBe(401);
  });

  it('calls reply.code(401) when key is invalid', async () => {
    const { request, reply } = makeReqReply({ 'x-api-key': 'bad-key' });
    await auth(request, reply);
    expect(reply._code).toBe(401);
  });

  it('does not call reply.code when key is valid', async () => {
    const { request, reply } = makeReqReply({ 'x-api-key': 'good-key' });
    await auth(request, reply);
    expect(reply._code).toBe(200);
  });
});

describe('createAdminAuth', () => {
  const SECRET = 'test-secret-32-chars-xxxxxxxxxxxx';
  let auth;

  beforeEach(() => {
    auth = createAdminAuth(SECRET);
  });

  it('calls reply.code(401) when no cookie present', async () => {
    const { request, reply } = makeReqReply({}, {});
    await auth(request, reply);
    expect(reply._code).toBe(401);
  });

  it('calls reply.code(401) when token is invalid', async () => {
    const { request, reply } = makeReqReply({}, { admin_session: 'bad.token.here' });
    await auth(request, reply);
    expect(reply._code).toBe(401);
  });

  it('does not call reply.code when token is valid', async () => {
    const token = signAdminToken(SECRET);
    const { request, reply } = makeReqReply({}, { admin_session: token });
    await auth(request, reply);
    expect(reply._code).toBe(200);
  });
});
