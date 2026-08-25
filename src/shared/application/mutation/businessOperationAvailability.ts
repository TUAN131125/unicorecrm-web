/**
 * Availability of a local business operation in the active runtime.
 *
 * Some business operations have no authoritative backend contract yet. The connected
 * composition binds those ports to `connectedOperationUnavailable`, which fails closed —
 * but only once the port has already been called, which is too late for a UI that has
 * asked the user to confirm an action. Declaring the same operations here lets a module
 * boundary and its presentation refuse first, without either of them re-deriving runtime
 * mode for itself.
 *
 * The declaration is owned by the composition that creates the bindings, so the two can
 * never disagree: a connected binding is created through `unavailableConnectedOperation`,
 * which declares the operation at the moment it is bound. A demo composition declares
 * nothing, so every operation stays available and local demo behaviour is unchanged.
 */

const unavailableOperations = new Set<string>();

/** Declares one operation as non-authoritative in the active runtime. */
export function declareUnavailableBusinessOperation(operation: string): void {
  unavailableOperations.add(operation);
}

/** Clears the declaration. Composition calls this before it builds a new runtime. */
export function resetBusinessOperationAvailability(): void {
  unavailableOperations.clear();
}

/** True when the active runtime cannot perform this business operation authoritatively. */
export function isBusinessOperationUnavailable(operation: string): boolean {
  return unavailableOperations.has(operation);
}

/** Every operation the active runtime has declared non-authoritative. */
export function getUnavailableBusinessOperations(): readonly string[] {
  return [...unavailableOperations].sort();
}
