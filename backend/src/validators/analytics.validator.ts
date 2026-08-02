import { param, query } from 'express-validator';

export const urlStatsValidator = [
  param('id').isMongoId().withMessage('Invalid id format'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be between 1 and 365'),
];
