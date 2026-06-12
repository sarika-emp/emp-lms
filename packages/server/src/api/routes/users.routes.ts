// ============================================================================
// USERS ROUTES
// GET /users/search — org-scoped employee lookup for pickers (instructor,
// attendees). Reads the shared empcloud users table; excludes the caller.
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { getEmpCloudDB } from "../../db/empcloud";
import { sendSuccess } from "../../utils/response";

const router = Router();

router.use(authenticate);

// GET /users/search?q=&limit=20 — admin-only: its consumers (instructor and
// attendee pickers) are admin flows, and it exposes the org's email directory.
router.get(
  "/search",
  authorize("super_admin", "org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const callerId = req.user!.empcloudUserId;
    const q = String(req.query.q ?? "").trim();
    const limitRaw = Number(req.query.limit);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;
    // includeSelf=1 keeps the caller in results (e.g. assigning yourself
    // as a session instructor); pickers for "other people" omit it.
    const includeSelf = req.query.includeSelf === "1";

    const db = getEmpCloudDB();
    let query = db("users")
      .where({ organization_id: orgId, status: 1 })
      .select("id", "first_name", "last_name", "email", "designation")
      .orderBy("first_name", "asc")
      .limit(limit);

    if (!includeSelf) query = query.whereNot("id", callerId);

    if (q) {
      query = query.andWhere((qb) => {
        qb.where("first_name", "like", `%${q}%`)
          .orWhere("last_name", "like", `%${q}%`)
          .orWhere("email", "like", `%${q}%`);
      });
    }

    sendSuccess(res, await query);
  } catch (err) {
    next(err);
  }
  }
);

export { router as usersRoutes };
