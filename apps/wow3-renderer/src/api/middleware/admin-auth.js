import jwt from 'jsonwebtoken';

/**
 * Sign a short-lived admin JWT.
 * @param {string} jwtSecret
 * @returns {string} signed token
 */
export function signAdminToken(jwtSecret) {
  return jwt.sign({ admin: true }, jwtSecret, { expiresIn: '8h' });
}

/**
 * Fastify preHandler that validates the admin_session httpOnly cookie.
 * @param {string} jwtSecret
 * @returns {import('fastify').preHandlerHookHandler}
 */
export function createAdminAuth(jwtSecret) {
  return async function adminAuth(request, reply) {
    const token = request.cookies?.admin_session;
    if (!token) {
      reply.code(401).send({ error: 'Not authenticated' });
      return;
    }
    try {
      jwt.verify(token, jwtSecret);
    } catch {
      reply.code(401).send({ error: 'Invalid or expired session' });
      return;
    }
  };
}
