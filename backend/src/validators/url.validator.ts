import { body, param } from 'express-validator';
import { ALIAS_REGEX, RESERVED_ALIASES } from '../config/constants';

// Creation requires the destination; updates may omit it (PATCH semantics).
function urlChain(required: boolean) {
  const chain = body('originalUrl');
  if (required) {
    chain.notEmpty().withMessage('originalUrl is required').bail();
  } else {
    chain.optional({ values: 'null' });
  }
  return chain
    .trim()
    .isURL({
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: true,
    })
    .withMessage('A valid http(s) URL is required');
}

const requiredUrl = urlChain(true);
const validUrl = urlChain(false);

const validAlias = body('customAlias')
  .optional({ values: 'null' })
  .trim()
  .matches(ALIAS_REGEX)
  .withMessage('Alias must be 3-32 characters: letters, numbers, dash or underscore')
  .bail()
  .custom((value) => {
    if (typeof value === 'string' && RESERVED_ALIASES.has(value.toLowerCase())) {
      throw new Error(`Alias "${value}" is reserved`);
    }
    return true;
  });

const validExpiresAt = body('expiresAt')
  .optional({ values: 'null' })
  .isISO8601()
  .withMessage('Expiry must be a valid date')
  .custom((value) => {
    if (value && new Date(value).getTime() <= Date.now()) {
      throw new Error('Expiry date must be in the future');
    }
    return true;
  });

const validMaxClicks = body('maxClicks')
  .optional({ values: 'null' })
  .isInt({ min: 1, max: 1_000_000 })
  .withMessage('maxClicks must be a positive integer');

const validId = param('id').isMongoId().withMessage('Invalid id format');

export const shortenUrlValidator = [requiredUrl, validAlias, validExpiresAt, validMaxClicks];

export const updateUrlValidator = [
  validId,
  validUrl,
  validAlias,
  validExpiresAt,
  validMaxClicks,
  body('isActive').optional({ values: 'null' }).isBoolean().withMessage('isActive must be a boolean'),
];

export const urlIdValidator = [validId];
