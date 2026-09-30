import assert from "node:assert/strict";
import process from "node:process";

// Drives the example service by issuing requests against each route handler. The service establishes a
// per-request context scope and emits the five demonstrated audit events to the example receiver.

export async function runEvaluationDriver(serviceOrigin: string = "http://127.0.0.1:3001") {
  console.log(`driver:starting ${serviceOrigin}`);

  // 1. Authentication failure
  const failRes = await fetch(`${serviceOrigin}/api/v1/auth/login-failure`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "invalid-user", credential: "fixture-credential-invalid" }),
  });
  assert.equal(failRes.status, 401, "login failure route must answer 401");
  console.log("driver:request:auth.login.failure:pass");

  // 2. Authentication success
  const successRes = await fetch(`${serviceOrigin}/api/v1/auth/login-success`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "eval-user", credential: "fixture-credential-valid" }),
  });
  assert.equal(successRes.status, 200, "login success route must answer 200");
  console.log("driver:request:auth.login.success:pass");

  // 3. Allowed read: sensitive resource view
  const viewRes = await fetch(`${serviceOrigin}/api/v1/records/record-eval-view-1`, {
    method: "GET",
  });
  assert.equal(viewRes.status, 200, "sensitive resource view route must answer 200");
  console.log("driver:request:sensitive_resource.viewed:pass");

  // 4. Denied action: authorization denial
  const denyRes = await fetch(`${serviceOrigin}/api/v1/actions/denied`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "evaluate_authorization" }),
  });
  assert.equal(denyRes.status, 403, "denied action route must answer 403");
  console.log("driver:request:authorization.denied:pass");

  // 5. Sensitive resource modification with committed operation handle
  const modifyRes = await fetch(`${serviceOrigin}/api/v1/records/record-eval-modify-1`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "update", metadata: { updated: true } }),
  });
  assert.equal(modifyRes.status, 200, "sensitive resource modify route must answer 200");
  console.log("driver:request:sensitive_resource.modified:pass");

  console.log("driver:completed");
}

const isMain =
  process.argv[1]?.endsWith("evaluation-driver.ts") || process.argv[1]?.endsWith("evaluation-driver.js");
if (isMain) {
  const serviceOrigin = process.argv[2] || process.env.SERVICE_ORIGIN || "http://127.0.0.1:3001";
  await runEvaluationDriver(serviceOrigin);
}
