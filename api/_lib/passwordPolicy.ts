/** Re-export shared password policy for Vercel API handlers (keeps imports inside api/). */
export { getPasswordPolicyError, evaluatePasswordRules, PASSWORD_MIN_LENGTH } from '../../shared/passwordPolicy';
