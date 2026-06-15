import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      // Express 5 recomputes req.query from the URL on every access, so
      // mutating the returned object silently discards zod's coercions
      // (e.g. perPage stayed a string and reached SQL as LIMIT '5').
      // Shadow the prototype getter with an own property that holds the
      // validated, typed values — unknown keys are preserved.
      Object.defineProperty(req, "query", {
        value: { ...req.query, ...parsed },
        writable: true,
        enumerable: true,
        configurable: true,
      });
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.params);
      Object.keys(parsed).forEach((key) => {
        (req.params as Record<string, any>)[key] = parsed[key];
      });
      next();
    } catch (err) {
      next(err);
    }
  };
}
