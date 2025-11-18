// app/qa/bridge.ts
type ArriveCb = () => void;
let cb: ArriveCb | null = null;

export function onArrive(handler: ArriveCb) {
  cb = handler;
  return () => { if (cb === handler) cb = null; };
}

export function emitArrive() {
  if (cb) cb();
}
