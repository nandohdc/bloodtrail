import { sha256 } from "./io.mjs";

function diagnostic(error) {
  return Object.fromEntries(["code", "category", "path"].filter((key) => error[key] !== undefined).map((key) => [key, error[key]]));
}

export function returned({ raw, refusalExpected = false }) {
  const accepted = !(raw && raw.ok === false);
  const observation = { kind: "returned", raw, accepted, unexpected_acceptance: refusalExpected && accepted };
  if (!accepted) observation.diagnostic = diagnostic(raw.error);
  return observation;
}

export function thrown({ error }) {
  return { kind: "thrown", accepted: false, raw: { name: error.name, message: error.message, ...diagnostic(error) }, diagnostic: diagnostic(error) };
}

export function callRecorder({ ledger }) {
  const outcomes = [];
  return {
    call({ label, invoke, refusalExpected = false }) {
      ledger.take(label);
      const record = (observation) => {
        outcomes.push({ label, ...observation });
        attributeBudgetFault({ ledger, observation: outcomes.at(-1) });
      };
      const success = (value) => {
        record(returned({ raw: value, refusalExpected }));
        return { passed: !(value && value.ok === false), value };
      };
      const failure = (error) => {
        record(thrown({ error }));
        return { passed: false };
      };
      let value;
      try {
        value = invoke();
      } catch (error) {
        return failure(error);
      }
      return value instanceof Promise ? value.then(success, failure) : success(value);
    },
    outcomes,
  };
}

function attributeBudgetFault({ ledger, observation }) {
  if (ledger.report().exhausted) {
    observation.attribution = "harness_fault";
    delete observation.diagnostic;
    ledger.assertAvailable();
  }
}

export function readCapturingSink({ sink }) {
  return { boundary: "capturing_sink", events: [...sink.events] };
}

export function recordingExchange({ exchange }) {
  const attempts = [];
  return {
    attempts,
    async exchange(request) {
      const bytes = Buffer.from(request.body);
      const attempt = { attempt: attempts.length + 1, body_sha256: sha256(bytes), body_bytes: bytes.length };
      attempts.push(attempt);
      try {
        const raw = await exchange(request);
        attempt.outcome = returned({ raw });
        return raw;
      } catch (error) {
        attempt.outcome = thrown({ error });
        throw error;
      }
    },
  };
}
