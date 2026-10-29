// One JSON-cloned IPC double for both process roles.
import { EventEmitter } from "node:events";
import { serializeIpcMessage } from "./chains-fakes.mjs";

export function fakeProcess(transform = (message) => message) {
  const child = new EventEmitter();
  const proc = new EventEmitter();
  let closed = false;
  let stop = async () => {};
  function finish(code, signal) {
    if (closed) return;
    closed = true;
    setImmediate(() => {
      child.emit("exit", code, signal);
      child.emit("close", code, signal);
    });
  }
  proc.send = (message, callback) => {
    if (closed) return;
    child.emit("message", serializeIpcMessage(transform(message)));
    if (typeof callback === "function") callback();
  };
  proc.exit = (code = 0) => finish(code, null);
  child.send = (message) => {
    if (closed) return;
    const cloned = serializeIpcMessage(message);
    setImmediate(() => proc.emit("message", cloned));
  };
  child.kill = (signal = "SIGKILL") => {
    if (closed) return;
    Promise.resolve(stop()).then(
      () => finish(null, signal),
      (error) => { child.emit("error", error); finish(1, signal); },
    );
  };
  return { child, proc, setStop: (handler) => { stop = handler; } };
}
