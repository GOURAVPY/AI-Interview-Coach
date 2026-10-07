import { Interview } from '../models/Interview.js';
import { VISITOR_COOKIE } from '../middleware/visitor.js';

// When a demo visitor signs up or logs in, their demo interviews move into their account.
export async function claimDemoInterviews(req, userId) {
  const vid = req.cookies?.[VISITOR_COOKIE];
  if (!/^[a-f0-9]{32}$/.test(vid ?? '')) return 0;

  const res = await Interview.updateMany(
    { visitor: vid, user: { $exists: false } },
    { $set: { user: userId }, $unset: { visitor: '' } },
  );
  return res.modifiedCount;
}
