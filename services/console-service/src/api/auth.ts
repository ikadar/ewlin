/**
 * Helpers for extracting the JWT from incoming requests.
 *
 * The console-service does NOT validate the JWT itself — it forwards it
 * to the PHP API verbatim, which has the public key and the canonical
 * permission system. The console-service trusts the PHP API to reject
 * any request that doesn't have the right permissions.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';

export function extractJwt(req: FastifyRequest): string | null {
  const header = req.headers['authorization'];
  if (typeof header !== 'string') return null;
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}

export function requireJwt(req: FastifyRequest, reply: FastifyReply): string | null {
  const jwt = extractJwt(req);
  if (!jwt) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization: Bearer <jwt> header',
    });
    return null;
  }
  return jwt;
}
