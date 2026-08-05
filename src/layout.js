export function splitEvents(events, maxEventsPerSystem) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  if (!Number.isInteger(maxEventsPerSystem) || maxEventsPerSystem <= 0) {
    throw new RangeError('maxEventsPerSystem must be a positive integer');
  }

  const systems = [];
  for (let index = 0; index < events.length; index += maxEventsPerSystem) {
    systems.push(events.slice(index, index + maxEventsPerSystem));
  }
  return systems;
}
