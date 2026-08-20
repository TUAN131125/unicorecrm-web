import type { ReturnStatus } from "../model/return.types";
const TRANSITIONS: Record<ReturnStatus, readonly ReturnStatus[]> = { REQUESTED:["APPROVED","REJECTED"], APPROVED:["AWAITING_ITEM","RECEIVED"], AWAITING_ITEM:["RECEIVED"], RECEIVED:["RESOLVED"], RESOLVED:["CLOSED"], CLOSED:[], REJECTED:[] };
export const canTransitionReturn = (from:ReturnStatus,to:ReturnStatus)=>TRANSITIONS[from].includes(to);
export const getAllowedReturnTransitions = (state:ReturnStatus)=>TRANSITIONS[state];
