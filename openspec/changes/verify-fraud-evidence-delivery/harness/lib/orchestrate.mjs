import { approvalFromArgs, claimOnce } from "./approval.mjs";
import { sessionPreflight } from "./preflight.mjs";
import { assertRuntimePrerequisites } from "./runtime-facts.mjs";

// One approval covers exactly one execution: the approval is checked and the once-marker claimed before
// anything runs. A failure after the claim still writes results (the run is spent); a failure before it
// refuses without spending the approval.
export async function runApprovedSession({ options, entrypoint, session, failure, refuse, now, probe, ticket, runtimeCheck = assertRuntimePrerequisites }) {
  let claimed = false;
  let approval;
  try {
    const checked = approvalFromArgs({ options, now, probe, ticket });
    const { hashes, onceMarker } = sessionPreflight({ options, approval: checked, entrypoint, runtimeCheck });
    approval = { ...checked, once_marker: onceMarker };
    claimOnce({ path: options["once-marker"], approvedHead: options.approvedHead, bodySha256: checked.body_sha256, windowOpenedAt: checked.window_opened_at });
    claimed = true;
    return await session(approval, hashes);
  } catch (error) {
    if (claimed) await failure({ error, approval });
    else refuse(error.message);
    return { exitCode: 1 };
  }
}
