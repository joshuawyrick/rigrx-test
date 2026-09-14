// Keep eligibility in the same statement as the open -> selected transition.
// Concurrent selections cannot replace the first successful choice.
const SELECT_PROVIDER = `UPDATE requests r
  SET status='selected', selected_provider=$1, selected_at=NOW()
  WHERE r.id=$2 AND r.driver_id=$3 AND r.status='open'
    AND EXISTS (
      SELECT 1 FROM purchases pu
      JOIN providers p ON p.user_id=pu.provider_id
      JOIN users u ON u.id=p.user_id
      WHERE pu.request_id=r.id AND pu.provider_id=$1
        AND pu.refunded=FALSE AND p.approved=TRUE AND u.archived_at IS NULL
    ) RETURNING r.*`;
module.exports = { SELECT_PROVIDER };
