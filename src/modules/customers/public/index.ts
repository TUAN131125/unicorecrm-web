export * from "./api";

export type {
  CustomerDisplay,
  CustomerProductOwned,
} from "../presentation/model/customerDisplay.types";

export {
  getCustomerPresentationSnapshot,
  getCustomerPresentationRecordSnapshot,
  projectCustomerForPresentation,
} from "../presentation/model/customerPresentation";

export { subscribeToCustomerPresentation } from "../presentation/customerPresentationRuntime";

export {
  getOwnedProductDisplay,
  getPurchasedProductsForContact,
} from "../presentation/customerPresentationHelpers";

export {
  buildCustomer360ReadModel,
  resolveCustomerIdentity,
} from "../presentation/model/customer360ReadModel";

export type {
  Customer360ReadModel,
  CustomerTimelineItem,
} from "../presentation/model/customer360ReadModel";

export { buildCustomerRelationshipAssessment } from "../presentation/model/customerOverviewAssessment";

export type {
  CustomerRelationshipAssessment,
  CustomerAssessmentSignal,
  CustomerRecommendedAction,
} from "../presentation/model/customerOverviewAssessment";

export { getCustomerDisplayName, getCustomerInitial, getCustomerSecondaryInfo } from "../presentation/model/customerDisplay.helpers";
